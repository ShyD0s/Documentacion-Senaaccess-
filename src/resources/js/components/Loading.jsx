import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// Componente de carga que muestra una animación y redirige al usuario después de unos segundos
const Loading = () => {
    const navigate = useNavigate(); // HOOK: useNavigate maneja las redirecciones post-login hacia los paneles de control.

    useEffect(() => { // HOOK: useEffect ejecuta codigo cuando el componente se monta, redireccion programatica.
        const timer = setTimeout(() => {
            const role = localStorage.getItem('user_role')?.toLowerCase();
            if (role === 'superadmin') {
                navigate('/admin'); // Redirige al panel de administración.
            } else if (role === 'aprendiz') {
                navigate('/aprendiz'); // Redirige al panel de aprendices.
            } else if (role === 'instructor') {
                navigate('/instructor'); // Redirige al panel de instructores.
            } else if (role === 'admin' || role === 'portero') {
                navigate('/portero'); // Redirige al panel operativo (portería).
            } else {
                navigate('/'); // Redirige al inicio.
            }
        }, 3000); // Tiempo de espera para la redirección.

        return () => clearTimeout(timer); // HOOK: useEffect ejecuta codigo cuando el componente se monta.
    }, [navigate]);

    return (
        <div className="vh-100 d-flex flex-column justify-content-center align-items-center fade-in-up">
            <h1 className="fw-bold mb-4" style={{ color: '#02d914', textShadow: '0 0 15px rgba(2, 217, 20, 0.4)' }}>
                Bienvenido al CCyS
            </h1>
            <div className="loader mb-3"></div>
            <p className="theme-text opacity-75 mt-3">Cargando sistema...</p>
            <style>{`
                .loader {
                    border: 8px solid rgba(2, 217, 20, 0.1);
                    box-shadow: 0 0 20px rgba(2, 217, 20, 0.2);
                    border-top: 8px solid #02d914;
                    border-radius: 50%;
                    width: 80px;
                    height: 80px;
                    animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Loading;
