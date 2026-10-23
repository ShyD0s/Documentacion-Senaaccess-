<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Base del modelo predictivo de accesos diarios (metodología del doc
// "6 Modelo predictivo": features → split 80/20 → MAE/R² → endpoint).
return new class extends Migration
{
    public function up(): void
    {
        // Festivos de Colombia (fecha observada): alimentan la feature es_festivo.
        Schema::create('festivos', function (Blueprint $table) {
            $table->id();
            $table->date('fecha')->unique();
            $table->string('nombre', 120);
        });

        // Agregado diario de movimientos (zona America/Bogota).
        Schema::create('accesos_diarios', function (Blueprint $table) {
            $table->id();
            $table->date('fecha')->unique();
            $table->unsignedTinyInteger('dia_semana'); // 1=domingo..7=sabado (DAYOFWEEK)
            $table->boolean('es_festivo')->default(false);
            $table->unsignedInteger('total_entradas')->default(0);
            $table->unsignedInteger('total_salidas')->default(0);
        });

        // Coeficientes y métricas del modelo entrenado (una sola fila viva).
        Schema::create('prediccion_modelo', function (Blueprint $table) {
            $table->id();
            $table->json('coeficientes');
            $table->double('intercepto');
            $table->double('mae');
            $table->double('r2');
            $table->unsignedInteger('filas');
            $table->timestamp('entrenado_en')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prediccion_modelo');
        Schema::dropIfExists('accesos_diarios');
        Schema::dropIfExists('festivos');
    }
};
