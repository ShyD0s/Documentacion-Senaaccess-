<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Novedad extends Model
{
    use HasFactory;

    protected $table = 'novedades';
    protected $primaryKey = 'id_novedad';

    protected $fillable = [
        'novedad_ambiente',
        'novedad_title',
        'novedad_body',
        'novedad_datetime',
        'fk_id_usuario',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'fk_id_usuario', 'id_usuario');
    }
}
