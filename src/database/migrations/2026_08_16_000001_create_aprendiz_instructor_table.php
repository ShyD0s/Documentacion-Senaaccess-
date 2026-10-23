<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('aprendiz_instructor', function (Blueprint $table) {
            $table->id('id_asignacion');
            $table->unsignedBigInteger('fk_id_aprendiz');
            $table->unsignedBigInteger('fk_id_instructor');
            $table->unsignedBigInteger('fk_id_ambiente')->nullable();
            $table->string('jornada', 20)->nullable();
            $table->timestamps();

            $table->foreign('fk_id_aprendiz')->references('id_usuario')->on('usuarios')->onDelete('cascade');
            $table->foreign('fk_id_instructor')->references('id_usuario')->on('usuarios')->onDelete('cascade');
            $table->foreign('fk_id_ambiente')->references('id_ambiente')->on('ambientes')->onDelete('set null');

            $table->unique(['fk_id_aprendiz', 'fk_id_instructor']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('aprendiz_instructor');
    }
};