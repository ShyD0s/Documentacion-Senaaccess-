<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('token_recovery', function (Blueprint $table) {
            $table->string('token_code', 255)->change();
        });
    }

    public function down(): void
    {
        Schema::table('token_recovery', function (Blueprint $table) {
            $table->string('token_code', 10)->change();
        });
    }
};
