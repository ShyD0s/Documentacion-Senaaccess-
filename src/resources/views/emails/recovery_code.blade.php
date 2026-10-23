<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu código de recuperación SENA Access es {{ $code }}</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            background-color: #07090D;
            margin: 0;
            padding: 0;
            color: #FFFFFF;
        }
        .preheader {
            display: none;
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            color: transparent;
        }
        .page {
            padding: 32px 12px;
        }
        .container {
            max-width: 560px;
            margin: 0 auto;
            background-color: #13161C;
            border: 1px solid rgba(2, 217, 20, 0.25);
            border-radius: 24px;
            overflow: hidden;
            text-align: center;
        }
        .glow {
            background: radial-gradient(circle at 50% 0%, rgba(2, 217, 20, 0.25), transparent 60%),
                        #13161C;
            padding: 28px 28px 4px 28px;
            border-bottom: 1px solid rgba(2, 217, 20, 0.15);
        }
        .logo {
            margin: 0 0 14px 0;
        }
        .logo img {
            display: block;
            width: 132px;
            height: auto;
            margin: 0 auto;
        }
        .brand {
            margin: 0;
            font-size: 24px;
            font-weight: bold;
            letter-spacing: 4px;
            color: #02D914;
        }
        .brand-sub {
            margin: 6px 0 0 0;
            font-size: 11px;
            letter-spacing: 3px;
            color: #7A828B;
        }
        .content {
            padding: 20px 28px 12px 28px;
        }
        .content h2 {
            margin: 0 0 8px 0;
            font-size: 20px;
            font-weight: bold;
            color: #FFFFFF;
        }
        .content p {
            font-size: 14px;
            line-height: 1.6;
            color: #B9C0C7;
        }
        .content p strong {
            color: #FFFFFF;
        }
        .code-box {
            background-color: #07090D;
            border: 2px dashed #02D914;
            border-radius: 16px;
            padding: 20px 12px;
            margin: 20px 0;
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 4px;
            color: #02D914;
            text-shadow: 0 0 18px rgba(2, 217, 20, 0.55);
        }
        .steps {
            text-align: left;
            margin: 4px 0 8px 0;
            padding: 16px 18px;
            background-color: #07090D;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 16px;
        }
        .steps p {
            margin: 6px 0;
            font-size: 13px;
        }
        .steps strong {
            color: #02D914;
        }
        .nota {
            font-size: 12px;
            color: #7A828B;
            margin: 12px 0 0 0;
        }
        .footer {
            padding: 0 28px 28px 28px;
            margin-top: 16px;
            font-size: 12px;
            color: #8A94A3;
        }
    </style>
</head>
<body>
    <div class="preheader">Tu código de recuperación SENA Access es {{ $code }}. Úsalo en la app para restablecer tu contraseña.</div>
    <div class="page">
        <div class="container">
            <div class="glow">
                <div class="logo">
                    <img src="{{ url('email/SenaCodeSolutions.png') }}" alt="SENA Code Solutions">
                </div>
                <p class="brand">SENA ACCESS</p>
                <p class="brand-sub">CONTROL DE ACCESO CCyS</p>
            </div>
            <div class="content">
                <h2>Recuperación de contraseña</h2>
                @if(!empty($nombre))
                    <p><strong>Hola {{ $nombre }},</strong></p>
                @else
                    <p><strong>Hola,</strong></p>
                @endif
                <p>Usa este código en la app SENA Access para restablecer tu contraseña:</p>

                <div class="code-box">
                    {{ $code }}
                </div>

                <div class="steps">
                    <p><strong>1.</strong> Abre la app y ve a "Recuperar contraseña".</p>
                    <p><strong>2.</strong> Escribe este código y tu clave nueva.</p>
                    <p><strong>3.</strong> Entra con tu clave nueva.</p>
                </div>

                <p class="nota">Si no fuiste tú quien lo pidió, ignora este correo y revisa tu cuenta.</p>
            </div>
            <div class="footer">
                &copy; {{ date('Y') }} SENA Access. Todos los derechos reservados.
            </div>
        </div>
    </div>
</body>
</html>
