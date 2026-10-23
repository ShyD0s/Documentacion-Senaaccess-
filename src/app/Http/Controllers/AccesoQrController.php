<?php

namespace App\Http\Controllers;

use App\Models\Ingreso;
use App\Models\PinAcceso;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

// QR rotativo de portería: el admin/superadmin proyecta un QR de ENTRADA y
// otro de SALIDA que rotan cada 30 s (firmados con HMAC, sin guardar nada).
// El aprendiz/instructor lo escanea y queda registrado en el historial.
// La Salida SOLO se marca por este QR (o PIN de excusa): cerrar la app
// ya no genera salidas.
class AccesoQrController extends Controller
{
    private const VENTANA_SEG = 30;

    // Construye el payload firmado para el tipo y la ventana actual.
    private function payload(string $tipo, int $ventana): string
    {
        $base = base64_encode(json_encode([
            'app' => 'SENA_ACCESS',
            'acceso' => $tipo,
            'sede' => 'CCyS',
            'ventana' => $ventana,
        ]));
        $firma = hash_hmac('sha256', $base, config('app.key'));
        return $base . '.' . $firma;
    }

    // QR vigente para proyectar en portería (admin o superadmin).
    public function mostrar(string $tipo)
    {
        if (!in_array($tipo, ['entrada', 'salida'], true)) {
            return response()->json(['message' => 'Tipo inválido.'], 422);
        }
        $ventana = intdiv(Carbon::now()->timestamp, self::VENTANA_SEG);
        return response()->json([
            'qr_payload' => $this->payload($tipo, $ventana),
            'tipo' => $tipo,
            'ventana_seg' => self::VENTANA_SEG,
            'expira_en' => ($ventana + 1) * self::VENTANA_SEG,
        ]);
    }

    // Valida el QR escaneado y registra Entrada/Salida en el historial.
    public function validar(Request $request)
    {
        $data = $request->validate(['qr_payload' => 'required|string|max:2000']);
        $partes = explode('.', $data['qr_payload']);
        if (count($partes) !== 2) {
            return response()->json(['message' => 'QR inválido.'], 422);
        }
        [$base, $firma] = $partes;
        if (!hash_equals(hash_hmac('sha256', $base, config('app.key')), $firma)) {
            return response()->json(['message' => 'QR inválido o falsificado.'], 422);
        }
        $json = json_decode(base64_decode($base), true);
        if (!is_array($json) || ($json['app'] ?? '') !== 'SENA_ACCESS' || !in_array($json['acceso'] ?? '', ['entrada', 'salida'], true)) {
            return response()->json(['message' => 'QR inválido.'], 422);
        }
        // Ventana vigente (±1 por relojes desfasados).
        $ventanaActual = intdiv(Carbon::now()->timestamp, self::VENTANA_SEG);
        if (abs($ventanaActual - (int) $json['ventana']) > 1) {
            return response()->json(['message' => 'QR vencido. Pide que lo actualicen en portería.'], 422);
        }
        // Anti-replay: el mismo QR no se procesa dos veces en su vigencia.
        $llaveReplay = 'acceso_qr_usado:' . hash('sha256', $data['qr_payload']);
        if (Cache::has($llaveReplay)) {
            return response()->json(['message' => 'Este QR ya fue usado. Espera al siguiente.'], 422);
        }
        Cache::put($llaveReplay, true, self::VENTANA_SEG * 2);

        $user = $request->user();
        $ultimo = Ingreso::where('fk_id_user', $user->id_usuario)->orderByDesc('id_ingreso')->first();
        $ultimoTipo = $ultimo?->ingreso_type;

        if ($json['acceso'] === 'entrada') {
            // Regla de permanencia: la puerta deja entrar si el ÚLTIMO
            // movimiento es Entrada (aunque sea de otro día); solo exige QR
            // tras una Salida. Aquí basta con no duplicar la Entrada de hoy:
            // si ayer quedó abierta, hoy se registra normal.
            $hoy = Carbon::now('America/Bogota')->toDateString();
            $entradaHoy = Ingreso::where('fk_id_user', $user->id_usuario)
                ->where('ingreso_type', 'Entrada')
                ->whereDate('ingreso_datetime', $hoy)
                ->exists();
            if ($entradaHoy) {
                return response()->json(['message' => 'Ya registraste tu entrada de hoy.', 'duplicado' => true]);
            }
            $ingreso = Ingreso::create([
                'ingreso_datetime' => Carbon::now('America/Bogota'),
                'ingreso_place' => $json['sede'] ?? 'CCyS',
                'ingreso_type' => 'Entrada',
                'fk_id_user' => $user->id_usuario,
            ]);
            return response()->json(['message' => 'Entrada registrada. ¡Bienvenido!', 'ingreso' => $ingreso], 201);
        }

        if ($ultimoTipo !== 'Entrada') {
            return response()->json(['message' => 'No tienes una entrada registrada para marcar salida.'], 422);
        }
        $ingreso = Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => $json['sede'] ?? 'CCyS',
            'ingreso_type' => 'Salida',
            'fk_id_user' => $user->id_usuario,
        ]);
        return response()->json(['message' => 'Salida registrada. ¡Hasta pronto!', 'ingreso' => $ingreso], 201);
    }

    // PIN corto de acceso (admin/portero lo dicta cuando no hay cámara):
    // 6 dígitos, 5 minutos, un solo uso, amarrado a entrada o salida.
    public function generarPin(Request $request)
    {
        $data = $request->validate(['tipo' => 'required|in:entrada,salida']);
        $codigo = null;
        for ($i = 0; $i < 20; $i++) {
            $candidato = (string) random_int(100000, 999999);
            if (!PinAcceso::where('codigo', $candidato)->whereNull('usado_en')->exists()) {
                $codigo = $candidato;
                break;
            }
        }
        if (!$codigo) {
            return response()->json(['message' => 'No se pudo generar el PIN. Intenta de nuevo.'], 500);
        }
        $pin = PinAcceso::create([
            'codigo' => $codigo,
            'tipo' => $data['tipo'],
            'expira_en' => Carbon::now('America/Bogota')->addMinutes(5),
            'fk_creado_por' => $request->user()->id_usuario,
        ]);
        return response()->json([
            'pin' => $pin->codigo,
            'tipo' => $pin->tipo,
            'expira_en' => $pin->expira_en,
        ], 201);
    }

    // Valida el PIN dictado en portería y registra Entrada/Salida.
    // Misma regla de permanencia del QR: sin duplicar la Entrada de hoy.
    public function validarPin(Request $request)
    {
        $data = $request->validate(['pin' => 'required|string|max:10']);
        $pin = PinAcceso::where('codigo', trim($data['pin']))->first();
        if (!$pin) {
            return response()->json(['message' => 'PIN incorrecto. Pide en portería uno nuevo.'], 404);
        }
        if ($pin->usado_en) {
            return response()->json(['message' => 'PIN ya utilizado. Pide uno nuevo.'], 400);
        }
        if ($pin->expira_en->isPast()) {
            return response()->json(['message' => 'PIN vencido. Pide uno nuevo.'], 400);
        }
        $pin->update(['usado_en' => Carbon::now('America/Bogota')]);
        $user = $request->user();

        if ($pin->tipo === 'entrada') {
            $hoy = Carbon::now('America/Bogota')->toDateString();
            $entradaHoy = Ingreso::where('fk_id_user', $user->id_usuario)
                ->where('ingreso_type', 'Entrada')
                ->whereDate('ingreso_datetime', $hoy)
                ->exists();
            if ($entradaHoy) {
                return response()->json(['message' => 'Ya registraste tu entrada de hoy.', 'duplicado' => true]);
            }
            $ingreso = Ingreso::create([
                'ingreso_datetime' => Carbon::now('America/Bogota'),
                'ingreso_place' => 'CCyS',
                'ingreso_type' => 'Entrada',
                'fk_id_user' => $user->id_usuario,
            ]);
            return response()->json(['message' => 'Entrada registrada. ¡Bienvenido!', 'ingreso' => $ingreso], 201);
        }

        $ultimo = Ingreso::where('fk_id_user', $user->id_usuario)->orderByDesc('id_ingreso')->first();
        if (($ultimo?->ingreso_type) !== 'Entrada') {
            return response()->json(['message' => 'No tienes una entrada registrada para marcar salida.'], 422);
        }
        $ingreso = Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => 'CCyS',
            'ingreso_type' => 'Salida',
            'fk_id_user' => $user->id_usuario,
        ]);
        return response()->json(['message' => 'Salida registrada. ¡Hasta pronto!', 'ingreso' => $ingreso], 201);
    }
}
