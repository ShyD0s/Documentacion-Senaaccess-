<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Rename de roles: admin->Superadmin (superusuario total),
// Portero->Admin (operativo de portería). Reversible.
return new class extends Migration
{
    public function up(): void
    {
        DB::table('roles')->whereRaw('LOWER(rol_name) = ?', ['admin'])->update(['rol_name' => 'Superadmin']);
        DB::table('roles')->whereRaw('LOWER(rol_name) = ?', ['portero'])->update(['rol_name' => 'Admin']);
    }

    public function down(): void
    {
        DB::table('roles')->where('rol_name', 'Superadmin')->update(['rol_name' => 'admin']);
        DB::table('roles')->where('rol_name', 'Admin')->update(['rol_name' => 'Portero']);
    }
};
