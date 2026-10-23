<?php

namespace App\Http\Controllers;

use App\Models\Ambiente;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AmbienteController extends Controller
{
    // Lista todos los ambientes (cualquier rol autenticado).
    public function index()
    {
        $ambientes = Ambiente::with(['instructores:id_usuario,user_name,user_lastname,user_email', 'aprendices:id_usuario,user_name,user_lastname,user_email'])
            ->withCount('aprendices')
            ->orderBy('ambiente_nombre')
            ->get();
        return response()->json($ambientes);
    }

    // Ambientes del instructor autenticado (o del aprendiz si se consulta como alumno).
    public function misAmbientes(Request $request)
    {
        $user = $request->user();
        $ambientes = Ambiente::whereHas('instructores', function ($q) use ($user) {
            $q->where('fk_id_instructor', $user->id_usuario);
        })->with(['instructores:id_usuario,user_name,user_lastname,user_email'])
          ->withCount('aprendices')
          ->orderBy('ambiente_nombre')->get();

        // Si el usuario es aprendiz y no es instructor de ninguno, mostrar donde está matriculado
        if ($ambientes->isEmpty() && $user->role && $user->role->rol_name === 'Aprendiz') {
            $ambientes = Ambiente::whereHas('aprendices', function ($q) use ($user) {
                $q->where('fk_id_usuario', $user->id_usuario);
            })->with(['instructores:id_usuario,user_name,user_lastname,user_email'])
              ->withCount('aprendices')->orderBy('ambiente_nombre')->get();
        }
        return response()->json($ambientes);
    }

    // Crear ambiente (solo admin). Valida instructores opcionales.
    public function store(Request $request)
    {
        $data = $request->validate([
            'ambiente_nombre' => 'required|string|max:100|unique:ambientes,ambiente_nombre',
            'ambiente_capacidad' => 'nullable|integer|min:1|max:500',
            'ambiente_ubicacion' => 'nullable|string|max:100',
            'ambiente_estado' => 'nullable|in:Activo,Inactivo,Mantenimiento',
            'ambiente_jornada' => 'nullable|string|max:20',
            'hora_inicio' => 'nullable|date_format:H:i',
            'hora_fin' => 'nullable|date_format:H:i',
            'descansos' => 'nullable|array',
            'radio_m' => 'nullable|integer|min:10|max:5000',
            'bssids' => 'nullable|array',
            'instructores' => 'nullable|array',
            'instructores.*' => 'integer|exists:usuarios,id_usuario',
        ]);

        $instructores = $data['instructores'] ?? null;
        unset($data['instructores']);

        $ambiente = Ambiente::create($data);

        if ($instructores) {
            // Solo asignar usuarios con rol Instructor
            $valid = User::whereIn('id_usuario', $instructores)
                ->whereHas('role', fn($q) => $q->where('rol_name', 'Instructor'))
                ->pluck('id_usuario')->toArray();
            $ambiente->instructores()->sync($valid);
        }

        return response()->json($ambiente->load(['instructores:id_usuario,user_name,user_lastname,user_email']), 201);
    }

    // Actualizar ambiente (solo admin).
    public function update(Request $request, $id)
    {
        $ambiente = Ambiente::findOrFail($id);
        $data = $request->validate([
            'ambiente_nombre' => 'sometimes|required|string|max:100|unique:ambientes,ambiente_nombre,' . $id . ',id_ambiente',
            'ambiente_capacidad' => 'nullable|integer|min:1|max:500',
            'ambiente_ubicacion' => 'nullable|string|max:100',
            'ambiente_estado' => 'nullable|in:Activo,Inactivo,Mantenimiento',
            'ambiente_jornada' => 'nullable|string|max:20',
            'hora_inicio' => 'nullable|date_format:H:i',
            'hora_fin' => 'nullable|date_format:H:i',
            'descansos' => 'nullable|array',
            'radio_m' => 'nullable|integer|min:10|max:5000',
            'bssids' => 'nullable|array',
            'instructores' => 'nullable|array',
            'instructores.*' => 'integer|exists:usuarios,id_usuario',
        ]);

        $instructores = $data['instructores'] ?? null;
        if (array_key_exists('instructores', $data)) unset($data['instructores']);

        $ambiente->update($data);

        if ($request->has('instructores')) {
            if ($instructores === null) {
                $ambiente->instructores()->sync([]);
            } else {
                $valid = User::whereIn('id_usuario', $instructores)
                    ->whereHas('role', fn($q) => $q->where('rol_name', 'Instructor'))
                    ->pluck('id_usuario')->toArray();
                $ambiente->instructores()->sync($valid);
            }
        }

        return response()->json($ambiente->load(['instructores:id_usuario,user_name,user_lastname,user_email']));
    }

    public function destroy($id)
    {
        $ambiente = Ambiente::findOrFail($id);
        $ambiente->delete();
        return response()->json(['message' => 'Ambiente eliminado']);
    }

    // Aprendices de un ambiente (admin o instructor asignado).
    public function getAprendices(Request $request, $id)
    {
        $ambiente = Ambiente::findOrFail($id);
        $user = $request->user();
        $isAdmin = strtolower($user->role->rol_name ?? '') === 'superadmin';
        $isInstructorDelAmbiente = $ambiente->instructores()->where('fk_id_instructor', $user->id_usuario)->exists();
        if (!$isAdmin && !$isInstructorDelAmbiente) {
            return response()->json(['message' => 'No autorizado para ver este ambiente'], 403);
        }
        $aprendices = $ambiente->aprendices()->with('role')->orderBy('user_name')->get();
        return response()->json($aprendices);
    }

    // Versión para instructor desde /mis-ambientes/{id}/aprendices (reusa validación).
    public function misAprendices(Request $request, $id)
    {
        return $this->getAprendices($request, $id);
    }

    // Agregar aprendiz (admin).
    public function addAprendiz(Request $request, $id)
    {
        $ambiente = Ambiente::findOrFail($id);
        $request->validate(['fk_id_usuario' => 'required|integer|exists:usuarios,id_usuario']);
        $aprendiz = User::with('role')->findOrFail($request->fk_id_usuario);
        if (!$aprendiz->role || $aprendiz->role->rol_name !== 'Aprendiz') {
            return response()->json(['message' => 'Solo se pueden agregar aprendices'], 422);
        }
        // No autorizar si el requester es instructor no asignado y no es admin
        $user = $request->user();
        $isAdmin = strtolower($user->role->rol_name ?? '') === 'superadmin';
        if (!$isAdmin && !$ambiente->instructores()->where('fk_id_instructor', $user->id_usuario)->exists()) {
            return response()->json(['message' => 'No autorizado para modificar este ambiente'], 403);
        }
        $ambiente->aprendices()->syncWithoutDetaching([$aprendiz->id_usuario]);
        return response()->json(['message' => 'Aprendiz agregado', 'aprendices' => $ambiente->aprendices()->with('role')->get()]);
    }

    // Atajo para instructor (mis-ambientes).
    public function misAddAprendiz(Request $request, $id)
    {
        return $this->addAprendiz($request, $id);
    }

    public function removeAprendiz(Request $request, $id, $userId)
    {
        $ambiente = Ambiente::findOrFail($id);
        $user = $request->user();
        $isAdmin = strtolower($user->role->rol_name ?? '') === 'superadmin';
        if (!$isAdmin && !$ambiente->instructores()->where('fk_id_instructor', $user->id_usuario)->exists()) {
            return response()->json(['message' => 'No autorizado'], 403);
        }
        $ambiente->aprendices()->detach($userId);
        return response()->json(['message' => 'Aprendiz removido']);
    }

    public function misRemoveAprendiz(Request $request, $id, $userId)
    {
        return $this->removeAprendiz($request, $id, $userId);
    }

    // Sync instructores (admin) desde pantalla de edición.
    public function syncInstructores(Request $request, $id)
    {
        $ambiente = Ambiente::findOrFail($id);
        $data = $request->validate([
            'instructores' => 'nullable|array',
            'instructores.*' => 'integer|exists:usuarios,id_usuario',
        ]);
        $ids = $data['instructores'] ?? [];
        $valid = User::whereIn('id_usuario', $ids)
            ->whereHas('role', fn($q) => $q->where('rol_name', 'Instructor'))
            ->pluck('id_usuario')->toArray();
        $ambiente->instructores()->sync($valid);
        return response()->json($ambiente->load('instructores'));
    }
}
