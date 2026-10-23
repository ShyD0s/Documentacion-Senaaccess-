<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Agregado diario de movimientos: la "tabla Casa" de nuestro modelo.
class AccesoDiario extends Model
{
    protected $table = 'accesos_diarios';

    public $timestamps = false;

    protected $fillable = ['fecha', 'dia_semana', 'es_festivo', 'total_entradas', 'total_salidas'];

    protected $casts = [
        'fecha' => 'date',
        'es_festivo' => 'boolean',
    ];
}
