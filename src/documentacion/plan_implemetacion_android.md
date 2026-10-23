# Plan de Migración a Android (Kotlin & Jetpack Compose)

Este plan describe la estrategia para transformar tu aplicación web (Laravel + React) en una aplicación móvil nativa para Android, manteniendo la lógica del servidor y recreando la interfaz con tecnologías modernas de Android.

## User Review Required

> [!IMPORTANT]
> La aplicación móvil actuará como un cliente de tu API actual de Laravel. Esto significa que **tu servidor Laravel seguirá siendo el cerebro**, pero la interfaz ya no será HTML/JS, sino código nativo de Android.
> 
> ¿Deseas mantener exactamente el mismo diseño "glassmorphism" en la app móvil, o prefieres una adaptación a las guías de diseño de Android (Material 3)?

## Proposed Changes

### Fase 1: Optimización del Backend (Laravel)
Para que Android se comunique con tu servidor:
- **API Sanctum**: Asegurar que las rutas en `routes/api.php` devuelven JSON puro (sin redirecciones web).
- **CORS**: Configurar Laravel para permitir peticiones desde la aplicación móvil.
- **Endpoints**: Verificar que todos los flujos (Login, Registro, Recuperación con Resend) tienen su equivalente en el controlador que responda con estados HTTP correctos (200, 401, 422).

### Fase 2: Configuración del Proyecto Android
- **Kotlin**: Lenguaje principal por su seguridad y concisión.
- **Jetpack Compose**: Para la interfaz declarativa (el equivalente a React en Android).
- **Gradle**: Configuración de dependencias esenciales:
    - **Retrofit & OkHttp**: Para las llamadas a la API de Laravel.
    - **Compose Navigation**: Para moverte entre pantallas.
    - **Hilt/Koin**: Para inyección de dependencias.
    - **Coil**: Para cargar imágenes (como el logo del SENA y fotos de Cloudinary).
    - **Cloudinary Android SDK (Opcional)**: Si decides subir imágenes directamente desde el móvil.

### Fase 3: Arquitectura (MVVM)
Implementaremos el patrón **Model-View-ViewModel**, que es el estándar en Android:
- **Model**: Clases de datos (Data Classes) que representen al Usuario, el Token, etc.
- **View (Compose)**: Tus componentes visuales (LoginScreen, RecoveryScreen, HomeScreen).
- **ViewModel**: Donde residirá la lógica de estado (ej. manejar el clic del botón de login y llamar al repositorio).
- **Repository**: Clase encargada de decidir si los datos vienen de la API o de una base de datos local.

### Fase 4: Replicación de la Interfaz (UI)
- **Temas**: Crear un `Theme.kt` que defina los colores y gradientes para lograr el efecto "glass-box" usando `Surface` con transparencia y `Modifier.blur()`.
- **Componentes**: Recrear los botones `btn-glow` y los `user-box` de React como `OutlinedTextField` personalizados en Compose.
- **Responsividad**: Usar `BoxWithConstraints` para que la app se adapte a diferentes tamaños de pantalla y orientaciones.

### Fase 5: Autenticación y Sesión
- **DataStore**: Usar Jetpack DataStore para guardar el `access_token` de Sanctum de forma segura y persistente.
- **Interceptores**: Configurar un interceptor en OkHttp para añadir automáticamente el header `Authorization: Bearer <token>` a todas las peticiones una vez logueado.

### Fase 6: Gestión de Imágenes (Cloudinary)
Tienes dos caminos para manejar las fotos de perfil que ya usas con Cloudinary:
1. **Delegado (Recomendado)**: La app de Android envía la imagen como un archivo "Multipart" a tu API de Laravel, y Laravel se encarga de subirla a Cloudinary como lo hace ahora. No necesitas cambiar nada en el backend.
2. **Directo**: Usar el SDK de Cloudinary en Android para subir la foto directamente desde el teléfono y solo enviar la URL resultante a Laravel. Esto ahorra ancho de banda en tu servidor.

## Herramientas Recomendadas
1. **Android Studio**: El IDE oficial e indispensable.
2. **Postman**: Para seguir probando los endpoints de Laravel antes de conectarlos a la app.
3. **Lottie**: Para añadir animaciones premium similares a las que ya tienes en la web.

## Verification Plan

### Manual Verification
- Probar el flujo de Login desde un emulador de Android conectado a tu servidor local.
- Verificar que el token se guarda correctamente y permite acceder a rutas protegidas (`/admin`, `/aprendiz`).
- Probar la recuperación de contraseña enviando el código a través de la API y recibiendo el correo de Resend.
