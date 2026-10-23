<?php

namespace App\Http\Controllers;

use App\Models\Novedad;
use App\Models\Notificacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NovedadController extends Controller
{
    //OBTIENE LAS NOVEDADES SEGUN EL ROL: EL ADMIN VE TODAS, LOS DEMAS SOLO LAS PROPIAS
    public function index(Request $request)
    {
        $search = $request->query('search'); //OBTIENE EL PARAMETRO DE BUSQUEDA

        $esAdmin = strtolower(Auth::user()->role->rol_name ?? '') === 'superadmin'; //VALIDA SI EL USUARIO ES ADMIN
        $query = Novedad::with('user'); //OBTIENE LAS NOVEDADES

        if (!$esAdmin) { //SI NO ES ADMIN SOLO VE SUS PROPIAS NOVEDADES
            $query->where('fk_id_usuario', Auth::id()); //FILTRA POR EL USUARIO AUTENTICADO
        }

        if ($search) { //VALIDA SI EXISTE EL PARAMETRO DE BUSQUEDA
            $query->where(function($q) use ($search) {
                $q->where('novedad_title', 'like', "%{$search}%") //VALIDA SI EXISTE EL PARAMETRO DE BUSQUEDA
                  ->orWhere('novedad_body', 'like', "%{$search}%") //VALIDA SI EXISTE EL PARAMETRO DE BUSQUEDA
                  ->orWhere('novedad_ambiente', 'like', "%{$search}%"); //VALIDA SI EXISTE EL PARAMETRO DE BUSQUEDA
            }); //CIERRA LA VALIDACION DE BUSQUEDA
        }

        $novedades = $query->orderBy('novedad_datetime', 'desc')->get(); //OBTIENE TODAS LAS NOVEDADES ORDENADAS POR FECHA

        return response()->json($novedades); //RETORNA TODAS LAS NOVEDADES
    }

    //FUNCION PARA CREAR UNA NUEVA NOVEDAD
    public function store(Request $request)
    {
        $request->validate([
            'novedad_ambiente' => 'required|string|max:100',
            'novedad_title' => 'required|string|max:100',
            'novedad_body' => 'required|string',
        ]);

        $novedad = Novedad::create([
            'novedad_ambiente' => $request->novedad_ambiente,
            'novedad_title' => $request->novedad_title,
            'novedad_body' => $request->novedad_body,
            'novedad_datetime' => now(),
            'fk_id_usuario' => Auth::id(),
        ]);

        // Notificar a los admins sobre la nueva novedad
        $autor = Auth::user();
        Notificacion::notifyAdmins(
            'Nueva novedad registrada',
            ($autor ? $autor->user_name . ' ' . $autor->user_lastname : 'Un usuario') . ' reportó: ' . $request->novedad_title . ' (' . $request->novedad_ambiente . ')',
            'novedad'
        );

        return response()->json($novedad, 201);
    }

    //FUNCION PARA OBTENER MIS NOVEDADES
    public function getMyNovedades()
    {
        $novedades = Novedad::with('user')->where('fk_id_usuario', Auth::id())->get(); //OBTIENE LAS NOVEDADES DEL USUARIO
        return response()->json($novedades); //RETORNA LAS NOVEDADES
    }

    public function show($id)
    {
        $novedad = Novedad::with('user')->findOrFail($id); //OBTIENE LA NOVEDAD
        // Solo el dueño o el admin pueden verla (el listado ya filtra por rol).
        $esAdmin = strtolower(Auth::user()->role->rol_name ?? '') === 'superadmin';
        if (!$esAdmin && (int) $novedad->fk_id_usuario !== (int) Auth::id()) {
            return response()->json(['message' => 'No tienes permiso para ver esta novedad'], 403);
        }
        return response()->json($novedad); //RETORNA LA NOVEDAD
    }

    public function update(Request $request, $id)
    {
        $novedad = Novedad::findOrFail($id); //OBTIENE LA NOVEDAD

        // SOLO EL ADMIN PUEDE ACTUALIZAR
        if (strtolower(Auth::user()->role->rol_name ?? '') !== 'superadmin') { //VALIDA QUE EL USUARIO SEA ADMIN
            return response()->json(['message' => 'No tienes permiso para actualizar esta novedad'], 403); //RETORNA MENSAJE DE ERROR
        }

        $request->validate([
            'novedad_ambiente' => 'string|max:100',
            'novedad_title' => 'string|max:100',
            'novedad_body' => 'string',
        ]);

        $novedad->update($request->only(['novedad_ambiente', 'novedad_title', 'novedad_body'])); //ACTUALIZAR NOVEDAD

        return response()->json($novedad); 
    }

    public function destroy($id)
    {
        $novedad = Novedad::findOrFail($id);

        // SOLO EL ADMIN PUEDE ELIMINAR
        if (strtolower(Auth::user()->role->rol_name ?? '') !== 'superadmin') {
            return response()->json(['message' => 'No tienes permiso para eliminar esta novedad'], 403);
        }

        $novedad->delete();// ELIMINA LA NOVEDAD POR ID 

        return response()->json(['message' => 'Novedad eliminada correctamente']); 
    }
}
