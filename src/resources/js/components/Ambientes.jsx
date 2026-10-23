import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { showAlert, showConfirm } from './CustomAlert';

const ESTADOS = ['Activo', 'Inactivo', 'Mantenimiento'];

const ESTADO_BADGE = {
    'Activo': 'badge-soft-success',
    'Inactivo': 'badge-soft-secondary',
    'Mantenimiento': 'badge-soft-warning'
};

const FORM_VACIO = {
    ambiente_nombre: '',
    ambiente_capacidad: '',
    ambiente_ubicacion: '',
    ambiente_estado: 'Activo',
    ambiente_jornada: '',
    hora_inicio: '',
    hora_fin: '',
    instructores: []
};

const Ambientes = ({ currentUser, rol }) => {
    const rolNorm = (rol || '').toLowerCase();
    const nombreRol = (currentUser?.role?.rol_name || '').toLowerCase();
    const esAdmin = rolNorm === 'superadmin' || nombreRol === 'superadmin';
    const esInstructor = rolNorm === 'instructor' || nombreRol === 'instructor';

    const [ambientes, setAmbientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [mostrarForm, setMostrarForm] = useState(false);
    const [editando, setEditando] = useState(null);
    const [formData, setFormData] = useState(FORM_VACIO);
    const [formErrors, setFormErrors] = useState({});

    const [instructores, setInstructores] = useState([]);
    const [aprendices, setAprendices] = useState([]);

    const [seleccionado, setSeleccionado] = useState(null);
    const [matriculados, setMatriculados] = useState([]);
    const [cargandoMatricula, setCargandoMatricula] = useState(false);
    const [syncInstructores, setSyncInstructores] = useState([]);
    const [nuevoAprendiz, setNuevoAprendiz] = useState('');

    const fetchAmbientes = useCallback(async (search = '') => {
        try {
            setLoading(true);
            const url = esAdmin ? '/api/ambientes' : '/api/mis-ambientes';
            const response = await axios.get(url);
            const lista = Array.isArray(response.data) ? response.data : [];
            if (!search) {
                setAmbientes(lista);
            } else {
                const q = search.toLowerCase();
                setAmbientes(lista.filter(a =>
                    (a.ambiente_nombre || '').toLowerCase().includes(q) ||
                    (a.ambiente_ubicacion || '').toLowerCase().includes(q) ||
                    (a.ambiente_jornada || '').toLowerCase().includes(q)
                ));
            }
        } catch (error) {
            console.error('Error fetching ambientes:', error);
            showAlert('Error al cargar los ambientes: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        } finally {
            setLoading(false);
        }
    }, [esAdmin]);

    const fetchUsuarios = useCallback(async () => {
        try {
            const response = await axios.get('/api/admin/users');
            const lista = Array.isArray(response.data) ? response.data : [];
            setInstructores(lista.filter(u => u.role?.rol_name === 'Instructor'));
            setAprendices(lista.filter(u => u.role?.rol_name === 'Aprendiz'));
        } catch (error) {
            console.error('Error fetching usuarios:', error);
        }
    }, []);

    useEffect(() => {
        if (esAdmin || esInstructor) {
            fetchAmbientes();
            fetchUsuarios();
        } else {
            setLoading(false);
        }
    }, [fetchAmbientes, fetchUsuarios, esAdmin, esInstructor]);

    useEffect(() => {
        const handleFocus = () => fetchAmbientes(searchTerm);
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                fetchAmbientes(searchTerm);
            }
        };
        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchAmbientes, searchTerm]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        fetchAmbientes(e.target.value);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (formErrors[name]) {
            setFormErrors(prev => {
                const next = { ...prev };
                delete next[name];
                return next;
            });
        }
    };

    const handleInstructoresChange = (e) => {
        const ids = Array.from(e.target.selectedOptions, o => Number(o.value));
        setFormData(prev => ({ ...prev, instructores: ids }));
        if (formErrors.instructores) {
            setFormErrors(prev => {
                const next = { ...prev };
                delete next.instructores;
                return next;
            });
        }
    };

    const abrirCrear = () => {
        setEditando(null);
        setFormData(FORM_VACIO);
        setFormErrors({});
        setMostrarForm(true);
    };

    const abrirEditar = (ambiente) => {
        setEditando(ambiente);
        setFormData({
            ambiente_nombre: ambiente.ambiente_nombre || '',
            ambiente_capacidad: ambiente.ambiente_capacidad || '',
            ambiente_ubicacion: ambiente.ambiente_ubicacion || '',
            ambiente_estado: ambiente.ambiente_estado || 'Activo',
            ambiente_jornada: ambiente.ambiente_jornada || '',
            hora_inicio: (ambiente.hora_inicio || '').slice(0, 5),
            hora_fin: (ambiente.hora_fin || '').slice(0, 5),
            instructores: (ambiente.instructores || []).map(i => i.id_usuario)
        });
        setFormErrors({});
        setMostrarForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            ...formData,
            ambiente_capacidad: formData.ambiente_capacidad === '' ? null : Number(formData.ambiente_capacidad),
            ambiente_ubicacion: formData.ambiente_ubicacion || null,
            ambiente_jornada: formData.ambiente_jornada || null,
            hora_inicio: formData.hora_inicio || null,
            hora_fin: formData.hora_fin || null
        };
        try {
            if (editando) {
                await axios.put(`/api/admin/ambientes/${editando.id_ambiente}`, payload);
                showAlert('Ambiente actualizado con éxito');
            } else {
                await axios.post('/api/admin/ambientes', payload);
                showAlert('Ambiente creado con éxito');
            }
            setFormErrors({});
            setMostrarForm(false);
            setEditando(null);
            fetchAmbientes(searchTerm);
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            }
            showAlert('Error al guardar el ambiente: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await showConfirm('¿Estás seguro de eliminar este ambiente? Se quitarán sus asignaciones.');
        if (confirmed) {
            try {
                await axios.delete(`/api/admin/ambientes/${id}`);
                showAlert('Ambiente eliminado');
                if (seleccionado?.id_ambiente === id) {
                    setSeleccionado(null);
                    setMatriculados([]);
                }
                fetchAmbientes(searchTerm);
            } catch (error) {
                showAlert('Error al eliminar el ambiente: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
            }
        }
    };

    const abrirGestion = async (ambiente) => {
        setSeleccionado(ambiente);
        setSyncInstructores((ambiente.instructores || []).map(i => i.id_usuario));
        setNuevoAprendiz('');
        await fetchMatriculados(ambiente.id_ambiente);
    };

    const fetchMatriculados = async (id) => {
        try {
            setCargandoMatricula(true);
            const url = esAdmin ? `/api/admin/ambientes/${id}/aprendices` : `/api/mis-ambientes/${id}/aprendices`;
            const response = await axios.get(url);
            setMatriculados(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            showAlert('Error al cargar los aprendices: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        } finally {
            setCargandoMatricula(false);
        }
    };

    const handleSyncInstructores = async () => {
        try {
            await axios.post(`/api/admin/ambientes/${seleccionado.id_ambiente}/instructores`, { instructores: syncInstructores });
            showAlert('Instructores asignados con éxito');
            fetchAmbientes(searchTerm);
        } catch (error) {
            showAlert('Error al asignar instructores: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const handleAgregarAprendiz = async () => {
        if (!nuevoAprendiz) {
            showAlert('Selecciona un aprendiz para matricular', 'error');
            return;
        }
        try {
            const url = esAdmin
                ? `/api/admin/ambientes/${seleccionado.id_ambiente}/aprendices`
                : `/api/mis-ambientes/${seleccionado.id_ambiente}/aprendices`;
            await axios.post(url, { fk_id_usuario: Number(nuevoAprendiz) });
            showAlert('Aprendiz agregado al ambiente');
            setNuevoAprendiz('');
            fetchMatriculados(seleccionado.id_ambiente);
            fetchAmbientes(searchTerm);
        } catch (error) {
            showAlert('Error al agregar el aprendiz: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const handleQuitarAprendiz = async (userId) => {
        const confirmed = await showConfirm('¿Quitar a este aprendiz del ambiente?');
        if (confirmed) {
            try {
                const url = esAdmin
                    ? `/api/admin/ambientes/${seleccionado.id_ambiente}/aprendices/${userId}`
                    : `/api/mis-ambientes/${seleccionado.id_ambiente}/aprendices/${userId}`;
                await axios.delete(url);
                showAlert('Aprendiz removido del ambiente');
                fetchMatriculados(seleccionado.id_ambiente);
                fetchAmbientes(searchTerm);
            } catch (error) {
                showAlert('Error al quitar el aprendiz: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
            }
        }
    };

    const fieldError = (name) => (
        formErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{formErrors[name][0]}</div> : null
    );

    const renderBadgeEstado = (estado) => (
        <span className={`badge ${ESTADO_BADGE[estado] || 'badge-soft-secondary'} px-3 py-2`}>{estado || '—'}</span>
    );

    const ocupacion = (ambiente) => {
        const total = Number(ambiente.ambiente_capacidad) || 0;
        const usados = Number(ambiente.aprendices_count) || 0;
        if (!total) return `${usados} matriculado(s)`;
        return `${usados}/${total}`;
    };

    const nombreUsuario = (u) => `${u?.user_name || ''} ${u?.user_lastname || ''}`.trim() || u?.user_email || '—';

    // El rol Aprendiz no usa este componente: sus salones se consultan desde el panel principal.
    if (!esAdmin && !esInstructor) {
        return (
            <div className="fade-in-up">
                <div className="glass-box p-4 mb-5 mx-auto text-center" style={{ maxWidth: '600px' }}>
                    <span className="material-symbols-outlined opacity-50" style={{ fontSize: '48px' }}>meeting_room</span>
                    <p className="mt-2 mb-0 opacity-75">Tus salones de formación se muestran en tu panel principal.</p>
                </div>
            </div>
        );
    }

    const renderForm = () => (
        <div className="glass-box p-4 mb-4 mx-auto" style={{ maxWidth: '700px' }}>
            <div className="section-header">
                <h3 className="mb-0">{editando ? 'Editar Ambiente' : 'Nuevo Ambiente'}</h3>
                <p className="opacity-50 small">{editando ? `Actualizando "${editando.ambiente_nombre}"` : 'Crea un salón de formación y asígnale instructores'}</p>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="row">
                    <div className="col-md-6 mb-3">
                        <label className="form-label opacity-75 small">Nombre del ambiente</label>
                        <input
                            type="text"
                            name="ambiente_nombre"
                            className={`form-control ${formErrors.ambiente_nombre ? 'is-invalid' : ''}`}
                            value={formData.ambiente_nombre}
                            onChange={handleChange}
                            required
                            maxLength={100}
                            placeholder="Ej: Ambiente 302"
                        />
                        {fieldError('ambiente_nombre')}
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label opacity-75 small">Capacidad</label>
                        <input
                            type="number"
                            name="ambiente_capacidad"
                            className={`form-control ${formErrors.ambiente_capacidad ? 'is-invalid' : ''}`}
                            value={formData.ambiente_capacidad}
                            onChange={handleChange}
                            min={1}
                            max={500}
                            placeholder="Ej: 30"
                        />
                        {fieldError('ambiente_capacidad')}
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label opacity-75 small">Ubicación</label>
                        <input
                            type="text"
                            name="ambiente_ubicacion"
                            className={`form-control ${formErrors.ambiente_ubicacion ? 'is-invalid' : ''}`}
                            value={formData.ambiente_ubicacion}
                            onChange={handleChange}
                            maxLength={100}
                            placeholder="Ej: Bloque B, piso 2"
                        />
                        {fieldError('ambiente_ubicacion')}
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label opacity-75 small">Estado</label>
                        <select
                            name="ambiente_estado"
                            className={`form-select ${formErrors.ambiente_estado ? 'is-invalid' : ''}`}
                            value={formData.ambiente_estado}
                            onChange={handleChange}
                        >
                            {ESTADOS.map(est => <option key={est} value={est}>{est}</option>)}
                        </select>
                        {fieldError('ambiente_estado')}
                    </div>
                    <div className="col-md-4 mb-3">
                        <label className="form-label opacity-75 small">Jornada</label>
                        <input
                            type="text"
                            name="ambiente_jornada"
                            className={`form-control ${formErrors.ambiente_jornada ? 'is-invalid' : ''}`}
                            value={formData.ambiente_jornada}
                            onChange={handleChange}
                            maxLength={20}
                            placeholder="Ej: Mañana"
                        />
                        {fieldError('ambiente_jornada')}
                    </div>
                    <div className="col-md-4 mb-3">
                        <label className="form-label opacity-75 small">Hora inicio</label>
                        <input
                            type="time"
                            name="hora_inicio"
                            className={`form-control ${formErrors.hora_inicio ? 'is-invalid' : ''}`}
                            value={formData.hora_inicio}
                            onChange={handleChange}
                        />
                        {fieldError('hora_inicio')}
                    </div>
                    <div className="col-md-4 mb-3">
                        <label className="form-label opacity-75 small">Hora fin</label>
                        <input
                            type="time"
                            name="hora_fin"
                            className={`form-control ${formErrors.hora_fin ? 'is-invalid' : ''}`}
                            value={formData.hora_fin}
                            onChange={handleChange}
                        />
                        {fieldError('hora_fin')}
                    </div>
                    <div className="col-12 mb-3">
                        <label className="form-label opacity-75 small">Instructores asignados (selección múltiple)</label>
                        <select
                            multiple
                            className={`form-select ${formErrors.instructores ? 'is-invalid' : ''}`}
                            value={formData.instructores.map(String)}
                            onChange={handleInstructoresChange}
                            style={{ minHeight: '110px' }}
                        >
                            {instructores.map(u => (
                                <option key={u.id_usuario} value={u.id_usuario}>{nombreUsuario(u)}</option>
                            ))}
                        </select>
                        {fieldError('instructores')}
                    </div>
                </div>
                <div className="d-flex gap-2 mt-3 flex-wrap">
                    <button type="submit" className="btn btn-success action-btn flex-grow-1 py-2">
                        <span className="material-symbols-outlined">{editando ? 'save' : 'add_circle'}</span> {editando ? 'Guardar Cambios' : 'Crear Ambiente'}
                    </button>
                    <button type="button" className="btn btn-outline-secondary action-btn px-4" onClick={() => { setMostrarForm(false); setEditando(null); setFormErrors({}); }}>
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );

    const renderGestion = () => (
        <div className="glass-box p-4 mb-4 mx-auto" style={{ maxWidth: '1000px' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                <div className="section-header mb-0">
                    <h3 className="mb-0">Gestionar: {seleccionado.ambiente_nombre}</h3>
                    <p className="opacity-50 small mb-0">Ocupación {ocupacion(seleccionado)}{seleccionado.ambiente_ubicacion ? ` · ${seleccionado.ambiente_ubicacion}` : ''}</p>
                </div>
                <button className="btn btn-sm btn-outline-secondary action-btn" onClick={() => { setSeleccionado(null); setMatriculados([]); }}>
                    <span className="material-symbols-outlined">close</span> Cerrar
                </button>
            </div>
            <div className="row">
                {esAdmin && (
                    <div className="col-md-6 mb-3">
                        <label className="form-label opacity-75 small">Instructores del ambiente</label>
                        <select
                            multiple
                            className="form-select"
                            value={syncInstructores.map(String)}
                            onChange={(e) => setSyncInstructores(Array.from(e.target.selectedOptions, o => Number(o.value)))}
                            style={{ minHeight: '130px' }}
                        >
                            {instructores.map(u => (
                                <option key={u.id_usuario} value={u.id_usuario}>{nombreUsuario(u)}</option>
                            ))}
                        </select>
                        <button className="btn btn-success action-btn w-100 mt-2" onClick={handleSyncInstructores}>
                            <span className="material-symbols-outlined">sync</span> Guardar Asignación
                        </button>
                    </div>
                )}
                <div className={esAdmin ? 'col-md-6 mb-3' : 'col-12 mb-3'}>
                    <label className="form-label opacity-75 small">Matricular aprendiz</label>
                    <div className="d-flex gap-2">
                        <select className="form-select" style={{ minWidth: 0 }} value={nuevoAprendiz} onChange={(e) => setNuevoAprendiz(e.target.value)}>
                            <option value="" disabled>Seleccione un aprendiz...</option>
                            {aprendices.map(u => (
                                <option key={u.id_usuario} value={u.id_usuario}>{nombreUsuario(u)}</option>
                            ))}
                        </select>
                        <button className="btn btn-success action-btn" onClick={handleAgregarAprendiz} title="Agregar aprendiz">
                            <span className="material-symbols-outlined">person_add</span>
                        </button>
                    </div>
                    <div className="admin-scrollable-container mt-3" style={{ maxHeight: '30vh' }}>
                        {cargandoMatricula ? (
                            <div className="text-center py-4">
                                <div className="spinner-border text-success" role="status">
                                    <span className="visually-hidden">Cargando...</span>
                                </div>
                            </div>
                        ) : matriculados.length > 0 ? (
                            <table className="table admin-table table-cards mb-0">
                                <thead>
                                    <tr>
                                        <th>Aprendiz</th>
                                        <th>Correo</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {matriculados.map(u => (
                                        <tr key={u.id_usuario}>
                                            <td data-label="Aprendiz" className="fw-bold">{nombreUsuario(u)}</td>
                                            <td data-label="Correo" className="small opacity-75">{u.user_email}</td>
                                            <td data-label="Acciones">
                                                <button className="btn btn-sm btn-outline-danger p-1 d-flex align-items-center" title="Quitar del ambiente" onClick={() => handleQuitarAprendiz(u.id_usuario)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_remove</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-4 opacity-50">
                                <span className="material-symbols-outlined" style={{ fontSize: '40px' }}>group_off</span>
                                <p className="mt-2 mb-0">Sin aprendices matriculados</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                    <div className="section-header mb-0">
                        <h3 className="mb-0">{esAdmin ? 'Gestión de Ambientes' : 'Mis Salones'}</h3>
                        <p className="opacity-50 small">Total: {ambientes.length} ambiente(s)</p>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        <div className="input-group search-input-group" style={{ maxWidth: '300px' }}>
                            <span className="input-group-text">
                                <span className="material-symbols-outlined">search</span>
                            </span>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Buscar por nombre, ubicación o jornada..."
                                value={searchTerm}
                                onChange={handleSearch}
                            />
                        </div>
                        {esAdmin && !mostrarForm && (
                            <button className="btn btn-success action-btn d-flex align-items-center gap-2" onClick={abrirCrear}>
                                <span className="material-symbols-outlined">add_circle</span> Nuevo Ambiente
                            </button>
                        )}
                    </div>
                </div>

                {esAdmin && mostrarForm && renderForm()}
                {seleccionado && renderGestion()}

                <div className="admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                    {loading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-success" role="status">
                                <span className="visually-hidden">Cargando...</span>
                            </div>
                        </div>
                    ) : ambientes.length > 0 ? (
                        <table className="table admin-table table-cards mb-0">
                            <thead>
                                <tr>
                                    <th>Ambiente</th>
                                    <th>Ubicación</th>
                                    <th>Jornada / Horario</th>
                                    <th>Estado</th>
                                    <th>Ocupación</th>
                                    <th>Instructores</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ambientes.map(ambiente => (
                                    <tr key={ambiente.id_ambiente}>
                                        <td data-label="Ambiente" className="fw-bold">{ambiente.ambiente_nombre}</td>
                                        <td data-label="Ubicación">{ambiente.ambiente_ubicacion || '—'}</td>
                                        <td data-label="Jornada / Horario">
                                            {ambiente.ambiente_jornada || '—'}
                                            {(ambiente.hora_inicio || ambiente.hora_fin) && (
                                                <small className="opacity-50 d-block">{(ambiente.hora_inicio || '').slice(0, 5)} - {(ambiente.hora_fin || '').slice(0, 5)}</small>
                                            )}
                                        </td>
                                        <td data-label="Estado">{renderBadgeEstado(ambiente.ambiente_estado)}</td>
                                        <td data-label="Ocupación">
                                            <span className="badge badge-soft-info px-3 py-2">
                                                <span className="material-symbols-outlined me-1" style={{ fontSize: '14px' }}>groups</span>
                                                {ocupacion(ambiente)}
                                            </span>
                                        </td>
                                        <td data-label="Instructores">
                                            {(ambiente.instructores || []).length > 0
                                                ? ambiente.instructores.map(i => nombreUsuario(i)).join(', ')
                                                : <span className="opacity-50">Sin asignar</span>}
                                        </td>
                                        <td data-label="Acciones">
                                            <div className="d-flex gap-2">
                                                <button className="btn btn-sm btn-outline-success p-1 d-flex align-items-center" title="Gestionar instructores y aprendices" onClick={() => abrirGestion(ambiente)}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>manage_accounts</span>
                                                </button>
                                                {esAdmin && (
                                                    <>
                                                        <button className="btn btn-sm btn-outline-success p-1 d-flex align-items-center" title="Editar" onClick={() => abrirEditar(ambiente)}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                                                        </button>
                                                        <button className="btn btn-sm btn-outline-danger p-1 d-flex align-items-center" title="Eliminar" onClick={() => handleDelete(ambiente.id_ambiente)}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-5 opacity-50">
                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>meeting_room</span>
                            <p className="mt-2">{esAdmin ? 'No hay ambientes registrados' : 'No tienes salones asignados'}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Ambientes;
