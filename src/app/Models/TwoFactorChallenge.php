<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TwoFactorChallenge extends Model
{
    use HasFactory;

    protected $fillable = [
        'challenge_id',
        'fk_id_usuario',
        'estado',
        'code_hash',
        'code_expires_at',
        'expires_at',
        'resolved_at',
        'access_token',
        'ip',
        'user_agent',
        'device_id',
    ];

    protected $casts = [
        'code_expires_at' => 'datetime',
        'expires_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    // Un reto 2FA pertenece a un usuario (la persona que intenta iniciar sesión).
    public function usuario()
    {
        return $this->belongsTo(User::class, 'fk_id_usuario', 'id_usuario');
    }
}