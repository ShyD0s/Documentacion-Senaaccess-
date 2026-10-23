<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ambientes', function (Blueprint $table) {
            $table->unsignedBigInteger('fk_id_instructor')->nullable()->after('id_ambiente');
            $table->string('ambiente_jornada', 20)->nullable()->after('ambiente_estado');

            $table->foreign('fk_id_instructor')
                ->references('id_usuario')
                ->on('usuarios')
                ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('ambientes', function (Blueprint $table) {
            $table->dropForeign(['fk_id_instructor']);
            $table->dropColumn(['fk_id_instructor', 'ambiente_jornada']);
        });
    }
};
