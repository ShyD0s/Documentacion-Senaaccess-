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
            $table->string('equipo_propiedad')->default('Prestado')->after('equipo_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ingreso_equipos', function (Blueprint $table) {
            $table->dropColumn('equipo_propiedad');
        });
    }
};