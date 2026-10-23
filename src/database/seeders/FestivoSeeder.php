<?php

namespace Database\Seeders;

use App\Models\Festivo;
use Illuminate\Database\Seeder;

// Festivos de Colombia 2024-2028: fijos + ley Emiliani (al lunes siguiente)
// + Semana Santa y fiestas de easter_date(). Idempotente (updateOrCreate).
class FestivoSeeder extends Seeder
{
    public function run(): void
    {
        foreach (range(2024, 2028) as $anio) {
            foreach ($this->festivosDe($anio) as [$fecha, $nombre]) {
                Festivo::updateOrCreate(['fecha' => $fecha], ['nombre' => $nombre]);
            }
        }
    }

    private function lunesSiguiente(\DateTime $d): string
    {
        if ($d->format('N') !== '1') {
            $d->modify('next monday');
        }
        return $d->format('Y-m-d');
    }

    // Domingo de pascua por cómputo gregoriano anónimo (algoritmo puro).
    private function pascua(int $anio): \DateTime
    {
        $a = $anio % 19;
        $b = intdiv($anio, 100);
        $c = $anio % 100;
        $d = intdiv($b, 4);
        $e = $b % 4;
        $f = intdiv($b + 8, 25);
        $g = intdiv($b - $f + 1, 3);
        $h = (19 * $a + $b - $d - $g + 15) % 30;
        $i = intdiv($c, 4);
        $k = $c % 4;
        $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
        $m = intdiv($a + 11 * $h + 22 * $l, 451);
        $mes = intdiv($h + $l - 7 * $m + 114, 31);
        $dia = (($h + $l - 7 * $m + 114) % 31) + 1;
        return new \DateTime(sprintf('%04d-%02d-%02d', $anio, $mes, $dia));
    }

    private function festivosDe(int $anio): array
    {
        $out = [];
        // Fijos.
        foreach (['01-01' => 'Año Nuevo', '05-01' => 'Día del Trabajo', '07-20' => 'Independencia', '08-07' => 'Batalla de Boyacá', '12-08' => 'Inmaculada Concepción', '12-25' => 'Navidad'] as $md => $nombre) {
            $out[] = ["$anio-$md", $nombre];
        }
        // Emiliani: si no cae lunes, se observa el lunes siguiente.
        foreach (['01-06' => 'Reyes Magos', '03-19' => 'San José', '06-29' => 'San Pedro y San Pablo', '08-15' => 'Asunción', '10-12' => 'Día de la Raza', '11-01' => 'Todos los Santos', '11-11' => 'Independencia de Cartagena'] as $md => $nombre) {
            $out[] = [$this->lunesSiguiente(new \DateTime("$anio-$md")), $nombre];
        }
        // Semana Santa y fiestas móviles: pascua por cómputo gregoriano puro
        // (sin ext-calendar, ausente en Railway).
        $pascua = $this->pascua($anio);
        $mas = fn (int $dias) => (clone $pascua)->modify("+$dias days")->format('Y-m-d');
        $out[] = [$mas(-3), 'Jueves Santo'];
        $out[] = [$mas(-2), 'Viernes Santo'];
        $out[] = [$this->lunesSiguiente((clone $pascua)->modify('+39 days')), 'Ascensión'];
        $out[] = [$this->lunesSiguiente((clone $pascua)->modify('+60 days')), 'Corpus Christi'];
        $out[] = [$this->lunesSiguiente((clone $pascua)->modify('+68 days')), 'Sagrado Corazón'];
        return $out;
    }
}
