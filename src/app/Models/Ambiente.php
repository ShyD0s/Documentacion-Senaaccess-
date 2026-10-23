<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Ambiente extends Model
{
    protected $table = 'ambientes';
    protected $primaryKey = 'id_ambiente';

    protected $fillable = [
        'ambiente_nombre',
        'ambiente_capacidad',
        'ambiente_ubicacion',
        'ambiente_estado',
        'ambiente_jornada',
        'hora_inicio',
        'hora_fin',
        'descansos',
        'radio_m',
        'bssids',
        'totp_secret',
    ];

    protected $casts = [
        'descansos' => 'array',
        'bssids' => 'array',
    ];

    protected static function booted()
    {
        static::creating(function ($ambiente) {
            if (empty($ambiente->totp_secret)) {
                $ambiente->totp_secret = self::generarSecreto();
            }
        });
    }

    public static function generarSecreto(): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $bytes = random_bytes(20);
        $bits = '';
        foreach (str_split($bytes) as $b) {
            $bits .= str_pad(decbin(ord($b)), 8, '0', STR_PAD_LEFT);
        }
        $out = '';
        for ($i = 0; $i < strlen($bits); $i += 5) {
            $chunk = substr($bits, $i, 5);
            if (strlen($chunk) < 5) break;
            $out .= $alphabet[bindec($chunk)];
        }
        return substr($out, 0, 32);
    }

    public function instructores()
    {
        return $this->belongsToMany(User::class, 'ambiente_instructor', 'fk_id_ambiente', 'fk_id_instructor');
    }

    public function aprendices()
    {
        return $this->belongsToMany(User::class, 'ambiente_aprendiz', 'fk_id_ambiente', 'fk_id_usuario');
    }
}
