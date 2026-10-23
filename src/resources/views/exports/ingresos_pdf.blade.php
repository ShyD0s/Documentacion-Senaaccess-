<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Historial de ingresos</title>
    <style>
        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 10px;
            color: #1c1c1c;
            margin: 0;
        }
        .cabecera {
            border-bottom: 3px solid #02D914;
            padding-bottom: 10px;
            margin-bottom: 14px;
        }
        .cabecera h1 {
            margin: 0;
            font-size: 18px;
            letter-spacing: 2px;
            color: #02D914;
        }
        .cabecera p {
            margin: 2px 0 0 0;
            font-size: 10px;
            color: #6b7280;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th {
            background-color: #02D914;
            color: #000000;
            font-weight: bold;
            text-align: left;
            padding: 7px 8px;
            font-size: 10px;
            letter-spacing: 1px;
        }
        td {
            border-bottom: 1px solid #e5e7eb;
            padding: 6px 8px;
            text-align: left;
        }
        tr:nth-child(even) {
            background-color: #f2f4f7;
        }
        .pie {
            margin-top: 14px;
            font-size: 9px;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <div class="cabecera">
        <h1>SENA ACCESS</h1>
        <p>Historial de ingresos al centro — Generado el {{ \Carbon\Carbon::now('America/Bogota')->format('d/m/Y H:i') }} (hora Bogotá)</p>
    </div>
    <table>
        <tr>
            @foreach($titulos as $titulo)
                <th>{{ $titulo }}</th>
            @endforeach
        </tr>
        @forelse($filas as $fila)
            <tr>
                @foreach($fila as $celda)
                    <td>{{ $celda }}</td>
                @endforeach
            </tr>
        @empty
            <tr><td colspan="{{ count($titulos) }}">Sin registros para los filtros seleccionados.</td></tr>
        @endforelse
    </table>
    <p class="pie">&copy; {{ date('Y') }} SENA Access. Control de acceso CCyS.</p>
</body>
</html>