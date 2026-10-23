<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAdminRole
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {   // verificar rol superadmin (superusuario total)
        $user = $request->user();
        if (!$user || strtolower($user->role?->rol_name) !== 'superadmin') {
            return response()->json(['message' => 'No tienes permisos de administrador'], 403);
        }

        return $next($request);
    }
}
