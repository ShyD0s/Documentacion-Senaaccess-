<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ingreso extends Model
{
    use HasFactory;

    protected $table = 'ingresos';
    protected $primaryKey = 'id_ingreso';

    protected $fillable = [
        'ingreso_datetime',
        'ingreso_place',
        'ingreso_type',
        'fk_id_user',
    ];

    // Fechas con zona: el JSON sale ISO con offset (-05:00) y la app
    // deja de asumir UTC (ese -5h rompía la puerta 00:00-04:59).
    protected $casts = [
        'ingreso_datetime' => 'datetime',
    ];

    // toJSON pega "Z" sin convertir: se normaliza a UTC real para que el
    // instante sea el correcto en móvil y web.
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return (clone $date)->setTimezone('UTC')->format('Y-m-d\TH:i:s.u\Z');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'fk_id_user', 'id_usuario');
    }
}
