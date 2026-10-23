<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usuarios', function (Blueprint $table) {
            $table->id('id_usuario');
            $table->string('user_name', 50);
            $table->string('user_lastname', 50);
            $table->string('user_email', 100)->unique();
            $table->string('user_password', 255);
            $table->integer('user_coursenumber');
            $table->string('user_program', 100);
            $table->unsignedBigInteger('fk_id_rol');
            $table->foreign('fk_id_rol')->references('id_rol')->on('roles');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usuarios');
    }
};
