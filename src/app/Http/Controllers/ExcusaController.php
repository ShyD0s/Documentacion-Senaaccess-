<?php

namespace App\Http\Controllers;

use App\Models\Ambiente;
use App\Models\Excusa;
use App\Models\Ingreso;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ExcusaController extends Controller
{
    // Genera PIN de 4 dígitos no colisionado entre pendientes.
    private function generarPin(): string
    {
        for ($i = 0; $i < 10; $i++) {
            $pin = (string) random_int(1000, 9999);
            $existe = Excusa::where('pin', $pin)->where('estado', 'pendiente')->exists();
            if (!$existe) return $pin;
        }
        return (string) random_int(1000, 9999);
    }

    private function expirarVencidas(): void
    {
        Excusa::where('estado', 'pendiente')
            ->where('expira_en', '<', Carbon::now())
            ->update(['estado' => 'expirada']);
    }

    // Instructor crea excusa con PIN (vigencia 15 min). Admin también puede.
    public function store(Request $request)
    {
        $user = $request->user();
        $esAdmin = strtolower($user->role->rol_name ?? '') === 'superadmin';
        $esInstructor = $user->role && $user->role->rol_name === 'Instructor';
        if (!$esAdmin && !$esInstructor) {
            return response()->json(['message' => 'Solo instructores o admin pueden crear excusas'], 403);
        }

        $data = $request->validate([
            'fk_id_aprendiz' => 'required|integer|exists:usuarios,id_usuario',
            'fk_id_ambiente' => 'required|integer|exists:ambientes,id_ambiente',
            'motivo' => 'required|string|max:255',
        ]);

        $aprendiz = User::with('role')->findOrFail($data['fk_id_aprendiz']);
        if (!$aprendiz->role || $aprendiz->role->rol_name !== 'Aprendiz') {
            return response()->json(['message' => 'Solo se puede crear excusa para un aprendiz'], 422);
        }

        $ambiente = Ambiente::findOrFail($data['fk_id_ambiente']);
        if (!$esAdmin) {
            $esDelAmbiente = $ambiente->instructores()->where('fk_id_instructor', $user->id_usuario)->exists();
            if (!$esDelAmbiente) {
                return response()->json(['message' => 'No eres instructor de este ambiente'], 403);
            }
        }

        $pin = $this->generarPin();
        $excusa = Excusa::create([
            'fk_id_aprendiz' => $aprendiz->id_usuario,
            'fk_id_ambiente' => $ambiente->id_ambiente,
            'fk_id_instructor' => $user->id_usuario,
            'motivo' => $data['motivo'],
            'pin' => $pin,
            'estado' => 'pendiente',
            'expira_en' => Carbon::now()->addMinutes(15),
        ]);

        $excusa->load(['aprendiz:id_usuario,user_name,user_lastname,user_identification,user_email', 'ambiente:id_ambiente,ambiente_nombre,ambiente_ubicacion', 'instructor:id_usuario,user_name,user_lastname']);

        return response()->json($excusa, 201);
    }

    // Lista excusas creadas por el instructor autenticado.
    public function misComoInstructor(Request $request)
    {
        $this->expirarVencidas();
        $user = $request->user();
        $excusas = Excusa::where('fk_id_instructor', $user->id_usuario)
            ->with(['aprendiz:id_usuario,user_name,user_lastname,user_identification,user_email', 'ambiente:id_ambiente,ambiente_nombre,ambiente_ubicacion'])
            ->orderByDesc('created_at')
            ->get();
        return response()->json($excusas);
    }

    // Instructor (o admin) anula una excusa pendiente propia.
    public function anular(Request $request, $id)
    {
        $user = $request->user();
        $excusa = Excusa::findOrFail($id);
        $esAdmin = strtolower($user->role->rol_name ?? '') === 'superadmin';
        if (!$esAdmin && $excusa->fk_id_instructor !== $user->id_usuario) {
            return response()->json(['message' => 'No autorizado'], 403);
        }
        if ($excusa->estado !== 'pendiente') {
            return response()->json(['message' => 'Solo se pueden anular excusas pendientes'], 422);
        }
        $excusa->update(['estado' => 'anulada']);
        return response()->json(['message' => 'Excusa anulada', 'excusa' => $excusa]);
    }

    // Admin: lista todas las excusas (con filtros opcionales).
    public function indexAdmin(Request $request)
    {
        $this->expirarVencidas();
        $estado = $request->query('estado');
        $q = Excusa::with(['aprendiz:id_usuario,user_name,user_lastname,user_identification,user_email', 'ambiente:id_ambiente,ambiente_nombre,ambiente_ubicacion', 'instructor:id_usuario,user_name,user_lastname'])
            ->orderByDesc('created_at');
        if ($estado) $q->where('estado', $estado);
        return response()->json($q->get());
    }

    // Superadmin, instructor o admin (operativo de portería) valida PIN en recepción: marca usada y registra Salida del aprendiz.
    public function validar(Request $request)
    {
        $user = $request->user();
        $rol = strtolower($user->role->rol_name ?? '');
        $esAdmin = $rol === 'superadmin';
        $esInstructor = $rol === 'instructor';
        $esPortero = $rol === 'admin';
        if (!$esAdmin && !$esInstructor && !$esPortero) {
            return response()->json(['message' => 'Solo superadmin, instructor o admin puede validar PIN'], 403);
        }

        $data = $request->validate([
            'pin' => 'required|string|max:10',
        ]);

        $pin = trim($data['pin']);
        $this->expirarVencidas();

        $excusa = Excusa::where('pin', $pin)->where('estado', 'pendiente')->with(['aprendiz', 'ambiente', 'instructor'])->first();
        if (!$excusa) {
            $expirada = Excusa::where('pin', $pin)->where('estado', 'expirada')->first();
            if ($expirada) return response()->json(['message' => 'PIN expirado (vigencia 60 min). Pide al instructor una nueva excusa.'], 400);
            $usada = Excusa::where('pin', $pin)->where('estado', 'usada')->first();
            if ($usada) return response()->json(['message' => 'PIN ya utilizado.'], 400);
            return response()->json(['message' => 'PIN inválido.'], 400);
        }

        if ($excusa->expira_en && $excusa->expira_en->isPast()) {
            $excusa->update(['estado' => 'expirada']);
            return response()->json(['message' => 'PIN expirado.'], 400);
        }

        $excusa->update(['estado' => 'usada', 'usado_en' => Carbon::now()]);

        // Registrar Salida en ingresos para el aprendiz.
        Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => $excusa->ambiente ? $excusa->ambiente->ambiente_nombre : 'Salida con excusa',
            'ingreso_type' => 'Salida',
            'fk_id_user' => $excusa->fk_id_aprendiz,
        ]);

        $excusa->load(['aprendiz:id_usuario,user_name,user_lastname,user_identification', 'ambiente:id_ambiente,ambiente_nombre', 'instructor:id_usuario,user_name,user_lastname']);

        return response()->json([
            'message' => 'Salida autorizada. PIN validado.',
            'excusa' => $excusa,
            'aprendiz' => $excusa->aprendiz,
        ]);
    }

    // Aprendiz ve sus excusas.
    public function misExcusas(Request $request)
    {
        $this->expirarVencidas();
        $user = $request->user();
        $excusas = Excusa::where('fk_id_aprendiz', $user->id_usuario)
            ->with(['ambiente:id_ambiente,ambiente_nombre,ambiente_ubicacion', 'instructor:id_usuario,user_name,user_lastname'])
            ->orderByDesc('created_at')
            ->get();
        return response()->json($excusas);
    }

    // Aprendiz borra una excusa ya cerrada de su historial (no permisos vigentes).
    public function eliminarMisExcusa(Request $request, $id)
    {
        $this->expirarVencidas();
        $user = $request->user();
        $excusa = Excusa::find($id);
        if (!$excusa) {
            return response()->json(['message' => 'Excusa no encontrada'], 404);
        }
        if ($excusa->fk_id_aprendiz !== $user->id_usuario) {
            return response()->json(['message' => 'No autorizado'], 403);
        }
        if ($excusa->estado === 'pendiente') {
            return response()->json(['message' => 'No puedes borrar un permiso vigente'], 422);
        }
        $excusa->delete();
        return response()->json(['message' => 'Excusa eliminada']);
    }
}
