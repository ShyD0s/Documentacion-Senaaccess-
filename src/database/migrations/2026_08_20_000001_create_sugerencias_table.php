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
        Schema::create('sugerencias', function (Blueprint $table) {
            $table->id('id_sugerencia');
            $table->unsignedBigInteger('fk_id_usuario');
            $table->string('sugerencia_asunto', 150);
            $table->text('sugerencia_body');
            $table->string('sugerencia_categoria', 50)->default('Otro');
            $table->string('sugerencia_status', 50)->default('Pendiente');
            $table->text('respuesta_admin')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->foreign('fk_id_usuario')->references('id_usuario')->on('usuarios')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sugerencias');
    }
};
