<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('token_recovery', function (Blueprint $table) {
            $table->id('id_token');
            $table->string('token_code', 10);
            $table->dateTime('token_exp');
            $table->boolean('token_used')->default(false);
            $table->unsignedBigInteger('fk_id_usuario');
            $table->foreign('fk_id_usuario')->references('id_usuario')->on('usuarios');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('token_recovery');
    }
};
