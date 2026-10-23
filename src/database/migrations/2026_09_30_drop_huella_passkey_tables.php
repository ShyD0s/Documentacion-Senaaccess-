<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Limpieza Fase 1: la huella queda solo en el movil (Keystore local);
        // el backend ya no guarda huellas ni passkeys WebAuthn ni retos.
        Schema::dropIfExists('huellas_usuarios');
        Schema::dropIfExists('passkeys');
        Schema::dropIfExists('webauthn_challenges');
    }

    public function down(): void
    {
        // No se revierte: las tablas eliminadas no se recrean.
    }
};
