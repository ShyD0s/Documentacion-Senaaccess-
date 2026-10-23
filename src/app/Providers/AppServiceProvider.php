<?php

namespace App\Providers;

use App\Mail\BrevoTransport;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Transporte Brevo por HTTPS: Railway bloquea SMTP saliente (puertos 25/465/587)
        // y solo deja pasar peticiones HTTPS. Brevo entrega a CUALQUIER destinatario sin
        // necesidad de dominio propio (remitente verificado por correo).
        Mail::extend('brevo', function (array $config) {
            return new BrevoTransport(
                apiKey: $config['key'] ?? '',
                fromEmail: $config['from']['address'] ?? config('mail.from.address'),
                fromName: $config['from']['name'] ?? config('mail.from.name'),
            );
        });

        // Los rate limits se anclan al CORREO/código (no a la IP): detrás del proxy
        // de Railway la IP del cliente varía por petición y un límite por IP nunca
        // se acumularía. Limitar por cuenta/código es además más seguro contra fuerza
        // bruta dirigida a un mismo correo.
        RateLimiter::for('login', function (Request $request) {
            $key = strtolower(trim($request->input('user_email', '')));
            return Limit::perMinute(5)->by($key ?: $request->ip());
        });

        RateLimiter::for('forgot-password', function (Request $request) {
            $key = strtolower(trim($request->input('email', '')));
            return Limit::perMinute(3)->by($key ?: $request->ip());
        });

        RateLimiter::for('reset-password', function (Request $request) {
            $key = trim($request->input('code', ''));
            return Limit::perMinute(10)->by($key ?: $request->ip());
        });

        RateLimiter::for('verification', function (Request $request) {
            $userId = $request->user()?->id_usuario;
            return Limit::perMinute(3)->by($userId ?: $request->ip());
        });

        // Invitados y PIN de excusas: anclados al identificador/código, no a la IP
        // (mismo criterio que el resto de limiters de este archivo).
        RateLimiter::for('guest', function (Request $request) {
            $key = preg_replace('/\W/', '', $request->input('user_identification', ''));
            return Limit::perMinute(10)->by($key ?: $request->ip());
        });

        RateLimiter::for('pin', function (Request $request) {
            $key = trim($request->input('pin', ''));
            return Limit::perMinute(10)->by($key ?: $request->ip());
        });
    }
}