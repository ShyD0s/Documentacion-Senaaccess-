import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from './Footer';
import BotonTema from './BotonTema';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [code, setCode] = useState('');
    const [password, setPassword] = useState('');
    const [password_confirmation, setPasswordConfirmation] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== password_confirmation) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);
        setMessage('');
        setError('');

        try {
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    code,
                    password,
                    password_confirmation
                })
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || 'Contraseña actualizada correctamente.');
                setTimeout(() => {
                    navigate('/'); // Navigate to login
                }, 2000);
            } else {
                setError(data.message || 'Error al actualizar la contraseña.');
            }
        } catch (err) {
            setError('Error de conexión. Inténtalo más tarde.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page fade-in-up">
            <main className="auth-main">
            <div className="glass-box password auth-card text-center" style={{ maxWidth: '480px', width: '100%' }}>
                <BotonTema />
                <img src="/Icons/logoSena.png" className="logosena mb-3" alt="Logo SENA" style={{ width: '72px' }} />
                <p className="eyebrow-2fa">Paso 2 de 2</p>
                <h2 className="fw-bold mb-1">Nueva contraseña</h2>
                <p className="mt-2 small opacity-75">Escribe el código que llegó a tu correo y crea tu clave nueva.</p>

                {message && <div className="alert alert-success mt-3">{message}</div>}
                {error && <div className="alert alert-danger mt-3">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <input
                        type="text"
                        name="code"
                        required
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        maxLength={10}
                        placeholder="········"
                        autoComplete="one-time-code"
                        className="code-input-2fa mt-2"
                        aria-label="Código de recuperación"
                        style={{ fontSize: '30px', letterSpacing: '4px' }}
                    />

                    <div className="user-box mt-3 text-start">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                        />
                        <label>Nueva Contraseña</label>
                    </div>

                    <div className="user-box text-start">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            name="password_confirmation"
                            required
                            value={password_confirmation}
                            onChange={(e) => setPasswordConfirmation(e.target.value)}
                            autoComplete="new-password"
                        />
                        <label>Confirmar Contraseña</label>
                    </div>

                    <div className="form-check text-start mb-3">
                        <input
                            type="checkbox"
                            className="form-check-input"
                            id="mostrarClaveReset"
                            checked={showPassword}
                            onChange={(e) => setShowPassword(e.target.checked)}
                        />
                        <label className="form-check-label small opacity-75" htmlFor="mostrarClaveReset">
                            Mostrar contraseñas
                        </label>
                    </div>

                    <div className="d-grid gap-2">
                        <button className="btn btn-glow btn-primary-login w-100 fw-bold py-3 btn-press" type="submit" disabled={loading}>
                            {loading ? 'Procesando...' : 'Cambiar Contraseña'}
                        </button>
                    </div>
                </form>
                <div className="mt-4 text-center">
                    <Link to="/password-recovery" className="custom-link fw-bold">Volver a solicitar código</Link>
                </div>
            </div>
            </main>
            <Footer />
        </div>
    );
};

export default ResetPassword;
