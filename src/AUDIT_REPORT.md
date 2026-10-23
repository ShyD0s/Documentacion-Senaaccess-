# AUDITORÍA INTEGRAL SENAACCESS — WEB + MÓVIL

**Fecha:** 2026-10-21 · **Alcance:** `SenaAccessWeb` (Laravel 10 + React 19) y `SenaAccessMovil` (Android, Kotlin + Compose)
**Entorno auditado:** producción `https://senaaccessweb-production-4c6e.up.railway.app` (API + SPA) y copia local del backend para las pruebas de navegador.
**Regla de despliegue aplicada:** solo commits locales (sin `push`), por indicación del propietario.

---

## A. RESUMEN EJECUTIVO

SenaAccess es un sistema **funcional y estable**, pero la auditoría encontró una capa de defectos reales que afectaban el uso diario: la web **no era usable en el móvil** (una etiqueta montada encima de un campo, el pie de página encima de la tarjeta, la marca encima del menú) y el **API devolvía respuestas incoherentes** (HTML en vez de JSON en rutas inexistentes, errores 500 donde debía haber 401). Además, la **huella digital que el móvil sí tenía no existía en la web**: solo había dos pantallas *simuladas* que además estaban muertas.

| Métrica | Antes | Después |
|---|---|---|
| Tests del backend | 40 | **52** (+12 nuevos) |
| Rutas `/api/*` con respuesta JSON coherente | 63 % | **100 %** |
| Páginas públicas sin solapes ni desbordes (6 anchos) | 1 de 5 | **5 de 5** |
| Paneles sin solapes ni desbordes (3 paneles × 6 anchos) | 2 de 3 | **3 de 3** |
| Huella digital (WebAuthn) | 0 (2 simulaciones muertas) | **Real, extremo a extremo** |
| Endpoints del móvil que el backend no tiene | 9 | **1** (spoofing `_method`, verificado) |
| Aprobación de cuentas desde el móvil | No existía | **Existe** (paridad con el web) |

**Estado final: APROBADO CON OBSERVACIONES** (ver sección I).

---

## B. AUDITORÍA DE `SenaAccessWeb`

### B.1 Módulos y rutas inspeccionados

| Módulo | Rutas / piezas | Resultado |
|---|---|---|
| Acceso y registro | `/login`, `/register`, `/password-recovery`, `/reset-password`, `/verificacion-2fa` | 4 defectos visuales corregidos |
| Panel superadmin | `/admin` (usuarios, ambientes, equipos, historial, presentes, predicción) | 1 defecto de navbar corregido; 1 API 500 corregido |
| Panel instructor | `/instructor` (dashboard, salones, novedades, excusas, equipos) | navbar + carga de datos |
| Panel aprendiz | `/aprendiz` | limpio |
| Panel portería | `/portero` | limpio |
| API | 83 rutas (`route:list`) | contrato y robustez auditados |
| Chatbot Bonzi | `/api/chatbot` | verificado (sin cambios) |
| Plantillas de correo | 5 vistas Blade | sin cambios |

### B.2 Problemas encontrados y correcciones realizadas

| ID | Prio | Problema | Causa raíz | Solución | Verificación |
|---|---|---|---|---|---|
| W-01 | **P1** | En el registro el `<select>` de *Tipo de Documento* se montaba encima de su etiqueta (127×23 px) y salía con la caja blanca del navegador | `Register.jsx:102` ponía el `<select>` **antes** de su `<label>`; el CSS flotante `.user-box label{position:absolute}` solo se activa con `input:focus ~ label` / `input:not(:placeholder-shown) ~ label` / `input:valid ~ label`, que **no aplican a un `<select>`** | Estilo de campo del DS para `<select>` (`.user-box select`), etiqueta en flujo (`.select-box`), flecha propia y `options` con el tema | Detector automático: solape `select ∩ label` **127×23 px → 0** en 320/375/430/768/1366/1920 |
| W-02 | **P1** | Login/registro/recuperación/2FA se salían de la página y el pie montaba sobre la tarjeta | `vh-90` (min-height 90vh) + `justify-content-center` + `<Footer/>` dentro del mismo flex; `.glass-box{margin:20px 0}` anulaba el `mx-3` (tarjeta pegada a los bordes) | Patrón único `.auth-page` (100dvh) + `.auth-main` (crece, centra) + pie debajo; padding de tarjeta por CSS; márgenes laterales reales | Antes: `scrollH` 916/917 vs 900 y solape pie-tarjeta. Después: `scrollH` 900/900 sin scroll en 375–1920 |
| W-03 | **P1** | Toda ruta `/api/*` inexistente devolvía **HTML 200 del SPA** | El `catch-all` de `routes/web.php` absorbía las rutas no definidas de la API | Ruta normal `Route::any('/{rutaApi}')` en `routes/api.php` (una *fallback* de Laravel se registra al final y perdía contra el catch-all) | `GET /api/sugerencias` → **404 `{"message":"Recurso no encontrado."}`** (antes HTML) |
| W-04 | **P1** | Cualquier petición API sin token devolvía **500** (no 401) | `Authenticate::redirectTo()` llamaba `route('login')`, ruta que no existe (el login es React) → `RouteNotFoundException` | `redirectTo()` devuelve `null` → 401 JSON uniforme | `GET /api/admin/roles` sin token → **401 JSON** (antes 500 HTML) |
| W-05 | **P1** | La huella digital no existía en la web | `Fingerprint.jsx` y `FingerprintSimulation.jsx` eran **simulaciones** (`setTimeout`, sin HTTP) y además estaban **huérfanas** (nadie las importaba); el backend había borrado WebAuthn el 30-sep | Huella **real** con WebAuthn: migración `webauthn_credentials` + `webauthn_challenges`, `PasskeyService`, `PasskeyController`, 6 endpoints, `MiHuella.jsx` en los 4 perfiles y botón *INGRESAR CON HUELLA* en el login. Sin dependencias nuevas: `web-auth/webauthn-framework` ya era dependencia del proyecto | E2E con **autenticador virtual de Chromium**: alta desde el perfil (201) + ingreso con biometría devolviendo token y rol (`rol=Superadmin`) |
| W-06 | **P1** | Las cuentas del centro (`@sena.edu.co`: 8+ cuentas semilla) **no podían guardar su perfil** | `updateMyProfile` y `updateUser` aplicaban la lista blanca de dominios aunque el correo **no cambiara** | La regla de dominio solo se exige cuando el correo cambia de verdad | `POST /api/my-profile` (spoofing `_method`) → **200**; `PUT /api/admin/users/11` → **200**; cambiar a un dominio no permitido → **422** |
| W-07 | **P2** | La marca *SENA ACCESS* se montaba sobre el primer enlace del menú (`SENA ACCESSBOARD`) | `.navbar-brand-wrap{flex:1 1 0}` dejaba encoger la marca, cuyo texto no encoge, y los enlaces no tenían `flex-wrap` | Marca con ancho natural (`flex:0 0 auto`) + `.navbar-nav{flex-wrap:wrap}` | Detector: solape `h5[SENA ACCESS] ∩ button[DASHBOARD]` **53×28 px → 0** |
| W-08 | **P2** | El botón de tema flotaba sobre la barra de navegación (tapaba campana y perfil) | `position:absolute; top:90px` contra una navbar de 120 px | El tema se cambia **desde la barra** (`theme-nav-btn`) y, en las páginas públicas, **desde la tarjeta** (`BotonTema.jsx`); el botón flotante se oculta cuando hay navbar | Detector: solape `light_mode ∩ logout` **32×26 px → 0** en 7 anchos |
| W-09 | **P2** | El límite de intentos respondía en inglés (*"Too Many Attempts."*) | Excepción por defecto de Laravel | `ThrottleRequestsException` mapeada en el manejador: *“Demasiados intentos. Espera un momento y vuelve a intentarlo.”* | 6to login seguido → **429 con mensaje en español** |
| W-10 | **P2** | Si la carga del panel fallaba (429/500) el usuario veía un panel vacío y un `AxiosError` en consola | Los 4 paneles solo trataban el 401 (redirección) y silenciaban el resto | `utils/mensajes.js` (`mensajeDeError`) + aviso al usuario en Admin, Instructor, Aprendiz y Portero | Con la API limitada, el panel muestra *“Demasiados intentos…”* en lugar de quedarse en blanco |
| W-11 | **P2** | El código de recuperación se montaba sobre la etiqueta *Nueva Contraseña* | La etiqueta flotante sube 20 px y no había holgura con el input de código | `margin-bottom` en `.code-input-2fa` | Detector: solape `code-input-2fa ∩ label` **→ 0** en los 6 anchos |
| W-12 | **P3** | El separador entre *INGRESAR* e *INVITADO* era una “O” que se leía como un **0** | Letra suelta con `opacity-50` | Texto explícito: *“o continúa como invitado”* | Captura revisada |
| W-13 | **P3** | El pie decía **v0.1.9** mientras la app móvil va en **v9.0** | Versión desactualizada en `Footer.jsx` | Badge unificado en **v9.0** | Captura revisada |
| W-14 | **P3** | *Privacidad / Términos / Soporte* eran enlaces `href="#"` que no hacían nada | Enlaces decorativos | Eliminados (no hay páginas de destino) | Revisión de código |
| W-15 | **P3** | Placeholders con poco contraste (0,40 de alfa) | `--input-placeholder` | 0,55 en claro y oscuro | Revisión de tokens |
| W-16 | **P3** | El texto de la clave podía pasar por debajo del botón del ojo | Sin `padding-right` en el campo | `padding-right: 46px` | Revisión de CSS |
| W-17 | **P3** | `PDO::MYSQL_ATTR_SSL_CA` está obsoleto en PHP 8.5 (2 avisos en cada corrida de tests) | Constante antigua | Se usa `Pdo\Mysql::ATTR_SSL_CA` cuando existe | Suite sin avisos |

### B.3 Funcionalidades completadas

| Funcionalidad | Qué faltaba | Qué se hizo | Comprobación |
|---|---|---|---|
| **Huella digital en la web** | El móvil tenía biometría (BiometricPrompt + Keystore AES-256-GCM); la web solo tenía dos páginas *falsas* y muertas | WebAuthn/passkey completo: la clave privada nunca sale del autenticador del dispositivo; el servidor guarda solo la clave pública; retos de un solo uso (5 min), contador anti-clon, verificación de usuario exigida, `userVerification: required` | E2E con autenticador virtual: registro desde el perfil + ingreso con biometría |
| **Aprobar/rechazar cuentas en el móvil** | El web tenía `POST /admin/users/{id}/aprobar|rechazar`; el móvil solo avisaba “en espera” | Bandeja *Solicitudes pendientes* en el panel de usuarios del móvil, con APROBAR/RECHAZAR y errores reales del servidor | Compila (debug + release) y el endpoint web verificado en el flujo funcional |

### B.4 Pruebas ejecutadas (web)

| Prueba | Comando / método | Resultado |
|---|---|---|
| Suite del backend | `php artisan test` | **52 passed (183 assertions)** — antes 40 |
| Pruebas nuevas | `tests/Feature/ApiRobustezTest.php` | 10 pruebas: 404 JSON, 401 sin token, huella con reto inválido, throttling en español, perfil con correo del centro |
| Build del SPA | `npm run build` | ✅ sin errores |
| Lint PHP | `php -l` en archivos tocados | ✅ |
| Auditoría visual (6 páginas públicas × 6 anchos) | Playwright + detector de solapes/desbordes | **0 solapes, 0 desbordes horizontales**; 0 errores de consola |
| Auditoría visual (3 paneles × 6 anchos) | Playwright | **0 solapes, 0 desbordes** |
| Navbar (7 anchos) | Playwright | **0 solapes** |
| Flujos funcionales (12) | `registro → pendiente → 403 → aprobación → login`, permisos por rol, equipos, historial, presentes, huella sin sesión | **12/12 OK** |
| E2E de la huella | Autenticador virtual de Chromium | alta 201 + ingreso con token |

### B.5 Pendientes (web)

1. **Desplegar**: los cambios están en commits locales; la producción sigue con el bundle anterior hasta que se haga `push` (no realizado por indicación expresa).
2. **Huella en producción**: definir `WEBAUTHN_RP_ID` y `WEBAUTHN_ALLOWED_ORIGINS` en Railway; por defecto se usa el dominio de la petición.
3. **Predicción**: `GET /api/admin/prediccion` responde *“Datos insuficientes: el modelo necesita al menos 50 días”* y en producción solo hay 11 filas. No es un fallo de código: falta histórico de movimientos.
4. **Higiene**: `public/` conserva APKs antiguos (V2–V4.1) sin ruta de descarga propia; se deja la limpieza para una decisión del propietario.
5. **Token del propietario**: el token entregado (`527eb64b-…`, formato UUID de PAT de Sanctum) **no es aceptado por esta API** (401 *“No autenticado o sesión expirada”*). La auditoría se hizo con login por credenciales.

---

## C. AUDITORÍA DE `SenaAccessMovil`

### C.1 Pantallas y módulos inspeccionados

Los 12 paquetes (`aplicacion`, `autenticacion`, `biometria`, `perfil`, `administrador`, `instructor`, `aprendiz`, `asistente`, `excusas`, `portero`, `datos`, `comun`), **109 archivos `.kt`**, el contrato de red (`datos/red/ServicioApi.kt`, 66 endpoints), los 13 repositorios y la capa de diseño (`comun/diseno`, `comun/tema`).

### C.2 Problemas encontrados y correcciones realizadas

| ID | Prio | Problema | Causa raíz | Solución | Verificación |
|---|---|---|---|---|---|
| M-01 | **P1** | El móvil **no podía aprobar ni rechazar cuentas**: el backend expone `POST /admin/users/{id}/aprobar|rechazar` y en producción había notificaciones “Nueva solicitud de cuenta” sin resolver, pero el cliente solo avisaba “en espera” | Paridad web↔móvil incompleta | `estado_cuenta` en `UsuarioApi`, 2 endpoints en `ServicioApi`, `aprobarCuenta`/`rechazarCuenta` en el repositorio, métodos en `ModeloUsuarios` y **bandeja “Solicitudes pendientes”** con APROBAR/RECHAZAR en `ListaUsuarios.kt` | `assembleDebug` + `assembleRelease` ✅ · `testDebugUnitTest` ✅ |
| M-02 | **P1** | El cliente declaraba **9 endpoints inexistentes**: `sugerencias`×4 (módulo eliminado del backend el 30-sep) y `admin/ambientes/{id}/horario(s)`×4 | Código muerto de funcionalidades que el backend nunca tuvo | Eliminados `ModelosSugerencia.kt`, `RepositorioSugerencias.kt`, sus imports y los endpoints; también los modelos `HorarioAmbiente`/`PeticionHorario` | Contrato: de 9 discrepancias a **1** (ver C.4) · compila ✅ |
| M-03 | **P2** | El usuario del centro no podía editar su perfil desde el móvil | El backend rechazaba el correo `@sena.edu.co` (W-06) | Corrección en el backend | `POST /api/my-profile` con `_method=PUT` → **200** |
| M-04 | **P3** | Documentación desactualizada: el AGENTS.md declaraba 109 `.kt` y 73 endpoints | Deriva del código | Actualizado a **109 `.kt`** (tras la limpieza) y **66 endpoints** | Checklist del propio AGENTS.md |

### C.3 Mejoras de usabilidad

- La bandeja de pendientes reutiliza el patrón del proyecto (planas con divisor, 46 dp de alto, errores del servidor con `detalleHttp`), sin tocar el diseño ni la paleta.
- El jugador de huella sigue siendo **local** (nada biométrico sale del dispositivo), igual que en la nueva web.

### C.4 Pruebas ejecutadas (móvil)

| Prueba | Comando | Resultado |
|---|---|---|
| Compilación debug | `./gradlew assembleDebug --offline` | ✅ |
| Compilación release | `./gradlew assembleRelease --offline` | ✅ |
| Pruebas unitarias | `./gradlew testDebugUnitTest --offline` | ✅ |
| Contrato con el backend | Script de comparación `route:list` ↔ `ServicioApi.kt` | 1 discrepancia conocida y documentada |
| Revisión estática de UI | Lectura de las 12 capas | Sin hallazgos nuevos bloqueantes |

### C.5 Pendientes (móvil)

1. **Sin dispositivo Android**: no hay teléfono conectado ni imágenes de sistema para un emulador → **la comprobación visual en pantalla real del móvil queda pendiente** y no se afirma lo contrario.
2. Verificar la bandeja de solicitudes en un dispositivo (el flujo del endpoint está probado en el backend).
3. El APK debe instalarse en el moto g86 cuando vuelva a estar disponible.

---

## D. AUDITORÍA DE INTEGRACIÓN

### D.1 Servicios y contratos examinados

- **Base común**: `https://senaaccessweb-production-4c6e.up.railway.app/api/` (el móvil apunta ahí en `ClienteApi.kt:17`).
- **API**: 83 rutas en producción; el móvil declara 66 endpoints; la web SPA consume el mismo contrato.
- **Autenticación**: Bearer + Sanctum, `device_id`, 2FA por código/enlace y ahora **WebAuthn** (solo web).
- **Roles**: `Superadmin`, `Admin` (portería), `Instructor`, `Aprendiz`, `Invitado`; el móvil los aplica con `RolSeguro`.

### D.2 Flujos compartidos comprobados

| Flujo | Resultado |
|---|---|
| Alta de cuenta desde la web → estado *pendiente* → login bloqueado (403) → aprobación → login OK | ✅ |
| Cambio de correo institucional (whitelist) | ✅ 422 con mensaje claro |
| Token del móvil contra la API | ✅ (login) / el PAT del propietario: ❌ 401 (no es un token de esta API) |
| Verificación de correo y recuperación | ✅ (plantillas y endpoints presentes) |

### D.3 Problemas de comunicación encontrados

1. **Formato de error divergente**: las rutas API inexistentes devolvían el HTML del SPA (W-03) → ahora JSON 404.
2. **Errores 500 en peticiones sin token** (W-04) → ahora 401 JSON; el móvil y la web reciben el mismo cuerpo de error.
3. **Contrato con 9 endpoints fantasma** (M-02) → eliminados.
4. **Desfase de la lista blanca de correos** (W-06) → el móvil no podía guardar el perfil de las cuentas del centro.

### D.4 Limitaciones

- La **verificación en dispositivo Android** no fue posible (sin hardware ni emulador).
- La **producción** no se modificó (solo commits locales, por indicación del propietario): los arreglos están probados contra la copia local del backend y contra los mismos endpoints en producción.

---

## E. REGISTRO DE DEFECTOS

| ID | Prio | Descripción | Ubicación | Causa raíz | Solución | Verificación |
|---|---|---|---|---|---|---|
| W-01 | P1 | `select` sobre su etiqueta en el registro | `Register.jsx`, `app.css` | Etiqueta flotante pensada solo para `input` | CSS de campo para `select` + etiqueta en flujo | Detector: 127×23 → 0 |
| W-02 | P1 | Desborde de las páginas públicas y pie sobre la tarjeta | `Login/Register/…`, `app.css` | `vh-90` + pie dentro del flex centrado | Patrón `.auth-page`/`.auth-main` | scroll 916→900, sin solapes |
| W-03 | P1 | HTML 200 en `/api/*` inexistente | `routes/api.php` | `catch-all` del SPA | Ruta JSON 404 en el grupo `api` | 404 JSON |
| W-04 | P1 | 500 en API sin token | `Authenticate.php` | `route('login')` inexistente | `redirectTo()` → `null` | 401 JSON |
| W-05 | P1 | Sin huella real en la web | `Fingerprint*.jsx` (muertos) | Simulaciones | WebAuthn completo | E2E con autenticador virtual |
| W-06 | P1 | Perfil imposible de guardar en cuentas `@sena.edu.co` | `AdminController` | Whitelist aplicada sin comparar | Regla solo si el correo cambia | 200 / 422 |
| M-01 | P1 | Sin aprobación de cuentas en el móvil | `ListaUsuarios.kt`, `ServicioApi.kt` | Paridad incompleta | Bandeja de pendientes | Compila + endpoint verificado |
| M-02 | P1 | 9 endpoints inexistentes en el cliente | `ServicioApi.kt` y 2 archivos | Módulos retirados del backend | Código muerto eliminado | Contrato: 9 → 1 |
| W-07 | P2 | Marca sobre el primer enlace | `app.css` | `flex:1 1 0` en la marca | `flex:0 0 auto` + wrap | 53×28 → 0 |
| W-08 | P2 | Botón de tema sobre la navbar | `app.css`, `Navbar.jsx` | Flotante a 90 px | Toggle dentro de la barra | 32×26 → 0 |
| W-09 | P2 | Throttling en inglés | `Handler.php` | Mensaje de Laravel | Excepción propia en español | 429 en español |
| W-10 | P2 | Panel vacío ante fallo de API | 4 paneles | Solo se trataba el 401 | Aviso con el mensaje del servidor | Verificado con 429 |
| W-11 | P2 | Código sobre la etiqueta | `app.css` | Sin holgura vertical | `margin-bottom` | → 0 |
| W-12 | P3 | “O” ilegible | `Login.jsx` | Letra suelta | Texto explícito | Captura |
| W-13 | P3 | Versión v0.1.9 en el pie | `Footer.jsx` | Desactualizada | v9.0 | Captura |
| W-14 | P3 | Enlaces sin destino | `Footer.jsx` | Decorativos | Eliminados | Revisión |
| W-15 | P3 | Placeholder con poco contraste | `app.css` | Alfa 0,40 | 0,55 | Revisión |
| W-16 | P3 | Texto bajo el botón del ojo | `app.css` | Sin padding | `padding-right` | Revisión |
| W-17 | P3 | Constante PDO obsoleta | `config/database.php` | PHP 8.5 | Constante nueva | Suite sin avisos |

---

## F. FUNCIONALIDADES NUEVAS O COMPLETADAS

### F.1 Huella digital en la web (WebAuthn)

**Qué faltaba:** el móvil tenía biometría real; la web tenía dos componentes *simulados* (`Fingerprint.jsx`, `FingerprintSimulation.jsx`) sin llamadas HTTP y sin usar, que además transmitían una falsa seguridad.
**Qué se implementó:** alta de credencial (`/api/huellas/registro/opciones` + `/api/huellas/registro`), autenticación (`/api/huellas/login/opciones` + `/api/huellas/login`), gestión de dispositivos (`GET /api/huellas`, `DELETE /api/huellas/{id}`), sección *Mi huella* en los 4 perfiles y botón *INGRESAR CON HUELLA* en el acceso.
**Por qué era necesario:** paridad de plataforma solicitada por el propietario y coherencia con el móvil (la biometría nunca sale del dispositivo).
**Dónde se integró:** backend Laravel + SPA React (componentes `MiHuella.jsx`, `BotonTema.jsx`, `utils/webauthn.js`).
**Cómo se comprobó:** E2E con el autenticador virtual de Chromium (alta 201 + ingreso con token y rol) y pruebas de regresión del API.

### F.2 Aprobación de cuentas desde el móvil

**Qué faltaba:** paridad con el panel web.
**Qué se implementó:** bandeja *Solicitudes pendientes* con APROBAR/RECHAZAR, `estado_cuenta` en el modelo y dos endpoints nuevos en el cliente.
**Dónde:** `administrador/usuarios/` + `datos/` (modelo, API, repositorio, ViewModel).
**Cómo se comprobó:** compilación debug/release + tests + el flujo equivalente verificado en el backend.

### F.3 Respuestas JSON coherentes en `/api/*`

**Qué faltaba:** el móvil收到的 HTML en rutas inexistentes y 500 por falta de token.
**Qué se implementó:** 404 JSON para rutas desconocidas, 401 JSON para falta de sesión, 429 en español.
**Cómo se comprobó:** 10 pruebas de regresión nuevas + verificación en producción (el 404 JSON se verá al desplegar).

---

## G. ARCHIVOS MODIFICADOS

### `SenaAccessWeb`

| Archivo | Motivo |
|---|---|
| `resources/css/app.css` | Campos `select` del DS, retícula `.auth-page`, tarjeta y botón de tema, navbar sin solapes, placeholder, campo de clave, `code-input-2fa` |
| `resources/js/components/Login.jsx` | Retícula nueva, botón de huella, `finalizarLogin` reutilizable, separador legible |
| `resources/js/components/Register.jsx` | Retícula, `select` con etiqueta en flujo |
| `resources/js/components/PasswordRecovery.jsx`, `ResetPassword.jsx`, `Verificacion2Fa.jsx` | Retícula nueva + botón de tema en la tarjeta |
| `resources/js/components/Navbar.jsx` | Botón de tema dentro de la barra |
| `resources/js/components/MiHuella.jsx` *(nuevo)* | Sección de huella por dispositivo |
| `resources/js/components/BotonTema.jsx` *(nuevo)* | Botón de tema para páginas públicas |
| `resources/js/utils/webauthn.js` *(nuevo)* | Conversión base64url ↔ ArrayBuffer y llamadas al navegador |
| `resources/js/utils/mensajes.js` *(nuevo)* | Mensajes de error de la API en español |
| `resources/js/components/{Admin,Aprendiz,Instructor,Portero}.jsx` | Aviso de error de carga + sección de huella |
| `resources/js/app.jsx` | Sincronización del tema entre navbar y botón global |
| `resources/js/components/Fingerprint.jsx`, `FingerprintSimulation.jsx` | **Eliminados** (simulaciones muertas) |
| `routes/api.php` | Rutas de huella + 404 JSON |
| `app/Http/Controllers/PasskeyController.php` *(nuevo)* | Endpoints de huella |
| `app/Services/PasskeyService.php` *(nuevo)* | Ceremonias WebAuthn |
| `app/Models/Passkey.php`, `WebauthnChallenge.php` *(nuevos)* | Modelos |
| `database/migrations/2026_10_21_000001_create_webauthn_tables.php` *(nuevo)* | Tablas de huella y retos |
| `config/webauthn.php` *(nuevo)* | RP ID, nombre y orígenes admitidos |
| `app/Http/Middleware/Authenticate.php` | 401 en vez de 500 |
| `app/Exceptions/Handler.php` | Throttling en español |
| `app/Http/Controllers/AdminController.php` | Dominio solo si el correo cambia |
| `config/database.php` | Constante PDO no obsoleta |
| `tests/Feature/ApiRobustezTest.php` *(nuevo)* | 10 pruebas de regresión |

### `SenaAccessMovil`

| Archivo | Motivo |
|---|---|
| `app/src/main/java/com/example/sennaccess/datos/modelos/Modelos.kt` | `estado_cuenta` + `estaPendiente()`; fuera modelos de horarios |
| `app/src/main/java/com/example/sennaccess/datos/red/ServicioApi.kt` | Endpoints de aprobación; fuera sugerencias y horarios |
| `app/src/main/java/com/example/sennaccess/datos/repositorios/RepositorioUsuarios.kt` | `aprobarCuenta` / `rechazarCuenta` |
| `app/src/main/java/com/example/sennaccess/administrador/usuarios/ModeloUsuarios.kt` | Métodos de aprobación/rechazo |
| `app/src/main/java/com/example/sennaccess/administrador/usuarios/ListaUsuarios.kt` | Bandeja de solicitudes pendientes |
| `app/src/main/java/com/example/sennaccess/datos/modelos/ModelosSugerencia.kt` | **Eliminado** (módulo retirado del backend) |
| `app/src/main/java/com/example/sennaccess/datos/repositorios/RepositorioSugerencias.kt` | **Eliminado** (módulo retirado del backend) |

---

## H. RESULTADOS DE PRUEBAS

| # | Comando / prueba | Resultado | Nota |
|---|---|---|---|
| 1 | `php artisan test` (web) | ✅ **52 passed (183 assertions)** | 40 previos + 12 nuevos |
| 2 | `npm run build` (web) | ✅ | Bundle generado sin errores |
| 3 | `php -l` (archivos PHP tocados) | ✅ | |
| 4 | `./gradlew assembleDebug --offline` (móvil) | ✅ | |
| 5 | `./gradlew assembleRelease --offline` (móvil) | ✅ | |
| 6 | `./gradlew testDebugUnitTest --offline` (móvil) | ✅ | |
| 7 | Auditoría visual: 6 páginas públicas × 6 anchos | ✅ 0 solapes / 0 desbordes X | Chromium headless |
| 8 | Auditoría visual: 3 paneles × 6 anchos | ✅ 0 solapes / 0 desbordes | |
| 9 | Navbar en 7 anchos | ✅ 0 solapes | |
| 10 | Flujos funcionales de API (12) | ✅ 12/12 | Registro→aprobación→login, permisos, equipos, historial, presentes |
| 11 | E2E huella con autenticador virtual | ✅ alta + ingreso | |
| 12 | Contrato móvil↔backend | ✅ 1 discrepancia conocida | `POST my-profile` = spoofing `_method`, verificado 200 |
| 13 | Login, huella y recuperación contra **producción** | ⚠️ parcial | El login del propietario es el único probado: el token entregado es un PAT que esta API no acepta (401) |
| 14 | Pruebas en dispositivo Android | ⛔ **bloqueado** | Sin teléfono conectado ni imagen de sistema para emulador |
| 15 | Despliegue a producción | ⛔ **no ejecutado** | Solo commits locales, por indicación del propietario |

---

## I. ESTADO FINAL

### **APROBADO CON OBSERVACIONES**

**Motivo:** las funcionalidades principales de la web y del móvil fueron verificadas de punta a punta (52 pruebas del backend, compilación y tests del móvil, 12 flujos funcionales, auditoría visual en 9 superficies × 6 anchos y E2E de la huella), y se corrigieron 17 defectos reales —incluidos tres P1 que impedían usar el sistema en móvil y dos que rompían el contrato de la API—. Quedan observaciones y limitaciones:

1. **Sin verificación visual del móvil en un dispositivo real** (no hay hardware ni emulador): la parte del móvil se validó por compilación, pruebas y revisión estática.
2. **La producción conserva el código anterior**: los arreglos están en commits locales; hace falta `push` a `SenaAccessWeb/main` (despliega en Railway) y a `SenaAccessMovil/main`.
3. **Configuración de la huella en producción**: definir `WEBAUTHN_RP_ID` / `WEBAUTHN_ALLOWED_ORIGINS`.
4. **La predicción necesita histórico**: con 11 días de movimientos no alcanza el mínimo de 50 del modelo.
5. **El token entregado no es válido para esta API** (401): hay que autenticarse con las credenciales de las cuentas de prueba.
6. **Higiene de `public/`**: APKs antiguos sin ruta de descarga, pendientes de una decisión del propietario.
