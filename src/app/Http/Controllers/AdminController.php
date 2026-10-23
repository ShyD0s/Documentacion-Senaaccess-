<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use App\Mail\CuentaAprobadaMail;
use App\Mail\CuentaRechazadaMail;

use App\Models\Ingreso;
use App\Models\Novedad;
use App\Models\IngresoEquipo;
use App\Models\Excusa;
use App\Models\Notificacion;
use App\Models\TokenRecovery;
use App\Models\TwoFactorChallenge;
use CloudinaryLabs\CloudinaryLaravel\Facades\Cloudinary;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AdminController extends Controller
{
    // Lista de usuarios con paginación opt-in: sin parámetros devuelve la tabla
    // completa (compatibilidad con APKs anteriores); con page/per_page/search/rol
    // devuelve un paginador Laravel {data, total, ...} filtrado en el servidor.
    public function index(Request $request)
    {
        $query = User::with('role');

        if ($request->filled('rol')) {
            $rol = $request->rol;
            $query->whereHas('role', function ($r) use ($rol) {
                $r->where('rol_name', $rol);
            });
        }

        if ($request->filled('estado')) {
            $query->where('estado_cuenta', $request->estado);
        }

        if ($request->filled('search')) {
            $s = $request->search;
            $query->where(function ($sub) use ($s) {
                $sub->where('user_name', 'like', "%{$s}%")
                    ->orWhere('user_lastname', 'like', "%{$s}%")
                    ->orWhere('user_email', 'like', "%{$s}%")
                    ->orWhere('user_identification', 'like', "%{$s}%");
            });
        }

        if ($request->filled('page') || $request->filled('per_page') || $request->filled('search') || $request->filled('rol') || $request->filled('estado')) {
            $perPage = $request->integer('per_page', 50);
            if ($perPage < 1) { $perPage = 50; }
            if ($perPage > 200) { $perPage = 200; }
            return response()->json(
                $query->orderBy('id_usuario', 'desc')->paginate($perPage)
            );
        }

        $users = $query->get();
        return response()->json($users); //CONSULTA DE TODOS LOS USUARIOS
    }

    public function getIngresos(Request $request)
    {
        $query = Ingreso::with('user');

        if ($request->filled('tipo')) {
            $query->where('ingreso_type', $request->tipo);
        }

        if ($request->filled('desde')) {
            // Rango sobre el datetime (no whereDate) para que use el índice.
            $query->where('ingreso_datetime', '>=', $request->desde . ' 00:00:00');
        }

        if ($request->filled('hasta')) {
            $query->where('ingreso_datetime', '<', Carbon::parse($request->hasta)->addDay()->toDateString() . ' 00:00:00');
        }

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('ingreso_place', 'like', "%{$q}%")
                    ->orWhereHas('user', function ($u) use ($q) {
                        $u->where('user_name', 'like', "%{$q}%")
                          ->orWhere('user_lastname', 'like', "%{$q}%")
                          ->orWhere('user_email', 'like', "%{$q}%");
                    });
            });
        }

        $perPage = $request->integer('per_page', 15); //CANTIDAD DE REGISTROS POR PAGINA
        if ($perPage > 500) { $perPage = 500; } //LIMITE PARA EVITAR RESPUESTAS ENORMES

        $ingresos = $query->orderBy('ingreso_datetime', 'desc')
            ->paginate($perPage);

        return response()->json($ingresos);
    }

    // Quiénes están DENTRO ahora: usuarios cuyo último registro en ingresos es una
    // Entrada (sin Salida posterior). Se usa el id más alto por usuario como proxy
    // del último movimiento, ya que los registros se insertan en orden.
    public function presentes(Request $request)
    {
        $idsUltimos = Ingreso::query()
            ->selectRaw('MAX(id_ingreso) as ultimo')
            ->groupBy('fk_id_user')
            ->pluck('ultimo');

        $presentes = Ingreso::with('user.role')
            ->whereIn('id_ingreso', $idsUltimos)
            ->where('ingreso_type', 'Entrada')
            ->orderBy('ingreso_datetime', 'desc')
            ->get();

        // Ambiente por usuario (primer nombre alfabético): aprendices por
        // matrícula (ambiente_aprendiz), instructores/admin por donde enseñan
        // (ambiente_instructor). Sin ambiente => null. Dos consultas por lote
        // para no hacer N+1; campos nuevos compatibles (Gson los ignora).
        $idsUsuarios = $presentes->pluck('fk_id_user')->unique()->values()->all();
        $ambientePorUsuario = [];
        if (!empty($idsUsuarios)) {
            $deMatricula = DB::table('ambiente_aprendiz as pa')
                ->join('ambientes as a', 'a.id_ambiente', '=', 'pa.fk_id_ambiente')
                ->whereIn('pa.fk_id_usuario', $idsUsuarios)
                ->orderBy('a.ambiente_nombre')
                ->select('pa.fk_id_usuario as uid', 'a.ambiente_nombre')
                ->get();
            foreach ($deMatricula as $fila) {
                $ambientePorUsuario[$fila->uid] ??= $fila->ambiente_nombre;
            }
            $deEnsenanza = DB::table('ambiente_instructor as pi')
                ->join('ambientes as a', 'a.id_ambiente', '=', 'pi.fk_id_ambiente')
                ->whereIn('pi.fk_id_instructor', $idsUsuarios)
                ->orderBy('a.ambiente_nombre')
                ->select('pi.fk_id_instructor as uid', 'a.ambiente_nombre')
                ->get();
            foreach ($deEnsenanza as $fila) {
                $ambientePorUsuario[$fila->uid] ??= $fila->ambiente_nombre;
            }
        }

        $resultado = $presentes->map(function ($ing) use ($ambientePorUsuario) {
                return [
                    'id_usuario' => $ing->fk_id_user,
                    'user_name' => $ing->user->user_name ?? '',
                    'user_lastname' => $ing->user->user_lastname ?? '',
                    'rol' => $ing->user->role->rol_name ?? null,
                    'entrada_hora' => $ing->ingreso_datetime,
                    'ambiente' => $ambientePorUsuario[$ing->fk_id_user] ?? null,
                    'user_coursenumber' => $ing->user->user_coursenumber ?? null,
                    'user_program' => $ing->user->user_program ?? null,
                ];
            });

        return response()->json($resultado);
    }

    public function exportIngresos(Request $request)
    {
        $query = Ingreso::with('user');

        if ($request->filled('tipo')) {
            $query->where('ingreso_type', $request->tipo);
        }

        if ($request->filled('desde')) {
            // Rango sobre el datetime (no whereDate) para que use el índice.
            $query->where('ingreso_datetime', '>=', $request->desde . ' 00:00:00');
        }

        if ($request->filled('hasta')) {
            $query->where('ingreso_datetime', '<', Carbon::parse($request->hasta)->addDay()->toDateString() . ' 00:00:00');
        }

        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function ($sub) use ($q) {
                $sub->where('ingreso_place', 'like', "%{$q}%")
                    ->orWhereHas('user', function ($u) use ($q) {
                        $u->where('user_name', 'like', "%{$q}%")
                          ->orWhere('user_lastname', 'like', "%{$q}%")
                          ->orWhere('user_email', 'like', "%{$q}%");
                    });
            });
        }

        // Formato de salida: csv (default), xlsx o pdf. Lista blanca cerrada.
        $formato = strtolower($request->input('formato', 'csv'));
        if (!in_array($formato, ['csv', 'xlsx', 'pdf'], true)) {
            $formato = 'csv';
        }

        // Columnas disponibles (lista blanca: nadie puede pedir otra).
        $columnasDisponibles = [
            'usuario' => 'Usuario',
            'email' => 'Email',
            'identificacion' => 'Identificación',
            'tipo' => 'Tipo',
            'lugar' => 'Lugar',
            'fecha' => 'Fecha y Hora',
        ];

        // Selección de columnas: solo las solicitadas y válidas; si no, todas.
        $colsSel = [];
        if (is_string($request->input('cols')) && $request->input('cols') !== '') {
            foreach (explode(',', $request->input('cols')) as $c) {
                $c = trim(strtolower($c));
                if (array_key_exists($c, $columnasDisponibles)) {
                    $colsSel[] = $c;
                }
            }
        }
        if (empty($colsSel)) {
            $colsSel = array_keys($columnasDisponibles);
        }

        // Tope de seguridad: el export nunca materializa más de 5000 filas
        // (las más recientes) para no tumbar el contenedor con historiales enormes.
        $ingresos = $query->orderBy('ingreso_datetime', 'desc')->limit(5000)->get();

        // En hojas de cálculo (CSV/XLSX) hay que neutralizar fórmulas: una celda
        // que empiece por = + - @ se ejecutaría al abrirla en Excel. Se antepone '.
        $escaparHoja = ($formato === 'csv' || $formato === 'xlsx');
        $hacerFila = function ($i) use ($colsSel, $escaparHoja) {
            $datos = [
                'usuario' => trim(($i->user->user_name ?? '') . ' ' . ($i->user->user_lastname ?? '')),
                'email' => $i->user->user_email ?? '',
                'identificacion' => $i->user->user_identification ?? '',
                'tipo' => $i->ingreso_type,
                'lugar' => $i->ingreso_place,
                'fecha' => $i->ingreso_datetime,
            ];
            $fila = [];
            foreach ($colsSel as $c) {
                $valor = $datos[$c] ?? '';
                if ($escaparHoja && is_string($valor) && $valor !== '' && in_array($valor[0], ['=', '+', '-', '@'], true)) {
                    $valor = "'" . $valor;
                }
                $fila[] = $valor;
            }
            return $fila;
        };

        $titulos = array_map(fn ($c) => $columnasDisponibles[$c], $colsSel);

        $base = 'historial_ingresos_' . Carbon::now('America/Bogota')->format('Y-m-d_His');

        if ($formato === 'xlsx') {
            $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->fromArray($titulos, null, 'A1');

            $filaNum = 2;
            foreach ($ingresos as $i) {
                $sheet->fromArray($hacerFila($i), null, "A{$filaNum}");
                $filaNum++;
            }

            $ultima = $sheet->getHighestColumn();
            $header = $sheet->getStyle("A1:{$ultima}1");
            $header->getFont()->setBold(true)->getColor()->setARGB('FFFFFFFF');
            $header->getFill()
                ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                ->getStartColor()->setARGB('FF02D914');
            foreach (range('A', $ultima) as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }

            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            ob_start();
            $writer->save('php://output');
            $contenido = ob_get_clean();

            return response($contenido, 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $base . '.xlsx"',
            ]);
        }

        if ($formato === 'pdf') {
            $filas = $ingresos->map($hacerFila)->all();
            $pdf = Pdf::loadView('exports.ingresos_pdf', compact('titulos', 'filas'))
                ->setPaper('a4', 'landscape');
            return $pdf->download($base . '.pdf');
        }

        // csv (default): mantiene el comportamiento original, ahora con columnas libres.
        return response()->streamDownload(function () use ($ingresos, $colsSel) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");
            $titulosCsv = [];
            foreach ($colsSel as $c) {
                $titulosCsv[] = match ($c) {
                    'usuario' => 'Usuario',
                    'email' => 'Email',
                    'identificacion' => 'Identificación',
                    'tipo' => 'Tipo',
                    'lugar' => 'Lugar',
                    'fecha' => 'Fecha y Hora',
                    default => $c,
                };
            }
            fputcsv($handle, $titulosCsv);
            foreach ($ingresos as $i) {
                $datos = [
                    'usuario' => trim(($i->user->user_name ?? '') . ' ' . ($i->user->user_lastname ?? '')),
                    'email' => $i->user->user_email ?? '',
                    'identificacion' => $i->user->user_identification ?? '',
                    'tipo' => $i->ingreso_type,
                    'lugar' => $i->ingreso_place,
                    'fecha' => $i->ingreso_datetime,
                ];
                $fila = [];
                foreach ($colsSel as $c) {
                    // Misma neutralización de fórmulas que el XLSX (inyección CSV).
                    $valor = $datos[$c] ?? '';
                    if (is_string($valor) && $valor !== '' && in_array($valor[0], ['=', '+', '-', '@'], true)) {
                        $valor = "'" . $valor;
                    }
                    $fila[] = $valor;
                }
                fputcsv($handle, $fila);
            }
            fclose($handle);
        }, $base . '.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function stats()
    {
        $hoy = Carbon::now('America/Bogota')->toDateString();

        $ingresos_hoy = Ingreso::whereDate('ingreso_datetime', $hoy)->count();

        // Ingresos de los ultimos 7 dias agrupados por fecha y tipo
        $desde = Carbon::now('America/Bogota')->subDays(6)->startOfDay();
        $ingresos_por_dia = Ingreso::where('ingreso_datetime', '>=', $desde)
            ->select(
                DB::raw('DATE(ingreso_datetime) as fecha'),
                DB::raw("SUM(CASE WHEN ingreso_type = 'Entrada' THEN 1 ELSE 0 END) as entradas"),
                DB::raw("SUM(CASE WHEN ingreso_type = 'Salida' THEN 1 ELSE 0 END) as salidas")
            )
            ->groupBy(DB::raw('DATE(ingreso_datetime)'))
            ->orderBy('fecha')
            ->get();

        $ingresos_semana = [];
        for ($i = 0; $i < 7; $i++) {
            $fecha = $desde->copy()->addDays($i)->toDateString();
            $registro = $ingresos_por_dia->firstWhere('fecha', $fecha);
            $ingresos_semana[] = [
                'fecha' => $fecha,
                'entradas' => $registro ? (int) $registro->entradas : 0,
                'salidas' => $registro ? (int) $registro->salidas : 0,
            ];
        }

        $distribucion_por_tipo = Ingreso::select('ingreso_type', DB::raw('count(*) as total'))
            ->groupBy('ingreso_type')
            ->pluck('total', 'ingreso_type')
            ->toArray();

        // Ingresos agrupados por rol del usuario
        $distribucion_por_rol = Ingreso::join('usuarios', 'ingresos.fk_id_user', '=', 'usuarios.id_usuario')
            ->join('roles', 'usuarios.fk_id_rol', '=', 'roles.id_rol')
            ->select('roles.rol_name as rol', DB::raw('count(*) as total'))
            ->groupBy('roles.rol_name')
            ->get();

        $usuarios_totales = User::count();
        $equipos_activos = IngresoEquipo::where('equipo_status', 'Prestado')->count();
        $novedades_totales = Novedad::count();

        $ultimos_accesos = Ingreso::with('user')
            ->orderBy('ingreso_datetime', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'ingresos_hoy' => $ingresos_hoy,
            'ingresos_semana' => $ingresos_semana,
            'distribucion_por_tipo' => [
                'Entrada' => $distribucion_por_tipo['Entrada'] ?? 0,
                'Salida' => $distribucion_por_tipo['Salida'] ?? 0,
            ],
            'distribucion_por_rol' => $distribucion_por_rol,
            'usuarios_totales' => $usuarios_totales,
            'equipos_activos' => $equipos_activos,
            'novedades_totales' => $novedades_totales,
            'ultimos_accesos' => $ultimos_accesos,
        ]);
    }

    public function createUser(Request $request)
    { //VALIDACIONES PARA EL REGISTRO DE USUARIOS
        // Solo el Aprendiz tiene ficha y programa obligatorios.
        $esAprendiz = strcasecmp(Role::find($request->fk_id_rol)?->rol_name ?? '', 'Aprendiz') === 0; //VERIFICA SI EL ROL ES APRENDIZ
        $request->validate([
            'user_identification' => 'required|string|max:20|unique:usuarios', //VALIDA QUE EL USUARIO EXISTA
            'user_name' => 'required', //VALIDA QUE EL NOMBRE EXISTA
            'user_lastname' => 'required', //VALIDA QUE EL APELLIDO EXISTA
            'user_email' => [
                'required', 'email', 'unique:usuarios',
                function ($attribute, $value, $fail) {
                    $dominios = ['@gmail.com', '@hotmail.com', '@outlook.com', '@soy.sena.edu.co'];
                    foreach ($dominios as $d) {
                        if (str_ends_with(strtolower($value), $d)) return;
                    }
                    $fail('El correo debe ser @gmail.com, @hotmail.com, @outlook.com o @soy.sena.edu.co.');
                },
            ],
            'user_password' => 'required', //VALIDA QUE LA CONTRASEÑA EXISTA
            'user_coursenumber' => $esAprendiz ? 'required' : 'nullable', //FICHA SOLO OBLIGATORIA PARA APRENDIZ
            'user_program' => $esAprendiz ? 'required' : 'nullable', //PROGRAMA SOLO OBLIGATORIO PARA APRENDIZ
            'user_documento_tipo' => 'required|in:CC,CE,TI,PAS',
            'user_telefono' => 'nullable|string|max:20',
            'fk_id_rol' => 'required|exists:roles,id_rol',
            'image' => 'nullable|image|max:5120',
        ]);

        $profile_photo_path = null; //VALIDA QUE LA IMAGEN NO SE REPITAN
        if ($request->hasFile('image')) { //VALIDA QUE LA IMAGEN EXISTA
            $profile_photo_path = $request->file('image')->storeOnCloudinary('avatars')->getSecurePath(); //VALIDA QUE LA IMAGEN NO SE REPITAN
        }

        $user = User::create([ //CREA EL USUARIO
            'user_identification' => $request->user_identification,
            'user_name' => $request->user_name,
            'user_lastname' => $request->user_lastname,
            'user_email' => $request->user_email,
            'user_password' => Hash::make($request->user_password),
            'user_coursenumber' => $esAprendiz ? $request->user_coursenumber : null, //NULL PARA ADMIN/INSTRUCTOR
            'user_program' => $esAprendiz ? $request->user_program : null, //NULL PARA ADMIN/INSTRUCTOR
            'user_documento_tipo' => $request->user_documento_tipo,
            'user_telefono' => $request->user_telefono,
            'fk_id_rol' => $request->fk_id_rol,
            'profile_photo_path' => $profile_photo_path,
            'estado_cuenta' => 'aprobada',
        ]);

        return response()->json($user->load('role'), 201);
    }

    // Aprueba una cuenta pendiente (bandeja del superadmin): marca aprobada
    // y avisa al correo. El envío nunca rompe la petición.
    public function aprobarCuenta(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $user->estado_cuenta = 'aprobada';
        $user->save();
        try {
            $nombre = trim(($user->user_name ?? '') . ' ' . ($user->user_lastname ?? ''));
            Mail::to($user->user_email)->send(new CuentaAprobadaMail($nombre));
        } catch (\Throwable $e) {
            Log::error('No se pudo enviar correo de aprobación a ' . $user->user_email . ': ' . $e->getMessage());
        }
        return response()->json(['message' => 'Cuenta aprobada. Se avisó al correo del usuario.', 'user' => $user->load('role')]);
    }

    // Rechaza una cuenta pendiente: marca rechazada (el login la bloquea con aviso)
    // y avisa al correo. El envío nunca rompe la petición.
    public function rechazarCuenta(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $user->estado_cuenta = 'rechazada';
        $user->save();
        try {
            $nombre = trim(($user->user_name ?? '') . ' ' . ($user->user_lastname ?? ''));
            Mail::to($user->user_email)->send(new CuentaRechazadaMail($nombre));
        } catch (\Throwable $e) {
            Log::error('No se pudo enviar correo de rechazo a ' . $user->user_email . ': ' . $e->getMessage());
        }
        return response()->json(['message' => 'Solicitud rechazada. Se avisó al correo del usuario.', 'user' => $user->load('role')]);
    }

    public function deleteUser(Request $request, $id) //FUNCION PARA ELIMINAR USUARIO POR ID (borrado total: primero su rastro, luego el usuario)
    {
        if ((int) $request->user()->id_usuario === (int) $id) { //NADIE PUEDE BORRARSE A SI MISMO
            return response()->json(['message' => 'No puedes eliminar tu propia cuenta.'], 403);
        }
        $user = User::findOrFail($id);
        DB::transaction(function () use ($user) { //TODO JUNTO O NADA: si algo falla no queda medio borrado
            $uid = $user->id_usuario;
            $user->tokens()->delete(); //SESIONES SANCTUM
            TwoFactorChallenge::where('fk_id_usuario', $uid)->delete(); //RETOS 2FA
            TokenRecovery::where('fk_id_usuario', $uid)->delete(); //TOKENS DE RECUPERACION
            Ingreso::where('fk_id_user', $uid)->delete(); //HISTORIAL DE ACCESOS
            IngresoEquipo::where('fk_id_usuario', $uid)->delete(); //EQUIPOS
            Novedad::where('fk_id_usuario', $uid)->delete(); //NOVEDADES
            Excusa::where('fk_id_aprendiz', $uid)->orWhere('fk_id_instructor', $uid)->delete(); //EXCUSAS
            Notificacion::where('fk_id_usuario', $uid)->delete(); //NOTIFICACIONES
            DB::table('ambiente_aprendiz')->where('fk_id_usuario', $uid)->delete(); //PIVOTES DE AMBIENTES
            DB::table('ambiente_instructor')->where('fk_id_instructor', $uid)->delete();
            if (\Illuminate\Support\Facades\Schema::hasTable('aprendiz_instructor')) {
                DB::table('aprendiz_instructor')->where('fk_id_aprendiz', $uid)->orWhere('fk_id_instructor', $uid)->delete();
            }
            $user->delete(); //ELIMINA EL USUARIO
        });
        return response()->json(['message' => 'Usuario eliminado']); //RETORNA MENSAJE DE ELIMINACION
    }

    public function updateUser(Request $request, $id) //FUNCION PARA ACTUALIZAR USUARIO
    {
        $user = User::findOrFail($id); //BUSCA EL USUARIO POR ID
        // Solo el Aprendiz tiene ficha y programa obligatorios.
        $esAprendiz = strcasecmp(Role::find($request->fk_id_rol)?->rol_name ?? '', 'Aprendiz') === 0; //VERIFICA SI EL ROL ES APRENDIZ
        
        $request->validate([
            'user_identification' => 'required|string|max:20|unique:usuarios,user_identification,' . $id . ',id_usuario',
            'user_name' => 'required',
            'user_lastname' => 'required',
            'user_email' => [
                'required', 'email', 'unique:usuarios,user_email,' . $id . ',id_usuario',
                // El dominio solo se exige si el correo cambia: las cuentas del
                // centro (@sena.edu.co) se deben poder editar sin tocarlas.
                function ($attribute, $value, $fail) use ($user) {
                    if (strcasecmp(trim((string) $value), trim((string) $user->user_email)) === 0) {
                        return;
                    }
                    $dominios = ['@gmail.com', '@hotmail.com', '@outlook.com', '@soy.sena.edu.co'];
                    foreach ($dominios as $d) {
                        if (str_ends_with(strtolower($value), $d)) return;
                    }
                    $fail('El correo debe ser @gmail.com, @hotmail.com, @outlook.com o @soy.sena.edu.co.');
                },
            ],
            'user_password' => 'nullable|min:6',
            'user_coursenumber' => $esAprendiz ? 'required' : 'nullable', //FICHA SOLO OBLIGATORIA PARA APRENDIZ
            'user_program' => $esAprendiz ? 'required' : 'nullable', //PROGRAMA SOLO OBLIGATORIO PARA APRENDIZ
            'user_documento_tipo' => 'required|in:CC,CE,TI,PAS',
            'user_telefono' => 'nullable|string|max:20',
            'fk_id_rol' => 'required|exists:roles,id_rol',
            'image' => 'nullable|image|max:5120',
        ]);
        //ACTUALIZA LA IMAGEN DEL USUARIO
        if ($request->hasFile('image')) { //VALIDA QUE LA IMAGEN EXISTA
            $profile_photo_path = $request->file('image')->storeOnCloudinary('avatars')->getSecurePath();
            $user->profile_photo_path = $profile_photo_path; //ACTUALIZA LA IMAGEN DEL USUARIO
        }

        $user->user_identification = $request->user_identification; //ACTUALIZA LA IDENTIFICACION DEL USUARIO
        $user->user_name = $request->user_name; //ACTUALIZA EL NOMBRE DEL USUARIO
        $user->user_lastname = $request->user_lastname; //ACTUALIZA EL APELLIDO DEL USUARIO
        // Si cambia el correo, se invalida su verificación hasta que lo confirme de nuevo.
        if ($user->user_email !== $request->user_email) {
            $user->email_verified_at = null;
        }
        $user->user_email = $request->user_email; //ACTUALIZA EL CORREO DEL USUARIO
        $user->user_coursenumber = $request->filled('user_coursenumber') ? $request->user_coursenumber : null; //FICHA (NULL PARA ADMIN/INSTRUCTOR)
        $user->user_program = $request->filled('user_program') ? $request->user_program : null; //PROGRAMA (NULL PARA ADMIN/INSTRUCTOR)
        $user->user_documento_tipo = $request->user_documento_tipo ?? $user->user_documento_tipo; //TIPO DE DOCUMENTO
        $user->user_telefono = $request->filled('user_telefono') ? $request->user_telefono : null; //TELEFONO
        $user->fk_id_rol = $request->fk_id_rol; //ACTUALIZA EL ROL DEL USUARIO

        if ($request->filled('user_password')) { //VALIDA QUE LA CONTRASEÑA EXISTA
            $user->user_password = Hash::make($request->user_password); //ACTUALIZA LA CONTRASEÑA DEL USUARIO
        }

        $user->save(); //GUARDA LOS CAMBIOS EN LA BASE DE DATOS

        return response()->json($user->load('role')); //RETORNA EL USUARIO ACTUALIZADO
    }

    public function getRoles() //FUNCION PARA OBTENER TODOS LOS ROLES
    {
        return response()->json(Role::all()); //RETORNA TODOS LOS ROLES
    }

    public function getMyIngresos(Request $request) //FUNCION PARA OBTENER MIS INGRESOS
    {
        $ingresos = Ingreso::where('fk_id_user', $request->user()->id_usuario) //BUSCA LOS INGRESOS DEL USUARIO
            ->with('user') //RELACIONA CON EL USUARIO
            ->orderBy('ingreso_datetime', 'desc') //ORDENA POR FECHA DESCENDENTE
            ->get(); //OBTIENE TODOS LOS INGRESOS
        return response()->json($ingresos); //RETORNA LOS INGRESOS
    }

    public function verificarPassword(Request $request) //VERIFICA LA CONTRASEÑA ACTUAL CON LA SESION (para registrar la huella sin disparar 2FA ni enviar correos)
    {
        $request->validate(['user_password' => 'required|string']); //SOLO PIDE LA CONTRASEÑA ACTUAL
        $user = $request->user(); //USUARIO AUTENTICADO POR TOKEN
        if (!Hash::check($request->input('user_password'), $user->user_password)) { //COMPARA SIN CREAR RETOS NI TOKENS
            return response()->json(['message' => 'Contraseña incorrecta.'], 422);
        }
        return response()->json(['message' => 'Contraseña verificada.']); //LISTO PARA ABRIR EL SENSOR DE HUELLA
    }

    public function updateMyProfile(Request $request) //FUNCION PARA ACTUALIZAR MI PERFIL
    {
        $user = $request->user(); //OBTIENE EL USUARIO ACTUAL
        $user->loadMissing('role'); //ASEGURA LA RELACION CON EL ROL
        // Solo el Aprendiz tiene ficha y programa; admin e instructor los dejan en null.
        $esAprendiz = strcasecmp($user->role->rol_name ?? '', 'Aprendiz') === 0; //VERIFICA SI ES APRENDIZ
        
        $request->validate([ //VALIDA QUE LA INFORMACION SEA CORRECTA
            'user_identification' => 'required|string|max:20|unique:usuarios,user_identification,' . $user->id_usuario . ',id_usuario', //VALIDA QUE LA IDENTIFICACION NO SE REPITA
            'user_name' => 'required', //VALIDA QUE EL NOMBRE EXISTA
            'user_lastname' => 'required', //VALIDA QUE EL APELLIDO EXISTA
            'user_email' => [
                'required', 'email', 'unique:usuarios,user_email,' . $user->id_usuario . ',id_usuario',
                // Mismo whitelist de dominios que el registro y el CRUD admin.
                // Solo se exige cuando el correo cambia de verdad: las cuentas
                // del centro (@sena.edu.co) deben poder guardar su perfil.
                function ($attribute, $value, $fail) use ($user) {
                    if (strcasecmp(trim((string) $value), trim((string) $user->user_email)) === 0) {
                        return;
                    }
                    $dominios = ['@gmail.com', '@hotmail.com', '@outlook.com', '@soy.sena.edu.co'];
                    foreach ($dominios as $d) {
                        if (str_ends_with(strtolower($value), $d)) return;
                    }
                    $fail('El correo debe ser @gmail.com, @hotmail.com, @outlook.com o @soy.sena.edu.co.');
                },
            ], //VALIDA QUE EL CORREO EXISTA
            'user_password' => 'nullable|min:6', //VALIDA QUE LA CONTRASEÑA EXISTA
            'two_factor_code' => 'nullable|string|size:6', //CODIGO 2FA PARA CAMBIO DE CLAVE
            'user_coursenumber' => $esAprendiz ? 'required' : 'nullable', //FICHA SOLO OBLIGATORIA PARA APRENDIZ
            'user_program' => $esAprendiz ? 'required' : 'nullable', //PROGRAMA SOLO OBLIGATORIO PARA APRENDIZ
            'image' => 'nullable|image|max:5120', //VALIDA QUE LA IMAGEN EXISTA
        ]);

        // Puerta 2FA al cambiar la clave desde el perfil: con verificación activa
        // se exige el código de 6 dígitos enviado al correo. Sin código, se genera
        // uno nuevo, se envía y se devuelve 422 para que la app abra el diálogo.
        if ($request->filled('user_password') && $user->two_factor_enabled) {
            $claveCache = '2fa_clave_' . $user->id_usuario;
            if (!$request->filled('two_factor_code')) {
                $codigo = (string) random_int(100000, 999999);
                Cache::put($claveCache, Hash::make($codigo), now()->addMinutes(10));
                try {
                    Mail::to($user->user_email)->send(new \App\Mail\TwoFactorCodeMail($codigo, '#', '#'));
                } catch (\Throwable $e) {
                    \Illuminate\Support\Facades\Log::error("Error enviando codigo cambio clave a {$user->user_email}: " . $e->getMessage());
                }
                return response()->json(['message' => 'Te enviamos un código de 6 dígitos a tu correo. Escríbelo para autorizar la nueva contraseña.', 'errors' => ['two_factor_code' => ['código enviado']]], 422);
            }
            $hash = Cache::get($claveCache);
            if (!$hash || !Hash::check($request->input('two_factor_code'), $hash)) {
                return response()->json(['message' => 'El código es incorrecto o venció. Revisa tu correo o guarda otra vez para recibir uno nuevo.', 'errors' => ['two_factor_code' => ['código inválido']]], 422);
            }
            Cache::forget($claveCache);
        }

        if ($request->hasFile('image')) { //VALIDA QUE LA IMAGEN EXISTA
            $profile_photo_path = $request->file('image')->storeOnCloudinary('avatars')->getSecurePath(); //VALIDA QUE LA IMAGEN NO SE REPITAN
            $user->profile_photo_path = $profile_photo_path; //ACTUALIZA LA IMAGEN DEL USUARIO
        }

        $user->user_identification = $request->user_identification; //ACTUALIZA LA IDENTIFICACION DEL USUARIO
        $user->user_name = $request->user_name; //ACTUALIZA EL NOMBRE DEL USUARIO
        $user->user_lastname = $request->user_lastname; //ACTUALIZA EL APELLIDO DEL USUARIO
        // Si cambia el correo, se invalida su verificación hasta que lo confirme de nuevo.
        if ($user->user_email !== $request->user_email) {
            $user->email_verified_at = null;
        }
        $user->user_email = $request->user_email; //ACTUALIZA EL CORREO DEL USUARIO
        $user->user_coursenumber = $request->filled('user_coursenumber') ? $request->user_coursenumber : null; //FICHA (NULL PARA ADMIN/INSTRUCTOR)
        $user->user_program = $request->filled('user_program') ? $request->user_program : null; //PROGRAMA (NULL PARA ADMIN/INSTRUCTOR)

        if ($request->filled('user_password')) { //VALIDA QUE LA CONTRASEÑA EXISTA
            $user->user_password = Hash::make($request->user_password); //ACTUALIZA LA CONTRASEÑA DEL USUARIO
        }

        $user->save(); //GUARDA LOS CAMBIOS EN LA BASE DE DATOS

        return response()->json($user->load('role')); //RETORNA EL USUARIO ACTUALIZADO
    }

    public function myStats(Request $request) //ESTADÍSTICAS PERSONALES DEL USUARIO AUTENTICADO
    {
        $user = $request->user();
        $hoy = Carbon::now('America/Bogota')->toDateString();

        $ingresos_hoy = Ingreso::where('fk_id_user', $user->id_usuario)
            ->whereDate('ingreso_datetime', $hoy)
            ->count();

        // Ingresos del usuario en los ultimos 7 dias agrupados por fecha y tipo
        $desde = Carbon::now('America/Bogota')->subDays(6)->startOfDay();
        $ingresos_por_dia = Ingreso::where('fk_id_user', $user->id_usuario)
            ->where('ingreso_datetime', '>=', $desde)
            ->select(
                DB::raw('DATE(ingreso_datetime) as fecha'),
                DB::raw("SUM(CASE WHEN ingreso_type = 'Entrada' THEN 1 ELSE 0 END) as entradas"),
                DB::raw("SUM(CASE WHEN ingreso_type = 'Salida' THEN 1 ELSE 0 END) as salidas")
            )
            ->groupBy(DB::raw('DATE(ingreso_datetime)'))
            ->orderBy('fecha')
            ->get();

        $ingresos_semana = [];
        for ($i = 0; $i < 7; $i++) {
            $fecha = $desde->copy()->addDays($i)->toDateString();
            $registro = $ingresos_por_dia->firstWhere('fecha', $fecha);
            $ingresos_semana[] = [
                'fecha' => $fecha,
                'entradas' => $registro ? (int) $registro->entradas : 0,
                'salidas' => $registro ? (int) $registro->salidas : 0,
            ];
        }

        $distribucion_por_tipo = Ingreso::where('fk_id_user', $user->id_usuario)
            ->select('ingreso_type', DB::raw('count(*) as total'))
            ->groupBy('ingreso_type')
            ->pluck('total', 'ingreso_type')
            ->toArray();

        $novedades_totales = Novedad::where('fk_id_usuario', $user->id_usuario)->count();

        $ultimos_accesos = Ingreso::with('user')
            ->where('fk_id_user', $user->id_usuario)
            ->orderBy('ingreso_datetime', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'ingresos_hoy' => $ingresos_hoy,
            'ingresos_semana' => $ingresos_semana,
            'distribucion_por_tipo' => [
                'Entrada' => $distribucion_por_tipo['Entrada'] ?? 0,
                'Salida' => $distribucion_por_tipo['Salida'] ?? 0,
            ],
            'novedades_totales' => $novedades_totales,
            'ultimos_accesos' => $ultimos_accesos,
        ]);
    }
}
