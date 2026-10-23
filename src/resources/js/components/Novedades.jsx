import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { showAlert, showConfirm } from './CustomAlert'; 

const Novedades = ({ currentUser, initialMode = 'history' }) => {
    const [novedades, setNovedades] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState(initialMode); // 'form' or 'history'
    const [formErrors, setFormErrors] = useState({});
    const [formData, setFormData] = useState({
        novedad_ambiente: '',
        novedad_title: '',
        novedad_body: ''
    });

    useEffect(() => {
        setMode(initialMode);
    }, [initialMode]);

    const fetchNovedades = async (search = '') => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/novedades?search=${search}`);
            setNovedades(response.data);
        } catch (error) {
            console.error('Error fetching novedades:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mode === 'history') {
            fetchNovedades();
        }
    }, [mode]);

    useEffect(() => {
        const handleFocus = () => {
            fetchNovedades(searchTerm);
        };
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                fetchNovedades(searchTerm);
            }
        };
        window.addEventListener("focus", handleFocus);
        document.addEventListener("visibilitychange", handleVisibility);
        return () => {
            window.removeEventListener("focus", handleFocus);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [searchTerm]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        fetchNovedades(e.target.value);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        if (formErrors[e.target.name]) {
            setFormErrors(prev => {
                const next = { ...prev };
                delete next[e.target.name];
                return next;
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/novedades', formData);
            showAlert('Novedad registrada con éxito');
            setFormErrors({});
            setFormData({
                novedad_ambiente: '',
                novedad_title: '',
                novedad_body: ''
            });
            setMode('history');
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            }
            showAlert('Error al registrar la novedad: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await showConfirm('¿Estás seguro de eliminar esta novedad?');
        if (confirmed) {
            try {
                await axios.delete(`/api/novedades/${id}`);
                showAlert('Novedad eliminada');
                fetchNovedades(searchTerm);
            } catch (error) {
                showAlert('Error al eliminar la novedad', 'error');
            }
        }
    };

    const fieldError = (name) => (
        formErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{formErrors[name][0]}</div> : null
    );

    const renderForm = () => (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '600px' }}>
                <div className="section-header">
                    <h3 className="mb-0">Nueva Novedad</h3>
                    <p className="opacity-50 small">Reportar incidentes o novedades en los ambientes de formación</p>
                </div>
                <div className="admin-scrollable-container" style={{ maxHeight: '55vh' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="row">
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Lugar / Ambiente</label>
                                <input
                                    type="text"
                                    name="novedad_ambiente"
                                    className={`form-control ${formErrors.novedad_ambiente ? 'is-invalid' : ''}`}
                                    value={formData.novedad_ambiente}
                                    onChange={handleChange}
                                    required
                                    placeholder="Ej: Ambiente 302, Auditorio, Biblioteca..."
                                />
                                {fieldError('novedad_ambiente')}
                            </div>
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Título de la Novedad</label>
                                <input
                                    type="text"
                                    name="novedad_title"
                                    className={`form-control ${formErrors.novedad_title ? 'is-invalid' : ''}`}
                                    value={formData.novedad_title}
                                    onChange={handleChange}
                                    required
                                    placeholder="Ej: Fallo en proyector, Silla rota..."
                                />
                                {fieldError('novedad_title')}
                            </div>
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Descripción Detallada</label>
                                <textarea
                                    name="novedad_body"
                                    className={`form-control ${formErrors.novedad_body ? 'is-invalid' : ''}`}
                                    rows="5"
                                    value={formData.novedad_body}
                                    onChange={handleChange}
                                    required
                                    placeholder="Explique detalladamente lo ocurrido o el estado del ambiente..."
                                ></textarea>
                                {fieldError('novedad_body')}
                            </div>
                        </div>
                        <div className="mt-4">
                            <button type="submit" className="btn btn-success w-100 py-2 action-btn">
                                <span className="material-symbols-outlined">report_problem</span> Registrar Novedad
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    const renderHistory = () => (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                    <div className="section-header mb-0">
                        <h3 className="mb-0">Historial de Novedades</h3>
                        <p className="opacity-50 small">Total: {novedades.length} registros</p>
                    </div>
                    <div className="input-group search-input-group" style={{ maxWidth: '350px' }}>
                        <span className="input-group-text">
                            <span className="material-symbols-outlined">search</span>
                        </span>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Buscar por título, cuerpo o ambiente..."
                            value={searchTerm}
                            onChange={handleSearch}
                        />
                    </div>
                </div>

                <div className="admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                <div className="row g-4">
                    {loading ? (
                        <div className="text-center py-5 w-100">
                            <div className="spinner-border text-success" role="status">
                                <span className="visually-hidden">Cargando...</span>
                            </div>
                        </div>
                    ) : novedades.length > 0 ? (
                        novedades.map(novedad => (
                            <div key={novedad.id_novedad} className="col-md-6 col-lg-4 mb-4">
                                <div className="glass-box p-4 h-100 d-flex flex-column hover-glow transition-all">
                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2" style={{ fontSize: '0.7rem' }}>
                                            {novedad.novedad_ambiente}
                                        </span>
                                        {(currentUser?.role?.rol_name || '').toLowerCase() === 'superadmin' && (
                                            <button className="btn btn-sm btn-outline-danger p-1 d-flex align-items-center justify-content-center" onClick={() => handleDelete(novedad.id_novedad)}>
                                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                                            </button>
                                        )}
                                    </div>
                                    <h4 className="mb-2">{novedad.novedad_title}</h4>
                                    <p className="opacity-75 mb-4 flex-grow-1" style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                                        {novedad.novedad_body}
                                    </p>
                                    <div className="mt-auto pt-3 border-top border-success border-opacity-10 d-flex justify-content-between align-items-center">
                                        <div className="d-flex align-items-center gap-2">
                                            <div className="rounded-circle bg-success bg-opacity-20 d-flex align-items-center justify-content-center text-success" style={{ width: '32px', height: '32px', fontSize: '0.8rem' }}>
                                                {novedad.user?.user_name?.[0]}{novedad.user?.user_lastname?.[0]}
                                            </div>
                                            <div className="small">
                                                <p className="mb-0 fw-bold">{novedad.user?.user_name}</p>
                                                <p className="mb-0 opacity-50" style={{ fontSize: '0.65rem' }}>{new Date(novedad.novedad_datetime).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center w-100 py-5 opacity-50">
                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>event_busy</span>
                            <p className="mt-2">No se encontraron novedades</p>
                        </div>
                     )}
                </div>
            </div>
            </div>
        </div>
    );

    return mode === 'form' ? renderForm() : renderHistory();
};

export default Novedades;
