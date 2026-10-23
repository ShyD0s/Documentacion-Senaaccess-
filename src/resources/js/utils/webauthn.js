// Utilidades de WebAuthn (huella digital en la web).
// Convierte los ArrayBuffer que usa el navegador en base64url y al reves,
// que es el formato que espera el backend.

const base64url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64url = (valor) => {
    const base64 = valor.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
};

// Convierte las opciones que envia el servidor al formato del navegador.
const opcionesParaNavegador = (opciones) => {
    const convertidas = { ...opciones };
    convertidas.challenge = fromBase64url(opciones.challenge);
    if (opciones.user?.id) convertidas.user.id = fromBase64url(opciones.user.id);
    if (Array.isArray(opciones.excludeCredentials)) {
        convertidas.excludeCredentials = opciones.excludeCredentials.map((c) => ({
            ...c,
            id: fromBase64url(c.id),
        }));
    }
    if (Array.isArray(opciones.allowCredentials)) {
        convertidas.allowCredentials = opciones.allowCredentials.map((c) => ({
            ...c,
            id: fromBase64url(c.id),
        }));
    }
    return convertidas;
};

// Traduce la credencial que devuelve el navegador al JSON que espera la API.
const credencialAJson = (credencial) => ({
    id: credencial.id,
    rawId: base64url(credencial.rawId),
    type: credencial.type,
    transports: credencial.response?.getTransports?.() || [],
    response: {
        clientDataJSON: base64url(credencial.response.clientDataJSON),
        attestationObject: base64url(credencial.response.attestationObject),
    },
});

// Traduce la asercion de la huella al JSON que espera la API.
const asercionAJson = (credencial) => ({
    id: credencial.id,
    rawId: base64url(credencial.rawId),
    type: credencial.type,
    response: {
        clientDataJSON: base64url(credencial.response.clientDataJSON),
        authenticatorData: base64url(credencial.response.authenticatorData),
        signature: base64url(credencial.response.signature),
        userHandle: credencial.response.userHandle ? base64url(credencial.response.userHandle) : null,
    },
});

// El navegador expone esta API solo en sitios seguros (https).
export const huellaDisponible = () =>
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === 'function';

export const registrarHuella = async (opciones) => {
    const credencial = await navigator.credentials.create({
        publicKey: opcionesParaNavegador(opciones),
        attestation: 'none',
    });
    if (!credencial) throw new Error('El navegador no devolvio ninguna credencial.');
    return credencialAJson(credencial);
};

export const solicitarHuella = async (opciones) => {
    const credencial = await navigator.credentials.get({
        publicKey: opcionesParaNavegador(opciones),
    });
    if (!credencial) throw new Error('El navegador no devolvio ninguna credencial.');
    return asercionAJson(credencial);
};

// Traduce los errores del navegador a un mensaje que se entienda.
export const mensajeErrorHuella = (error) => {
    const nombre = error?.name || '';
    if (nombre === 'NotAllowedError') return 'No se pudo leer la huella: cancelaste o el sensor no respondio.';
    if (nombre === 'InvalidStateError') return 'Este dispositivo ya tiene una huella registrada.';
    if (nombre === 'SecurityError') return 'El navegador solo permite la huella en sitios seguros (https).';
    if (nombre === 'NotSupportedError') return 'Este dispositivo no tiene un sensor de huella compatible.';
    if (nombre === 'AbortError') return 'La solicitud de huella se cancelo.';
    return error?.message || 'No se pudo completar la operacion con la huella.';
};
