<?php

// Configuracion de la huella digital en la web (WebAuthn / passkey).
return [
    // Nombre que ve el usuario en el dialogo del navegador.
    'rp_name' => env('WEBAUTHN_RP_NAME', 'SenaAccess'),

    // Identificador de la parte que confia. Vacio = el dominio de la peticion.
    // En produccion conviene fijarlo (WEBAUTHN_RP_ID) para que la huella
    // siga valiendo aunque cambie el dominio de acceso.
    'rp_id' => env('WEBAUTHN_RP_ID', ''),

    // Origenes admitidos en la verificacion (ademas del de la peticion).
    'allowed_origins' => array_filter(array_map(
        'trim',
        explode(',', (string) env('WEBAUTHN_ALLOWED_ORIGINS', ''))
    )),
];
