<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Ficha y programa ahora son opcionales: solo el Aprendiz los tiene, mientras
// que admin e instructor los guardan en null. Se usa SQL crudo (ALTER TABLE ...
// MODIFY) porque doctrine/dbal no está instalado y Schema::change() lo exige.
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE usuarios MODIFY user_coursenumber INT NULL');
        DB::statement('ALTER TABLE usuarios MODIFY user_program VARCHAR(100) NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE usuarios MODIFY user_coursenumber INT NOT NULL');
        DB::statement('ALTER TABLE usuarios MODIFY user_program VARCHAR(100) NOT NULL');
    }
};
