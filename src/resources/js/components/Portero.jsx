import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import Navbar from './Navbar';
import StatsDashboard from './StatsDashboard';
import Presentes from './Presentes';
import Excusas from './Excusas';
import QrInvitado from './QrInvitado';
import UserQrCarnet from './UserQrCarnet';
import AccesoQr from './AccesoQr';
import EquipmentForm from './EquipmentForm';
import DosPasos from './DosPasos';
import MiHuella from './MiHuella';
import RecorteFoto from './RecorteFoto';
import { showAlert, showConfirm } from './CustomAlert';
import downloadComprobante from '../utils/comprobante';
import { mensajeDeError } from '../utils/mensajes';

// Panel de Portería: operación diaria sin gestión de usuarios ni ambientes.
// Historial y presentes del centro, validar PIN de excusas, inventario de
// equipos (registrar/devolver/eliminar) y escáner QR de invitados.
const Portero = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [view, setView] = useState('dashboard');
    const [loading, setLoading] = useState(true);

    // Historial global de accesos (GET /api/admin/ingresos, paginado).
    const [ingresos, setIngresos] = useState([]);
    const [ingresosMeta, setIngresosMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [historialLoading, setHistorialLoading] = useState(false);
    const [searchTermIngresos, setSearchTermIngresos] = useState('');
    const [filterTipo, setFilterTipo] = useState('');
    const [filterDesde, setFilterDesde] = useState('');
    const [filterHasta, setFilterHasta] = useState('');

    // Inventario de equipos (GET /api/admin/equipment).
    const [equipmentList, setEquipmentList] = useState([]);
    const [searchTermEquipment, setSearchTermEquipment] = useState('');

    // Perfil propio (PUT /api/my-profile, multipart + _method=PUT).
    const [editingProfile, setEditingProfile] = useState(false);
    const [profileErrors, setProfileErrors] = useState({});
    const [fotoBlob, setFotoBlob] = useState(null);
    const [fotoPreview, setFotoPreview] = useState(null);
    const [archivoRecorte, setArchivoRecorte] = useState(null);
    const [codigo2fa, setCodigo2fa] = useState('');
    const [codigoSolicitado, setCodigoSolicitado] = useState(false);
    const [formData, setFormData] = useState({
        user_identification: '',
        user_name: '',
        user_lastname: '',
        user_email: '',
        user_password: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    navigate('/login');
                    return;
                }
                const [userMeResponse, ingresosResponse, equipmentResponse] = await Promise.all([
                    axios.get('/api/user'),
                    axios.get('/api/admin/ingresos?per_page=15'),
                    axios.get('/api/admin/equipment')
                ]);
                setCurrentUser(userMeResponse.data);
                setIngresos(ingresosResponse.data.data || []);
                setIngresosMeta({
                    current_page: ingresosResponse.data.current_page || 1,
                    last_page: ingresosResponse.data.last_page || 1,
                    total: ingresosResponse.data.total || 0
                });
                setEquipmentList(Array.isArray(equipmentResponse.data) ? equipmentResponse.data : []);
                setFormData({
                    user_identification: userMeResponse.data.user_identification || '',
                    user_name: userMeResponse.data.user_name,
                    user_lastname: userMeResponse.data.user_lastname,
                    user_email: userMeResponse.data.user_email,
                    user_password: '',
                    profile_photo_path: userMeResponse.data.profile_photo_path || null
                });
            } catch (error) {
                console.error('Error cargando datos: ', error);
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user_role');
                    navigate('/login');
                } else {
                    showAlert(mensajeDeError(error, 'No se pudieron cargar los datos del panel.'), 'error');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const fetchIngresos = async (page = 1) => {
        try {
            setHistorialLoading(true);
            const params = new URLSearchParams({ page: String(page) });
            if (searchTermIngresos) params.append('q', searchTermIngresos);
            if (filterTipo) params.append('tipo', filterTipo);
            if (filterDesde) params.append('desde', filterDesde);
            if (filterHasta) params.append('hasta', filterHasta);
            const response = await axios.get(`/api/admin/ingresos?${params.toString()}`);
            setIngresos(response.data.data || []);
            setIngresosMeta({
                current_page: response.data.current_page || 1,
                last_page: response.data.last_page || 1,
                total: response.data.total || 0
            });
        } catch (error) {
            console.error('Error al cargar ingresos:', error);
        } finally {
            setHistorialLoading(false);
        }
    };

    const fetchEquipment = async () => {
        try {
            const response = await axios.get('/api/admin/equipment');
            setEquipmentList(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error('Error al refrescar equipos:', error);
        }
    };

    // Descarga el comprobante PDF del equipo indicado (portero ve cualquiera).
    const handleDescargarComprobante = async (item) => {
        try {
            await downloadComprobante(item.id_ingreso_equipo);
        } catch (error) {
            console.error('Error al descargar comprobante:', error);
            showAlert(error.response?.status === 403
                ? 'No tienes permiso para descargar este comprobante.'
                : 'No se pudo descargar el comprobante. Intenta de nuevo.', 'error');
        }
    };

    // Marca un equipo como devuelto (POST /api/admin/equipment/{id}/return + recarga).
    const handleDevolverEquipo = async (id) => {
        const confirmed = await showConfirm('¿Marcar este equipo como devuelto?');
        if (!confirmed) return;
        try {
            const response = await axios.post(`/api/admin/equipment/${id}/return`);
            await fetchEquipment();
            showAlert(response.data.message || 'Equipo devuelto con éxito');
        } catch (error) {
            showAlert('Error al devolver equipo: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    // Elimina un equipo (DELETE /api/admin/equipment/{id} + error real).
    const handleEliminarEquipo = async (id) => {
        const confirmed = await showConfirm('¿Estás seguro de eliminar este equipo?');
        if (!confirmed) return;
        try {
            const response = await axios.delete(`/api/admin/equipment/${id}`);
            setEquipmentList(equipmentList.filter(item => item.id_ingreso_equipo !== id));
            showAlert(response.data.message || 'Equipo eliminado');
        } catch (error) {
            showAlert('Error al eliminar equipo: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (profileErrors[e.target.name]) {
            setProfileErrors(prev => {
                const next = { ...prev };
                delete next[e.target.name];
                return next;
            });
        }
    };

    // Guarda el perfil en PUT /api/my-profile. Si cambia la clave con 2FA
    // activo, el backend pide el código de 6 dígitos del correo.
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            data.append('user_identification', formData.user_identification);
            data.append('user_name', formData.user_name);
            data.append('user_lastname', formData.user_lastname);
            data.append('user_email', formData.user_email);
            if (formData.user_password) data.append('user_password', formData.user_password);
            if (codigo2fa) data.append('two_factor_code', codigo2fa);
            if (fotoBlob) data.append('image', fotoBlob, 'foto.jpg');
            data.append('_method', 'PUT');

            const response = await axios.post('/api/my-profile', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCurrentUser(response.data);
            showAlert('Perfil actualizado con éxito');
            setProfileErrors({});
            setEditingProfile(false);
            setFotoBlob(null);
            setFotoPreview(null);
            setArchivoRecorte(null);
            setCodigo2fa('');
            setCodigoSolicitado(false);
        } catch (error) {
            if (error.response?.data?.errors) setProfileErrors(error.response.data.errors);
            if (error.response?.data?.errors?.two_factor_code) {
                setCodigoSolicitado(true);
                showAlert(error.response?.data?.message || 'Revisa tu correo e ingresa el código de 6 dígitos.');
            } else {
                showAlert('Error al actualizar perfil: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
            }
        }
    };

    const cancelarEdicionPerfil = () => {
        setEditingProfile(false);
        setFotoBlob(null);
        setFotoPreview(null);
        setArchivoRecorte(null);
        setCodigo2fa('');
        setCodigoSolicitado(false);
    };

    const profileFieldError = (name) => (
        profileErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{profileErrors[name][0]}</div> : null
    );

    // Nav espeja el dock del portero móvil (Inicio·Validar·Equipos·Historial).
    // EXCUSAS valida PIN y VALIDAR QR el QR de invitado (en el móvil van unificados).
    const porteroLinks = [
        { label: 'DASHBOARD', icon: 'dashboard', view: 'dashboard' },
        { label: 'EXCUSAS', icon: 'key', view: 'excusas' },
        { label: 'VALIDAR QR', icon: 'qr_code_scanner', view: 'validar_qr' },
        { label: 'EQUIPOS', icon: 'inventory_2', view: 'equipos' },
        { label: 'HISTORIAL DE ACCESOS', icon: 'history', view: 'historial' },
        { label: 'MI CARNET', icon: 'id_card', view: 'qr_carnet' },
        { label: 'ACCESO QR', icon: 'qr_code_2', view: 'acceso_qr' }
    ];

    const filteredEquipment = equipmentList.filter(item => {
        const search = searchTermEquipment.toLowerCase();
        return (
            `${item.equipo_type || ''} ${item.equipo_brand || ''} ${item.equipo_serial || ''}`.toLowerCase().includes(search) ||
            `${item.user?.user_name || ''} ${item.user?.user_lastname || ''}`.toLowerCase().includes(search) ||
            (item.user?.user_email || '').toLowerCase().includes(search)
        );
    });

    const renderView = () => {
        if (editingProfile) {
            return (
                <div className="fade-in-up">
                    <div className="glass-box p-4 mb-5 mx-auto fade-in-up" style={{ maxWidth: '600px' }}>
                        <div className="section-header">
                            <h3 className="mb-0">Editar Mi Perfil</h3>
                        </div>
                        <div className="admin-scrollable-container" style={{ maxHeight: '55vh' }}>
                            <form onSubmit={handleUpdateProfile}>
                                <div className="text-center mb-3">
                                    <div className="rounded-circle bg-success mx-auto d-flex align-items-center justify-content-center mb-2 shadow overflow-hidden" style={{ width: '100px', height: '100px', fontSize: '2rem', fontWeight: 'bold' }}>
                                        {fotoPreview ? (
                                            <img src={fotoPreview} alt="Nueva foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : formData.profile_photo_path ? (
                                            <img src={formData.profile_photo_path} alt="Foto actual" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <>{formData.user_name?.[0]}{formData.user_lastname?.[0]}</>
                                        )}
                                    </div>
                                    <label className="btn btn-outline-success btn-sm">
                                        <span className="material-symbols-outlined small me-1">photo_camera</span> Cambiar foto
                                        <input type="file" accept="image/*" hidden onChange={(e) => {
                                            if (e.target.files?.[0]) setArchivoRecorte(e.target.files[0]);
                                            e.target.value = '';
                                        }} />
                                    </label>
                                    {profileFieldError('image')}
                                </div>
                                {archivoRecorte && (
                                    <RecorteFoto
                                        archivo={archivoRecorte}
                                        alCancelar={() => setArchivoRecorte(null)}
                                        alConfirmar={(blob) => {
                                            setFotoBlob(blob);
                                            setFotoPreview(URL.createObjectURL(blob));
                                            setArchivoRecorte(null);
                                        }}
                                    />
                                )}
                                <div className="row">
                                    <div className="col-12 mb-3">
                                        <label className="form-label opacity-75 small">N° Documento</label>
                                        <input type="text" name="user_identification" className={`form-control ${profileErrors.user_identification ? 'is-invalid' : ''}`} value={formData.user_identification} onChange={handleChange} required />
                                        {profileFieldError('user_identification')}
                                    </div>
                                    <div className="col-12 mb-3">
                                        <label className="form-label opacity-75 small">Nombre</label>
                                        <input type="text" name="user_name" className={`form-control ${profileErrors.user_name ? 'is-invalid' : ''}`} value={formData.user_name} onChange={handleChange} required />
                                        {profileFieldError('user_name')}
                                    </div>
                                    <div className="col-12 mb-3">
                                        <label className="form-label opacity-75 small">Apellido</label>
                                        <input type="text" name="user_lastname" className={`form-control ${profileErrors.user_lastname ? 'is-invalid' : ''}`} value={formData.user_lastname} onChange={handleChange} required />
                                        {profileFieldError('user_lastname')}
                                    </div>
                                    <div className="col-12 mb-3">
                                        <label className="form-label opacity-75 small">Email Institucional</label>
                                        <input type="email" name="user_email" className={`form-control ${profileErrors.user_email ? 'is-invalid' : ''}`} value={formData.user_email} onChange={handleChange} required />
                                        {profileFieldError('user_email')}
                                    </div>
                                    <div className="col-12 mb-3">
                                        <label className="form-label opacity-75 small">Nueva Contraseña (Opcional)</label>
                                        <input type="password" name="user_password" placeholder="Mínimo 6 caracteres..." className={`form-control ${profileErrors.user_password ? 'is-invalid' : ''}`} value={formData.user_password} onChange={handleChange} />
                                        {profileFieldError('user_password')}
                                        <small className="opacity-50">Si tienes verificación en dos pasos activa, al guardar se enviará un código de 6 dígitos a tu correo.</small>
                                    </div>
                                    {codigoSolicitado && (
                                        <div className="col-12 mb-3">
                                            <label className="form-label opacity-75 small">Código de 6 dígitos (enviado a tu correo)</label>
                                            <input type="text" inputMode="numeric" maxLength="6" placeholder="123456" className={`form-control ${profileErrors.two_factor_code ? 'is-invalid' : ''}`} value={codigo2fa} onChange={(e) => setCodigo2fa(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                                            {profileFieldError('two_factor_code')}
                                        </div>
                                    )}
                                </div>
                                <div className="d-flex gap-2 mt-4">
                                    <button type="submit" className="btn btn-success action-btn flex-grow-1 py-2">
                                        <span className="material-symbols-outlined">save</span> Guardar Cambios
                                    </button>
                                    <button type="button" className="btn btn-outline-secondary action-btn px-4" onClick={cancelarEdicionPerfil}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            );
        }

        switch (view) {
            case 'dashboard':
                return <StatsDashboard currentUser={currentUser} />;
            case 'historial':
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                                <div className="section-header mb-0">
                                    <h3 className="mb-0">Historial de Accesos</h3>
                                    <p className="opacity-50 small mb-0">Total: {ingresosMeta.total} registros</p>
                                </div>
                                <div className="input-group search-input-group" style={{ maxWidth: '350px' }}>
                                    <span className="input-group-text">
                                        <span className="material-symbols-outlined">search</span>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Buscar usuario o lugar..."
                                        value={searchTermIngresos}
                                        onChange={(e) => setSearchTermIngresos(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') fetchIngresos(1); }}
                                    />
                                </div>
                            </div>

                            <div className="row g-2 mb-3 align-items-end">
                                <div className="col-12 col-md-3">
                                    <label className="form-label opacity-75 small mb-1">Tipo</label>
                                    <select className="form-select" value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}>
                                        <option value="">Todos</option>
                                        <option value="Entrada">Entrada</option>
                                        <option value="Salida">Salida</option>
                                    </select>
                                </div>
                                <div className="col-6 col-md-3">
                                    <label className="form-label opacity-75 small mb-1">Desde</label>
                                    <input type="date" className="form-control" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)} />
                                </div>
                                <div className="col-6 col-md-3">
                                    <label className="form-label opacity-75 small mb-1">Hasta</label>
                                    <input type="date" className="form-control" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)} />
                                </div>
                                <div className="col-12 col-md-3 d-flex gap-2">
                                    <button className="btn btn-success action-btn flex-grow-1" onClick={() => fetchIngresos(1)}>
                                        <span className="material-symbols-outlined small">filter_alt</span> Filtrar
                                    </button>
                                    <button className="btn btn-outline-secondary action-btn" onClick={() => { setSearchTermIngresos(''); setFilterTipo(''); setFilterDesde(''); setFilterHasta(''); fetchIngresos(1); }}>
                                        <span className="material-symbols-outlined small">restart_alt</span>
                                    </button>
                                </div>
                            </div>

                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '50vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            <th>Usuario</th>
                                            <th>Fecha y Hora</th>
                                            <th>Ubicación / Punto</th>
                                            <th>Tipo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {historialLoading ? (
                                            <tr><td colSpan="4" className="text-center py-4"><div className="spinner-border text-success" role="status"></div></td></tr>
                                        ) : ingresos.length > 0 ? ingresos.map(ingreso => (
                                            <tr key={ingreso.id_ingreso}>
                                                <td data-label="Usuario">
                                                    <div className="d-flex flex-column">
                                                        <span className="fw-bold">{ingreso.user?.user_name} {ingreso.user?.user_lastname}</span>
                                                        <span className="small opacity-50">{ingreso.user?.user_email}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Fecha y Hora">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <span className="material-symbols-outlined opacity-50" style={{ fontSize: '18px' }}>calendar_today</span>
                                                        {new Date(ingreso.ingreso_datetime).toLocaleString()}
                                                    </div>
                                                </td>
                                                <td data-label="Ubicación">
                                                    <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2" style={{ fontSize: '0.75rem' }}>
                                                        {ingreso.ingreso_place}
                                                    </span>
                                                </td>
                                                <td data-label="Tipo">
                                                    <span className={`badge px-3 py-2 ${ingreso.ingreso_type === 'Entrada' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${ingreso.ingreso_type === 'Entrada' ? 'text-success border-success' : 'text-warning border-warning'}`} style={{ fontSize: '0.75rem' }}>
                                                        {ingreso.ingreso_type}
                                                    </span>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="4" className="text-center py-4 opacity-50">No se encontraron registros de ingreso.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {ingresosMeta.last_page > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                                    <span className="small opacity-50">Página {ingresosMeta.current_page} de {ingresosMeta.last_page}</span>
                                    <div className="d-flex gap-2">
                                        <button className="btn btn-outline-success btn-sm" disabled={ingresosMeta.current_page <= 1} onClick={() => fetchIngresos(ingresosMeta.current_page - 1)}>
                                            <span className="material-symbols-outlined small">chevron_left</span> Anterior
                                        </button>
                                        <button className="btn btn-outline-success btn-sm" disabled={ingresosMeta.current_page >= ingresosMeta.last_page} onClick={() => fetchIngresos(ingresosMeta.current_page + 1)}>
                                            Siguiente <span className="material-symbols-outlined small">chevron_right</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'presentes':
                return <Presentes />;
            case 'excusas':
                return <Excusas currentUser={currentUser} rol="admin" />;
            case 'equipo_entry':
                return (
                    <div className="fade-in-up">
                        <button className="btn btn-outline-success btn-sm mb-3" onClick={() => setView('equipos')}>
                            <span className="material-symbols-outlined small">arrow_back</span> Volver al inventario
                        </button>
                        <EquipmentForm adminMode onSaved={fetchEquipment} />
                    </div>
                );
            case 'equipos':
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                                <div className="section-header mb-0">
                                    <h3 className="mb-0">Inventario de Equipos</h3>
                                    <p className="opacity-50 small mb-0">Total: {filteredEquipment.length} equipo(s)</p>
                                </div>
                                <div className="d-flex gap-2 flex-wrap align-items-center">
                                <button className="btn btn-success action-btn" onClick={() => setView('equipo_entry')}>
                                    <span className="material-symbols-outlined small">add_circle</span> Registrar equipo
                                </button>
                                <div className="input-group search-input-group" style={{ maxWidth: '300px' }}>
                                    <span className="input-group-text">
                                        <span className="material-symbols-outlined">search</span>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Buscar equipo, dueño o serial..."
                                        value={searchTermEquipment}
                                        onChange={(e) => setSearchTermEquipment(e.target.value)}
                                    />
                                </div>
                                </div>
                            </div>
                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '50vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            <th>Equipo</th>
                                            <th>Dueño</th>
                                            <th>Serial</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEquipment.length > 0 ? filteredEquipment.map(item => (
                                            <tr key={item.id_ingreso_equipo}>
                                                <td data-label="Equipo">
                                                    <span className="fw-bold">{item.equipo_type}</span>{' '}
                                                    <span className="small opacity-75">{item.equipo_brand} {item.equipo_model}</span>
                                                </td>
                                                <td data-label="Dueño">
                                                    <div className="d-flex flex-column">
                                                        <span>{item.user?.user_name} {item.user?.user_lastname}</span>
                                                        <span className="small opacity-50">{item.user?.user_email}</span>
                                                    </div>
                                                </td>
                                                <td data-label="Serial"><code>{item.equipo_serial}</code></td>
                                                <td data-label="Estado">
                                                    <span className={`badge px-3 py-2 ${item.equipo_status === 'Disponible' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${item.equipo_status === 'Disponible' ? 'text-success border-success' : 'text-warning border-warning'}`} style={{ fontSize: '0.75rem' }}>
                                                        {item.equipo_status}
                                                    </span>
                                                </td>
                                                <td data-label="Acciones">
                                                    <div className="d-flex gap-1 flex-wrap">
                                                        {item.equipo_status !== 'Disponible' && (
                                                            <button type="button" className="btn btn-outline-success btn-sm" onClick={() => handleDevolverEquipo(item.id_ingreso_equipo)} title="Marcar como devuelto">
                                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>keyboard_return</span>
                                                            </button>
                                                        )}
                                                        <button type="button" className="btn btn-outline-success btn-sm" onClick={() => handleDescargarComprobante(item)} title="Descargar comprobante PDF">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                                                        </button>
                                                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleEliminarEquipo(item.id_ingreso_equipo)} title="Eliminar equipo">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="5" className="text-center py-4 opacity-50">No hay equipos registrados.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'validar_qr':
                return <QrInvitado />;
            case 'qr_carnet':
                return <UserQrCarnet currentUser={currentUser} />;
            case 'acceso_qr':
                return <AccesoQr />;
            case 'profile':
                return (
                    <div className="fade-in-up glass-box p-5 mx-auto" style={{ maxWidth: '600px' }}>
                        <div className="text-center mb-4">
                            <div className="rounded-circle bg-success mx-auto d-flex align-items-center justify-content-center mb-3 shadow overflow-hidden" style={{ width: '100px', height: '100px', fontSize: '2.5rem', fontWeight: 'bold' }}>
                                {currentUser?.profile_photo_path ? (
                                    <img src={currentUser.profile_photo_path} alt="Profile" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <>{currentUser?.user_name[0]}{currentUser?.user_lastname[0]}</>
                                )}
                            </div>
                            <h3 className="mb-1">{currentUser?.user_name} {currentUser?.user_lastname}</h3>
                            <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 px-3 py-1">
                                {currentUser?.role?.rol_name || 'Usuario'}
                            </span>
                        </div>

                        <div className="row text-start mt-4 g-4">
                            <div className="col-12">
                                <label className="form-label opacity-50 small mb-1">Identificación</label>
                                <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10">
                                    {currentUser?.user_identification || 'No registrada'}
                                </div>
                            </div>
                            <div className="col-12">
                                <label className="form-label opacity-50 small mb-1">Correo Institucional</label>
                                <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10">
                                    {currentUser?.user_email}
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 pt-3 border-top border-success border-opacity-10">
                            <button className="btn btn-outline-success w-100 py-3 d-flex align-items-center justify-content-center gap-2" onClick={() => setEditingProfile(true)}>
                                <span className="material-symbols-outlined">edit</span>
                                Editar Información de Mi Perfil
                            </button>
                        </div>
                        <DosPasos />
                        <MiHuella />
                    </div>
                );
            default: return null;
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
                <div className="spinner-border text-success" role="status">
                    <span className="visually-hidden">Cargando...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="d-flex flex-column min-vh-100">
            <Navbar currentUser={currentUser} view={view} setView={(newView) => {
                setView(newView);
                setEditingProfile(false);
            }} links={porteroLinks} />
            <main className="container-fluid px-3 px-md-5 py-4 flex-grow-1">{renderView()}</main>
            <Footer />
        </div>
    );
};

export default Portero;
