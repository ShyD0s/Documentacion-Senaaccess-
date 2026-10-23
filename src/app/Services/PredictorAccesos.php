<?php

namespace App\Services;

use App\Models\AccesoDiario;
use App\Models\Festivo;
use App\Models\PrediccionModelo;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

// Modelo predictivo de accesos diarios (equivalente PHP del doc
// "6 Modelo predictivo": features → split cronológico 80/20 → MAE/R²).
// Sin dependencias nuevas: mínimos cuadrados ordinarios a mano.
class PredictorAccesos
{
    const MIN_FILAS = 50;

    // Features en orden: es_sabado (0/1), es_domingo (0/1), es_festivo (0/1),
    // tendencia (media móvil 7 días), semana_iso (1-53).
    const FEATURES = ['es_sabado', 'es_domingo', 'es_festivo', 'tendencia', 'semana_iso'];

    // Agrega a accesos_diarios las fechas con movimientos aún no agregadas.
    // Bogotá es UTC-5 todo el año (sin horario de verano).
    public function agregar(): int
    {
        $desde = AccesoDiario::max('fecha');
        $sql = "SELECT DATE(DATE_SUB(ingreso_datetime, INTERVAL 5 HOUR)) AS f,
            SUM(LOWER(ingreso_type) = 'entrada') AS e,
            SUM(LOWER(ingreso_type) = 'salida') AS s
            FROM ingresos GROUP BY f";
        $params = [];
        if ($desde) {
            $sql .= " HAVING f > ?";
            $params[] = $desde;
        }
        $sql .= " ORDER BY f";
        $grupos = DB::select($sql, $params);
        if (empty($grupos)) {
            return 0;
        }
        $festivos = Festivo::pluck('fecha')->flip()->all();
        $nuevas = 0;
        foreach ($grupos as $g) {
            // 1=domingo..7=sábado (igual que DAYOFWEEK de MySQL).
            $dow = Carbon::parse($g->f)->dayOfWeek + 1;
            $r = AccesoDiario::updateOrCreate(['fecha' => $g->f], [
                'dia_semana' => $dow,
                'es_festivo' => isset($festivos[$g->f]),
                'total_entradas' => (int) $g->e,
                'total_salidas' => (int) $g->s,
            ]);
            if ($r->wasRecentlyCreated) {
                $nuevas++;
            }
        }
        return $nuevas;
    }

    // Entrena por mínimos cuadrados con split cronológico 80/20 y guarda el modelo.
    public function entrenar(): array
    {
        $filas = AccesoDiario::orderBy('fecha')->get();
        if ($filas->count() < self::MIN_FILAS) {
            throw new \RuntimeException('Pocos datos: se necesitan al menos ' . self::MIN_FILAS . ' días.');
        }
        $datos = [];
        $hist = [];
        foreach ($filas as $r) {
            if (count($hist) === 7) {
                // Sábado y domingo tienen niveles distintos: van separados.
                $datos[] = [
                    [$r->dia_semana == 7 ? 1.0 : 0.0, $r->dia_semana == 1 ? 1.0 : 0.0, $r->es_festivo ? 1.0 : 0.0, array_sum($hist) / 7, (float) $r->fecha->format('W')],
                    (float) $r->total_entradas,
                ];
            }
            $hist[] = (float) $r->total_entradas;
            if (count($hist) > 7) {
                array_shift($hist);
            }
        }
        // Split cronológico (serie temporal: el futuro no se mezcla con el pasado).
        $corte = (int) (count($datos) * 0.8);
        $ent = array_slice($datos, 0, $corte);
        $pru = array_slice($datos, $corte);
        $n = count(self::FEATURES) + 1;
        $a = array_fill(0, $n, array_fill(0, $n, 0.0));
        $b = array_fill(0, $n, 0.0);
        foreach ($ent as [$x, $y]) {
            $f = array_merge([1.0], $x);
            for ($i = 0; $i < $n; $i++) {
                $b[$i] += $f[$i] * $y;
                for ($j = 0; $j < $n; $j++) {
                    $a[$i][$j] += $f[$i] * $f[$j];
                }
            }
        }
        $coef = $this->resolver($a, $b);
        $pred = array_map(fn ($d) => $this->aplicar($coef, $d[0]), $pru);
        $reales = array_column($pru, 1);
        $mae = array_sum(array_map(fn ($p, $y) => abs($p - $y), $pred, $reales)) / count($pru);
        $media = array_sum($reales) / count($reales);
        $sst = array_sum(array_map(fn ($y) => ($y - $media) ** 2, $reales));
        $sse = array_sum(array_map(fn ($p, $y) => ($p - $y) ** 2, $pred, $reales));
        $metricas = [
            'filas' => $filas->count(),
            'mae' => round($mae, 2),
            'r2' => $sst > 0 ? round(1 - $sse / $sst, 4) : 0.0,
        ];
        PrediccionModelo::updateOrCreate(['id' => 1], [
            'coeficientes' => array_slice($coef, 1),
            'intercepto' => $coef[0],
            'mae' => $metricas['mae'],
            'r2' => $metricas['r2'],
            'filas' => $metricas['filas'],
            'entrenado_en' => now(),
        ]);
        return $metricas;
    }

    // Predice los próximos $dias días (la tendencia se realimenta con lo predicho).
    public function predecir(int $dias = 7): array
    {
        $modelo = PrediccionModelo::find(1);
        if (!$modelo) {
            return [];
        }
        $coef = array_merge([$modelo->intercepto], $modelo->coeficientes);
        $ultimos = AccesoDiario::orderByDesc('fecha')->limit(7)->pluck('total_entradas')->reverse()->map(fn ($v) => (float) $v)->all();
        $festivos = Festivo::pluck('fecha')->flip()->all();
        $nombres = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
        $hoy = Carbon::now('America/Bogota')->startOfDay();
        $salida = [];
        for ($i = 1; $i <= $dias; $i++) {
            $f = (clone $hoy)->addDays($i);
            $w = (int) $f->format('w');
            $x = [$w === 6 ? 1.0 : 0.0, $w === 0 ? 1.0 : 0.0, isset($festivos[$f->format('Y-m-d')]) ? 1.0 : 0.0, array_sum($ultimos) / count($ultimos), (float) $f->format('W')];
            $p = max(0, (int) round($this->aplicar($coef, $x)));
            $salida[] = [
                'fecha' => $f->format('Y-m-d'),
                'dia' => $nombres[(int) $f->format('w')],
                'predicho' => $p,
                'min' => max(0, (int) round($p - $modelo->mae)),
                'max' => (int) round($p + $modelo->mae),
            ];
            $ultimos[] = (float) $p;
            array_shift($ultimos);
        }
        return $salida;
    }

    private function aplicar(array $coef, array $x): float
    {
        $f = array_merge([1.0], $x);
        $s = 0.0;
        foreach ($f as $i => $v) {
            $s += $coef[$i] * $v;
        }
        return $s;
    }

    // Eliminación gaussiana con pivoteo parcial (sistema 5x5: sobra potencia).
    private function resolver(array $a, array $b): array
    {
        $n = count($b);
        for ($col = 0; $col < $n; $col++) {
            $piv = $col;
            for ($row = $col + 1; $row < $n; $row++) {
                if (abs($a[$row][$col]) > abs($a[$piv][$col])) {
                    $piv = $row;
                }
            }
            [$a[$col], $a[$piv]] = [$a[$piv], $a[$col]];
            [$b[$col], $b[$piv]] = [$b[$piv], $b[$col]];
            if (abs($a[$col][$col]) < 1e-12) {
                $a[$col][$col] = 1e-12;
            }
            for ($row = $col + 1; $row < $n; $row++) {
                $f = $a[$row][$col] / $a[$col][$col];
                for ($k = $col; $k < $n; $k++) {
                    $a[$row][$k] -= $f * $a[$col][$k];
                }
                $b[$row] -= $f * $b[$col];
            }
        }
        $x = array_fill(0, $n, 0.0);
        for ($row = $n - 1; $row >= 0; $row--) {
            $s = $b[$row];
            for ($k = $row + 1; $k < $n; $k++) {
                $s -= $a[$row][$k] * $x[$k];
            }
            $x[$row] = $s / $a[$row][$row];
        }
        return $x;
    }
}
