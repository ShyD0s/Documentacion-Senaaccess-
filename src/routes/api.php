<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\AmbienteController;
use App\Http\Controllers\EquipmentController;
use App\Http\Controllers\ExcusaController;
use App\Http\Controllers\NovedadController;
use App\Http\Controllers\PasskeyController;
use App\Http\Controllers\NotificacionController;
use App\Http\Controllers\TwoFactorController;
use App\Http\Controllers\ChatbotController;
use App\Http\Controllers\AccesoQrController;
use App\Http\Controllers\PrediccionController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Healthcheck público para Railway (no requiere auth)
Route::get('/health', function () {
    return response()->json(['status' => 'ok']);
});

// Rutas de autenticación con Sanctum
Route::post('/register', [AuthController::class, 'register']);
// Throttle anclado al correo (ver AppServiceProvider): máx 5 fallos/min por cuenta.
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
// Throttle por correo: máx 3 solicitudes/min, evita spam de correos.
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:forgot-password');
// Throttle por código: permite probar el código sin abrir fuerza bruta.
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:reset-password');
// Invitados (público): el visitante genera su QR de un solo uso (60 min) y
// recepción lo valida escaneándolo, registrando su Entrada en el historial.
Route::post('/validate-guest-qr', [AuthController::class, 'validateGuestQr'])->middleware('throttle:login');
Route::post('/register-guest', [AuthController::class, 'registerGuest'])->middleware('throttle:guest');
Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth:sanctum');

// Verificación de correo: enlace firmado temporal (GET, firmado con 'signed');
// el hash del correo y la firma viajan en la URL del email enviado.
Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->middleware('signed')
    ->name('verification.verify');
// Reenvío del enlace de verificación (requiere sesión).
Route::post('/email/verification-notification', [AuthController::class, 'resendVerification'])
    ->middleware('auth:sanctum')
    ->middleware('throttle:verification');

// Verificación en dos pasos (2FA):
// - validar-codigo y estado/{id} son PÚBLICOS: el dispositivo en pleno intento de
//   login aún no tiene token; el challenge_id es un UUID con entropía suficiente
//   para usarlo como secreto de ese único intento.
// - config/activar/desactivar/pendientes/aprobar requieren sesión (perfil y la
//   tarjeta "¿Eres tú?" en un dispositivo ya confiable).
Route::post('/2fa/validar-codigo', [TwoFactorController::class, 'validarCodigo'])->middleware('throttle:login');
Route::get('/2fa/estado/{challengeId}', [TwoFactorController::class, 'estado']);
// Botones "¿Eres tú?" del correo (tipo Google): público pero con enlace firmado.
Route::get('/2fa/decidir', [TwoFactorController::class, 'decidir']);

// Huella digital en la web (WebAuthn / passkey):
// - las opciones y la autenticación son PÚBLICAS (el reto es de un solo uso).
// - registrar y administrar los dispositivos exige sesión iniciada.
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/huellas/registro/opciones', [PasskeyController::class, 'opcionesRegistro'])->middleware('throttle:20,1');
    Route::post('/huellas/registro', [PasskeyController::class, 'registrar'])->middleware('throttle:20,1');
});
Route::post('/huellas/login/opciones', [PasskeyController::class, 'opcionesAutenticacion'])->middleware('throttle:20,1');
Route::post('/huellas/login', [PasskeyController::class, 'autenticar'])->middleware('throttle:20,1');

// Salida en tiempo real: ELIMINADA. Cerrar la app o el navegador nunca genera
// salidas; la Salida solo se marca con el QR de salida o el PIN de excusa.

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user()->load('role');
    });

    // Rutas de usuario general (Aprendiz)
    Route::get('/my-ingresos', [AdminController::class, 'getMyIngresos']);
    Route::get('/my-stats', [AdminController::class, 'myStats']);
    Route::get('/my-equipment', [EquipmentController::class, 'getMyEquipment']);
    Route::get('/my-equipment/{id}/comprobante', [EquipmentController::class, 'comprobante']);
    Route::post('/my-equipment', [EquipmentController::class, 'store']);
    Route::put('/my-profile', [AdminController::class, 'updateMyProfile']);
    Route::post('/my-profile/verificar-password', [AdminController::class, 'verificarPassword']);

    // Huella digital: dispositivos registrados y baja de uno de ellos.
    Route::get('/huellas', [PasskeyController::class, 'index']);
    Route::delete('/huellas/{id}', [PasskeyController::class, 'destroy']);

    // Rutas compartidas entre Admin e Instructor
    Route::middleware('admin_or_instructor')->prefix('admin')->group(function () {
        Route::get('/users', [AdminController::class, 'index']);
        Route::get('/roles', [AdminController::class, 'getRoles']);
        
        // Rutas admin para crear usuarios 
        Route::middleware('admin')->group(function () {
            Route::post('/users', [AdminController::class, 'createUser']);
            Route::put('/users/{id}', [AdminController::class, 'updateUser']);
            Route::delete('/users/{id}', [AdminController::class, 'deleteUser']);
            Route::post('/users/{id}/aprobar', [AdminController::class, 'aprobarCuenta']);
            Route::post('/users/{id}/rechazar', [AdminController::class, 'rechazarCuenta']);
        });

        // El historial global de accesos y las estadísticas del centro son admin
        // o portero: la portería consulta movimientos sin gestionar usuarios.
        Route::middleware('admin_or_portero')->group(function () {
            Route::get('/ingresos', [AdminController::class, 'getIngresos']);
            Route::get('/ingresos/export', [AdminController::class, 'exportIngresos']);
            Route::get('/stats', [AdminController::class, 'stats']);
            Route::get('/presentes', [AdminController::class, 'presentes']);
        });

        // Rutas para gestionar equipos: admin o portero registran y marcan
        // devoluciones; ver el inventario completo y eliminar también ambos.
        Route::post('/equipment', [EquipmentController::class, 'store'])->middleware('admin_or_portero');
        Route::post('/equipment/{id}/return', [EquipmentController::class, 'markReturn'])->middleware('admin_or_portero');
        Route::middleware('admin_or_portero')->group(function () {
            Route::get('/equipment', [EquipmentController::class, 'index']);
            Route::delete('/equipment/{id}', [EquipmentController::class, 'deleteEquipment']);
        });
    });

    // Rutas de novedades para cualquier rol autenticado (lectura). El aprendiz
    // también consulta GET /novedades desde su dashboard.
    Route::get('/my-novedades', [NovedadController::class, 'getMyNovedades']); //OBTIENE LAS NOVEDADES DEL USUARIO
    Route::apiResource('novedades', NovedadController::class);

    // Rutas de notificaciones in-app
    Route::get('/notifications', [NotificacionController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificacionController::class, 'unreadCount']);
    Route::put('/notifications/{id}/read', [NotificacionController::class, 'markRead']);
    Route::put('/notifications/read-all', [NotificacionController::class, 'markAllRead']);

    // Configuración y aprobación de la verificación en dos pasos.
    Route::get('/2fa/estado-config', [TwoFactorController::class, 'estadoConfig']);
    Route::post('/2fa/activar', [TwoFactorController::class, 'activar']);
    Route::post('/2fa/desactivar', [TwoFactorController::class, 'desactivar']);
    Route::get('/2fa/pendientes', [TwoFactorController::class, 'pendientes']);
    Route::post('/2fa/aprobar', [TwoFactorController::class, 'aprobar']);

    // Chatbot flotante (Gemini): responde 503 honesto sin GEMINI_API_KEY.
    Route::post('/chatbot', [ChatbotController::class, 'chat']);

    // QR rotativo de portería: mostrar (admin/superadmin) y validar (cualquiera).
    Route::get('/acceso/qr/{tipo}', [AccesoQrController::class, 'mostrar'])->middleware('admin_or_portero');
    Route::post('/acceso/validar', [AccesoQrController::class, 'validar']);
    // PIN corto de acceso: portería lo genera y el aprendiz lo digita sin cámara.
    Route::post('/admin/pines-acceso', [AccesoQrController::class, 'generarPin'])->middleware('admin_or_portero');
    Route::post('/acceso/validar-pin', [AccesoQrController::class, 'validarPin']);

    // Ambientes (admin crea, instructor gestiona sus ambientes/aprendices).
    Route::get('/ambientes', [AmbienteController::class, 'index']);
    Route::get('/mis-ambientes', [AmbienteController::class, 'misAmbientes']);
    Route::get('/mis-ambientes/{id}/aprendices', [AmbienteController::class, 'misAprendices']);
    Route::post('/mis-ambientes/{id}/aprendices', [AmbienteController::class, 'misAddAprendiz']);
    Route::delete('/mis-ambientes/{id}/aprendices/{userId}', [AmbienteController::class, 'misRemoveAprendiz']);

    // Gestión de ambientes (solo admin).
    Route::middleware('admin')->group(function () {
        Route::get('/admin/prediccion', [PrediccionController::class, 'indice']);
        Route::post('/admin/ambientes', [AmbienteController::class, 'store']);
        Route::put('/admin/ambientes/{id}', [AmbienteController::class, 'update']);
        Route::delete('/admin/ambientes/{id}', [AmbienteController::class, 'destroy']);
        Route::post('/admin/ambientes/{id}/instructores', [AmbienteController::class, 'syncInstructores']);
        Route::get('/admin/ambientes/{id}/aprendices', [AmbienteController::class, 'getAprendices']);
        Route::post('/admin/ambientes/{id}/aprendices', [AmbienteController::class, 'addAprendiz']);
        Route::delete('/admin/ambientes/{id}/aprendices/{userId}', [AmbienteController::class, 'removeAprendiz']);
    });

    // Excusas con PIN: instructor crea (elige aprendiz+ambiente+motivo → genera PIN), admin valida en salida.
    Route::post('/instructor/excusas', [ExcusaController::class, 'store']);
    Route::get('/instructor/excusas', [ExcusaController::class, 'misComoInstructor']);
    Route::delete('/instructor/excusas/{id}', [ExcusaController::class, 'anular']);
    Route::get('/mis-excusas', [ExcusaController::class, 'misExcusas']);
    // El aprendiz limpia su historial: solo excusas ya cerradas (usada/expirada/anulada).
    Route::delete('/mis-excusas/{id}', [ExcusaController::class, 'eliminarMisExcusa']);
    Route::post('/excusas/validar', [ExcusaController::class, 'validar'])->middleware('throttle:pin');
    Route::middleware('admin_or_portero')->group(function () {
        Route::get('/admin/excusas', [ExcusaController::class, 'indexAdmin']);
    });

    // Rutas específicas del Instructor
    Route::middleware('auth:sanctum')->group(function () {
        // Solo el instructor puede ver sus propios comprobantes
    });
});

// Cualquier ruta /api/* que no exista responde JSON y no el HTML del SPA.
// Antes caia en el catch-all de routes/web.php y el movil recibia una pagina
// HTML con estado 200: el error era ilegible en el cliente.
// Es una ruta normal (no fallback) porque Laravel registra las fallbacks al
// final de la lista y el catch-all del SPA las gana.
Route::any('/{rutaApi}', function (Request $request) {
    return response()->json([
        'message' => 'Recurso no encontrado.',
        'ruta' => $request->path(),
    ], 404);
})->where('rutaApi', '.*');
