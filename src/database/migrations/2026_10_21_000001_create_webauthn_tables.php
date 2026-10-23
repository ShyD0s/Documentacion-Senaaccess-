<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Huella digital en la web (WebAuthn / passkey): la clave privada nunca sale
// del autenticador del dispositivo; aqui solo se guarda la clave publica.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webauthn_credentials', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('fk_id_usuario');
            $table->foreign('fk_id_usuario')->references('id_usuario')->on('usuarios')->cascadeOnDelete();
            $table->text('credential_id'); // id de la credencial en base64url
            $table->longText('credencial'); // credencial completa (clave publica, contador, aaguid)
            $table->unsignedBigInteger('contador')->default(0);
            $table->string('nombre_dispositivo', 120)->default('Este dispositivo');
            $table->string('transportes', 120)->nullable();
            $table->dateTime('ultimo_uso_en')->nullable();
            $table->timestamps();

            $table->unique('credential_id');
            $table->index('fk_id_usuario');
        });

        // Retos de un solo uso: caducan en 5 minutos y se consumen al usarlos.
        Schema::create('webauthn_challenges', function (Blueprint $table) {
            $table->id();
            $table->string('reto', 191)->unique();
            $table->string('tipo', 20); // registro | autenticacion
            $table->unsignedBigInteger('fk_id_usuario')->nullable();
            $table->foreign('fk_id_usuario')->references('id_usuario')->on('usuarios')->cascadeOnDelete();
            $table->dateTime('expira_en');
            $table->timestamps();

            $table->index('expira_en');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webauthn_challenges');
        Schema::dropIfExists('webauthn_credentials');
    }
};
