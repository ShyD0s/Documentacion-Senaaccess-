<?php

namespace App\Http\Controllers;

use App\Mail\TwoFactorCodeMail;
use App\Models\TwoFactorChallenge;
use App\Models\User;
use App\Services\NotificacionService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class TwoFactorController extends Controller
{
    // Ventana de validez del reto (el usuario va a otro dispositivo y aprueba).
    public const RETO_MINUTOS = 10;

    // Vigencia del código de 6 dígitos enviado por correo (fallback).
    public const CODIGO_MINUTOS = 10;

    /**
     * Crea un reto de segundo factor cuando el usuario tiene 2FA activado.
     * Es llamado desde AuthController@login: NO se emite token hasta que el
     * reto se resuelva (aprobado por otro dispositivo o código del correo).
     */
    public function iniciarReto(User $user, Request $request)
    {
        $codigo = (string) random_int(100000, 999999);

        $reto = TwoFactorChallenge::create([
            'challenge_id' => (string) Str::uuid(),
            'fk_id_usuario' => $user->id_usuario,
            'estado' => 'pendiente',
            'code_hash' => Hash::make($codigo),
            'code_expires_at' => Carbon::now()->addMinutes(self::CODIGO_MINUTOS),
            'expires_at' => Carbon::now()->addMinutes(self::RETO_MINUTOS),
            'ip' => $request->ip(),
            'user_agent' => Str::limit($request->userAgent() ?? 'desconocido', 255),
            'device_id' => $request->input('device_id'),
        ]);

        // Fallback: código de 6 dígitos al correo + botones "¿Eres tú?" tipo Google.
        // El envío no puede colgar el login.
        try {
            $base = rtrim(config('app.url'), '/');
            $firma = fn (string $dec) => hash_hmac('sha256', $reto->challenge_id . '|' . $dec, config('app.key'));
            $aprobarUrl = $base . '/api/2fa/decidir?challenge_id=' . $reto->challenge_id . '&dec=aprobar&sig=' . $firma('aprobar');
            $denegarUrl = $base . '/api/2fa/decidir?challenge_id=' . $reto->challenge_id . '&dec=denegar&sig=' . $firma('denegar');
            Mail::to($user->user_email)->send(new TwoFactorCodeMail(
                $codigo,
                $aprobarUrl,
                $denegarUrl,
                $reto->challenge_id,
                trim(($user->user_name ?? '') . ' ' . ($user->user_lastname ?? ''))
            ));
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Error enviando codigo 2FA a {$user->user_email}: " . $e->getMessage());
        }

        // Aviso in-app: el otro dispositivo (con sesión) lo ve y puede aprobar/denegar.
        try {
            app(NotificacionService::class)->crearParaUsuario(
                $user->id_usuario,
                'Intento de acceso detectado',
                'Alguien intentó iniciar sesión en tu cuenta ' . Str::limit($request->userAgent() ?? 'desconocido', 80) . '. Si eres tú, aprueba el acceso.',
                'seguridad'
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Error notificando 2FA: " . $e->getMessage());
        }

        return response()->json([
            'message' => 'Verificación en dos pasos requerida.',
            'two_factor_required' => true,
            'two_factor_id' => $reto->challenge_id,
            'two_factor_method' => 'in_app_or_email',
            'code_sent' => $reto->code_hash !== null,
        ], 200);
    }

    /**
     * Estado de la configuración de 2FA del usuario autenticado (perfil).
     */
    public function estadoConfig(Request $request)
    {
        return response()->json([
            'two_factor_enabled' => (bool) $request->user()->two_factor_enabled,
        ], 200);
    }

    /**
     * Activa la verificación en dos pasos para la cuenta autenticada.
     */
    public function activar(Request $request)
    {
        $user = $request->user();

        $user->forceFill(['two_factor_enabled' => true])->save();

        return response()->json(['message' => 'Verificación en dos pasos activada.', 'two_factor_enabled' => true], 200);
    }

    /**
     * Desactiva la verificación en dos pasos. Exige la contraseña actual
     * (es una acción sensible en la cuenta).
     */
    public function desactivar(Request $request)
    {
        $validated = $request->validate([
            'user_password' => 'required|string',
        ]);

        $user = $request->user();

        if (!Hash::check($validated['user_password'], $user->user_password)) {
            return response()->json(['message' => 'Contraseña incorrecta.'], 422);
        }

        $user->forceFill(['two_factor_enabled' => false])->save();

        // Invalida los retos pendientes: ya no deben aprobarse/validarse.
        TwoFactorChallenge::where('fk_id_usuario', $user->id_usuario)
            ->where('estado', 'pendiente')
            ->update(['estado' => 'rechazado', 'resolved_at' => Carbon::now()]);

        return response()->json(['message' => 'Verificación en dos pasos desactivada.', 'two_factor_enabled' => false], 200);
    }

    /**
     * Valida el código de 6 dígitos enviado por correo (fallback). Público:
     * el dispositivo en el intento de login aún no tiene sesión.
     */
    public function validarCodigo(Request $request)
    {
        $validated = $request->validate([
            'challenge_id' => 'required|string',
            'code' => 'required|string|size:6',
        ]);

        $reto = TwoFactorChallenge::where('challenge_id', $validated['challenge_id'])->first();

        if (!$reto || $reto->estado !== 'pendiente') {
            return response()->json(['message' => 'El intento de acceso ya fue resuelto o no existe.'], 400);
        }

        if ($reto->expires_at->isPast()) {
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now()]);
            return response()->json(['message' => 'El intento de acceso expiró. Vuelve a intentarlo.'], 400);
        }

        if (!$reto->code_hash || !$reto->code_expires_at || $reto->code_expires_at->isPast()) {
            return response()->json(['message' => 'El código ya expiró. Vuelve a iniciar sesión.'], 400);
        }

        if (!Hash::check($validated['code'], $reto->code_hash)) {
            return response()->json(['message' => 'Código incorrecto.'], 422);
        }

        return $this->resolverAprobado($reto);
    }

    /**
     * Devuelve el estado de un reto. Público: el dispositivo en intento de login
     * hace polling aquí mientras espera que el otro dispositivo apruebe/deniegue.
     * Solo cuando queda aprobado se fabrica y entrega el token de acceso.
     */
    public function estado(Request $request, string $challengeId)
    {
        $reto = TwoFactorChallenge::where('challenge_id', $challengeId)->first();

        if (!$reto) {
            return response()->json(['message' => 'El intento de acceso no existe.'], 404);
        }

        if ($reto->estado === 'pendiente' && $reto->expires_at->isPast()) {
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now()]);
        }

        if ($reto->estado === 'pendiente') {
            return response()->json(['two_factor_id' => $reto->challenge_id, 'estado' => 'pendiente']);
        }

        if ($reto->estado === 'rechazado') {
            return response()->json(['message' => 'El intento fue rechazado.', 'two_factor_id' => $reto->challenge_id, 'estado' => 'rechazado']);
        }

        if ($reto->estado === 'expirado') {
            return response()->json(['message' => 'El intento de acceso expiró.', 'two_factor_id' => $reto->challenge_id, 'estado' => 'expirado']);
        }

        // Aprobado: emitir (o reusar) el token y devolver el mismo LoginResponse que /api/login.
        return $this->respuestaLogin($reto);
    }

    /**
     * Retos pendientes del usuario autenticado: es lo que hace polling el
     * dispositivo con sesión para mostrar la tarjeta "¿Eres tú?".
     */
    public function pendientes(Request $request)
    {
        $reto = TwoFactorChallenge::where('fk_id_usuario', $request->user()->id_usuario)
            ->where('estado', 'pendiente')
            ->where('expires_at', '>', Carbon::now())
            ->orderByDesc('id')
            ->first();

        if (!$reto) {
            return response()->json(['pending' => false]);
        }

        return response()->json([
            'pending' => true,
            'challenge' => [
                'challenge_id' => $reto->challenge_id,
                'ip' => $reto->ip,
                'user_agent' => $reto->user_agent,
                'created_at' => $reto->created_at?->toIso8601String(),
                'expires_at' => $reto->expires_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * El usuario con sesión aprueba o deniega un reto de su propia cuenta.
     * Solo puede responder retos que pertenezcan a su usuario.
     */
    public function aprobar(Request $request)
    {
        $validated = $request->validate([
            'challenge_id' => 'required|string',
            'decision' => 'required|in:aprobar,denegar',
        ]);

        $reto = TwoFactorChallenge::where('challenge_id', $validated['challenge_id'])->first();

        if (!$reto || $reto->fk_id_usuario !== $request->user()->id_usuario) {
            return response()->json(['message' => 'Este intento de acceso no te pertenece.'], 403);
        }

        if ($reto->estado !== 'pendiente') {
            return response()->json(['message' => 'Este intento ya fue resuelto.'], 400);
        }

        if ($reto->expires_at->isPast()) {
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now()]);
            return response()->json(['message' => 'El intento de acceso ya expiró.'], 400);
        }

        $reto->update([
            'estado' => $validated['decision'] === 'aprobar' ? 'aprobado' : 'rechazado',
            'resolved_at' => Carbon::now(),
        ]);

        if ($validated['decision'] === 'denegar') {
            $this->notificarBloqueo($reto);
            return response()->json(['message' => 'Acceso denegado.'], 200);
        }

        // El dueño confirmó que es él: ese teléfono queda confiable y no vuelve
        // a pedirle código en este dispositivo (solo en otros nuevos).
        $this->confiarDispositivo($reto);

        return response()->json(['message' => 'Acceso aprobado.'], 200);
    }

    /**
     * Botones "¿Eres tú?" del correo 2FA (tipo Google). Público pero firmado
     * con APP_KEY: sin la firma correcta el enlace es inválido (403). Resuelve
     * el reto a aprobado/rechazado y muestra una página de confirmación.
     */
    public function decidir(Request $request)
    {
        $validated = $request->validate([
            'challenge_id' => 'required|string',
            'dec' => 'required|in:aprobar,denegar',
            'sig' => 'required|string',
        ]);

        $firma = hash_hmac('sha256', $validated['challenge_id'] . '|' . $validated['dec'], config('app.key'));
        if (!hash_equals($firma, $validated['sig'])) {
            abort(403, 'Enlace inválido o caducado.');
        }

        $reto = TwoFactorChallenge::where('challenge_id', $validated['challenge_id'])->first();

        $resultado = $validated['dec'] === 'aprobar' ? 'aprobado' : 'rechazado';

        if (!$reto || $reto->estado !== 'pendiente') {
            $mensaje = 'Este intento de acceso ya fue respondido o no existe.';
            return $this->paginaDecision($mensaje, '#666666', $validated['challenge_id']);
        }

        if ($reto->expires_at->isPast()) {
            $reto->update(['estado' => 'expirado', 'resolved_at' => Carbon::now()]);
            $mensaje = 'Este intento de acceso ya expiró. Pide a la persona que vuelva a intentarlo.';
            return $this->paginaDecision($mensaje, '#b55400', $validated['challenge_id']);
        }

        $reto->update(['estado' => $resultado, 'resolved_at' => Carbon::now()]);

        if ($validated['dec'] === 'aprobar') {
            $mensaje = '¡Acceso aprobado! Ya puedes volver al dispositivo y continuar.';
            $this->confiarDispositivo($reto);
            return $this->paginaDecision($mensaje, '#00875A', $validated['challenge_id']);
        }

        $this->notificarBloqueo($reto);
        $mensaje = 'Acceso denegado. La persona que intentó entrar ya fue bloqueada.';
        return $this->paginaDecision($mensaje, '#BE0000', $validated['challenge_id']);
    }

    private function paginaDecision(string $mensaje, string $color, ?string $challengeId = null): \Illuminate\Http\Response
    {
        $botonApp = '';
        if (!empty($challengeId)) {
            $id = htmlspecialchars($challengeId, ENT_QUOTES, 'UTF-8');
            $botonApp = '<div style="margin-top:22px;"><a href="senaaccess://2fa?challenge_id=' . $id . '" '
                . 'style="display:block;background:#02D914;color:#000;font-weight:700;font-size:14px;letter-spacing:1px;'
                . 'text-decoration:none;border-radius:10px;padding:13px;">ABRIR LA APP Y CONTINUAR</a>'
                . '<div style="font-size:12px;color:#666;margin-top:10px;">Si estás en computador, abre el correo en tu celular y toca el botón.</div></div>';
        }
        return response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><title>SENA Access</title></head>'
            . '<body style="margin:0;font-family:Inter,Arial,sans-serif;background:#f4f4f4;display:flex;align-items:center;justify-content:center;min-height:100vh;">'
            . '<div style="background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);max-width:440px;padding:40px;text-align:center;">'
            . '<div style="color:#00875A;font-size:26px;font-weight:700;margin-bottom:18px;">SENA Access</div>'
            . '<div style="font-size:15px;line-height:1.5;color:#333;">' . htmlspecialchars($mensaje) . '</div>'
            . $botonApp
            . '</div></body></html>',
            200,
            ['Content-Type' => 'text/html; charset=utf-8']
        );
    }

    /**
     * Avisa al dueño cuando alguien deniega un intento: lugar (IP), fecha, hora
     * y dispositivo que intentó entrar. Best-effort: nunca rompe la respuesta.
     */
    private function notificarBloqueo(TwoFactorChallenge $reto): void
    {
        try {
            $fecha = $reto->created_at
                ? $reto->created_at->copy()->setTimezone('America/Bogota')->format('d/m/Y H:i')
                : 'fecha desconocida';
            $ip = $reto->ip ?: 'IP desconocida';
            $disp = $reto->user_agent ? Str::limit($reto->user_agent, 100) : 'dispositivo desconocido';
            app(NotificacionService::class)->crearParaUsuario(
                $reto->fk_id_usuario,
                'Intento de acceso bloqueado',
                "Bloqueaste un intento de acceso a tu cuenta. Lugar (IP): {$ip}. Fecha y hora: {$fecha} (Bogotá). Dispositivo: {$disp}. Si no fuiste tú, cambia tu contraseña.",
                'seguridad'
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('No se pudo notificar bloqueo 2FA: ' . $e->getMessage());
        }
    }

    /**
     * Marca el teléfono del reto como confiable para que el dueño no vuelva a
     * ver el 2FA en ese dispositivo (manual o huella). Solo otros teléfonos
     * generan reto nuevo.
     */
    private function confiarDispositivo(TwoFactorChallenge $reto): void
    {
        if (empty($reto->device_id)) {
            return;
        }
        try {
            $usuario = User::find($reto->fk_id_usuario);
            if ($usuario && $usuario->trusted_device_id !== $reto->device_id) {
                $usuario->forceFill(['trusted_device_id' => $reto->device_id])->save();
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('No se pudo confiar dispositivo 2FA: ' . $e->getMessage());
        }
    }

    /**
     * Fabrica el LoginResponse completo. Solo se emite un token por reto.
     */
    private function resolverAprobado(TwoFactorChallenge $reto)
    {
        $reto->update([
            'estado' => 'aprobado',
            'resolved_at' => Carbon::now(),
        ]);

        return $this->respuestaLogin($reto);
    }

    private function respuestaLogin(TwoFactorChallenge $reto)
    {
        $user = User::with('role')->find($reto->fk_id_usuario);

        if (!$user) {
            return response()->json(['message' => 'Usuario no encontrado.'], 404);
        }

        // Reto aprobado = dueño verificado: confía en este teléfono de una vez.
        $this->confiarDispositivo($reto);

        if (!$reto->access_token) {
            $token = $user->createToken('auth_token')->plainTextToken;
            $reto->forceFill(['access_token' => $token])->save();
            // Sin Entrada automática: la marca el QR de portería (puerta de entrada).
        }

        $user->refresh();

        return response()->json([
            'message' => 'Login exitoso',
            'user' => $user,
            'role' => $user->role->rol_name,
            'access_token' => $reto->access_token,
            'token_type' => 'Bearer',
            'email_verified_at' => $user->email_verified_at,
        ]);
    }
}