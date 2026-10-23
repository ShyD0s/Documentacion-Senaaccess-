<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// PIN corto de acceso (fallback sin cámara): 6 dígitos, 5 min, un solo uso.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pines_acceso', function (Blueprint $table) {
            $table->id();
            $table->string('codigo', 6)->unique();
            $table->string('tipo', 10); // entrada | salida
            $table->dateTime('expira_en');
            $table->dateTime('usado_en')->nullable();
            $table->unsignedBigInteger('fk_creado_por');
            $table->foreign('fk_creado_por')->references('id_usuario')->on('usuarios');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pines_acceso');
    }
};
