<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Festivo de Colombia (fecha observada).
class Festivo extends Model
{
    public $timestamps = false;

    protected $fillable = ['fecha', 'nombre'];
}
