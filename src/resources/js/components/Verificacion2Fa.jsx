import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import BotonTema from './BotonTema';
import { showAlert } from './CustomAlert';

// Guarda la sesión entregada por validar-codigo o por el polling de estado.
const guardarSesion2Fa = (data) => {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user_role', data.role);
    localStorage.removeItem('2fa_challenge_id');
};

// Redirige al panel según rol (mismo mapa que Login.jsx).
const redirigirPorRol = (navigate, role) => {
    const userRole = (role || '').toLowerCase();
    if (userRole === 'superadmin') {
        navigate('/admin');
    } else if (userRole === 'instructor') {
        navigate('/puerta-acceso');
    } else if (userRole === 'aprendiz') {
        navigate('/puerta-acceso');
    } else if (userRole === 'admin' || userRole === 'portero') {
        navigate('/portero');
    } else {
        navigate('/loading');
    }
};

const Verificacion2Fa = () => {
    const navigate = useNavigate();
    const [challengeId] = useState(() => localStorage.getItem('2fa_challenge_id') || '');
    const [code, setCode] = useState('');
    const [codeErrors, setCodeErrors] = useState('');
    const [generalError, setGeneralError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resuelto, setResuelto] = useState(false);
    const resueltoRef = useRef(false);

    const marcarResuelto = () => {
        resueltoRef.current = true;
        setResuelto(true);
    };

    const volverAlLogin = () => {
        localStorage.removeItem('2fa_challenge_id');
        navigate('/login');
    };

    // Polling: el otro dispositivo (o el correo) puede aprobar mientras se escribe el código.
    useEffect(() => {
        if (!challengeId) return;
        const consultarEstado = async () => {
            if (resueltoRef.current) return;
            try {
                const response = await axios.get(`/api/2fa/estado/${challengeId}`);
                const estado = response.data.estado;
                if (estado === 'aprobado') {
                    marcarResuelto();
                    guardarSesion2Fa(response.data);
                    showAlert(response.data.message || 'Login exitoso');
                    redirigirPorRol(navigate, response.data.role);
                } else if (estado === 'rechazado' || estado === 'denegado') {
                    marcarResuelto();
                    setGeneralError('El intento fue rechazado. Vuelve a iniciar sesión.');
                } else if (estado === 'expirado') {
                    marcarResuelto();
                    setGeneralError(response.data.message || 'El intento de acceso expiró. Vuelve a intentarlo.');
                }
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    marcarResuelto();
                    setGeneralError('El intento de acceso no existe. Vuelve a iniciar sesión.');
                }
            }
        };
        const intervalo = setInterval(consultarEstado, 4000);
        return () => clearInterval(intervalo);
    }, [challengeId, navigate]);

    // Sin challenge no hay nada que verificar: de vuelta al login.
    if (!challengeId) {
        return (
            <div className="auth-page fade-in-up">
                <main className="auth-main">
                <div className="glass-box auth-card text-center" style={{ maxWidth: '520px' }}>
                <BotonTema />
                    <span className="material-symbols-outlined text-warning" style={{ fontSize: '48px' }}>lock_open</span>
                    <h4 className="fw-bold mt-2">Sin verificación pendiente</h4>
                    <p className="mt-3 small opacity-75">Inicia sesión para generar un código de verificación.</p>
                    <div className="d-grid mt-4">
                        <Link to="/login" className="btn btn-glow btn-primary-login w-100 fw-bold py-3">
                            VOLVER AL LOGIN
                        </Link>
                    </div>
                </div>
                </main>
                <Footer />
            </div>
        );
    }

    // Valida el código de 6 dígitos enviado al correo.
    const handleSubmit = async (e) => {
        e.preventDefault();
        setCodeErrors('');
        setGeneralError('');
        setLoading(true);
        try {
            const response = await axios.post('/api/2fa/validar-codigo', {
                challenge_id: challengeId,
                code: code.trim()
            });
            marcarResuelto();
            guardarSesion2Fa(response.data);
            showAlert(response.data.message || 'Login exitoso');
            redirigirPorRol(navigate, response.data.role);
        } catch (error) {
            if (error.response) {
                const mensaje = error.response.data.message || 'Código inválido';
                if (error.response.status === 422) {
                    setCodeErrors(mensaje);
                } else {
                    setGeneralError(mensaje);
                    // El reto ya se resolvió o expiró: no tiene sentido reintentar.
                    if (error.response.status === 400) {
                        marcarResuelto();
                    }
                }
                showAlert(mensaje, 'error');
            } else {
                setGeneralError('Error al conectar con el servidor.');
                showAlert('Error al conectar con el servidor.', 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page fade-in-up">
            <main className="auth-main">
            <div className="glass-box auth-card text-center" style={{ maxWidth: '520px' }}>
                <BotonTema />
                <img src="/Icons/logoSena.png" className="logosena mb-3" alt="Logo SENA" style={{ width: '72px' }} />
                <p className="eyebrow-2fa">Segundo paso</p>
                <h2 className="fw-bold mb-1">Verificación en dos pasos</h2>
                <p className="mt-2 small opacity-75">Te enviamos un código de 6 dígitos a tu correo.</p>

                {generalError && (
                    <div className="alert alert-danger mt-3" role="alert">{generalError}</div>
                )}

                {!resuelto ? (
                    <form onSubmit={handleSubmit}>
                        <input
                            type="text"
                            name="code"
                            required
                            placeholder="······"
                            autoComplete="one-time-code"
                            inputMode="numeric"
                            maxLength="6"
                            value={code}
                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className={`code-input-2fa mt-2 ${codeErrors ? 'is-invalid' : ''}`}
                            aria-label="Código de 6 dígitos"
                        />
                        {codeErrors && <div className="text-danger small mt-2">{codeErrors}</div>}

                        <button className="btn btn-glow btn-primary-login w-100 fw-bold py-3 mt-4 btn-press" type="submit" disabled={loading || code.length !== 6}>
                            {loading ? 'VERIFICANDO...' : 'VERIFICAR'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-outline-success w-100 mt-2 btn-press"
                            onClick={volverAlLogin}
                        >
                            VOLVER AL LOGIN
                        </button>

                        <div className="divider-2fa"><span>O ENTRA SIN CÓDIGO</span></div>
                        <p className="small opacity-75 mb-0">
                            <span className="pulse-dot" aria-hidden="true"></span>
                            {' '}Si apruebas el acceso desde otro dispositivo o tu correo, entrarás automáticamente.
                        </p>
                    </form>
                ) : (
                    <div className="d-grid gap-3 mt-4">
                        <button
                            type="button"
                            className="btn btn-glow btn-primary-login w-100 fw-bold py-3 btn-press"
                            onClick={volverAlLogin}
                        >
                            VOLVER AL LOGIN
                        </button>
                    </div>
                )}
            </div>
            </main>
            <Footer />
        </div>
    );
};

export default Verificacion2Fa;
