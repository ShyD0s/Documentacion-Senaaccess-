<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Reto WebAuthn de un solo uso (registro o autenticacion). Caduca a los 5 minutos.
 */
class WebauthnChallenge extends Model
{
    protected $table = 'webauthn_challenges';

    protected $fillable = [
        'reto',
        'tipo',
        'fk_id_usuario',
        'expira_en',
    ];

    protected $casts = [
        'expira_en' => 'datetime',
    ];

    public function estaVencido(): bool
    {
        return $this->expira_en->isPast();
    }
}
