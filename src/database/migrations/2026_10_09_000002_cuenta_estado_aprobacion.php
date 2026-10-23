<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

// Aprobación de cuentas: pendiente (registro público) / aprobada / rechazada.
// Las cuentas existentes quedan aprobadas para no bloquear a nadie.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('usuarios', function (Blueprint $table) {
            $table->string('estado_cuenta', 20)->default('pendiente')->after('fk_id_rol');
        });
        DB::table('usuarios')->update(['estado_cuenta' => 'aprobada']);
    }

    public function down(): void
    {
        Schema::table('usuarios', function (Blueprint $table) {
            $table->dropColumn('estado_cuenta');
        });
    }
};
