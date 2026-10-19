

# SenaAccess

**Sistema de control de acceso e ingreso para el SENA**

Aplicación web full-stack que permite gestionar el ingreso de personas y equipos a las instalaciones del SENA, con roles diferenciados (Administrador e Instructor), chatbot integrado y notificaciones por correo electrónico.


## Integrantes

- Sebastián Andrés Arcos: Desarrollador 
- Andrés Felipe Volverás: Desarrollador 
- Laura Medina: Desarrolladora 
- Katherin Fernández: Desarrolladora 



## Descripción

SenaAccess es una plataforma web diseñada para automatizar y controlar el acceso a las instalaciones del SENA. El sistema permite:

- **Registro de ingresos** de personas con identificación y seguimiento en tiempo real.
- **Control de equipos** — registro de entrada y salida de dispositivos electrónicos.
- **Gestión de novedades** — reporte y seguimiento de incidencias.
- **Chatbot integrado** para asistencia rápida a los usuarios.
- **Recuperación de contraseña** mediante código enviado por correo electrónico.
- **Roles y permisos** diferenciados para Administradores e Instructores.

---

## Tecnologías


- **Frontend** React JS, JavaScript (ES6+), HTML5, CSS3, Tailwind CSS 
- **Backend** Laravel 11, PHP 8.2+ 
- **Base de datos** MySQL 8 
- **Bundler** Vite 
- **Autenticación** Laravel Sanctum (SPA + API tokens) 
| **Correo** | Laravel Mail (SMTP) |

---

## Requisitos Previos

Requisitos para tener instalado:

- PHP >= 8.2
- Composer >= 2.x
- Node.js >= 18.x y npm >= 9.x
- MySQL >= 8.0


---

## Instalación


### 1. Configurar el Backend (Laravel)

```bash
# Instalar dependencias de PHP
composer install

# Copiar el archivo de variables de entorno
cp documentacion/env-ejemplo.txt .env

# Generar la clave de la aplicación
php artisan key:generate

# Ejecutar las migraciones y seeders
php artisan migrate --seed

# Iniciar el servidor de desarrollo
php artisan serve
```

> El backend estará disponible en `http://localhost:8000`

### 2. Configurar el Frontend (React + Vite)

```bash
# Instalar dependencias de JavaScript
npm install

# Iniciar el servidor de desarrollo de Vite
npm run dev
```

> El frontend estará disponible en `http://localhost:5173`

---

## Variables de Entorno

Copia el archivo de ejemplo y configura las variables según tu entorno local:

```bash
cp documentacion/env-ejemplo.txt .env
```

Las variables principales a configurar son:

- `DB_HOST` Host de la base de datos `127.0.0.1` 
- `DB_PORT` Puerto de MySQL  `3306` 
- `DB_DATABASE` Nombre de la base de datos  `senaaccess` 
- `DB_USERNAME` Usuario de la base de datos  `root` 
- `DB_PASSWORD` Contraseña de la base de datos  `""` 
- `MAIL_MAILER` Driver de correo `smtp` 
- `MAIL_HOST`  Host del servidor SMTP `smtp.gmail.com` 
- `MAIL_PORT`  Puerto SMTP  `587` 
- `GEMINI_API_KEY`  API Key de Gemini 
- `CLOUDINARY_URL`  Cloudinary URL  `cloudinary://api_key:api_secret@cloud_name` 




---

## Estructura del Proyecto

```
SenaAccessFinal/
├── app/
│   ├── Http/Controllers/        # AuthController, ChatbotController, EquipmentController,
│   │                            # NovedadController, UserController
│   ├── Http/Middleware/          # Filtros: Admin, Instructor, Sanctum
│   ├── Mail/                    # RecoveryCodeMail.php
│   └── Models/                  # User, Role, Ingreso, IngresoEquipo, Novedad
├── bootstrap/                   # Arranque del framework y caché
├── config/                      # services, auth, database, sanctum
├── database/
│   ├── migrations/              # Migraciones del esquema
│   └── seeders/                 # DatabaseSeeder.php (datos iniciales)
├── documentacion/               # Manual, borrador, modelo relacional, env-ejemplo
├── public/                      # index.php, íconos y assets estáticos
├── resources/
│   ├── css/app.css              # Estilos personalizados
│   ├── js/                      # app.jsx, bootstrap.js y components/
│   └── views/                   # Plantillas Blade (emails, welcome)
├── routes/
│   ├── api.php                  # Rutas de la API REST
│   └── web.php                  # Ruta comodín → SPA
├── storage/                     # Archivos generados, logs y caché
├── tests/                       # Pruebas automatizadas (PHPUnit)
├── .env.example                 # Plantilla de variables de entorno
├── artisan                      # Consola CLI de Laravel
├── composer.json                # Dependencias de PHP
├── package.json                 # Dependencias de JavaScript
├── phpunit.xml                  # Configuración de PHPUnit
├── vite.config.js               # Configuración de Vite + React
└── README.md                    # Este archivo
```





---

## Licencia

Este proyecto fue desarrollado con fines académicos como parte del programa de formación del **Servicio Nacional de Aprendizaje (SENA)**.

---


