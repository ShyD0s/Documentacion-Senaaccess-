<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TokenRecovery extends Model
{
    use HasFactory;

    protected $table = 'token_recovery';
    protected $primaryKey = 'id_token';

    protected $fillable = [
        'token_code',
        'token_exp',
        'token_used',
        'fk_id_usuario',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'fk_id_usuario', 'id_usuario');
    }
}
