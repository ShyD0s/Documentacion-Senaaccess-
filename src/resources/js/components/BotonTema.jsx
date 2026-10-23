import React, { useState, useEffect } from 'react';

// Boton de tema claro/oscuro para las paginas publicas (acceso, registro,
// recuperacion, 2FA). Va dentro de la tarjeta para no flotar por encima del
// contenido ni tapar el pie de pagina.
const BotonTema = () => {
    const [temaClaro, setTemaClaro] = useState(() => document.body.classList.contains('light-mode'));

    useEffect(() => {
        const alCambiar = (evento) => setTemaClaro(evento.detail?.tema === 'light');
        window.addEventListener('tema-cambiado', alCambiar);
        return () => window.removeEventListener('tema-cambiado', alCambiar);
    }, []);

    const toggleTema = () => {
        const claro = !document.body.classList.contains('light-mode');
        document.body.classList.toggle('light-mode', claro);
        localStorage.setItem('theme', claro ? 'light' : 'dark');
        setTemaClaro(claro);
        window.dispatchEvent(new CustomEvent('tema-cambiado', { detail: { tema: claro ? 'light' : 'dark' } }));
    };

    return (
        <button
            type="button"
            className="auth-theme-btn"
            onClick={toggleTema}
            title={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
            aria-label={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
        >
            <span className="material-symbols-outlined">
                {temaClaro ? 'dark_mode' : 'light_mode'}
            </span>
        </button>
    );
};

export default BotonTema;
