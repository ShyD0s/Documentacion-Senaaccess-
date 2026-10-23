<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Comprobante de Ingreso de Equipo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; color: #24292f; font-size: 11.5px; }

        /* ===== Membrete ===== */
        table.membrete { width: 100%; border-collapse: collapse; }
        table.membrete td { vertical-align: middle; }
        .inst-nombre { font-size: 13px; font-weight: bold; letter-spacing: 1.5px; color: #24292f; }
        .inst-sub { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: #6b7280; margin-top: 2px; }
        .inst-marca { font-size: 11px; font-weight: bold; color: #237a00; margin-top: 4px; }
        .doc-caja { border: 1.5px solid #39A900; padding: 8px 12px; text-align: center; width: 150px; }
        .doc-caja .num { font-size: 15px; font-weight: bold; color: #237a00; }
        .doc-caja .lbl { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }

        /* ===== Banda de título ===== */
        .titulo-banda { background-color: #39A900; color: #ffffff; text-align: center; font-size: 13px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; padding: 7px 0; margin-top: 14px; }

        /* ===== Secciones ===== */
        .seccion { margin-top: 16px; }
        .seccion-titulo { font-size: 10.5px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; color: #ffffff; background-color: #4c8c40; display: inline-block; padding: 3px 12px; border-radius: 2px; }
        .seccion-cuerpo { border: 1px solid #d5dce2; border-top: none; padding: 10px 12px 12px 12px; }

        /* ===== Tablas de datos ===== */
        table.datos { width: 100%; border-collapse: collapse; }
        table.datos td { padding: 5px 6px; vertical-align: top; }
        table.datos td.etiqueta { width: 130px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding-top: 7px; }
        table.datos td.valor { font-weight: bold; color: #24292f; border-bottom: 1px dotted #c4cdd5; }
        table.datos tr.par td { background-color: #f6f8f7; }

        /* ===== Accesorios ===== */
        table.accesorios { width: 100%; border-collapse: collapse; }
        table.accesorios th { background-color: #eef4ec; color: #33413a; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; padding: 5px 8px; text-align: left; border-bottom: 1.5px solid #39A900; }
        table.accesorios td { padding: 5px 8px; border-bottom: 1px solid #e6eaee; }
        .vacio { color: #6b7280; font-style: italic; }

        /* ===== Pie ===== */
        .pie { margin-top: 26px; border-top: 2px solid #39A900; padding-top: 6px; font-size: 8.5px; color: #6b7280; text-align: center; line-height: 1.5; }

        .badge { display: inline-block; padding: 1px 9px; border-radius: 8px; font-size: 9.5px; font-weight: bold; }
        .badge-verde { background-color: #e7f3e2; color: #237a00; border: 1px solid #9fd08c; }
        .badge-ambar { background-color: #fdf3e0; color: #a05a00; border: 1px solid #ecc789; }
    </style>
</head>
<body>
    @php
        $vinculaciones = [
            'admin' => 'Administrador(a)',
            'Instructor' => 'Instructor(a)',
            'Aprendiz' => 'Aprendiz SENA',
        ];
        $vinculacion = $vinculaciones[$dueno?->role?->rol_name] ?? ($dueno?->role?->rol_name ?? '—');
        $numero = str_pad($ingreso->id_ingreso_equipo, 6, '0', STR_PAD_LEFT);
        $tieneFormacion = !empty($dueno->user_program) || !empty($dueno->user_coursenumber);
    @endphp

    <table class="membrete">
        <tr>
            <td style="width: 95px;"><img src="{{ public_path('Icons/logoSena.png') }}" alt="SENA" style="width: 82px;"></td>
            <td style="text-align: center;">
                <div class="inst-nombre">SERVICIO NACIONAL DE APRENDIZAJE</div>
                <div class="inst-sub">Centro de Comercio y Servicios · CCyS</div>
                <div class="inst-marca">SenaAccess — Sistema de Control de Acceso</div>
            </td>
            <td style="width: 160px; text-align: right;">
                <div class="doc-caja">
                    <div class="lbl">Comprobante N°</div>
                    <div class="num">{{ $numero }}</div>
                    <div class="lbl">Expedido {{ $generado_en->format('d/m/Y') }}</div>
                </div>
            </td>
        </tr>
    </table>

    <div class="titulo-banda">Comprobante de Ingreso de Equipo</div>

    <div class="seccion">
        <span class="seccion-titulo">1 · Datos del portador</span>
        <div class="seccion-cuerpo">
            <table class="datos">
                <tr>
                    <td class="etiqueta">Nombre completo</td>
                    <td class="valor">{{ $dueno ? $dueno->user_name.' '.$dueno->user_lastname : '—' }}</td>
                    <td class="etiqueta" style="width: 110px;">Identificación</td>
                    <td class="valor">{{ $dueno->user_identification ?? '—' }}</td>
                </tr>
                <tr class="par">
                    <td class="etiqueta">Vinculación</td>
                    <td class="valor">{{ $vinculacion }}</td>
                    <td class="etiqueta">Correo electrónico</td>
                    <td class="valor">{{ $dueno->user_email ?? '—' }}</td>
                </tr>
                @if ($tieneFormacion)
                    <tr>
                        <td class="etiqueta">Programa de formación</td>
                        <td class="valor">{{ $dueno->user_program ?: '—' }}</td>
                        <td class="etiqueta">N° de ficha</td>
                        <td class="valor">{{ $dueno->user_coursenumber ?: '—' }}</td>
                    </tr>
                @endif
            </table>
        </div>
    </div>

    <div class="seccion">
        <span class="seccion-titulo">2 · Descripción del equipo</span>
        <div class="seccion-cuerpo">
            <table class="datos">
                <tr>
                    <td class="etiqueta">Tipo de equipo</td>
                    <td class="valor">{{ $ingreso->equipo_type }}</td>
                    <td class="etiqueta" style="width: 110px;">Marca</td>
                    <td class="valor">{{ $ingreso->equipo_brand }}</td>
                </tr>
                <tr class="par">
                    <td class="etiqueta">Modelo</td>
                    <td class="valor">{{ $ingreso->equipo_model ?: '—' }}</td>
                    <td class="etiqueta">Color</td>
                    <td class="valor">{{ $ingreso->equipo_color }}</td>
                </tr>
                <tr>
                    <td class="etiqueta">Serial</td>
                    <td class="valor">{{ $ingreso->equipo_serial }}</td>
                    <td class="etiqueta">Propiedad</td>
                    <td class="valor"><span class="badge {{ $ingreso->equipo_propiedad === 'Propio' ? 'badge-verde' : 'badge-ambar' }}">{{ $ingreso->equipo_propiedad }}</span></td>
                </tr>
                <tr class="par">
                    <td class="etiqueta">Estado actual</td>
                    <td class="valor"><span class="badge {{ $ingreso->equipo_status === 'Disponible' ? 'badge-verde' : 'badge-ambar' }}">{{ $ingreso->equipo_status }}</span></td>
                    <td class="etiqueta"></td>
                    <td></td>
                </tr>
                <tr>
                    <td class="etiqueta">Fecha de ingreso</td>
                    <td class="valor">{{ $ingreso->entry_datetime ? \Carbon\Carbon::parse($ingreso->entry_datetime)->timezone('America/Bogota')->format('d/m/Y H:i') : '—' }}</td>
                    <td class="etiqueta">Fecha de devolución</td>
                    <td class="valor">{{ $ingreso->equipo_return_datetime ? \Carbon\Carbon::parse($ingreso->equipo_return_datetime)->timezone('America/Bogota')->format('d/m/Y H:i') : 'Pendiente' }}</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="seccion">
        <span class="seccion-titulo">3 · Accesorios entregados</span>
        <div class="seccion-cuerpo">
            @if ($accesorios->count())
                <table class="accesorios">
                    <tr><th style="width: 45px;">N°</th><th>Descripción</th></tr>
                    @foreach ($accesorios as $i => $acc)
                        <tr><td>{{ $i + 1 }}</td><td>{{ $acc }}</td></tr>
                    @endforeach
                </table>
            @else
                <span class="vacio">No se registran accesorios para este equipo.</span>
            @endif
        </div>
    </div>

    <div class="seccion">
        <span class="seccion-titulo">4 · Observaciones</span>
        <div class="seccion-cuerpo">
            @if ($ingreso->equipo_observations)
                {{ $ingreso->equipo_observations }}
            @else
                <span class="vacio">Sin observaciones.</span>
            @endif
        </div>
    </div>

    <div class="pie">
        Documento generado electrónicamente por SenaAccess el {{ $generado_en->format('d/m/Y H:i') }} · Comprobante N° {{ $numero }}<br>
        Este documento constituye el soporte del registro de ingreso del equipo al centro de formación.
    </div>
</body>
</html>
