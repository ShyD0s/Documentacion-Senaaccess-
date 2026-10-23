<?php

namespace App\Http\Controllers;

use App\Models\AccesoDiario;
use App\Models\PrediccionModelo;
use App\Services\PredictorAccesos;
use Illuminate\Http\Request;

// Predicción de accesos diarios (solo superadmin): agrega al vuelo,
// reentrena si hay días nuevos o el modelo tiene más de 7 días.
class PrediccionController extends Controller
{
    public function indice(Request $request, PredictorAccesos $predictor)
    {
        $nuevas = $predictor->agregar();
        $filas = AccesoDiario::count();
        if ($filas < PredictorAccesos::MIN_FILAS) {
            return response()->json([
                'aviso' => 'Datos insuficientes: el modelo necesita al menos ' . PredictorAccesos::MIN_FILAS . ' días con movimientos.',
                'filas' => $filas,
            ]);
        }
        $modelo = PrediccionModelo::find(1);
        if (!$modelo || $nuevas > 0 || $modelo->entrenado_en->lt(now()->subDays(7))) {
            $metricas = $predictor->entrenar();
            $modelo = PrediccionModelo::find(1);
        } else {
            $metricas = ['filas' => $modelo->filas, 'mae' => $modelo->mae, 'r2' => $modelo->r2];
        }
        $dias = min(max((int) $request->query('dias', 7), 1), 14);
        return response()->json([
            'predicciones' => $predictor->predecir($dias),
            'mae' => $modelo->mae,
            'r2' => $modelo->r2,
            'filas' => $modelo->filas,
            'entrenado_en' => $modelo->entrenado_en,
        ]);
    }
}
