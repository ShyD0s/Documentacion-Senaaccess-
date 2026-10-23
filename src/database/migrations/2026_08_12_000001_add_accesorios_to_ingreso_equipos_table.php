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
        Schema::table('ingreso_equipos', function (Blueprint $table) {
            $table->json('equipo_accesorios')->nullable()->after('equipo_observations');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ingreso_equipos', function (Blueprint $table) {
            $table->dropColumn('equipo_accesorios');
        });
    }
};
