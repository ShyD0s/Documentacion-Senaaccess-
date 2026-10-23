<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Coeficientes y métricas del modelo entrenado (fila única id=1).
class PrediccionModelo extends Model
{
    protected $table = 'prediccion_modelo';

    public $timestamps = false;

    protected $fillable = ['coeficientes', 'intercepto', 'mae', 'r2', 'filas', 'entrenado_en'];

    protected $casts = [
        'coeficientes' => 'array',
        'entrenado_en' => 'datetime',
    ];
}
