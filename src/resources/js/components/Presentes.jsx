import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';

// Presentes: quiénes están DENTRO ahora (GET /api/admin/presentes).
// Se agrupa por ambiente (tarjeta "Sin ambiente" cuando es null); si la API
// aún no trae ambiente en nadie, se agrupa por rol como antes (fallback).
const Presentes = () => {
    const [presentes, setPresentes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [cargando, setCargando] = useState(true);
    const [expandido, setExpandido] = useState({});

    const fetchPresentes = async () => {
        try {
            setCargando(true);
            const response = await axios.get('/api/admin/presentes');
            setPresentes(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error fetching presentes:', error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        fetchPresentes();
    }, []);

    useEffect(() => {
        const handleFocus = () => {
            fetchPresentes();
        };
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchPresentes();
            }
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, []);

    const filtrados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return presentes;
        return presentes.filter(p =>
            `${p.user_name || ''} ${p.user_lastname || ''}`.toLowerCase().includes(q)
            || String(p.user_coursenumber ?? '').toLowerCase().includes(q)
        );
    }, [presentes, busqueda]);

    const hayAmbiente = useMemo(
        () => presentes.some(p => p.ambiente != null && p.ambiente !== ''),
        [presentes]
    );

    const grupos = useMemo(() => {
        const acc = {};
        filtrados.forEach(p => {
            const clave = hayAmbiente
                ? (p.ambiente || 'Sin ambiente')
                : (p.rol || 'Sin rol');
            if (!acc[clave]) acc[clave] = [];
            acc[clave].push(p);
        });
        return acc;
    }, [filtrados, hayAmbiente]);

    const toggleGrupo = (rol) => {
        setExpandido(prev => ({ ...prev, [rol]: !prev[rol] }));
    };

    const horaLegible = (fecha) => {
        if (!fecha) return '—';
        return new Date(fecha).toLocaleString();
    };

    return (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                    <div className="section-header mb-0">
                        <h3 className="mb-0">Personas Presentes</h3>
                        <p className="opacity-50 small">Dentro ahora: {presentes.length} personas</p>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        <div className="input-group search-input-group" style={{ maxWidth: '300px' }}>
                            <span className="input-group-text">
                                <span className="material-symbols-outlined">search</span>
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Buscar por nombre o ficha..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-outline-success d-flex align-items-center gap-2" onClick={fetchPresentes} disabled={cargando}>
                            <span className="material-symbols-outlined">refresh</span>
                            Recargar
                        </button>
                    </div>
                </div>

                <div className="admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                    {cargando ? (
                        <div className="text-center py-5 w-100">
                            <div className="spinner-border text-success" role="status">
                                <span className="visually-hidden">Cargando...</span>
                            </div>
                        </div>
                    ) : filtrados.length > 0 ? (
                        <div className="row g-4">
                            {Object.entries(grupos).map(([rol, miembros]) => {
                                const abierto = expandido[rol] !== false;
                                const pct = presentes.length > 0 ? Math.round((miembros.length / presentes.length) * 100) : 0;
                                return (
                                    <div key={rol} className="col-md-6 col-lg-4 mb-4">
                                        <div className="glass-box p-4 h-100 d-flex flex-column hover-glow transition-all">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <span className="badge-soft-success">{rol}</span>
                                                <span className="small opacity-75">{miembros.length}/{presentes.length}</span>
                                            </div>
                                            <div className="progress mb-3" style={{ height: '8px' }}>
                                                <div className="progress-bar bg-success" role="progressbar" style={{ width: `${pct}%` }} aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100"></div>
                                            </div>
                                            <button className="btn btn-sm btn-outline-success w-100 mb-3 d-flex align-items-center justify-content-center gap-2" onClick={() => toggleGrupo(rol)}>
                                                <span className="material-symbols-outlined">{abierto ? 'expand_less' : 'expand_more'}</span>
                                                {abierto ? 'Ocultar miembros' : `Ver miembros (${miembros.length})`}
                                            </button>
                                            {abierto && (
                                                <ul className="list-unstyled mb-0">
                                                    {miembros.map(m => (
                                                        <li key={m.id_usuario} className="d-flex justify-content-between align-items-center py-2 border-top border-success border-opacity-10">
                                                            <div>
                                                                <p className="mb-0 fw-bold">{m.user_name} {m.user_lastname}</p>
                                                                <p className="mb-0 opacity-50" style={{ fontSize: '0.65rem' }}>
                                                                    <span className="material-symbols-outlined small me-1">login</span>
                                                                    Entró: {horaLegible(m.entrada_hora)}
                                                                </p>
                                                                {Number(m.user_coursenumber) > 0 && (
                                                                    <p className="mb-0 opacity-50" style={{ fontSize: '0.65rem' }}>
                                                                        Ficha {m.user_coursenumber}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <span className="badge-soft-success">{m.rol || '—'}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center w-100 py-5 opacity-50">
                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>group_off</span>
                            <p className="mt-2">{busqueda ? 'Sin coincidencias para la búsqueda' : 'No hay personas dentro ahora'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Presentes;
