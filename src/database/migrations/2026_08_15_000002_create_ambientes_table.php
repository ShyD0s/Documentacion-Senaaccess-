<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ambientes', function (Blueprint $table) {
            $table->id('id_ambiente');
            $table->string('ambiente_nombre', 100)->unique();
            $table->integer('ambiente_capacidad')->nullable();
            $table->string('ambiente_ubicacion', 100)->nullable();
            $table->string('ambiente_estado', 20)->default('Activo');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ambientes');
    }
};
