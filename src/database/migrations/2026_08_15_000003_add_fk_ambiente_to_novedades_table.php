<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('novedades', function (Blueprint $table) {
            $table->unsignedBigInteger('fk_id_ambiente')->nullable()->after('novedad_ambiente');
            $table->foreign('fk_id_ambiente')->references('id_ambiente')->on('ambientes')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('novedades', function (Blueprint $table) {
            $table->dropForeign(['fk_id_ambiente']);
            $table->dropColumn('fk_id_ambiente');
        });
    }
};
