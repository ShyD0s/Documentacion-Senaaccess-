import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
    const navigate = useNavigate();
    const [isExiting, setIsExiting] = useState(false);

    const handleNavigation = (path) => { //Para manejar la funcion de navegacion
        setIsExiting(true);
        setTimeout(() => {
            navigate(path);
        }, 500); // Duración de la animación de salida
    };

    return (
        <div className={`landing-overlay ${isExiting ? 'exit-animation' : 'entry-animation'}`}>
            <div className="landing-card glass-box p-4 p-md-5 text-center mx-3" style={{ animation: 'fadeInUp 0.8s ease-out' }}>
                <div className="logo-container mb-4" style={{ animation: 'fadeInUp 1s ease-out' }}>
                    <img 
                        src="/Icons/logoSena.png" 
                        alt="SENA Logo" 
                        className="landing-logo neon-glow"
                        style={{ height: '120px', maxWidth: '100%' }}
                    />
                </div>
                
                <div style={{ animation: 'fadeInUp 1.2s ease-out' }}>
                    <h1 className="landing-title mb-2 fw-bold theme-text" style={{ letterSpacing: '2px' }}>
                        SENA <span className="text-success neon-text">ACCESS</span>
                    </h1>
                    <p className="theme-text opacity-75 mb-5 small text-uppercase fw-bold" style={{ letterSpacing: '4px' }}>
                        Control de Acceso Biométrico
                    </p>
                </div>

                <div className="d-grid gap-3 px-md-4" style={{ animation: 'fadeInUp 1.4s ease-out' }}>
                    <button 
                        onClick={() => handleNavigation('/login')}
                        className="btn btn-neon-solid py-3 fw-bold rounded-pill"
                    >
                        INGRESAR
                    </button>
                    <button 
                        onClick={() => handleNavigation('/register')}
                        className="btn btn-neon-outline py-3 fw-bold rounded-pill"
                    >
                        REGISTRARSE
                    </button>
                </div>

                <div className="mt-5 pt-4 border-top border-success border-opacity-10" style={{ animation: 'fadeInUp 1.6s ease-out' }}>
                    <p className="small theme-text opacity-75 mb-0">Sistema de Gestión de Ambientes y Equipos</p>
                    <p className="small text-success mt-1 opacity-75">v0.1.9</p>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
