<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IngresoEquipo extends Model
{
    use HasFactory;

    protected $table = 'ingreso_equipos';
    protected $primaryKey = 'id_ingreso_equipo';

    protected $fillable = [
        'fk_id_usuario',
        'equipo_type',
        'equipo_brand',
        'equipo_model',
        'equipo_color',
        'equipo_serial',
        'equipo_observations',
        'equipo_accesorios',
        'equipo_status',
        'equipo_propiedad',
        'equipo_return_datetime',
        'entry_datetime'
    ];

    protected $casts = [
        'equipo_accesorios' => 'array',
        'equipo_return_datetime' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'fk_id_usuario', 'id_usuario');
    }
}
