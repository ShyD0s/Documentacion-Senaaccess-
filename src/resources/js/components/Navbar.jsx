import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Navbar = ({ currentUser, view, setView, userFilter, setUserFilter, links = [] }) => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    // Tema claro/oscuro (mismo criterio que el boton flotante global).
    const [temaClaro, setTemaClaro] = useState(() => document.body.classList.contains('light-mode'));

    const toggleTema = () => {
        const claro = !document.body.classList.contains('light-mode');
        document.body.classList.toggle('light-mode', claro);
        localStorage.setItem('theme', claro ? 'light' : 'dark');
        setTemaClaro(claro);
        // Avisa al boton global (paginas publicas) para que no quede desfasado.
        window.dispatchEvent(new CustomEvent('tema-cambiado', { detail: { tema: claro ? 'light' : 'dark' } }));
    };

    const fetchNotifications = async () => {
        try {
            const [listResponse, countResponse] = await Promise.all([
                axios.get('/api/notifications'),
                axios.get('/api/notifications/unread-count')
            ]);
            setNotifications(listResponse.data);
            setUnread(countResponse.data.unread || 0);
        } catch (error) {
            console.error('Error cargando notificaciones:', error);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleMarkRead = async (id) => {
        try {
            await axios.put(`/api/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id_notificacion === id ? { ...n, is_read: true } : n));
            setUnread(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marcando notificación:', error);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await axios.put('/api/notifications/read-all');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnread(0);
        } catch (error) {
            console.error('Error marcando notificaciones:', error);
        }
    };

    const handleLogout = async () => {
        try {
            await axios.post('/api/logout');
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            navigate('/');
        } catch (error) {
            console.error('Error al cerrar sesión', error);
            localStorage.removeItem('access_token');
            localStorage.removeItem('user_role');
            navigate('/');
        }
    };

    return (
        <nav className="navbar navbar-expand-lg px-3 px-lg-4 py-2 navbar-custom">
            <div className="container-fluid p-0">
                {/* Botón colapsable para móviles */}
                <button className="navbar-toggler border-success border-opacity-25" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMain">
                    <span className="material-symbols-outlined text-success">menu</span>
                </button>

                {/* Logo compacto visible solo con el menú colapsado (móvil/tablet) */}
                <img src="/Icons/logoSena.png" alt="SENA" className="d-lg-none ms-2" style={{ height: '34px' }} />

                {/* Salir siempre visible: el de adentro queda oculto con el menú colapsado */}
                <button className="btn-logout-minimal d-lg-none ms-auto" onClick={handleLogout} title="Cerrar Sesión">
                    <span className="material-symbols-outlined">logout</span>
                </button>

                <div className="collapse navbar-collapse" id="navbarMain">
                    {/* Columna izquierda: Logo y Marca */}
                    <div className="navbar-brand-wrap d-flex align-items-center gap-3">
                        <img src="/Icons/logoSena.png" alt="SENA" style={{ height: '40px' }} />
                        <div className="d-none d-sm-block">
                            <h5 className="mb-0 fw-bold " style={{ letterSpacing: '1px' }}>SENA <span className="text-success neon-text">ACCESS</span></h5>
                            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-20" style={{ fontSize: '0.6rem' }}>
                                {currentUser?.role?.rol_name?.toUpperCase() || 'USER'} PANEL
                            </span>
                        </div>
                    </div>

                    {/* Enlaces de Navegación Dinámicos (a la izquierda, estética Sebastián) */}
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-2">
                        {links.map((link, index) => {
                            if (link.dropdown) {
                                const hijoActivo = (link.items || []).some(item => item.view && item.view === view);
                                return (
                                    <li key={index} className="nav-item dropdown">
                                        <button
                                            className={`nav-item-link dropdown-toggle ${hijoActivo ? 'active' : ''}`}
                                            type="button"
                                            data-bs-toggle="dropdown"
                                            aria-expanded="false"
                                        >
                                            <span className="material-symbols-outlined small me-1">{link.icon}</span> {link.label}
                                        </button>
                                        <ul className="dropdown-menu glass-box border-success border-opacity-25 shadow-lg">
                                            {link.items.map((item, idx) => (
                                                <li key={idx}>
                                                    {item.divider ? (
                                                        <hr className="dropdown-divider border-success border-opacity-10" />
                                                    ) : (
                                                        <button
                                                            className="dropdown-item py-2 d-flex align-items-center gap-2"
                                                            onClick={() => {
                                                                if (item.onClick) item.onClick();
                                                                if (item.view) setView(item.view);
                                                                if (item.filter) setUserFilter(item.filter);
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined small">{item.icon}</span> {item.label}
                                                        </button>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                );
                            }
                            return (
                                <li key={index} className="nav-item">
                                    <button
                                        className={`nav-item-link ${view === link.view ? 'active' : ''}`}
                                        onClick={() => {
                                            setView(link.view);
                                            if (link.filter && setUserFilter) setUserFilter(link.filter);
                                        }}
                                    >
                                        <span className="material-symbols-outlined small me-1">{link.icon}</span> {link.label}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>

                    {/* Columna derecha: Perfil y Acciones */}
                    <div className="navbar-actions d-flex align-items-center justify-content-lg-end gap-3 pt-2 pt-lg-0 border-top border-lg-0 border-success border-opacity-10">
                        {/* Tema claro/oscuro: vive en la barra para no tapar nada */}
                        <button
                            className="btn btn-link p-1 text-success theme-nav-btn"
                            type="button"
                            onClick={toggleTema}
                            title={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
                            aria-label={temaClaro ? 'Activar modo oscuro' : 'Activar modo claro'}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>
                                {temaClaro ? 'dark_mode' : 'light_mode'}
                            </span>
                        </button>

                        {/* Campana de notificaciones */}
                        <div className="dropdown position-relative">
                            <button
                                className="btn btn-link p-1 position-relative text-success"
                                type="button"
                                data-bs-toggle="dropdown"
                                onClick={fetchNotifications}
                                title="Notificaciones"
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>notifications</span>
                                {unread > 0 && (
                                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-dark" style={{ fontSize: '0.6rem' }}>
                                        {unread > 9 ? '9+' : unread}
                                    </span>
                                )}
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end glass-box border-success border-opacity-25 mt-2 shadow-lg p-2" style={{ width: 'min(340px, calc(100vw - 32px))', maxHeight: '400px', overflowY: 'auto' }}>
                                <li className="d-flex justify-content-between align-items-center px-2 py-1 mb-1 border-bottom border-success border-opacity-10">
                                    <span className="fw-bold small">Notificaciones</span>
                                    {unread > 0 && (
                                        <button className="btn btn-sm btn-outline-success py-0" onClick={handleMarkAllRead}>
                                            <span className="material-symbols-outlined small me-1">done_all</span> Marcar todas
                                        </button>
                                    )}
                                </li>
                                {notifications.length > 0 ? notifications.map(n => (
                                    <li key={n.id_notificacion}>
                                        <button
                                            className={`dropdown-item py-2 d-flex flex-column ${n.is_read ? '' : 'fw-bold'}`}
                                            onClick={() => handleMarkRead(n.id_notificacion)}
                                        >
                                            <span className="small">{n.notification_title}</span>
                                            <span className="small opacity-75" style={{ fontSize: '0.78rem' }}>{n.notification_body}</span>
                                            <span className="opacity-50" style={{ fontSize: '0.65rem' }}>{new Date(n.created_at).toLocaleString()}</span>
                                        </button>
                                    </li>
                                )) : (
                                    <li className="text-center py-3 opacity-50 small">No tienes notificaciones</li>
                                )}
                            </ul>
                        </div>

                        <div className="vr d-none d-lg-block opacity-25" style={{ height: '30px' }}></div>

                        <div
                            className="profile-nav-trigger d-flex align-items-center gap-2 cursor-pointer p-1 px-2 rounded-pill hover-bg"
                            onClick={() => setView('profile')}
                            style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                        >
                            <div className="text-end d-none d-md-block">
                                <p className="mb-0 fw-bold small text-truncate" style={{ maxWidth: '150px' }}>{currentUser?.user_name}</p>
                                <p className="mb-0 opacity-50" style={{ fontSize: '0.65rem' }}>{currentUser?.role?.rol_name}</p>
                            </div>
                            <div className="rounded-circle bg-success d-flex align-items-center justify-content-center shadow-sm border border-2 border-success border-opacity-25 overflow-hidden" style={{ width: '38px', height: '38px', fontSize: '0.9rem', fontWeight: 'bold', color: '#000' }}>
                                {currentUser?.profile_photo_path ? (
                                    <img src={currentUser.profile_photo_path} alt="Profile" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <>{currentUser?.user_name?.[0]}{currentUser?.user_lastname?.[0]}</>
                                )}
                            </div>
                        </div>

                        <button className="btn-logout-minimal" onClick={handleLogout} title="Cerrar Sesión">
                            <span className="material-symbols-outlined">logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
