<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('usuarios', function (Blueprint $table) {
            $table->boolean('two_factor_enabled')->default(false)->after('email_verified_at');
        });

        Schema::create('two_factor_challenges', function (Blueprint $table) {
            $table->id();
            $table->string('challenge_id', 36)->unique();
            $table->unsignedBigInteger('fk_id_usuario');
            $table->string('estado', 20)->default('pendiente');
            $table->string('code_hash', 255)->nullable();
            $table->dateTime('code_expires_at')->nullable();
            $table->dateTime('expires_at');
            $table->dateTime('resolved_at')->nullable();
            $table->string('access_token', 255)->nullable();
            $table->string('ip', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->timestamps();

            $table->foreign('fk_id_usuario')->references('id_usuario')->on('usuarios')->onDelete('cascade');
            $table->index(['fk_id_usuario', 'estado', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('two_factor_challenges');
        Schema::table('usuarios', function (Blueprint $table) {
            $table->dropColumn('two_factor_enabled');
        });
    }
};