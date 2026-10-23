<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notificacion extends Model
{
    use HasFactory;

    protected $table = 'notificaciones';
    protected $primaryKey = 'id_notificacion';

    protected $fillable = [
        'fk_id_usuario',
        'notification_title',
        'notification_body',
        'notification_type',
        'is_read',
    ];

    protected $casts = [
        'is_read' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'fk_id_usuario', 'id_usuario');
    }

    /**
     * Crea una notificacion para todos los usuarios con rol Admin.
     *
     * @param string $title
     * @param string $body
     * @param string|null $type
     * @return void
     */
    public static function notifyAdmins(string $title, string $body, ?string $type = 'sistema'): void
    {
        $adminRoleId = Role::where('rol_name', 'Admin')->value('id_rol');
        if (!$adminRoleId) {
            return;
        }

        $admins = User::where('fk_id_rol', $adminRoleId)->get();
        foreach ($admins as $admin) {
            static::create([
                'fk_id_usuario' => $admin->id_usuario,
                'notification_title' => $title,
                'notification_body' => $body,
                'notification_type' => $type,
            ]);
        }
    }
}
