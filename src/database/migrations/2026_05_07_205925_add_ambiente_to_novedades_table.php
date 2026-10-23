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
        Schema::table('novedades', function (Blueprint $table) {
            $table->string('novedad_ambiente', 100)->after('id_novedad');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('novedades', function (Blueprint $table) {
            $table->dropColumn('novedad_ambiente');
        });
    }
};
