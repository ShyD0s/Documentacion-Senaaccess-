<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('usuarios', function (Blueprint $table) {
            $table->string('guest_qr_token', 64)->nullable()->unique()->after('profile_photo_path');
            $table->timestamp('guest_qr_expires_at')->nullable()->after('guest_qr_token');
            $table->boolean('guest_qr_used')->default(false)->after('guest_qr_expires_at');
        });
    }

    public function down(): void
    {
        Schema::table('usuarios', function (Blueprint $table) {
            $table->dropColumn(['guest_qr_token', 'guest_qr_expires_at', 'guest_qr_used']);
        });
    }
};
