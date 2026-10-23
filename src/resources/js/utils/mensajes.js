// Mensajes de error de la API: el servidor ya responde en espanol, asi que
// se muestra su texto en vez de un AxiosError crudo.

export const mensajeDeError = (error, porDefecto = 'No se pudo conectar con el servidor.') => {
    const mensaje = error?.response?.data?.message;
    if (typeof mensaje === 'string' && mensaje.trim() !== '') return mensaje;

    const estado = error?.response?.status;
    if (estado === 401) return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    if (estado === 403) return 'No tienes permiso para ver esta información.';
    if (estado === 429) return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
    if (estado >= 500) return 'El servidor no pudo responder en este momento. Intenta de nuevo.';
    if (error?.message === 'Network Error') return 'Sin conexión con el servidor. Revisa tu internet.';

    return porDefecto;
};
