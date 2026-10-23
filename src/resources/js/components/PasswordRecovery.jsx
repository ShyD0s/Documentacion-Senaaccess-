import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from './Footer';
import BotonTema from './BotonTema';

const PasswordRecovery = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const response = await fetch('/api/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || 'Código enviado correctamente.');
                setTimeout(() => {
                    navigate('/reset-password');
                }, 2000);
            } else {
                setError(data.message || 'Error al enviar el código.');
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
                <p className="eyebrow-2fa">Paso 1 de 2</p>
                <h2 className="fw-bold mb-1">Recuperar contraseña</h2>
                <p className="mt-2 small opacity-75">Escribe tu correo y te enviamos un código para crear una clave nueva.</p>

                {message && <div className="alert alert-success mt-3">{message}</div>}
                {error && <div className="alert alert-danger mt-3">{error}</div>}

                <form onSubmit={handleSubmit} className="text-start">
                    <div className="user-box">
                        <input
                            type="email"
                            name="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                        />
                        <label>Correo Electrónico</label>
                    </div>
                    <div className="d-grid gap-2">
                        <button className="btn btn-glow btn-primary-login w-100 fw-bold py-3 btn-press" type="submit" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar Código'}
                        </button>
                    </div>
                </form>
                <div className="mt-4 text-center">
                    <p className="mb-2 theme-text">¿Recordaste tu contraseña? <Link to="/" className="custom-link fw-bold">Inicia sesión</Link></p>
                </div>
            </div>
            </main>
            <Footer />
        </div>
    );
};

export default PasswordRecovery;
