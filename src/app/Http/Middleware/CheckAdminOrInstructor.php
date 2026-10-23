<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAdminOrInstructor
{
    /**
     * Handle an incoming request.
     * 
     *
     */

    // Verificación de rol superadmin, instructor o admin (lectura operativa).
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user || !in_array(strtolower($user->role?->rol_name), ['superadmin', 'instructor', 'admin'])) {
            return response()->json(['message' => 'No tienes permisos para realizar esta acción'], 403);
        }

        return $next($request);
    }
}
