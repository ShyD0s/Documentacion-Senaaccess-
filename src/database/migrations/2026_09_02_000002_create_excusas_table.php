<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('excusas', function (Blueprint $table) {
            $table->id('id_excusa');
            $table->unsignedBigInteger('fk_id_aprendiz');
            $table->unsignedBigInteger('fk_id_ambiente');
            $table->unsignedBigInteger('fk_id_instructor');
            $table->string('motivo', 255);
            $table->string('pin', 10);
            $table->string('estado', 20)->default('pendiente');
            $table->dateTime('expira_en')->nullable();
            $table->dateTime('usado_en')->nullable();
            $table->timestamps();

            $table->foreign('fk_id_aprendiz')->references('id_usuario')->on('usuarios')->onDelete('cascade');
            $table->foreign('fk_id_ambiente')->references('id_ambiente')->on('ambientes')->onDelete('cascade');
            $table->foreign('fk_id_instructor')->references('id_usuario')->on('usuarios')->onDelete('cascade');
            $table->index(['pin', 'estado']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('excusas');
    }
};
