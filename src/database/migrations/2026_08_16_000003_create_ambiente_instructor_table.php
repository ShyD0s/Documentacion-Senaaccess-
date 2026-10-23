<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ambiente_instructor', function (Blueprint $table) {
            $table->id('id_ambiente_instructor');
            $table->unsignedBigInteger('fk_id_ambiente');
            $table->unsignedBigInteger('fk_id_instructor');
            $table->timestamps();

            $table->foreign('fk_id_ambiente')->references('id_ambiente')->on('ambientes')->onDelete('cascade');
            $table->foreign('fk_id_instructor')->references('id_usuario')->on('usuarios')->onDelete('cascade');

            $table->unique(['fk_id_ambiente', 'fk_id_instructor']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ambiente_instructor');
    }
};