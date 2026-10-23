<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Excusa extends Model
{
    protected $table = 'excusas';
    protected $primaryKey = 'id_excusa';

    protected $fillable = [
        'fk_id_aprendiz',
        'fk_id_ambiente',
        'fk_id_instructor',
        'motivo',
        'pin',
        'estado',
        'expira_en',
        'usado_en',
    ];

    protected $casts = [
        'expira_en' => 'datetime',
        'usado_en' => 'datetime',
    ];

    public function aprendiz()
    {
        return $this->belongsTo(User::class, 'fk_id_aprendiz', 'id_usuario');
    }

    public function ambiente()
    {
        return $this->belongsTo(Ambiente::class, 'fk_id_ambiente', 'id_ambiente');
    }

    public function instructor()
    {
        return $this->belongsTo(User::class, 'fk_id_instructor', 'id_usuario');
    }

    public function estaExpirada(): bool
    {
        return $this->estado === 'pendiente' && $this->expira_en && $this->expira_en->isPast();
    }
}
