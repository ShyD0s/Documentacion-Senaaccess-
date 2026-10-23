<?php

namespace App\Console\Commands;

use App\Services\PredictorAccesos;
use Illuminate\Console\Command;

// Agrega el historial y entrena el predictivo de accesos diarios.
class EntrenarPredictivo extends Command
{
    protected $signature = 'accesos:entrenar';

    protected $description = 'Agrega movimientos por día y entrena el modelo predictivo de accesos';

    public function handle(PredictorAccesos $predictor): int
    {
        $nuevas = $predictor->agregar();
        $this->info("Días agregados: {$nuevas}");
        try {
            $m = $predictor->entrenar();
        } catch (\RuntimeException $e) {
            $this->warn($e->getMessage());
            return self::FAILURE;
        }
        $this->info("Modelo entrenado con {$m['filas']} días: MAE={$m['mae']} R²={$m['r2']}");
        return self::SUCCESS;
    }
}
