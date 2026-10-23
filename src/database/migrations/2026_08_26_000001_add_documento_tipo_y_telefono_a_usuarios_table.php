<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Anade tipo de documento y telefono de contacto a los usuarios. Se usa SQL
// crudo (ALTER TABLE ... ADD) porque doctrine/dbal no esta instalado y
// Schema::change() lo exige. Los existentes nacen con CC y telefono nulo.
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE usuarios ADD user_documento_tipo VARCHAR(5) NULL DEFAULT 'CC'");
        DB::statement("ALTER TABLE usuarios ADD user_telefono VARCHAR(20) NULL");
        DB::statement("UPDATE usuarios SET user_documento_tipo = 'CC' WHERE user_documento_tipo IS NULL");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE usuarios DROP COLUMN user_documento_tipo');
        DB::statement('ALTER TABLE usuarios DROP COLUMN user_telefono');
    }
};
