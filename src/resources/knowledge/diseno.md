# SenaAccess — diseño y paleta

## Identidad
- Marca: SENA ACCESS, con el verde institucional como único acento de marca.
- Estilo Android: vidrio (glassmorphism) sobre fondo oscuro o claro, tarjetas con bordes suaves, botones tipo píldora, animaciones cortas de entrada.
- Estilo web: Bootstrap 5, tarjetas, tablas que se convierten en tarjetas en móvil, navbar con logo del SENA.

## Paleta Android (Jetpack Compose)
- Verde de marca: `#02D914` (mismo tono en tema claro y oscuro).
- Verde para texto sobre fondo claro: `#0B7A1E` (tinta verde, por contraste).
- Fondo oscuro: `#05070B`; superficie `#0E1217`; superficie variante `#161D24`.
- Fondo claro: `#F0F2F5`; tarjetas y tablas blancas.
- Error: `#FF6B6B`; error de texto: `#C62828`; aviso: `#FFC107`; naranja ámbar: `#FFA726`.
- El texto e íconos usan tokens (`textPrimary`, `textSecondary`), nunca colores sueltos.
- Hay tema claro y oscuro; los colores se leen desde `ColoresAppLocal` y el verde visible con `verdeMarca()`.

## Paleta web (React)
- Verde SENA: `#39a900`; verde oscuro: `#2d8a00`; acento neón: `#02d914`.
- Chat flotante: fondo `#0d1117`, mensajes del usuario en degradado verde, mensajes del asistente en `rgba(255,255,255,0.07)`.
- Estados: éxito `#16a34a`, peligro `#dc3545`, superficies claras `#f8f9fa`.

## Componentes y medidas
- Botones principales en píldora, alto mínimo 48-52 dp, texto con peso alto.
- Radios: 16 dp en campos y botones, 24-28 dp en diálogos y tarjetas grandes.
- Dock inferior Android: 5-6 accesos, 120 dp de alto, etiquetas en una línea.
- Tarjetas de vidrio con borde definido y sombra suave en tema claro.
- Tipografía: escalas de Material 3 en Android y Bootstrap en web; títulos en negrita, textos secundarios en gris.
