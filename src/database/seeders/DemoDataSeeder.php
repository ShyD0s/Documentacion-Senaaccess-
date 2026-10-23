<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Ambiente;
use App\Models\User;
use Illuminate\Support\Facades\Log;

// Base operativa para producción (idempotente): ambientes por sede y asignación
// de instructores/aprendices. NO crea ingresos: el historial queda limpio y
// Presentes se llena solo con movimientos reales.
class DemoDataSeeder extends Seeder
{
    public function run(): void
    {
        // Ambientes de prueba: (nombre, sede, jornada, inicio, fin, capacidad).
        $ambientes = [
            ['CCyS 101', 'Centro Comercio y Servicios', 'Mañana', '07:00', '12:00', 30],
            ['CCyS 102', 'Centro Comercio y Servicios', 'Mañana', '07:00', '12:00', 30],
            ['CCyS 103', 'Centro Comercio y Servicios', 'Tarde', '13:00', '18:00', 28],
            ['Ciudad Jardín 201', 'Ciudad Jardín', 'Tarde', '13:00', '18:00', 25],
            ['Ciudad Jardín 202', 'Ciudad Jardín', 'Mañana', '07:00', '12:00', 25],
            ['Aulas 301', 'Bloque de Aulas', 'Tarde', '13:00', '18:00', 35],
            ['Aulas 302', 'Bloque de Aulas', 'Mañana', '07:00', '12:00', 35],
        ];

        $ids = [];
        foreach ($ambientes as $a) {
            $amb = Ambiente::firstOrCreate(
                ['ambiente_nombre' => $a[0]],
                [
                    'ambiente_ubicacion' => $a[1],
                    'ambiente_jornada' => $a[2],
                    'hora_inicio' => $a[3],
                    'hora_fin' => $a[4],
                    'ambiente_capacidad' => $a[5],
                    'ambiente_estado' => 'Activo',
                    'radio_m' => 30,
                ]
            );
            $ids[$a[0]] = $amb->id_ambiente;
        }

        // Correos de usuarios ya creados por DatabaseSeeder la primera vez.
        $correos = [
            'juan.pablo@sena.edu.co' => 'instr', 'alejandro@sena.edu.co' => 'instr',
            'gustavo@sena.edu.co' => 'instr', 'raul@sena.edu.co' => 'instr',
            'andres.vargas@sena.edu.co' => 'apr', 'laura.medina@sena.edu.co' => 'apr',
            'sebastian@sena.edu.co' => 'apr', 'camilo@sena.edu.co' => 'apr',
            'katherin@sena.edu.co' => 'apr',
        ];
        // Usuarios que falten (cuentas reales borradas/renombradas en producción)
        // se omiten con aviso en vez de tumbar el deploy: el seed nunca puede
        // fallar el releaseCommand `migrate --seed` (eso deja la app en 502).
        $usuarios = [];
        foreach ($correos as $email => $_) {
            $usuarios[$email] = User::where('user_email', $email)->first();
        }
        $faltantes = array_keys(array_filter($usuarios, fn ($u) => $u === null));
        if (!empty($faltantes)) {
            Log::warning('DemoDataSeeder omite cuentas inexistentes: ' . implode(', ', $faltantes));
        }

        // Asignaciones de instructores a ambientes.
        $instrAmbiente = [
            'CCyS 101' => ['juan.pablo@sena.edu.co'],
            'CCyS 102' => ['alejandro@sena.edu.co'],
            'CCyS 103' => ['gustavo@sena.edu.co'],
            'Ciudad Jardín 201' => ['raul@sena.edu.co'],
            'Ciudad Jardín 202' => ['juan.pablo@sena.edu.co'],
            'Aulas 301' => ['alejandro@sena.edu.co'],
            'Aulas 302' => ['gustavo@sena.edu.co'],
        ];
        foreach ($instrAmbiente as $nombre => $emails) {
            $presentes = array_values(array_filter(array_map(
                fn ($e) => $usuarios[$e]->id_usuario ?? null,
                $emails
            )));
            if (empty($presentes)) continue;
            $amb = Ambiente::find($ids[$nombre]);
            // Lista completa: sync exacto como antes; si falta alguien, solo
            // agrega sin desprender asignaciones reales existentes.
            if (count($presentes) === count($emails)) $amb->instructores()->sync($presentes);
            else $amb->instructores()->syncWithoutDetaching($presentes);
        }

        // Asignaciones de aprendices a ambientes.
        $aprAmbiente = [
            'CCyS 101' => ['andres.vargas@sena.edu.co', 'laura.medina@sena.edu.co'],
            'CCyS 102' => ['sebastian@sena.edu.co'],
            'CCyS 103' => ['camilo@sena.edu.co', 'katherin@sena.edu.co'],
            'Ciudad Jardín 201' => ['andres.vargas@sena.edu.co', 'camilo@sena.edu.co'],
            'Ciudad Jardín 202' => ['laura.medina@sena.edu.co'],
            'Aulas 301' => ['katherin@sena.edu.co'],
            'Aulas 302' => ['sebastian@sena.edu.co', 'camilo@sena.edu.co'],
        ];
        foreach ($aprAmbiente as $nombre => $emails) {
            $presentes = array_values(array_filter(array_map(
                fn ($e) => $usuarios[$e]->id_usuario ?? null,
                $emails
            )));
            if (empty($presentes)) continue;
            $amb = Ambiente::find($ids[$nombre]);
            if (count($presentes) === count($emails)) $amb->aprendices()->sync($presentes);
            else $amb->aprendices()->syncWithoutDetaching($presentes);
        }

        $this->command->info('DemoDataSeeder: ambientes y asignaciones listos (sin ingresos demo).');
    }
}