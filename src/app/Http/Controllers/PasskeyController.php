<?php

namespace App\Http\Controllers;

use App\Models\Passkey;
use App\Models\User;
use App\Services\PasskeyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Huella digital en la web (WebAuthn / passkey).
 *
 * - Se registra la credencial desde el perfil (pide la sesion iniciada).
 * - El ingreso con huella devuelve el mismo token que el login por clave.
 */
class PasskeyController extends Controller
{
    public function __construct(private PasskeyService $passkeys)
    {
    }

    /**
     * Opciones para registrar la huella de este dispositivo.
     */
    public function opcionesRegistro(Request $request)
    {
        $request->validate([
            'nombre_dispositivo' => 'nullable|string|max:120',
        ]);

        $respuesta = $this->passkeys->opcionesRegistro($request, $request->user());

        return response()->json([
            'message' => 'Opciones de registro generadas',
            'reto' => $respuesta['reto'],
            'opciones' => json_decode($respuesta['opciones'], true),
        ]);
    }

    /**
     * Guarda la credencial devuelta por el navegador.
     */
    public function registrar(Request $request)
    {
        $datos = $request->validate([
            'reto' => 'required|string',
            'id' => 'required|string',
            'rawId' => 'nullable|string',
            'type' => 'nullable|string',
            'response' => 'required|array',
            'transports' => 'nullable|array',
            'nombre_dispositivo' => 'nullable|string|max:120',
        ]);

        $respuesta = $datos['response'];
        $respuesta['transports'] = $datos['transports'] ?? ($respuesta['transports'] ?? []);

        try {
            $passkey = $this->passkeys->registrarCredencial(
                $request,
                $request->user(),
                $datos['reto'],
                $respuesta,
                $datos['nombre_dispositivo'] ?? 'Este dispositivo'
            );
        } catch (\Throwable $e) {
            Log::warning('WebAuthn: fallo al registrar la credencial', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'No se pudo registrar la huella en este dispositivo.'], 422);
        }

        if (!$passkey) {
            return response()->json(['message' => 'El reto de registro no es valido o ya expiro.'], 422);
        }

        return response()->json([
            'message' => 'Huella registrada en este dispositivo',
            'dispositivo' => [
                'id' => $passkey->id,
                'nombre' => $passkey->nombre_dispositivo,
                'creado' => optional($passkey->created_at)->toIso8601String(),
            ],
        ], 201);
    }

    /**
     * Opciones para autenticarse con huella (reto de un solo uso).
     */
    public function opcionesAutenticacion(Request $request)
    {
        $respuesta = $this->passkeys->opcionesAutenticacion($request);

        return response()->json([
            'message' => 'Opciones de autenticacion generadas',
            'reto' => $respuesta['reto'],
            'opciones' => json_decode($respuesta['opciones'], true),
        ]);
    }

    /**
     * Verifica la huella y entrega el token de sesion.
     */
    public function autenticar(Request $request)
    {
        $datos = $request->validate([
            'reto' => 'required|string',
            'id' => 'required|string',
            'rawId' => 'nullable|string',
            'type' => 'nullable|string',
            'response' => 'required|array',
        ]);

        try {
            $usuario = $this->passkeys->autenticar($request, $datos['reto'], $datos['id'], $datos['response']);
        } catch (\Throwable $e) {
            Log::warning('WebAuthn: fallo al autenticar', ['error' => $e->getMessage()]);

            return response()->json(['message' => 'No se pudo verificar la huella.'], 401);
        }

        if (!$usuario) {
            return response()->json(['message' => 'Huella no valida para este dispositivo.'], 401);
        }

        if (($usuario->estado_cuenta ?? 'aprobada') === 'pendiente') {
            return response()->json(['message' => 'Tu cuenta esta en espera de aprobacion.'], 403);
        }

        if (($usuario->estado_cuenta ?? '') === 'rechazada') {
            return response()->json(['message' => 'Tu solicitud de cuenta fue rechazada.'], 403);
        }

        $token = $usuario->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Login exitoso',
            'user' => $usuario->refresh(),
            'role' => $usuario->role->rol_name,
            'access_token' => $token,
            'token_type' => 'Bearer',
            'email_verified_at' => $usuario->email_verified_at,
        ]);
    }

    /**
     * Dispositivos con huella registrada del usuario en sesion.
     */
    public function index(Request $request)
    {
        $dispositivos = Passkey::where('fk_id_usuario', $request->user()->id_usuario)
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Passkey $p) => [
                'id' => $p->id,
                'nombre' => $p->nombre_dispositivo,
                'creado' => optional($p->created_at)->toIso8601String(),
                'ultimo_uso' => optional($p->ultimo_uso_en)->toIso8601String(),
            ]);

        return response()->json(['dispositivos' => $dispositivos]);
    }

    /**
     * Quita la huella de un dispositivo.
     */
    public function destroy(Request $request, $id)
    {
        $passkey = Passkey::where('fk_id_usuario', $request->user()->id_usuario)
            ->where('id', $id)
            ->first();

        if (!$passkey) {
            return response()->json(['message' => 'Ese dispositivo no tiene huella registrada.'], 404);
        }

        $passkey->delete();

        return response()->json(['message' => 'Huella del dispositivo eliminada']);
    }
}
