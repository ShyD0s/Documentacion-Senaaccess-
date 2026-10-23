import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import Navbar from './Navbar';
import StatsDashboard from './StatsDashboard';
import Excusas from './Excusas';
import DosPasos from './DosPasos';
import MiHuella from './MiHuella';
import UserQrCarnet from './UserQrCarnet';
import EscanearAcceso from './EscanearAcceso';
import RecorteFoto from './RecorteFoto';
import { showAlert } from './CustomAlert';
import downloadComprobante from '../utils/comprobante';
import { mensajeDeError } from '../utils/mensajes';

const Aprendiz = () => {
    const navigate = useNavigate();
    const [currentUser, setCurrentUser] = useState(null);
    const [view, setView] = useState('dashboard'); // 'dashboard', 'comprobantes', 'profile'
    const [ingresos, setIngresos] = useState([]);
    const [equipmentList, setEquipmentList] = useState([]);
    const [loading, setLoading] = useState(true);
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
        user_password: '',
        user_coursenumber: '',
        user_program: ''
    });

    useEffect(() => { // Logica para cargar los datos del usuario, haciendo el uso de useEffect
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const [userMeResponse, ingresosResponse, equipmentResponse] = await Promise.all([ // Realiza múltiples solicitudes al backend para obtener la información del usuario, sus ingresos y los equipos registrados, utilizando Promise.all para optimizar la carga de datos y reducir el tiempo de espera
                    axios.get('/api/user'),
                    axios.get('/api/my-ingresos'),
                    axios.get('/api/my-equipment')
                ]);

                setCurrentUser(userMeResponse.data);
                setIngresos(ingresosResponse.data);
                setEquipmentList(equipmentResponse.data);

                setFormData({ // Set inicial del formulario de edición de perfil con los datos obtenidos del backend, permitiendo que el usuario vea su información actual y pueda editarla fácilmente sin tener que ingresar todos los datos desde cero
                    user_identification: userMeResponse.data.user_identification || '',
                    user_name: userMeResponse.data.user_name,
                    user_lastname: userMeResponse.data.user_lastname,
                    user_email: userMeResponse.data.user_email,
                    user_password: '',
                    user_coursenumber: userMeResponse.data.user_coursenumber,
                    user_program: userMeResponse.data.user_program,
                    profile_photo_path: userMeResponse.data.profile_photo_path || null
                });
            } catch (error) { // catch para manejar errores en la carga de los datos 
                console.error('Error cargando datos: ', error);
                if (error.response && error.response.status === 401) {
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('user_role');
                    navigate('/login');
                } else {
                    // La API ya explica el problema (por ejemplo, limite de
                    // intentos): se muestra su mensaje y no un error tecnico.
                    showAlert(mensajeDeError(error, 'No se pudieron cargar los datos del panel.'), 'error');
                }
            } finally { // Finally para asegurar que el estado de carga se actualice correctamente independientemente de si la solicitud fue exitosa o si ocurrió un error, evitando que la interfaz quede en un estado de carga indefinido
                setLoading(false);
            }
        };
        fetchData();
    }, [navigate]);

    // Descarga el comprobante PDF del equipo indicado.
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

    // Refresca los datos de la vista actual al cambiar de vista y al enfocar la pestaña,
    // para que los cambios hechos por otros roles se reflejen sin recargar la página.
    useEffect(() => {
        const refreshViewData = async () => {
            if (view === 'historial') {
                try {
                    const response = await axios.get('/api/my-ingresos');
                    setIngresos(response.data);
                } catch (error) {
                    console.error('Error al refrescar ingresos:', error);
                }
            } else if (view === 'comprobantes') {
                try {
                    const response = await axios.get('/api/my-equipment');
                    setEquipmentList(response.data);
                } catch (error) {
                    console.error('Error al refrescar equipos:', error);
                }
            }
        };
        refreshViewData();
        const onFocus = () => refreshViewData();
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [view]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        if (profileErrors[e.target.name]) {
            setProfileErrors(prev => {
                const next = { ...prev };
                delete next[e.target.name];
                return next;
            });
        }
    };

    // Guarda el perfil en PUT /api/my-profile (multipart + _method=PUT).
    // Si cambia la clave con 2FA activo, el backend responde 422 con
    // errors.two_factor_code y envia el codigo al correo: se muestra el
    // campo del codigo y al reenviar se incluye two_factor_code.
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
            data.append('user_coursenumber', formData.user_coursenumber);
            data.append('user_program', formData.user_program);
            if (fotoBlob) data.append('image', fotoBlob, 'foto.jpg');
            data.append('_method', 'PUT');

            const response = await axios.post('/api/my-profile', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
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
            if (error.response?.data?.errors) {
                setProfileErrors(error.response.data.errors);
            }
            if (error.response?.data?.errors?.two_factor_code) {
                setCodigoSolicitado(true);
                showAlert(error.response?.data?.message || 'Revisa tu correo e ingresa el código de 6 dígitos.');
            } else {
                showAlert('Error al actualizar perfil: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
            }
        }
    };

    // Limpia el formulario de perfil (foto recortada y codigo 2FA incluidos).
    const cancelarEdicionPerfil = () => {
        setEditingProfile(false);
        setFotoBlob(null);
        setFotoPreview(null);
        setArchivoRecorte(null);
        setCodigo2fa('');
        setCodigoSolicitado(false);
    };

    if (loading) return <div className="text-white text-center mt-5">Cargando...</div>;

    const profileFieldError = (name) => (
        profileErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{profileErrors[name][0]}</div> : null
    );

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
                                    <div className="rounded-circle bg-success mx-auto d-flex align-items-center justify-content-center mb-2 shadow overflow-hidden" style={{ width: '100px', height: '100px', fontSize: '2rem', fontWeight: 'bold', color: '#000' }}>
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
                                    <div className="col-12 mb-3">
                                        <label className="form-label opacity-75 small">Ficha</label>
                                        <input type="number" name="user_coursenumber" className={`form-control ${profileErrors.user_coursenumber ? 'is-invalid' : ''}`} value={formData.user_coursenumber} onChange={handleChange} required />
                                        {profileFieldError('user_coursenumber')}
                                    </div>
                                    <div className="col-12 mb-3">
                                        <label className="form-label opacity-75 small">Programa</label>
                                        <input type="text" name="user_program" className={`form-control ${profileErrors.user_program ? 'is-invalid' : ''}`} value={formData.user_program} onChange={handleChange} required />
                                        {profileFieldError('user_program')}
                                    </div>
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
            case 'comprobantes':
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                            <div className="section-header">
                                <h3 className="mb-0">Mis Comprobantes de Equipo</h3>
                                <p className="opacity-50 small">Registros de tus dispositivos ingresados al centro</p>
                            </div>
                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '50vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            <th>Equipo</th>
                                            <th>Marca/Modelo</th>
                                            <th>Serial</th>
                                            <th>Propiedad</th>
                                            <th>Accesorios</th>
                                            <th>Ingreso / Devolución</th>
                                            <th>Estado</th>
                                            <th>Comprobante</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {equipmentList.length > 0 ? equipmentList.map(item => (
                                            <tr key={item.id_ingreso_equipo}>
                                                <td data-label="Equipo"><span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25">{item.equipo_type}</span></td>
                                                <td data-label="Marca/Modelo">{item.equipo_brand} {item.equipo_model}</td>
                                                <td data-label="Serial"><code>{item.equipo_serial}</code></td>
                                                <td data-label="Propiedad">
                                                    <span className={`badge px-3 py-2 ${item.equipo_propiedad === 'Propio' ? 'bg-info' : 'bg-secondary'} bg-opacity-10 border border-opacity-25 ${item.equipo_propiedad === 'Propio' ? 'text-info border-info' : 'text-secondary border-secondary'}`} style={{ fontSize: '0.75rem' }}>
                                                        {item.equipo_propiedad === 'Propio' ? 'Propio' : 'Prestado'}
                                                    </span>
                                                </td>
                                                <td data-label="Accesorios" className="small opacity-75">
                                                    {(item.equipo_accesorios || []).map(a => a?.tipo).filter(Boolean).join(', ') || '—'}
                                                </td>
                                                <td data-label="Ingreso / Devolución" className="small opacity-75">
                                                    <div className="d-flex flex-column">
                                                        <span>Ingreso: {new Date(item.entry_datetime).toLocaleString()}</span>
                                                        {item.equipo_return_datetime && (
                                                            <span className="text-success">Devolución: {new Date(item.equipo_return_datetime).toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td data-label="Estado">
                                                    <span className={`badge px-3 py-2 ${item.equipo_status === 'Disponible' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${item.equipo_status === 'Disponible' ? 'text-success border-success' : 'text-warning border-warning'}`} style={{ fontSize: '0.75rem' }}>
                                                        {item.equipo_status}
                                                    </span>
                                                </td>
                                                <td data-label="Comprobante">
                                                    <button type="button" className="action-btn btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1" onClick={() => handleDescargarComprobante(item)} title="Descargar comprobante PDF">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span> PDF
                                                    </button>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="8" className="text-center py-4 opacity-50">No tienes equipos registrados.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'historial':
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1000px' }}>
                            <div className="section-header">
                                <h3 className="mb-0">Mi Historial de Accesos</h3>
                                <p className="opacity-50 small">Registros de tus ingresos al centro de formación</p>
                            </div>
                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '50vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            <th>Fecha y Hora</th>
                                            <th>Ubicación / Punto</th>
                                            <th>Tipo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ingresos.length > 0 ? ingresos.map(ingreso => (
                                            <tr key={ingreso.id_ingreso}>
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
                                            <tr>
                                                <td colSpan="3" className="text-center py-4 opacity-50">No se encontraron registros de ingreso.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'permisos':
                return <Excusas currentUser={currentUser} rol="aprendiz" />;
            case 'qr_carnet':
                return <UserQrCarnet currentUser={currentUser} />;
            case 'escanear_acceso':
                return <EscanearAcceso />;
            case 'profile':
                return (
                    <div className="fade-in-up glass-box p-5 mx-auto" style={{ maxWidth: '600px' }}>
                        <div className="text-center mb-4">
                            <div className="rounded-circle bg-success mx-auto d-flex align-items-center justify-content-center mb-3 shadow overflow-hidden" style={{ width: '100px', height: '100px', fontSize: '2.5rem', fontWeight: 'bold', color: '#000' }}>
                                {currentUser?.profile_photo_path ? (
                                    <img src={currentUser.profile_photo_path} alt="Profile" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <>{currentUser?.user_name?.[0]}{currentUser?.user_lastname?.[0]}</>
                                )}
                            </div>
                            <h3 className="mb-1">{currentUser?.user_name} {currentUser?.user_lastname}</h3>
                            <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50 px-3 py-1">
                                {currentUser?.role?.rol_name || 'Aprendiz'}
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
                            <div className="col-md-6">
                                <label className="form-label opacity-50 small mb-1">Ficha</label>
                                <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10">
                                    {currentUser?.user_coursenumber}
                                </div>
                            </div>
                            <div className="col-md-6">
                                <label className="form-label opacity-50 small mb-1">Programa</label>
                                <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10">
                                    {currentUser?.user_program}
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
            default:
                return null;
        }
    };

    const aprendizLinks = [ // Definicion de enlaces para el navbar (espejo del dock móvil: Inicio·Excusas·Historial·Equipos)
        { label: 'DASHBOARD', icon: 'dashboard', view: 'dashboard' },
        { label: 'MIS PERMISOS', icon: 'key', view: 'permisos' },
        { label: 'HISTORIAL DE ACCESOS', icon: 'history', view: 'historial' },
        { label: 'MIS EQUIPOS', icon: 'inventory_2', view: 'comprobantes' },
        { label: 'MI CARNET', icon: 'id_card', view: 'qr_carnet' },
        { label: 'MARCAR ACCESO', icon: 'qr_code_scanner', view: 'escanear_acceso' }
    ];

    return ( // Estructura principal
        <div className="min-vh-100 d-flex flex-column fade-in-up" style={{ background: 'transparent' }}>
            <Navbar
                currentUser={currentUser}
                view={view}
                setView={(newView) => {
                    setView(newView);
                    setEditingProfile(false);
                }}
                links={aprendizLinks}
            />

            <main className="container-fluid px-3 px-md-5 py-2 flex-grow-1">
                {renderView()}
            </main>

            <Footer />
        </div>
    );
};

export default Aprendiz;
