<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Role extends Model
{
    use HasFactory;

    protected $table = 'roles';
    protected $primaryKey = 'id_rol';

    protected $fillable = [
        'rol_name',
    ];

    public function users()
    {
        return $this->hasMany(User::class, 'fk_id_rol', 'id_rol');
    }
}
