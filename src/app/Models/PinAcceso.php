<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// PIN corto de acceso a portería (fallback sin cámara).
class PinAcceso extends Model
{
    protected $table = 'pines_acceso';

    protected $fillable = ['codigo', 'tipo', 'expira_en', 'usado_en', 'fk_creado_por'];

    protected $casts = [
        'expira_en' => 'datetime',
        'usado_en' => 'datetime',
    ];
}
