import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import QRCode from 'qrcode';
import Footer from './Footer';
import BotonTema from './BotonTema';
import { showAlert } from './CustomAlert';
import { huellaDisponible, solicitarHuella, mensajeErrorHuella } from '../utils/webauthn';

const Login = () => {
    // HOOK: useNavigate maneja las redirecciones post-login hacia los paneles de control.
    const navigate = useNavigate();

    // HOOK: Múltiples useState para almacenar temporalmente los datos del formulario (email, password) mientras el usuario escribe.
    const [user_email, setEmail] = useState(''); // Estado para almacenar email del usuario
    // Correos usados en este navegador (espejo del autorrelleno del móvil; la clave la pone el navegador, nunca se guarda aquí).
    const [correosGuardados, setCorreosGuardados] = useState(() => {
        try { return JSON.parse(localStorage.getItem('sena_emails') || '[]'); }
        catch { return []; }
    });
    const guardarCorreoUsado = (correo) => {
        const limpio = (correo || '').trim();
        if (!limpio) return;
        setCorreosGuardados((prev) => {
            const lista = [limpio, ...prev.filter((c) => c.toLowerCase() !== limpio.toLowerCase())].slice(0, 5);
            try { localStorage.setItem('sena_emails', JSON.stringify(lista)); } catch {}
            return lista;
        });
    };
    const [user_password, setPassword] = useState(''); // Estado para almacenar contraseña del usuario
    const [showPassword, setShowPassword] = useState(false); // Estado para alternar visibilidad de contraseña
    const [puedeUsarHuella, setPuedeUsarHuella] = useState(false); // El navegador admite WebAuthn
    const [ingresandoConHuella, setIngresandoConHuella] = useState(false); // Lectura de la huella en curso
    const [isGuestMode, setIsGuestMode] = useState(false); // Estado para alternar modo invitado
    const [guestData, setGuestData] = useState({ // Estado para almacenar datos de invitado
        user_name: '',
        user_lastname: '',
        user_identification: '',
        user_documento_tipo: 'CC'
    });
    const [guestErrors, setGuestErrors] = useState({}); // Errores de validación por campo (invitado)
    const [qrInvitado, setQrInvitado] = useState(null); // { token, expiresAt, dataUrl } tras registro exitoso
    const [qrRestante, setQrRestante] = useState(''); // Cuenta regresiva mm:ss hasta qr_expires_at

    // Cuenta regresiva del QR de invitado (60 min desde su generación).
    useEffect(() => {
        if (!qrInvitado) return;
        const tick = () => {
            const ms = new Date(qrInvitado.expiresAt).getTime() - Date.now();
            if (ms <= 0) {
                setQrRestante('00:00');
                return;
            }
            const m = Math.floor(ms / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            setQrRestante(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        tick();
        const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [qrInvitado]);

    // Funcion para manejar el envio del formulario de login
    // device_id: UUID persistente de este navegador; el backend solo pide 2FA en dispositivos nuevos.
    const obtenerDeviceId = () => {
        let id = localStorage.getItem('sena_device_id');
        if (!id) {
            id = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
            localStorage.setItem('sena_device_id', id);
        }
        return id;
    };

    // Cierra el ingreso: guarda el token, aplica la puerta de entrada y
    // lleva al panel del rol. La usan el login con clave y el login con huella.
    const finalizarLogin = async (datos, correo = '') => {
        localStorage.setItem('access_token', datos.access_token);
        localStorage.setItem('user_role', datos.role);
        if (correo) guardarCorreoUsado(correo);

        showAlert(datos.message || 'Login exitoso');

        // Puerta de entrada: aprendiz e instructor marcan su Entrada con el
        // QR de portería antes de ver su panel (el resto entra directo).
        const userRole = (datos.role || '').toLowerCase();
        if (userRole === 'aprendiz' || userRole === 'instructor') {
            try {
                const { data } = await axios.get('/api/my-ingresos', {
                    headers: { Authorization: `Bearer ${datos.access_token}` }
                });
                const lista = Array.isArray(data) ? data : (data.data || []);
                const hoy = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
                }).format(new Date());
                const fmt = (f) => {
                    try {
                        return new Intl.DateTimeFormat('en-CA', {
                            timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
                        }).format(new Date(f));
                    } catch (_) { return ''; }
                };
                const tieneEntrada = lista.some((m) => m.ingreso_type === 'Entrada' && fmt(m.ingreso_datetime) === hoy);
                if (!tieneEntrada) {
                    navigate('/puerta-acceso');
                    return;
                }
            } catch (_) { /* si falla la verificación, sigue al panel */ }
        }

        if (userRole === 'superadmin') {
            navigate('/admin');
        } else if (userRole === 'instructor') {
            navigate('/instructor');
        } else if (userRole === 'aprendiz') {
            navigate('/aprendiz');
        } else if (userRole === 'admin' || userRole === 'portero') {
            navigate('/portero');
        } else {
            navigate('/loading');
        }
    };

    // Ingreso con huella (WebAuthn): el navegador pide la biometria del
    // dispositivo y el servidor devuelve la misma sesion que el login normal.
    const entrarConHuella = async () => {
        setIngresandoConHuella(true);
        try {
            const opciones = await axios.post('/api/huellas/login/opciones');
            const credencial = await solicitarHuella(opciones.data.opciones);
            const respuesta = await axios.post('/api/huellas/login', {
                reto: opciones.data.reto,
                ...credencial,
            });
            await finalizarLogin(respuesta.data);
        } catch (error) {
            const mensaje = error?.response?.data?.message || mensajeErrorHuella(error);
            showAlert(mensaje, 'error');
        } finally {
            setIngresandoConHuella(false);
        }
    };

    useEffect(() => {
        setPuedeUsarHuella(huellaDisponible());
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post('/api/login', {
                user_email,
                user_password,
                device_id: obtenerDeviceId()
            });

            // 2FA requerido: el backend no emitió token; se continúa en /verificacion-2fa.
            if (response.data.two_factor_required) {
                localStorage.setItem('2fa_challenge_id', response.data.two_factor_id);
                showAlert(response.data.message || 'Verificación en dos pasos requerida.');
                navigate('/verificacion-2fa');
                return;
            }

            await finalizarLogin(response.data, user_email);
        } catch (error) {
            if (error.response) {
                showAlert(error.response.data.message || 'Error en el inicio de sesión', 'error');
            } else {
                showAlert('Error al conectar con el servidor.', 'error');
            }
        }
    };

    // Funcion para alternar visibilidad de contraseña
    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    // Funcion para manejar el envio del formulario de invitado
    // POST /api/register-guest → { qr_token, qr_expires_at }; genera el QR y lo muestra.
    const handleGuestSubmit = async (e) => {
        e.preventDefault();
        setGuestErrors({});
        try {
            const response = await axios.post('/api/register-guest', guestData);
            const dataUrl = await QRCode.toDataURL(response.data.qr_token);
            setQrInvitado({
                token: response.data.qr_token,
                expiresAt: response.data.qr_expires_at,
                dataUrl
            });
            showAlert(response.data.message);
        } catch (error) {
            if (error.response?.data?.errors) {
                setGuestErrors(error.response.data.errors);
                showAlert('Revisa los datos del invitado.', 'error');
            } else if (error.response) {
                showAlert(error.response.data.message || 'Error al registrar ingreso de invitado', 'error');
            } else {
                showAlert('Error al conectar con el servidor.', 'error');
            }
        }
    };

    // Copia el token del QR al portapapeles.
    const copiarToken = async () => {
        try {
            await navigator.clipboard.writeText(qrInvitado.token);
            showAlert('Código copiado al portapapeles.');
        } catch (err) {
            showAlert('No se pudo copiar el código.', 'error');
        }
    };

    // Limpia el QR mostrado y deja el formulario listo para otro invitado.
    const registrarOtroInvitado = () => {
        setQrInvitado(null);
        setGuestErrors({});
        setGuestData({ user_name: '', user_lastname: '', user_identification: '', user_documento_tipo: 'CC' });
    };

    const guestError = (name) =>
        guestErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{guestErrors[name][0]}</div> : null;

    if (isGuestMode) {
        // Tras el registro exitoso: QR + vigencia + token copiable (un solo uso, 60 min).
        if (qrInvitado) {
            return (
                <div className="auth-page fade-in-up">
                    <main className="auth-main">
                    <div className="glass-box auth-card text-center" style={{ maxWidth: '440px' }}>
                <BotonTema />
                        <h2 className="fw-bold mb-0">Tu código de ingreso</h2>
                        <h5 className="fw-light text-success">Preséntalo en portería</h5>
                        <hr className="border-success opacity-25" />
                        <img src={qrInvitado.dataUrl} alt="QR de invitado" className="img-fluid my-3" style={{ maxWidth: '240px' }} />
                        <div className="fw-bold fs-4">Vence en {qrRestante}</div>
                        <p className="small opacity-75 mb-2">Un solo uso · válido por 60 minutos</p>
                        <code className="d-block text-break small p-2 bg-dark bg-opacity-25 rounded mb-3">{qrInvitado.token}</code>
                        <div className="d-grid gap-3">
                            <button className="btn btn-glow w-100 fw-bold" type="button" onClick={copiarToken}>
                                COPIAR CÓDIGO
                            </button>
                            <button className="btn btn-glow w-100" type="button" onClick={registrarOtroInvitado}>
                                REGISTRAR OTRO
                            </button>
                            <button
                                type="button"
                                className="btn btn-glow w-100"
                                onClick={() => { setIsGuestMode(false); setQrInvitado(null); }}
                            >
                                VOLVER AL LOGIN
                            </button>
                        </div>
                    </div>
                    </main>
                    <Footer />
                </div>
            );
        }
        return (
            <div className="auth-page fade-in-up">
                <main className="auth-main">
                <div className="glass-box auth-card">
                <BotonTema />
                    <div className="text-center mb-4">
                        <img src="/Icons/logoSena.png" className="logosena mb-3" alt="Logo SENA" />
                        <h2 className="fw-bold mb-0">Invitado</h2>
                        <h5 className="fw-light text-success">Ingreso Rapido</h5>
                        <hr className="border-success opacity-25" />
                        <p className="mt-3 small opacity-75">Ingrese sus datos básicos para registrar su entrada</p>
                    </div>

                    <form onSubmit={handleGuestSubmit}>
                        <div className="mb-3">
                            <label className="form-label opacity-75 small">Tipo de Documento</label>
                            <select
                                className={`form-select ${guestErrors.user_documento_tipo ? 'is-invalid' : ''}`}
                                value={guestData.user_documento_tipo}
                                onChange={(e) => setGuestData({ ...guestData, user_documento_tipo: e.target.value })}
                            >
                                <option value="CC">CC: Cédula de Ciudadanía</option>
                                <option value="CE">CE: Cédula de Extranjería</option>
                                <option value="TI">TI: Tarjeta de Identidad</option>
                                <option value="PAS">PAS: Pasaporte</option>
                            </select>
                            {guestError('user_documento_tipo')}
                        </div>
                        <div className="user-box">
                            <input
                                type="text"
                                required
                                placeholder=" "
                                value={guestData.user_identification}
                                onChange={(e) => setGuestData({ ...guestData, user_identification: e.target.value })}
                            />
                            <label>Número de Documento</label>
                            {guestError('user_identification')}
                        </div>
                        <div className="user-box">
                            <input
                                type="text"
                                required
                                placeholder=" "
                                value={guestData.user_name}
                                // Funcion para generar los datos de invitado (guest)
                                onChange={(e) => setGuestData({ ...guestData, user_name: e.target.value })}
                            />
                            <label>Nombres</label>
                            {guestError('user_name')}
                        </div>
                        <div className="user-box">
                            <input
                                type="text"
                                required
                                placeholder=" "
                                value={guestData.user_lastname}
                                onChange={(e) => setGuestData({ ...guestData, user_lastname: e.target.value })}
                            />
                            <label>Apellidos</label>
                            {guestError('user_lastname')}
                        </div>

                        <div className="d-grid gap-3 mt-4">
                            <button className="btn btn-glow btn-primary-login w-100 fw-bold py-3" type="submit">
                                REGISTRAR INGRESO
                            </button>
                            <button
                                type="button"
                                className="btn btn-glow w-100"
                                onClick={() => setIsGuestMode(false)}
                            >
                                VOLVER AL LOGIN
                            </button>
                        </div>
                    </form>
                </div>
                </main>
                <Footer />
            </div>
        );
    }

    return (
        <div className="auth-page fade-in-up">
            <main className="auth-main">
            <div className="glass-box auth-card">
                <BotonTema />
                <div className="text-center mb-4">
                    <img src="/Icons/logoSena.png" className="logosena mb-3" alt="Logo SENA" />
                    <h2 className="landing-title fw-bold mb-0">Sena <span className="neon-text">Access</span></h2>
                    <h5 className="fw-light text-success">Acceso CCyS</h5>
                    <hr className="border-success opacity-25" />
                    <h4 className="mt-3 fw-bold">Iniciar Sesión</h4>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="user-box">
                        <input
                            type="email"
                            name="user_email"
                            required
                            placeholder=" "
                            value={user_email}
                            onChange={(e) => setEmail(e.target.value)}
                            list="sena-emails"
                            autoComplete="email"
                        />
                        <datalist id="sena-emails">
                            {correosGuardados.map((c) => <option key={c} value={c} />)}
                        </datalist>
                        <label>Correo electrónico</label>
                    </div>
                    <div className="user-box">
                        <input
                            type={showPassword ? "text" : "password"}
                            name="user_password"
                            autoComplete="current-password"
                            required
                            placeholder=" "
                            value={user_password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <label>Contraseña</label>
                        <button
                            type="button"
                            className="password-toggle"
                            onClick={togglePasswordVisibility}
                            aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        >
                            {showPassword ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                    <line x1="12" y1="5" x2="12" y2="2" />
                                    <line x1="5" y1="8" x2="3" y2="5" />
                                    <line x1="19" y1="8" x2="21" y2="5" />
                                </svg>
                            ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M2 10c4 6 16 6 20 0" />
                                    <line x1="12" y1="15" x2="12" y2="18" />
                                    <line x1="7" y1="14" x2="5" y2="17" />
                                    <line x1="17" y1="14" x2="19" y2="17" />
                                </svg>
                            )}
                        </button>
                    </div>

                    <div className="d-grid gap-3 mb-4">
                        <button className="btn btn-glow btn-primary-login w-100 fw-bold py-3 d-flex align-items-center justify-content-center gap-2" type="submit">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                // Icono de flecha de inicio de sesión
                                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                <polyline points="10 17 15 12 10 7" />
                                <line x1="15" y1="12" x2="3" y2="12" />
                            </svg>
                            INGRESAR
                        </button>

                        {puedeUsarHuella && (
                            <button
                                type="button"
                                className="btn btn-outline-success w-100 fw-bold d-flex align-items-center justify-content-center gap-2"
                                onClick={entrarConHuella}
                                disabled={ingresandoConHuella}
                            >
                                <span className="material-symbols-outlined">fingerprint</span>
                                {ingresandoConHuella ? 'LEYENDO HUELLA...' : 'INGRESAR CON HUELLA'}
                            </button>
                        )}

                        <div className="position-relative text-center my-3">
                            <hr className="border-secondary opacity-25" />
                            <span className="position-absolute top-50 start-50 translate-middle theme-bg theme-text px-2 small opacity-75" style={{ fontSize: '0.72rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                o continúa como invitado
                            </span>
                        </div>

                        <button
                            type="button"
                            className="btn btn-glow w-100 fw-bold"
                            onClick={() => setIsGuestMode(true)}
                        >
                            INVITADO
                        </button>
                    </div>
                </form>

                <div className="mt-4 text-center">
                    <p className="mb-2 theme-text opacity-75 small">¿No estás registrado? <Link to="/register" className="custom-link fw-bold text-success">¡Regístrate aquí!</Link></p>
                    <p className="mb-4 theme-text opacity-75 small">¿Olvidaste tu contraseña? <Link to="/password-recovery" className="custom-link fw-bold text-success">Recuperar</Link></p>
                </div>
            </div>
            </main>
            <Footer />
        </div>
    );
};

export default Login;
