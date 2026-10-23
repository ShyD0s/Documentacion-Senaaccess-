<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ingreso_equipos', function (Blueprint $table) {
            $table->id('id_ingreso_equipo');
            $table->unsignedBigInteger('fk_id_usuario');
            $table->string('equipo_type'); // Portátil, Cámara, etc.
            $table->string('equipo_brand');
            $table->string('equipo_model')->nullable();
            $table->string('equipo_color');
            $table->string('equipo_serial')->unique();
            $table->text('equipo_observations')->nullable();
            $table->timestamp('entry_datetime')->useCurrent();
            $table->timestamps();

            $table->foreign('fk_id_usuario')->references('id_usuario')->on('usuarios')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ingreso_equipos');
    }
};
