<?php

namespace App\Http\Controllers;

use App\Models\IngresoEquipo;
use App\Models\Notificacion;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class EquipmentController extends Controller
{
    public function store(Request $request)
    {
        // Admin o portero pueden registrar equipos (comparación insensible a mayúsculas).
        if (!in_array(strtolower(Auth::user()->role->rol_name ?? ''), ['superadmin', 'admin'])) {
            return response()->json(['message' => 'No tienes permiso para registrar equipos'], 403);
        }

        $request->validate([ //VALIDACIONES PARA EL REGISTRO DE EQUIPOS
            'equipo_type' => 'required|string', //VALIDA QUE EL TIPO DE EQUIPO EXISTA
            'equipo_brand' => 'required|string',//VALIDA QUE LA MARCA DEL EQUIPO EXISTA
            'equipo_model' => 'nullable|string',//VALIDA QUE EL MODELO DEL EQUIPO EXISTA
            'equipo_color' => 'required|string',//VALIDA QUE EL COLOR DEL EQUIPO EXISTA
            'equipo_serial' => 'required|string|unique:ingreso_equipos', //VALIDA QUE EL SERIAL NO SE REPITA
            'equipo_observations' => 'nullable|string',//VALIDA QUE LAS OBSERVACIONES NO SE REPITAN
            'equipo_propiedad' => 'nullable|in:Prestado,Propio',
            'fk_id_usuario' => 'nullable|integer|exists:usuarios,id_usuario',
            'equipo_accesorios' => 'nullable|array',
            'equipo_accesorios.*.tipo' => 'required_with:equipo_accesorios|string',
            'equipo_accesorios.*.marca' => 'nullable|string',
            'equipo_accesorios.*.color' => 'nullable|string',
            'equipo_accesorios.*.inalambrico' => 'nullable|boolean',
        ]);

        $dueno = $request->fk_id_usuario ?: $request->user()->id_usuario;
        $duenoModel = User::find($dueno);

        $ingreso = IngresoEquipo::create([
            'fk_id_usuario' => $dueno,
            'equipo_type' => $request->equipo_type,
            'equipo_brand' => $request->equipo_brand,
            'equipo_model' => $request->equipo_model,
            'equipo_color' => $request->equipo_color,
            'equipo_serial' => $request->equipo_serial,
            'equipo_observations' => $request->equipo_observations,
            'equipo_propiedad' => $request->equipo_propiedad ?? 'Prestado',
            'equipo_accesorios' => $request->equipo_accesorios,
        ]);

        // Notificar a los admins sobre el nuevo equipo registrado
        Notificacion::notifyAdmins(
            'Nuevo equipo registrado',
            ($duenoModel ? $duenoModel->user_name . ' ' . $duenoModel->user_lastname : 'Un usuario') . ' registró un(a) ' . $request->equipo_type . ' ' . $request->equipo_brand . ' (Serial: ' . $request->equipo_serial . ')',
            'equipo'
        );

        return response()->json([ //RESPUESTA DE LA CREACION DEL REGISTRO
            'message' => 'Comprobante de ingreso de equipo creado con éxito',
            'data' => $ingreso->load('user')
        ], 201);
    }

    public function index()
    {
        $ingresos = IngresoEquipo::with('user.role')->orderBy('entry_datetime', 'desc')->get();
        return response()->json($ingresos); //RESPUESTA DE LA CONSULTA DE LOS REGISTROS
    }

    public function getMyEquipment(Request $request)
    {
        $ingresos = IngresoEquipo::where('fk_id_usuario', $request->user()->id_usuario) //CONSULTA DE LOS REGISTROS DEL USUARIO
            ->with('user') //CONSULTA DE LOS REGISTROS DEL USUARIO
            ->orderBy('entry_datetime', 'desc') //CONSULTA DE LOS REGISTROS DEL USUARIO
            ->get(); //CONSULTA DE LOS REGISTROS DEL USUARIO
        return response()->json($ingresos); //RESPUESTA DE LA CONSULTA DE LOS REGISTROS
    }

    public function comprobante($id)
    {
        $ingreso = IngresoEquipo::with('user.role')->findOrFail($id);

        $esDueno = $ingreso->fk_id_usuario === Auth::id();
        $esAdmin = in_array(strtolower(Auth::user()->role->rol_name ?? ''), ['superadmin', 'admin']);
        if (!$esDueno && !$esAdmin) {
            return response()->json(['message' => 'No tienes permiso para descargar este comprobante'], 403);
        }

        $dueno = $ingreso->user;
        $accesorios = collect($ingreso->equipo_accesorios ?? [])
            ->map(fn ($a) => trim(collect([
                $a['tipo'] ?? null,
                isset($a['marca']) && $a['marca'] !== '' ? $a['marca'] : null,
                isset($a['color']) && $a['color'] !== '' ? $a['color'] : null,
                !empty($a['inalambrico']) ? 'Inalámbrico' : null,
            ])->filter()->implode(' ')))
            ->filter()
            ->values();

        $pdf = Pdf::loadView('comprobantes.equipo', [
            'ingreso' => $ingreso,
            'dueno' => $dueno,
            'accesorios' => $accesorios,
            'generado_en' => Carbon::now('America/Bogota'),
        ]);

        $serial = preg_replace('/[^A-Za-z0-9\-_]/', '', $ingreso->equipo_serial) ?: 'equipo';

        return $pdf->download("comprobante-{$serial}.pdf");
    }

    public function deleteEquipment($id)
    {
        $ingreso = IngresoEquipo::findOrFail($id);
        $ingreso->delete();
        return response()->json([ //RESPUESTA DE LA CONSULTA DE LOS REGISTROS
            'message' => 'Comprobante de ingreso de equipo eliminado con éxito',
        ], 200);
    }

    public function markReturn($id)
    {
        $ingreso = IngresoEquipo::findOrFail($id);

        if ($ingreso->equipo_status === 'Disponible') {
            return response()->json([
                'message' => 'El equipo ya fue devuelto',
            ], 422);
        }

        $ingreso->update([
            'equipo_status' => 'Disponible',
            'equipo_return_datetime' => Carbon::now('America/Bogota'),
        ]);

        return response()->json([
            'message' => 'Equipo devuelto con éxito',
            'data' => $ingreso->load('user')
        ], 200);
    }
}
