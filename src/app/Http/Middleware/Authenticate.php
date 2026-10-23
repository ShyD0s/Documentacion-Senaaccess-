<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     *
     * Esta aplicacion es un SPA: la pantalla de acceso la maneja React, no
     * existe una ruta de servidor llamada "login". Redirigir ahi devolvia un
     * error 500 (RouteNotFoundException) en vez de un 401 legible, asi que
     * ahora siempre se responde 401 y el cliente decide que hacer.
     */
    protected function redirectTo(Request $request): ?string
    {
        return null;
    }
}
