<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Índices de rendimiento para los listados (usuarios, ingresos, presentes):
// convierten los full-scan por llamada en accesos por índice.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ingresos', function (Blueprint $table) {
            $table->index('ingreso_datetime', 'ingresos_datetime_idx');
            $table->index(['fk_id_user', 'ingreso_datetime'], 'ingresos_user_datetime_idx');
            $table->index(['fk_id_user', 'id_ingreso'], 'ingresos_user_id_idx');
            $table->index(['ingreso_type', 'ingreso_datetime'], 'ingresos_type_datetime_idx');
        });
        Schema::table('usuarios', function (Blueprint $table) {
            $table->index('created_at', 'usuarios_created_at_idx');
            $table->index('user_coursenumber', 'usuarios_coursenumber_idx');
        });
    }

    public function down(): void
    {
        Schema::table('ingresos', function (Blueprint $table) {
            $table->dropIndex('ingresos_datetime_idx');
            $table->dropIndex('ingresos_user_datetime_idx');
            $table->dropIndex('ingresos_user_id_idx');
            $table->dropIndex('ingresos_type_datetime_idx');
        });
        Schema::table('usuarios', function (Blueprint $table) {
            $table->dropIndex('usuarios_created_at_idx');
            $table->dropIndex('usuarios_coursenumber_idx');
        });
    }
};
