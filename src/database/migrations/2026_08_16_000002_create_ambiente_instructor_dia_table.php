<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ambiente_instructor_dia', function (Blueprint $table) {
            $table->id('id_horario');
            $table->unsignedBigInteger('fk_id_ambiente');
            $table->string('dia', 15);
            $table->string('jornada', 20);
            $table->unsignedBigInteger('fk_id_instructor');
            $table->timestamps();

            $table->foreign('fk_id_ambiente')->references('id_ambiente')->on('ambientes')->onDelete('cascade');
            $table->foreign('fk_id_instructor')->references('id_usuario')->on('usuarios')->onDelete('cascade');

            $table->unique(['fk_id_ambiente', 'dia', 'jornada']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ambiente_instructor_dia');
    }
};