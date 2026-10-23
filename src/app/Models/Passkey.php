<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Credencial WebAuthn (huella/passkey) de un usuario.
 * La clave privada vive en el autenticador del dispositivo: aqui solo la publica.
 */
class Passkey extends Model
{
    use HasFactory;

    protected $table = 'webauthn_credentials';

    protected $fillable = [
        'fk_id_usuario',
        'credential_id',
        'credencial',
        'contador',
        'nombre_dispositivo',
        'transportes',
        'ultimo_uso_en',
    ];

    protected $casts = [
        'contador' => 'integer',
        'ultimo_uso_en' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'fk_id_usuario', 'id_usuario');
    }
}
