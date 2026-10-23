# SenaAccess — stack técnico y API

## Repositorios
- Web/backend: `SenaAccessWeb` (Laravel + React). Repositorio GitHub `Andres777233/SenaAccessWeb`, rama `main`. Despliegue en Railway con Dockerfile.
- Android: `SenaAccessMovil` (Kotlin + Jetpack Compose). Consume la misma API por HTTPS (Retrofit, sin fallback local).

## Backend
- Laravel 10, PHP 8.3+, MySQL, autenticación con Laravel Sanctum (token Bearer).
- SPA React 19 compilada con Vite; Bootstrap 5 por CDN.
- IA: Google Gemini (chatbot). Correo: API HTTP de Brevo (Railway no permite SMTP saliente). Fotos: Cloudinary.
- Despliegue: Railway ejecuta `composer install`, `npm run build`, `php artisan migrate --force --seed` y `php artisan serve`.
- Zona horaria de negocio: `America/Bogota` para ingresos y reportes; los retos 2FA se guardan en UTC.

## Endpoints principales (`/api`)
- Auth: `POST /register`, `POST /login`, `POST /logout`, `POST /forgot-password`, `POST /reset-password`, `GET /email/verify/{id}/{hash}`, `POST /email/verification-notification`.
- Invitados: `POST /register-guest`, `POST /validate-guest-qr`.
- 2FA: `POST /2fa/validar-codigo`, `GET /2fa/estado/{id}`, `GET /2fa/decidir`, `GET /2fa/estado-config`, `POST /2fa/activar`, `POST /2fa/desactivar`, `GET /2fa/pendientes`, `POST /2fa/aprobar`.
- Perfil y propio: `GET /user`, `GET /my-ingresos`, `GET /my-stats`, `GET /my-equipment`, `POST /my-equipment`, `PUT /my-profile`, `POST /my-profile/verificar-password`.
- Usuarios (superadmin): `GET /admin/users`, `GET /admin/roles`, `POST /admin/users`, `PUT /admin/users/{id}`, `DELETE /admin/users/{id}`, `POST /admin/users/{id}/aprobar`, `POST /admin/users/{id}/rechazar`.
- Historial y presencia (superadmin/Admin): `GET /admin/ingresos`, `GET /admin/ingresos/export`, `GET /admin/stats`, `GET /admin/presentes`.
- Equipos: `GET /equipment`, `POST /equipment`, `POST /equipment/{id}/return`, `DELETE /equipment/{id}`.
- Novedades: `GET /my-novedades`, `GET/POST/PUT/DELETE /novedades`.
- Notificaciones: `GET /notifications`, `GET /notifications/unread-count`, `PUT /notifications/{id}/read`, `PUT /notifications/read-all`.
- Chatbot: `POST /chatbot` (mensaje + historial; responde texto).
- Acceso QR: `GET /acceso/qr/{tipo}` (entrada|salida, solo portería), `POST /acceso/validar`.
- Ambientes: `GET /ambientes`, `GET /mis-ambientes`, `GET/POST/DELETE /mis-ambientes/{id}/aprendices`, y CRUD `/admin/ambientes`.
- Excusas: `POST /instructor/excusas`, `GET /instructor/excusas`, `DELETE /instructor/excusas/{id}`, `GET /mis-excusas`, `DELETE /mis-excusas/{id}`, `POST /excusas/validar`, `GET /admin/excusas`.

## Base de datos (tablas relevantes)
`usuarios` (rol en `fk_id_rol`, datos `user_*`), `roles` (`rol_name`), `ingresos` (entrada/salida), `ingreso_equipos` (equipos), `ambientes`, `ambiente_instructor`, `ambiente_aprendiz`, `excusas` (PIN, estado, expira_en, usado_en), `novedades`, `notificaciones`, `two_factor_challenges`, `personal_access_tokens`.

## Android
- Kotlin + Jetpack Compose (Material 3), MVVM con `EstadoCarga` (Loading/Success/Error).
- Retrofit + Gson; un solo `ClienteApi` apunta a Railway por HTTPS.
- Sesión en `GestorSesion`; biometría local con Android Keystore (AES-GCM); QR con ZXing; escaneo con CameraX + MLKit.
- Paquetes: `autenticacion`, `aprendiz`, `instructor`, `administrador`, `portero`, `excusas`, `perfil`, `asistente`, `datos`, `comun`.
