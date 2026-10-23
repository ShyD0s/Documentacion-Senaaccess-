<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

// Los paneles (Admin, Instructor, Aprendiz) ahora se sirven desde el SPA React
// (ver /admin, /instructor, /aprendiz en resources/js/app.jsx).
// Se removieron las rutas estáticas de public/ (legacy).

// Descarga directa de los APK para el QR (antes del catch-all del SPA).
Route::get('/SenaAccessV3.0.apk', function () {
    return response()->download(public_path('SenaAccessV3.0.apk'));
});
Route::get('/SenaAccessV4.1.apk', function () {
    return response()->download(public_path('SenaAccessV4.1.apk'));
});
Route::get('/SenaAccessV3.7.apk', function () {
    return response()->download(public_path('SenaAccessV3.7.apk'));
});

// Catch-all: React SPA maneja todas las rutas (incluyendo login y paneles)
Route::get('/{any}', function () {
    return view('welcome');
})->where('any', '.*'); 
