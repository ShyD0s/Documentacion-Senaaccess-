import './bootstrap';
import '../css/app.css';

import React, { Suspense, lazy, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';

import Login from './components/Login';
import Verificacion2Fa from './components/Verificacion2Fa';
import Register from './components/Register';
import PasswordRecovery from './components/PasswordRecovery';
import ResetPassword from './components/ResetPassword';
import Loading from './components/Loading';
import LandingPage from './components/LandingPage';
import CustomAlert from './components/CustomAlert';
import ChatbotWidget from './components/ChatbotWidget';
import PuertaAcceso from './components/PuertaAcceso';
// Paneles pesados por rol: lazy para que la primera carga solo baje el chunk
// de la ruta visitada (antes las 12 rutas viajaban en un solo app-*.js).
const Admin = lazy(() => import('./components/Admin'));
const Aprendiz = lazy(() => import('./components/Aprendiz'));
const Instructor = lazy(() => import('./components/Instructor'));
const Portero = lazy(() => import('./components/Portero'));

// Guard: redirige a /login si no hay token o el rol no coincide con el esperado.
const ProtectedRoute = ({ expectedRole, children }) => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role')?.toLowerCase();
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    if (expectedRole && role !== expectedRole) {
        return <Navigate to="/" replace />;
    }
    return children;
};

// Ruta pública del reto 2FA: si ya hay sesión, redirige por rol como el login.
const Verificacion2FaRoute = () => {
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role')?.toLowerCase();
    if (token) {
        if (role === 'superadmin') {
            return <Navigate to="/admin" replace />;
        }
        if (role === 'instructor') {
            return <Navigate to="/instructor" replace />;
        }
        if (role === 'aprendiz') {
            return <Navigate to="/aprendiz" replace />;
        }
        if (role === 'admin' || role === 'portero') {
            return <Navigate to="/portero" replace />;
        }
        return <Navigate to="/" replace />;
    }
    return <Verificacion2Fa />;
};

// Componente principal de la aplicación
const LogoutHandler = () => {
    const location = useLocation();
    useEffect(() => {
        if (location.search === '?logout=1') {
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            window.history.replaceState({}, document.title, '/');
        }
    }, [location]);
    return null;
};

const App = () => {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

    // Efecto para aplicar el tema seleccionado y guardarlo en localStorage
    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Función para alternar entre temas
    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
    };

    // La navbar tambien cambia el tema: este aviso mantiene los dos botones
    // sincronizados sin recargar la pagina.
    useEffect(() => {
        const alCambiarTema = (evento) => setTheme(evento.detail?.tema || 'dark');
        window.addEventListener('tema-cambiado', alCambiarTema);
        return () => window.removeEventListener('tema-cambiado', alCambiarTema);
    }, []);

    return (
        <BrowserRouter>
            <LogoutHandler />
            {/* Botón de Modo Claro/Oscuro */}
            <button 
                onClick={toggleTheme}
                className="theme-toggle-btn"
                aria-label="Toggle theme"
            >
                <span className="material-symbols-outlined">
                    {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
            </button>

            {/* Alerta y Confirmación Personalizada Global */}
            <CustomAlert />

            {/* Chatbot flotante: visible solo cuando hay sesión (como en Sebastián) */}
            {!!localStorage.getItem('access_token') && <ChatbotWidget />}

            <div style={{color: 'var(--text-color)', position: 'fixed', bottom: 10, right: 10, background: 'var(--glass-bg)', padding: '5px', zIndex: 9999, borderRadius: '5px', fontSize: '12px'}}>
            </div>
            <Suspense fallback={<div className="text-white text-center mt-5">Cargando componentes...</div>}>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/verificacion-2fa" element={<Verificacion2FaRoute />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/password-recovery" element={<PasswordRecovery />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/loading" element={<Loading />} />
                    <Route path="/puerta-acceso" element={localStorage.getItem('access_token') ? <PuertaAcceso /> : <Navigate to="/login" replace />} />
                    <Route path="/admin" element={<ProtectedRoute expectedRole="superadmin"><Admin /></ProtectedRoute>} />
                    <Route path="/aprendiz" element={<ProtectedRoute expectedRole="aprendiz"><Aprendiz /></ProtectedRoute>} />
                    <Route path="/instructor" element={<ProtectedRoute expectedRole="instructor"><Instructor /></ProtectedRoute>} />
                    <Route path="/portero" element={<ProtectedRoute expectedRole="admin"><Portero /></ProtectedRoute>} />
                    <Route path="*" element={<div style={{color: 'var(--text-color)'}}>404 - Página no encontrada</div>} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    );
};

const rootElement = document.getElementById('app');
if (rootElement) {
    try {
        const root = ReactDOM.createRoot(rootElement);
        root.render(
            <React.StrictMode>
                <App />
            </React.StrictMode>
        );
    } catch (err) {
        console.error("Error durante el renderizado de App.jsx", err);
    }
} else {
    console.error("No se encontró el elemento \"app\" en el DOM.");
}
