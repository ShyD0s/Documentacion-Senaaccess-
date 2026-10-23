<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!DB::table('roles')->where('rol_name', 'Portero')->exists()) {
            DB::table('roles')->insert([
                'rol_name' => 'Portero',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        $id = DB::table('roles')->where('rol_name', 'Portero')->value('id_rol');
        if ($id && !DB::table('usuarios')->where('fk_id_rol', $id)->exists()) {
            DB::table('roles')->where('id_rol', $id)->delete();
        }
    }
};
