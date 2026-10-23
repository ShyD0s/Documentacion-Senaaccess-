import React, { useState, useEffect } from 'react';
import axios from 'axios';

const StatsDashboard = ({ currentUser = null }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Portería ve estadísticas del centro (mismo alcance operativo que admin).
    const isAdmin = ['superadmin', 'admin'].includes(currentUser?.role?.rol_name?.toLowerCase());

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const url = isAdmin ? '/api/admin/stats' : '/api/my-stats';
                const response = await axios.get(url);
                setStats(response.data);
                setError('');
            } catch (err) {
                setError('No se pudieron cargar los datos del dashboard.');
            } finally {
                setLoading(false);
            }
        };
        if (currentUser) fetchStats();
    }, [isAdmin, currentUser]);

    useEffect(() => {
        const handleFocus = () => {
            fetchStats();
        };
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                fetchStats();
            }
        };
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [currentUser]);

    const firstName = currentUser?.user_name || 'Usuario';

    const kpis = isAdmin ? [
        { label: 'Ingresos Hoy', value: stats?.ingresos_hoy ?? 0, icon: 'login' },
        { label: 'Usuarios', value: stats?.usuarios_totales ?? 0, icon: 'group' },
        { label: 'Equipos Activos', value: stats?.equipos_activos ?? 0, icon: 'devices' },
        { label: 'Novedades', value: stats?.novedades_totales ?? 0, icon: 'report_problem' },
    ] : [
        { label: 'Mis Ingresos Hoy', value: stats?.ingresos_hoy ?? 0, icon: 'login' },
        { label: 'Mis Entradas', value: stats?.distribucion_por_tipo?.Entrada ?? 0, icon: 'meeting_room' },
        { label: 'Mis Salidas', value: stats?.distribucion_por_tipo?.Salida ?? 0, icon: 'logout' },
        { label: 'Mis Novedades', value: stats?.novedades_totales ?? 0, icon: 'report_problem' },
    ];

    // El dashboard muestra solo las tarjetas KPI. El historial completo vive
    // en la vista HISTORIAL de cada panel (no se duplica aquí).
    return (
        <div className="fade-in-up mx-auto" style={{ maxWidth: isAdmin ? '1400px' : '1200px' }}>
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-4">
                <h2 className="mb-0" style={{ fontWeight: '800', letterSpacing: '-1px' }}>
                    Bienvenido, <span style={{ color: 'var(--primary-color)' }}>{firstName}</span>
                </h2>
            </div>

            {error && (
                <div className="glass-box p-4 mb-4 text-center opacity-75">
                    <span className="material-symbols-outlined d-block mb-2" style={{ fontSize: '40px' }}>cloud_off</span>
                    {error}
                </div>
            )}

            <div className="stats-container mx-auto">
                {kpis.map(kpi => (
                    <div className="stat-card" key={kpi.label}>
                        <div className="stat-icon">
                            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>{kpi.icon}</span>
                        </div>
                        <div className="stat-info">
                            <h4>{kpi.label}</h4>
                            <p>{loading ? '—' : kpi.value}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default StatsDashboard;