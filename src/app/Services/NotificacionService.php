<?php

namespace App\Services;

use App\Models\Notificacion;
use App\Models\Role;
use App\Models\User;

/**
 * Centro único de creación de notificaciones in-app. Evita duplicar la lógica
 * de "notificar a" en cada controlador y centraliza los tipos de aviso.
 */
class NotificacionService
{
    /**
     * Crea una notificación para un usuario concreto.
     */
    public function crearParaUsuario(int $usuarioId, string $titulo, string $cuerpo, string $tipo = 'sistema'): Notificacion
    {
        return Notificacion::create([
            'fk_id_usuario' => $usuarioId,
            'notification_title' => $titulo,
            'notification_body' => $cuerpo,
            'notification_type' => $tipo,
        ]);
    }

    /**
     * Crea una notificación para todos los usuarios con un rol concreto.
     */
    public function notificarRol(string $rolNombre, string $titulo, string $cuerpo, string $tipo = 'sistema'): int
    {
        $roleId = Role::where('rol_name', $rolNombre)->value('id_rol');
        if (!$roleId) {
            return 0;
        }

        $usuarios = User::where('fk_id_rol', $roleId)->pluck('id_usuario');
        $count = 0;
        foreach ($usuarios as $usuarioId) {
            $this->crearParaUsuario($usuarioId, $titulo, $cuerpo, $tipo);
            $count++;
        }
        return $count;
    }

    /**
     * Notifica a todos los superadmins (conveniente para acciones de audit,
     * como solicitudes de cuenta pendientes de aprobación).
     */
    public function notificarAdmins(string $titulo, string $cuerpo, string $tipo = 'sistema'): int
    {
        return $this->notificarRol('Superadmin', $titulo, $cuerpo, $tipo);
    }
}