<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Elimina las tablas y columnas del módulo de Ambientes.
     */
    public function up(): void
    {
        // Quitar FK y columna en novedades
        Schema::table('novedades', function (Blueprint $table) {
            if (Schema::hasColumn('novedades', 'fk_id_ambiente')) {
                $table->dropForeign(['fk_id_ambiente']);
                $table->dropColumn('fk_id_ambiente');
            }
        });

        // Quitar FK y columna en aprendiz_instructor (asignación aprendiz -> instructor)
        Schema::table('aprendiz_instructor', function (Blueprint $table) {
            if (Schema::hasColumn('aprendiz_instructor', 'fk_id_ambiente')) {
                $table->dropForeign(['fk_id_ambiente']);
                $table->dropColumn('fk_id_ambiente');
            }
        });

        // Las pivotes/schedules referencian ambientes, se dropean primero
        Schema::dropIfExists('ambiente_instructor_dia');
        Schema::dropIfExists('ambiente_instructor');
        Schema::dropIfExists('ambientes');
    }

    /**
     * Revertir: volver a crear lo mínimo (no se usa en producción, solo por completitud).
     */
    public function down(): void
    {
        Schema::create('ambientes', function (Blueprint $table) {
            $table->id('id_ambiente');
            $table->string('ambiente_nombre')->unique();
            $table->integer('ambiente_capacidad')->nullable();
            $table->string('ambiente_ubicacion')->nullable();
            $table->string('ambiente_estado')->default('Activo');
            $table->unsignedBigInteger('fk_id_instructor')->nullable();
            $table->string('ambiente_jornada')->nullable();
            $table->timestamps();
        });

        Schema::table('novedades', function (Blueprint $table) {
            $table->unsignedBigInteger('fk_id_ambiente')->nullable();
            $table->foreign('fk_id_ambiente')->references('id_ambiente')->on('ambientes')->onDelete('set null');
        });

        Schema::table('aprendiz_instructor', function (Blueprint $table) {
            $table->unsignedBigInteger('fk_id_ambiente')->nullable();
            $table->foreign('fk_id_ambiente')->references('id_ambiente')->on('ambientes')->onDelete('set null');
        });

        Schema::create('ambiente_instructor', function (Blueprint $table) {
            $table->id('id_ambiente_instructor');
            $table->unsignedBigInteger('fk_id_ambiente');
            $table->unsignedBigInteger('fk_id_instructor');
            $table->unique(['fk_id_ambiente', 'fk_id_instructor']);
            $table->timestamps();
        });

        Schema::create('ambiente_instructor_dia', function (Blueprint $table) {
            $table->id('id_horario');
            $table->unsignedBigInteger('fk_id_ambiente');
            $table->string('dia');
            $table->string('jornada');
            $table->unsignedBigInteger('fk_id_instructor');
            $table->unique(['fk_id_ambiente', 'dia', 'jornada']);
            $table->timestamps();
        });
    }
};
