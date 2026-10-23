<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu cuenta SENA Access fue aprobada</title>
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
        .status-mark {
            margin: 16px auto 4px auto;
            text-align: center;
        }
        .status-mark img {
            width: 72px;
            height: 72px;
            border-radius: 50%;
            border: 2px solid #02D914;
            background-color: #FFFFFF;
            padding: 6px;
            box-shadow: 0 0 24px rgba(2, 217, 20, 0.35);
        }
        .status-pill {
            display: inline-block;
            margin-top: 10px;
            padding: 5px 16px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: bold;
            letter-spacing: 2px;
            color: #000000;
            background-color: #02D914;
        }
        .btn {
            display: block;
            width: 100%;
            padding: 15px;
            margin: 16px 0 6px 0;
            border-radius: 16px;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 1px;
            text-decoration: none;
            text-align: center;
            box-sizing: border-box;
            background-color: #02D914;
            color: #000000;
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
    <div class="preheader">Tu cuenta SENA Access fue aprobada. Ya puedes iniciar sesión en la app.</div>
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
                <div class="status-mark">
                    <img src="{{ url('email/logoSena.png') }}" alt="SENA">
                    <br>
                    <span class="status-pill">APROBADA</span>
                </div>
                <h2>Cuenta aprobada</h2>
                @if(!empty($nombre))
                    <p><strong>Hola {{ $nombre }},</strong></p>
                @else
                    <p><strong>Hola,</strong></p>
                @endif
                <p>Tu solicitud fue aprobada. Ya puedes iniciar sesión en la app SENA Access con tu correo y contraseña.</p>

                <a href="{{ url('/login') }}" class="btn">INICIAR SESIÓN</a>

                <p class="nota">Si no pediste esta cuenta, ignora este correo.</p>
            </div>
            <div class="footer">
                &copy; {{ date('Y') }} SENA Access. Todos los derechos reservados.
            </div>
        </div>
    </div>
</body>
</html>
