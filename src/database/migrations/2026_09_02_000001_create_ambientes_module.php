<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Tabla principal de ambientes con config de jornada para el módulo de presencia.
        Schema::create('ambientes', function (Blueprint $table) {
            $table->id('id_ambiente');
            $table->string('ambiente_nombre', 100)->unique();
            $table->integer('ambiente_capacidad')->nullable();
            $table->string('ambiente_ubicacion', 100)->nullable();
            $table->string('ambiente_estado', 20)->default('Activo');
            $table->string('ambiente_jornada', 20)->nullable();
            // Ventana lectiva y config TOTP/geo (NTP server-side, TOTP por ambiente).
            $table->time('hora_inicio')->nullable();
            $table->time('hora_fin')->nullable();
            $table->json('descansos')->nullable();
            $table->integer('radio_m')->nullable();
            $table->json('bssids')->nullable();
            $table->string('totp_secret', 64)->nullable();
            $table->timestamps();
        });

        // Pivote ambiente <-> instructor (un instructor en varios ambientes; un ambiente con varios instructores).
        Schema::create('ambiente_instructor', function (Blueprint $table) {
            $table->id('id_ambiente_instructor');
            $table->unsignedBigInteger('fk_id_ambiente');
            $table->unsignedBigInteger('fk_id_instructor');
            $table->timestamps();
            $table->foreign('fk_id_ambiente')->references('id_ambiente')->on('ambientes')->onDelete('cascade');
            $table->foreign('fk_id_instructor')->references('id_usuario')->on('usuarios')->onDelete('cascade');
            $table->unique(['fk_id_ambiente', 'fk_id_instructor']);
        });

        // Pivote ambiente <-> aprendiz (estudiantes asignados a un ambiente por su instructor).
        Schema::create('ambiente_aprendiz', function (Blueprint $table) {
            $table->id('id_ambiente_aprendiz');
            $table->unsignedBigInteger('fk_id_ambiente');
            $table->unsignedBigInteger('fk_id_usuario');
            $table->timestamps();
            $table->foreign('fk_id_ambiente')->references('id_ambiente')->on('ambientes')->onDelete('cascade');
            $table->foreign('fk_id_usuario')->references('id_usuario')->on('usuarios')->onDelete('cascade');
            $table->unique(['fk_id_ambiente', 'fk_id_usuario']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ambiente_aprendiz');
        Schema::dropIfExists('ambiente_instructor');
        Schema::dropIfExists('ambientes');
    }
};
