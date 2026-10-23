import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Footer from './Footer';
import Navbar from './Navbar';
import Novedades from './Novedades';
import StatsDashboard from './StatsDashboard';
import EquipmentForm from './EquipmentForm';
import Ambientes from './Ambientes';
import Excusas from './Excusas';
import Presentes from './Presentes';
import QrInvitado from './QrInvitado';
import QrScannerModal from './QrScannerModal';
import DosPasos from './DosPasos';
import MiHuella from './MiHuella';
import RecorteFoto from './RecorteFoto';
import { showAlert, showConfirm } from './CustomAlert';
import downloadComprobante from '../utils/comprobante';
import { mensajeDeError } from '../utils/mensajes';

// Columnas disponibles para exportar el historial (mismo orden del backend).
const EXPORT_COLUMNAS = [
    { key: 'usuario', label: 'Usuario' },
    { key: 'email', label: 'Correo' },
    { key: 'identificacion', label: 'Identificación' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'lugar', label: 'Lugar' },
    { key: 'fecha', label: 'Fecha y Hora' },
];

const Admin = () => {
    // HOOK: useNavigate se emplea para redirigir al Login si el usuario no tiene una sesión activa o el token expira.
    const navigate = useNavigate();
    const carouselRef = useRef(null);
    const userFormRef = useRef(null);
    // HOOK: useState se utiliza de forma intensiva para mantener el estado de la aplicación: usuario logueado, la vista renderizada en el panel, listas de datos desde la API y estados de carga.
    const [currentUser, setCurrentUser] = useState(null);
    const [view, setView] = useState('dashboard'); // 'dashboard', 'historial', 'users', 'profile'
    const [userFilter, setUserFilter] = useState('all'); // 'all', 'Instructor', 'Aprendiz'
    const [users, setUsers] = useState([]); // Lista de usuarios
    // Página actual del carrusel de usuarios (paginada en servidor).
    const [usuariosPagina, setUsuariosPagina] = useState([]);
    const [usuariosTotal, setUsuariosTotal] = useState(0);
    const [usuariosUltima, setUsuariosUltima] = useState(1);
    const [usuariosPag, setUsuariosPag] = useState(1);
    const [pendientesCount, setPendientesCount] = useState(0); // Badge de la bandeja Pendientes
    const [usuariosCargando, setUsuariosCargando] = useState(false);
    const [usersSearchDeb, setUsersSearchDeb] = useState(''); // Búsqueda con debounce
    const usuariosPagRef = useRef(1); // Página vigente para refrescos (evita closures viejos)
    const [roles, setRoles] = useState([]); // Lista de roles
    const [ingresos, setIngresos] = useState([]); // Lista de ingresos
    const [loading, setLoading] = useState(true); // Estado de carga
    const [editingUser, setEditingUser] = useState(null); // Usuario que se está editando
    const [creatingUser, setCreatingUser] = useState(false); // Formulario en modo crear
    const [searchTermUsers, setSearchTermUsers] = useState(''); // Busqueda de usuarios
    const [isQrScannerOpen, setIsQrScannerOpen] = useState(false); // Escáner de carnet digital
    const [searchTermIngresos, setSearchTermIngresos] = useState('');   // Busqueda de ingresos
    const [filterTipo, setFilterTipo] = useState('');                    // Filtro por tipo (Entrada/Salida)
    const [filterDesde, setFilterDesde] = useState('');                  // Filtro por fecha desde
    const [filterHasta, setFilterHasta] = useState('');                  // Filtro por fecha hasta
    const [ingresosMeta, setIngresosMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [historialLoading, setHistorialLoading] = useState(false);
    const [searchTermEquipment, setSearchTermEquipment] = useState(''); // Busqueda de equipos
    const [equipmentList, setEquipmentList] = useState([]);
    const [equipoRolFilter, setEquipoRolFilter] = useState(''); // Filtro por rol en historial de equipos
    const [equipoSort, setEquipoSort] = useState({ key: 'ingreso', dir: 'desc' }); // Orden de la tabla de equipos
    const [directorioTab, setDirectorioTab] = useState('instructores'); // 'instructores' | 'aprendices'
    const [exportModalOpen, setExportModalOpen] = useState(false); // Modal de exportación del historial
    const [exportFormato, setExportFormato] = useState('csv');      // Formato de exportación (csv/xlsx/pdf)
    const [exportCols, setExportCols] = useState([]);               // Columnas elegidas para exportar
    const [exportando, setExportando] = useState(false);            // Estado de la descarga en curso
    const [formData, setFormData] = useState({
        user_identification: '',
        user_name: '',
        user_lastname: '',
        user_email: '',
        user_password: '',
        user_coursenumber: '',
        user_program: '',
        user_documento_tipo: 'CC',
        user_telefono: '',
        fk_id_rol: ''
    });
    const [formErrors, setFormErrors] = useState({}); // Errores de validación por campo
    const [perfilArchivo, setPerfilArchivo] = useState(null); // Foto elegida para recortar
    const [claveNueva, setClaveNueva] = useState(''); // Nueva contraseña del admin
    const [codigo2faAdm, setCodigo2faAdm] = useState(''); // Código 2FA del correo
    const [codigoSolicitadoAdm, setCodigoSolicitadoAdm] = useState(false); // Backend pidió el código

    // Desplaza la vista hasta el formulario al iniciar la edición o creación de un usuario
    useEffect(() => {
        if (editingUser || creatingUser) {
            const timer = setTimeout(() => {
                userFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [editingUser, creatingUser]);

    // Página del carrusel de usuarios desde el servidor (24 por página,
    // con búsqueda y rol filtrados allá, no en el navegador).
    const fetchUsers = async (page) => {
        const p = page || usuariosPagRef.current || 1;
        setUsuariosCargando(true);
        try {
            const params = new URLSearchParams();
            params.append('per_page', '24');
            params.append('page', String(p));
            if (usersSearchDeb) params.append('search', usersSearchDeb);
            if (userFilter !== 'all' && userFilter !== 'pendientes') params.append('rol', userFilter);
            if (userFilter === 'pendientes') params.append('estado', 'pendiente');
            const resp = await axios.get(`/api/admin/users?${params.toString()}`);
            setUsuariosPagina(resp.data.data || []);
            setUsuariosTotal(resp.data.total || 0);
            setUsuariosUltima(resp.data.last_page || 1);
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
        } finally {
            setUsuariosCargando(false);
        }
    };

    // Escáner de carnet digital (paridad Sebastián): el QR trae JSON SENA_ACCESS;
    // se busca por identificación y se filtra el listado por identificación.
    const handleQrScan = (rawData) => {
        setIsQrScannerOpen(false);
        try {
            const parsed = JSON.parse(rawData);
            if (parsed.app === 'SENA_ACCESS' && parsed.user_identification) {
                setSearchTermUsers(parsed.user_identification);
            } else {
                setSearchTermUsers(rawData.trim());
            }
        } catch {
            setSearchTermUsers(rawData.trim());
        }
        setUserFilter('all');
        setView('users');
        showAlert('Búsqueda aplicada desde el carnet escaneado');
    };

    // Refresca los datos de la vista actual al cambiar de vista y al enfocar la pestaña,
    // para que los cambios hechos por otros roles se reflejen sin recargar la página.
    const refreshViewData = async () => {
        // Usuarios lo cubre el efecto de paginación (view/página/búsqueda/filtro).
        if (view === 'historial') {
            await fetchIngresos(1);
        } else if (view === 'historial_equipos') {
            await fetchEquipment();
        }
    };

    // Badge de pendientes: cuenta solicitudes sin entrar a la bandeja.
    const fetchPendientesCount = async () => {
        try {
            const { data } = await axios.get('/api/admin/users?estado=pendiente&per_page=1');
            setPendientesCount(data.total || 0);
        } catch (_) { /* el badge se queda en 0 */ }
    };

    useEffect(() => {
        refreshViewData();
        if (view === 'users') fetchPendientesCount();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]);

    useEffect(() => {
        // Al volver a la pestaña se re-pide solo la página visible de usuarios.
        const onFocus = () => {
            if (view === 'users') fetchUsers();
            else refreshViewData();
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view]);

    // Debounce de 400 ms en la búsqueda de usuarios: no dispara un GET por tecla.
    useEffect(() => {
        const t = setTimeout(() => {
            setUsersSearchDeb(searchTermUsers.trim());
            setUsuariosPag(1);
            usuariosPagRef.current = 1;
        }, 400);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTermUsers]);

    // La página del carrusel vive en el servidor: buscar, filtrar o paginar
    // re-pide solo 24 filas en vez de refiltrar todo en el navegador.
    useEffect(() => {
        if (view === 'users' && !editingUser && !creatingUser) {
            usuariosPagRef.current = usuariosPag;
            fetchUsers(usuariosPag);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [view, usuariosPag, usersSearchDeb, userFilter]);

    const fetchEquipment = async () => {
        try {
            const response = await axios.get('/api/admin/equipment');
            setEquipmentList(response.data);
        } catch (error) {
            console.error("Error al refrescar lista:", error);
        }
    }

    // Descarga el comprobante PDF del equipo indicado (el admin puede descargar cualquiera).
    const handleDescargarComprobante = async (item) => {
        try {
            await downloadComprobante(item.id_ingreso_equipo);
        } catch (error) {
            console.error('Error al descargar comprobante:', error);
            showAlert(error.response?.status === 403
                ? 'No tienes permiso para descargar este comprobante.'
                : 'No se pudo descargar el comprobante. Intenta de nuevo.', 'error');
        }
    }

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

    const fetchIngresos = async (page = 1) => {
        try {
            setHistorialLoading(true);
            const params = new URLSearchParams({ page: String(page) });
            if (searchTermIngresos) params.append('q', searchTermIngresos);
            if (filterTipo) params.append('tipo', filterTipo);
            if (filterDesde) params.append('desde', filterDesde);
            if (filterHasta) params.append('hasta', filterHasta);

            const response = await axios.get(`/api/admin/ingresos?${params.toString()}`);
            setIngresos(response.data.data);
            setIngresosMeta({
                current_page: response.data.current_page,
                last_page: response.data.last_page,
                total: response.data.total,
            });
        } catch (error) {
            console.error("Error al cargar ingresos:", error);
        } finally {
            setHistorialLoading(false);
        }
    }

    // HOOK: useEffect se ejecuta al montarse el componente. Es fundamental para simular la carga de datos inicial realizando peticiones a la API para obtener roles, usuarios, ingresos y validar la sesión.
    useEffect(() => {

        const fetchData = async () => {
            try {
                const token = localStorage.getItem('access_token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const [usersResponse, rolesResponse, userMeResponse, equipmentResponse] = await Promise.all([
                    axios.get('/api/admin/users'),
                    axios.get('/api/admin/roles'),
                    axios.get('/api/user'),
                    axios.get('/api/admin/equipment')
                ]);
                setUsers(usersResponse.data);
                setRoles(rolesResponse.data);
                setCurrentUser(userMeResponse.data);
                setEquipmentList(equipmentResponse.data);
                await fetchIngresos(1);
            } catch (error) {
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
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // El carrusel de usuarios ya viene filtrado y paginado del servidor
    // (fetchUsers con search/rol); aquí no se refiltra nada en el navegador.
    const filteredUsers = usuariosPagina;

    // Los ingresos ya vienen filtrados y paginados desde el servidor (/api/admin/ingresos)
    const filteredIngresos = ingresos;

    // Instructores disponibles para asignar a un aprendiz (lista de directorio).
    const instructors = useMemo(
        () => users.filter(user => user.role?.rol_name === 'Instructor'),
        [users]
    );

    // Filtro de instructores del directorio (sin ambientes)
    const filteredInstructors = instructors;

    // Filtro de aprendices del directorio
    const filteredAprendices = useMemo(
        () => users.filter(user => user.role?.rol_name === 'Aprendiz'),
        [users]
    );

    // Filtro de equipos por nombre, apellido, email, tipo de equipo, marca, modelo, color y serial
    const filteredEquipment = useMemo(() => equipmentList.filter(item => {
        const search = searchTermEquipment.toLowerCase();
        const userName = `${item.user?.user_name} ${item.user?.user_lastname}`.toLowerCase();
        return (
            userName.includes(search) ||
            item.equipo_type.toLowerCase().includes(search) ||
            item.equipo_brand.toLowerCase().includes(search) ||
            item.equipo_serial.toLowerCase().includes(search) ||
            item.user?.user_identification?.toLowerCase().includes(search)
        );
    }), [equipmentList, searchTermEquipment]);

    const handleLogout = async () => {
        // Logica para el log-out asincronica 
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
    // Funcion para desplazar el carrusel
    const scrollCarousel = (direction) => {
        if (carouselRef.current) {
            const scrollAmount = 300;
            carouselRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };
    // Funcion para editar un usuario
    const handleEditClick = (user) => {
        setCreatingUser(false);
        setEditingUser(user.id_usuario);
        setFormData({
            user_identification: user.user_identification || '',
            user_name: user.user_name || '',
            user_lastname: user.user_lastname || '',
            user_email: user.user_email || '',
        user_password: '',
        user_coursenumber: user.user_coursenumber || '',
        user_program: user.user_program || '',
        user_documento_tipo: user.user_documento_tipo || 'CC',
        user_telefono: user.user_telefono || '',
        fk_id_rol: user.fk_id_rol || '',
        profile_photo_path: user.profile_photo_path || null
    });
};
// Funcion para cancelar la edicion o creación de un usuario
const handleCancelEdit = () => {
    setEditingUser(null);
    setCreatingUser(false);
    setFormErrors({});
    setFormData({
        user_identification: '',
        user_name: '',
        user_lastname: '',
        user_email: '',
        user_password: '',
        user_coursenumber: '',
        user_program: '',
        user_documento_tipo: 'CC',
        user_telefono: '',
        fk_id_rol: ''
    });
};
    // Funcion para cambiar un dato del formulario
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
    // Funcion para actualizar un usuario
    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });
            // Workaround para PUT con FormData en Laravel
            data.append('_method', 'PUT');

            const response = await axios.post(`/api/admin/users/${editingUser}`, data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }); // El metodo axios.post se usa para enviar los datos del formulario al backend.

            setUsers(users.map(u => u.id_usuario === editingUser ? response.data : u));
            fetchUsers(); // Refresca la página visible del carrusel

            // Si el usuario editado es el actual, actualizarlo también
            if (currentUser && currentUser.id_usuario === editingUser) {
                setCurrentUser(response.data);
            }

            showAlert('Usuario actualizado con éxito');
            handleCancelEdit();
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            }
            showAlert('Error al actualizar usuario: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };
    // Abre el mismo formulario de edición en modo crear
    const handleNewUser = () => {
        setEditingUser(null);
        setCreatingUser(true);
        setFormErrors({});
        setFormData({
            user_identification: '',
            user_name: '',
            user_lastname: '',
            user_email: '',
            user_password: '',
            user_coursenumber: '',
            user_program: '',
            user_documento_tipo: 'CC',
            user_telefono: '',
            fk_id_rol: ''
        });
    };
    // Funcion para crear un usuario (POST /api/admin/users, mismos campos que editar)
    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const data = new FormData();
            Object.keys(formData).forEach(key => {
                data.append(key, formData[key]);
            });

            const response = await axios.post('/api/admin/users', data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setUsers([...users, response.data]);
            fetchUsers(); // Refresca la página visible del carrusel
            showAlert('Usuario creado con éxito');
            handleCancelEdit();
        } catch (error) {
            if (error.response?.data?.errors) {
                setFormErrors(error.response.data.errors);
            }
            showAlert('Error al crear usuario: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };
    // Abre el modal para exportar el historial (formato + columnas a elegir).
    const abrirExportar = () => {
        setExportCols(EXPORT_COLUMNAS.map(c => c.key));
        setExportFormato('csv');
        setExportModalOpen(true);
    };

    // Alterna una columna en la selección de exportación.
    const toggleExportCol = (key) => {
        setExportCols(prev => prev.includes(key)
            ? prev.filter(c => c !== key)
            : [...prev, key]);
    };

    // Descarga el historial según el formato y las columnas elegidas.
    const descargarExportacion = async () => {
        try {
            setExportando(true);
            const params = new URLSearchParams();
            if (searchTermIngresos) params.append('q', searchTermIngresos);
            if (filterTipo) params.append('tipo', filterTipo);
            if (filterDesde) params.append('desde', filterDesde);
            if (filterHasta) params.append('hasta', filterHasta);
            params.append('formato', exportFormato);
            params.append('cols', exportCols.join(','));

            const response = await axios.get(`/api/admin/ingresos/export?${params.toString()}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const ext = exportFormato === 'xlsx' ? 'xlsx' : exportFormato === 'pdf' ? 'pdf' : 'csv';
            const link = document.createElement('a');
            link.href = url;
            link.download = `historial_ingresos_${new Date().toISOString().slice(0, 10)}.${ext}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            setExportModalOpen(false);
            showAlert('Exportación completada');
        } catch (error) {
            showAlert('Error al exportar: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        } finally {
            setExportando(false);
        }
    };

    // Funcion para eliminar un usuario
    // Bandeja de pendientes: aprueba (avisa al correo) o rechaza la solicitud.
    const handleAprobar = async (id) => {
        try {
            const { data } = await axios.post(`/api/admin/users/${id}/aprobar`);
            showAlert(data.message || 'Cuenta aprobada');
            fetchUsers();
            fetchPendientesCount();
        } catch (error) {
            showAlert(error.response?.data?.message || 'Error al aprobar', 'error');
        }
    };

    const handleRechazar = async (id) => {
        const confirmed = await showConfirm('¿Rechazar esta solicitud de cuenta?');
        if (!confirmed) return;
        try {
            const { data } = await axios.post(`/api/admin/users/${id}/rechazar`);
            showAlert(data.message || 'Solicitud rechazada');
            fetchUsers();
            fetchPendientesCount();
        } catch (error) {
            showAlert(error.response?.data?.message || 'Error al rechazar', 'error');
        }
    };

    const handleDelete = async (id) => {
        const confirmed = await showConfirm('¿Estás seguro de eliminar este usuario?');
        if (confirmed) {
            try {
                await axios.delete(`/api/admin/users/${id}`);
                setUsers(users.filter(u => u.id_usuario !== id));
                fetchUsers(); // Refresca la página visible del carrusel
                showAlert('Usuario eliminado');
            } catch (error) {
                showAlert('Error al eliminar usuario', 'error');
            }
        }
    };

    // Campos base del perfil propio para PUT /api/my-profile (multipart + _method=PUT).
    const datosBaseMiPerfil = () => {
        const data = new FormData();
        data.append('user_identification', currentUser.user_identification || '');
        data.append('user_name', currentUser.user_name || '');
        data.append('user_lastname', currentUser.user_lastname || '');
        data.append('user_email', currentUser.user_email || '');
        data.append('_method', 'PUT');
        return data;
    };

    // Sube la foto recortada (campo `image`, max 5MB) a mi perfil.
    const subirFotoMiPerfil = async (blob) => {
        try {
            const data = datosBaseMiPerfil();
            data.append('image', blob, 'foto.jpg');
            const response = await axios.post('/api/my-profile', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCurrentUser(response.data);
            setPerfilArchivo(null);
            showAlert('Foto de perfil actualizada');
        } catch (error) {
            const detalle = error.response?.data?.errors?.image?.[0];
            showAlert('Error al subir foto: ' + (detalle || error.response?.data?.message || 'Error desconocido'), 'error');
        }
    };

    // Cambia mi contraseña; con 2FA activo el backend envia un codigo de
    // 6 digitos al correo (422 + errors.two_factor_code) y se reenvia con el codigo.
    const cambiarClaveMiPerfil = async (e) => {
        e.preventDefault();
        try {
            const data = datosBaseMiPerfil();
            data.append('user_password', claveNueva);
            if (codigo2faAdm) data.append('two_factor_code', codigo2faAdm);
            const response = await axios.post('/api/my-profile', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setCurrentUser(response.data);
            setClaveNueva('');
            setCodigo2faAdm('');
            setCodigoSolicitadoAdm(false);
            showAlert('Contraseña actualizada');
        } catch (error) {
            if (error.response?.data?.errors?.two_factor_code) {
                setCodigoSolicitadoAdm(true);
                showAlert(error.response?.data?.message || 'Revisa tu correo e ingresa el código de 6 dígitos.');
            } else {
                showAlert('Error al cambiar contraseña: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
            }
        }
    };

    if (loading) return <div className="text-white text-center mt-5">Cargando...</div>;

    const fieldError = (name) => (
        formErrors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{formErrors[name][0]}</div> : null
    );

    // La ficha y el programa solo aplican al rol Aprendiz; admin e instructor no los tienen.
    const esRolAprendiz = roles.find(r => r.id_rol === formData.fk_id_rol)?.rol_name === 'Aprendiz';

    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <StatsDashboard currentUser={currentUser} />;
            case 'users':
                return (
                    <div className="fade-in-up">
                        {(editingUser || creatingUser) && (
                            <div ref={userFormRef} className="glass-box p-4 mb-5 mx-auto fade-in-up" style={{ maxWidth: '600px' }}>
                                <div className="section-header">
                                    <h3 className="mb-0">{creatingUser ? 'Crear Nuevo Usuario' : 'Editar Perfil de Usuario'}</h3>
                                </div>
                                <div className="admin-scrollable-container" style={{ maxHeight: '55vh' }}>
                                    <form onSubmit={creatingUser ? handleCreate : handleUpdate}>
                                        <div className="row">
                                            <div className="col-12 mb-3">

                                                <label className="form-label opacity-75 small">N° Documento</label>
                                                <input type="text" name="user_identification" className={`form-control ${formErrors.user_identification ? 'is-invalid' : ''}`} value={formData.user_identification} onChange={handleChange} required />
                                                {fieldError('user_identification')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Tipo de Documento</label>
                                                <select name="user_documento_tipo" className={`form-select ${formErrors.user_documento_tipo ? 'is-invalid' : ''}`} value={formData.user_documento_tipo} onChange={handleChange} required>
                                                    <option value="CC">CC: Cédula de Ciudadanía</option>
                                                    <option value="CE">CE: Cédula de Extranjería</option>
                                                    <option value="TI">TI: Tarjeta de Identidad</option>
                                                    <option value="PAS">PAS: Pasaporte</option>
                                                </select>
                                                {fieldError('user_documento_tipo')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Teléfono de contacto (opcional)</label>
                                                <input type="tel" name="user_telefono" className={`form-control ${formErrors.user_telefono ? 'is-invalid' : ''}`} value={formData.user_telefono} onChange={handleChange} />
                                                {fieldError('user_telefono')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Nombre</label>
                                                <input type="text" name="user_name" className={`form-control ${formErrors.user_name ? 'is-invalid' : ''}`} value={formData.user_name} onChange={handleChange} required />
                                                {fieldError('user_name')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Apellido</label>
                                                <input type="text" name="user_lastname" className={`form-control ${formErrors.user_lastname ? 'is-invalid' : ''}`} value={formData.user_lastname} onChange={handleChange} required />
                                                {fieldError('user_lastname')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Email Institucional</label>
                                                <input type="email" name="user_email" className={`form-control ${formErrors.user_email ? 'is-invalid' : ''}`} value={formData.user_email} onChange={handleChange} required />
                                                {fieldError('user_email')}
                                            </div>
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">{creatingUser ? 'Contraseña' : 'Seguridad (Opcional)'}</label>
                                                <input type="password" name="user_password" placeholder={creatingUser ? 'Contraseña obligatoria...' : 'Nueva contraseña...'} className={`form-control ${formErrors.user_password ? 'is-invalid' : ''}`} value={formData.user_password} onChange={handleChange} required={creatingUser} />
                                                {fieldError('user_password')}
                                            </div>
                                            {esRolAprendiz && (
                                                <>
                                                    <div className="col-12 mb-3">
                                                        <label className="form-label opacity-75 small">Ficha</label>
                                                        <input type="number" name="user_coursenumber" className={`form-control ${formErrors.user_coursenumber ? 'is-invalid' : ''}`} value={formData.user_coursenumber} onChange={handleChange} required />
                                                        {fieldError('user_coursenumber')}
                                                    </div>
                                                    <div className="col-12 mb-3">
                                                        <label className="form-label opacity-75 small">Programa</label>
                                                        <input type="text" name="user_program" className={`form-control ${formErrors.user_program ? 'is-invalid' : ''}`} value={formData.user_program} onChange={handleChange} required />
                                                        {fieldError('user_program')}
                                                    </div>
                                                </>
                                            )}
                                            <div className="col-12 mb-3">
                                                <label className="form-label opacity-75 small">Rol Asignado</label>
                                                <select name="fk_id_rol" className={`form-select ${formErrors.fk_id_rol ? 'is-invalid' : ''}`} value={formData.fk_id_rol} onChange={handleChange} required>
                                                    <option value="">Seleccione un rol</option>
                                                    {roles.map(role => (
                                                        <option key={role.id_rol} value={role.id_rol}>{role.rol_name}</option>
                                                    ))}
                                                </select>
                                                {fieldError('fk_id_rol')}
                                            </div>
                                        </div>
                                        <div className="d-flex gap-2 mt-4">
                                            <button type="submit" className="btn btn-success action-btn flex-grow-1 py-2">
                                                <span className="material-symbols-outlined">{creatingUser ? 'person_add' : 'save'}</span> {creatingUser ? 'Crear Usuario' : 'Actualizar Datos'}
                                            </button>
                                            <button type="button" className="btn btn-outline-secondary action-btn px-4" onClick={handleCancelEdit}>
                                                Cancelar
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {!editingUser && !creatingUser ? (
                            <div className="mx-auto" style={{ maxWidth: '1200px' }}>
                                <div className="d-flex justify-content-between align-items-center mb-5 flex-wrap gap-3 px-3 px-md-4">
                                    <div className="section-header mb-0">
                                        <h3 className="mb-0">Gestión de {userFilter === 'all' ? 'Usuarios' : userFilter === 'pendientes' ? 'Cuentas pendientes' : userFilter}</h3>
                                        <p className="small opacity-50 mb-0">Total: {usuariosTotal} registros{usuariosCargando ? ' • cargando…' : ''}</p>
                                    </div>
                                    <div className="d-flex gap-2 flex-wrap align-items-center">
                                        <button className="btn btn-success action-btn" onClick={handleNewUser}>
                                            <span className="material-symbols-outlined small">person_add</span> Nuevo usuario
                                        </button>
                                        <div className="btn-group" role="group" aria-label="Filtrar por rol">
                                            {[
                                                { key: 'all', label: 'Todos' },
                                                { key: 'pendientes', label: 'Pendientes' },
                                                { key: 'Instructor', label: 'Instructores' },
                                                { key: 'Aprendiz', label: 'Aprendices' },
                                                { key: 'Admin', label: 'Admins' },
                                                { key: 'Invitado', label: 'Invitados' }
                                            ].map(f => (
                                                <button
                                                    key={f.key}
                                                    type="button"
                                                    className={`btn btn-sm ${userFilter === f.key ? 'btn-success' : 'btn-outline-success'}`}
                                                    onClick={() => { setUserFilter(f.key); setUsuariosPag(1); usuariosPagRef.current = 1; }}
                                                >
                                                    {f.label}
                                                    {f.key === 'pendientes' && pendientesCount > 0 && (
                                                        <span className="badge rounded-pill bg-warning text-dark ms-1">{pendientesCount}</span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="input-group search-input-group" style={{ maxWidth: '350px' }}>
                                        <span className="input-group-text">
                                            <span className="material-symbols-outlined">search</span>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Buscar..."
                                            value={searchTermUsers}
                                            onChange={(e) => setSearchTermUsers(e.target.value)}
                                        />
                                        </div>
                                    </div>
                                </div>

                                <div className="carousel-wrapper position-relative">
                                    <button className="carousel-nav-btn left shadow-lg" onClick={() => scrollCarousel('left')} aria-label="Anterior">
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>

                                    <div className="carousel-blur-start"></div>
                                    <div className="user-carousel d-flex gap-4 pb-4 px-3 px-md-5" ref={carouselRef}>
                                        {filteredUsers.length > 0 ? filteredUsers.map(user => (
                                            <div key={user.id_usuario} className="user-card-new glass-box">
                                                <div className="user-card-header text-center pt-4 mb-3">
                                                    <div className="user-avatar-lg mx-auto mb-3 shadow overflow-hidden">
                                                        {user.profile_photo_path ? (
                                                            <img src={user.profile_photo_path} alt="Avatar" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <>{user.user_name[0]}{user.user_lastname[0]}</>
                                                        )}
                                                    </div>
                                                    <h5 className="mb-1 text-truncate px-2">{user.user_name} {user.user_lastname}</h5>
                                                    <span className={`badge ${user.role?.rol_name === 'Admin' ? 'bg-danger' : 'bg-success'} bg-opacity-10 text-${user.role?.rol_name === 'Admin' ? 'danger' : 'success'} border border-${user.role?.rol_name === 'Admin' ? 'danger' : 'success'} border-opacity-25`} style={{ fontSize: '0.65rem' }}>
                                                        {user.role?.rol_name}
                                                    </span>
                                                </div>

                                                <div className="user-card-body px-3 pb-3">
                                                    <div className="user-info-item mb-2">
                                                        <span className="material-symbols-outlined">id_card</span>
                                                        <span className="text-truncate">{user.user_identification || 'S/N'}</span>
                                                    </div>
                                                    <div className="user-info-item mb-2">
                                                        <span className="material-symbols-outlined">mail</span>
                                                        <span className="text-truncate">{user.user_email}</span>
                                                    </div>
                                                    <div className="user-info-item">
                                                        <span className="material-symbols-outlined">groups</span>
                                                        <span className="text-truncate">Ficha: {user.user_coursenumber || '—'}</span>
                                                    </div>
                                                    <div className="user-info-item mb-2">
                                                        <span className="material-symbols-outlined">school</span>
                                                        <span className="text-truncate">{user.user_program || 'Sin programa'}</span>
                                                    </div>
                                                    {user.user_telefono && (
                                                        <div className="user-info-item">
                                                            <span className="material-symbols-outlined">call</span>
                                                            <span className="text-truncate">{user.user_telefono}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="d-flex gap-2 px-3 pb-4">
                                                    {user.estado_cuenta === 'pendiente' ? (
                                                        <>
                                                            <button className="btn btn-success btn-sm action-btn flex-grow-1" onClick={() => handleAprobar(user.id_usuario)}>
                                                                <span className="material-symbols-outlined small">check_circle</span> Aprobar
                                                            </button>
                                                            <button className="btn btn-danger btn-sm action-btn flex-grow-1" onClick={() => handleRechazar(user.id_usuario)}>
                                                                <span className="material-symbols-outlined small">cancel</span> Rechazar
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button className="btn btn-warning btn-sm action-btn flex-grow-1" onClick={() => handleEditClick(user)}>
                                                                <span className="material-symbols-outlined small">edit</span> Editar
                                                            </button>
                                                            <button className="btn btn-danger btn-sm action-btn flex-grow-1" onClick={() => handleDelete(user.id_usuario)}>
                                                                <span className="material-symbols-outlined small">delete</span> Eliminar
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center w-100 py-5 opacity-50">
                                                <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>person_off</span>
                                                <p className="mt-2">No se encontraron usuarios</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="carousel-blur-end"></div>

                                    <button className="carousel-nav-btn right shadow-lg" onClick={() => scrollCarousel('right')} aria-label="Siguiente">
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                </div>
                                {/* Paginación del servidor: 24 por página, sin renderizar cientos de tarjetas */}
                                {usuariosUltima > 1 && (
                                    <div className="d-flex justify-content-center align-items-center gap-3 mt-3">
                                        <button
                                            className="btn btn-sm btn-outline-success"
                                            disabled={usuariosPag <= 1 || usuariosCargando}
                                            onClick={() => setUsuariosPag(p => Math.max(1, p - 1))}
                                        >
                                            Anterior
                                        </button>
                                        <span className="small opacity-75">Página {usuariosPag} de {usuariosUltima}</span>
                                        <button
                                            className="btn btn-sm btn-outline-success"
                                            disabled={usuariosPag >= usuariosUltima || usuariosCargando}
                                            onClick={() => setUsuariosPag(p => Math.min(usuariosUltima, p + 1))}
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                );
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
<button className="btn btn-outline-success action-btn" onClick={abrirExportar} title="Exportar historial (CSV, Excel o PDF)">
                                    <span className="material-symbols-outlined small">download</span>
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
                                        ) : filteredIngresos.length > 0 ? filteredIngresos.map(ingreso => (
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
            case 'equipo_entry':
                return (
                    <EquipmentForm adminMode onSaved={fetchEquipment} />
                );
            case 'ambientes':
                return <Ambientes currentUser={currentUser} rol="superadmin" />;
            case 'excusas':
                return <Excusas currentUser={currentUser} rol="superadmin" />;
            case 'presentes':
                return <Presentes />;
            case 'validar_qr':
                return <QrInvitado />;
            case 'escanear_carnet':
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto text-center" style={{ maxWidth: '640px' }}>
                            <h3 className="mb-2">Escanear Carnet Digital</h3>
                            <p className="opacity-50 small">Apunta al QR del carnet para buscar al usuario.</p>
                            <button type="button" className="btn btn-success px-4 py-2" onClick={() => setIsQrScannerOpen(true)}>
                                <span className="material-symbols-outlined small me-1">qr_code_scanner</span> Abrir escáner
                            </button>
                        </div>
                        <QrScannerModal isOpen={isQrScannerOpen} onClose={() => setIsQrScannerOpen(false)} onScanSuccess={handleQrScan} />
                    </div>
                );
            case 'historial_equipos':
                const equiposFiltradosPorRol = filteredEquipment.filter(item => {
                    if (!equipoRolFilter) return true;
                    return item.user?.role?.rol_name === equipoRolFilter;
                });
                const sortedEquipos = [...equiposFiltradosPorRol].sort((a, b) => {
                    const dir = equipoSort.dir === 'asc' ? 1 : -1;
                    let va, vb;
                    switch (equipoSort.key) {
                        case 'dueno':
                            va = `${a.user?.user_name || ''} ${a.user?.user_lastname || ''}`.toLowerCase();
                            vb = `${b.user?.user_name || ''} ${b.user?.user_lastname || ''}`.toLowerCase();
                            break;
                        case 'tipo':
                            va = a.equipo_type.toLowerCase();
                            vb = b.equipo_type.toLowerCase();
                            break;
                        case 'estado':
                            va = a.equipo_status.toLowerCase();
                            vb = b.equipo_status.toLowerCase();
                            break;
                        default:
                            va = a.entry_datetime || '';
                            vb = b.entry_datetime || '';
                    }
                    return va < vb ? -dir : va > vb ? dir : 0;
                });
                const sortHeader = (label, key) => (
                    <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => setEquipoSort(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })}>
                        <span className="d-inline-flex align-items-center gap-1">
                            {label}
                            {equipoSort.key === key && (
                                <span className="material-symbols-outlined small" style={{ fontSize: '14px' }}>{equipoSort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
                            )}
                        </span>
                    </th>
                );
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                                <div className="section-header mb-0">
                                    <h3 className="mb-0">Historial de Equipos</h3>
                                    <p className="opacity-50 small mb-0">Total: {sortedEquipos.length} equipos</p>
                                </div>
                                <div className="d-flex gap-2 flex-wrap">
                                    <select className="form-select" style={{ maxWidth: '170px' }} value={equipoRolFilter} onChange={(e) => setEquipoRolFilter(e.target.value)}>
                                        <option value="">Todos los roles</option>
                                        <option value="Instructor">Instructores</option>
                                        <option value="Aprendiz">Aprendices</option>
                                    </select>
                                    <div className="input-group search-input-group" style={{ maxWidth: '300px' }}>
                                        <span className="input-group-text">
                                            <span className="material-symbols-outlined">search</span>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Buscar usuario, equipo o serial..."
                                            value={searchTermEquipment}
                                            onChange={(e) => setSearchTermEquipment(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="table-responsive admin-scrollable-container" style={{ maxHeight: '60vh' }}>
                                <table className="table admin-table table-cards mb-0">
                                    <thead>
                                        <tr>
                                            {sortHeader('Dueño', 'dueno')}
                                            {sortHeader('Tipo', 'tipo')}
                                            <th>Marca/Modelo</th>
                                            <th>Serial</th>
                                            <th>Propiedad</th>
                                            {sortHeader('Estado', 'estado')}
                                            <th>Accesorios</th>
                                            {sortHeader('Ingreso', 'ingreso')}
                                            <th>Devolución</th>
                                            <th>Comprobante</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedEquipos.length > 0 ? sortedEquipos.map(item => (
                                            <tr key={item.id_ingreso_equipo}>
                                                <td data-label="Dueño">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="rounded-circle bg-success d-flex align-items-center justify-content-center border border-2 border-success border-opacity-25 overflow-hidden flex-shrink-0" style={{ width: '34px', height: '34px', fontSize: '0.75rem', fontWeight: 'bold', color: '#000' }}>
                                                            {item.user?.profile_photo_path ? (
                                                                <img src={item.user.profile_photo_path} alt="Avatar" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                            ) : (
                                                                <>{item.user?.user_name?.[0]}{item.user?.user_lastname?.[0]}</>
                                                            )}
                                                        </div>
                                                        <div className="d-flex flex-column">
                                                            <span className="fw-bold">{item.user?.user_name} {item.user?.user_lastname}</span>
                                                            <span className="small opacity-50">{item.user?.user_identification || 'S/N'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td data-label="Tipo"><span className="badge badge-soft-primary px-3 py-2">{item.equipo_type}</span></td>
                                                <td data-label="Marca/Modelo">{item.equipo_brand} {item.equipo_model || ''}</td>
                                                <td data-label="Serial"><code style={{ color: '#86efac' }}>{item.equipo_serial}</code></td>
                                                <td data-label="Propiedad">
                                                    <span className={`badge badge-soft-${item.equipo_propiedad === 'Propio' ? 'info' : 'secondary'} px-2 py-1`}>
                                                        {item.equipo_propiedad === 'Propio' ? 'Propio' : 'Prestado'}
                                                    </span>
                                                </td>
                                                <td data-label="Estado">
                                                    <span className={`badge badge-soft-${item.equipo_status === 'Disponible' ? 'success' : 'warning'} px-2 py-1`}>
                                                        {item.equipo_status}
                                                    </span>
                                                </td>
                                                <td data-label="Accesorios" className="small opacity-75">
                                                    {(item.equipo_accesorios || []).map(a => a?.tipo).filter(Boolean).join(', ') || '—'}
                                                </td>
                                                <td data-label="Ingreso" className="small opacity-75">{item.entry_datetime ? new Date(item.entry_datetime).toLocaleString() : '—'}</td>
                                                <td data-label="Devolución" className="small opacity-75">{item.equipo_return_datetime ? <span className="text-success">{new Date(item.equipo_return_datetime).toLocaleString()}</span> : '—'}</td>
                                                <td data-label="Comprobante">
                                                    <button type="button" className="action-btn btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1" onClick={() => handleDescargarComprobante(item)} title="Descargar comprobante PDF">
                                                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span> PDF
                                                    </button>
                                                </td>
                                                <td data-label="Acciones">
                                                    <div className="d-flex gap-1 flex-wrap">
                                                        {!item.equipo_return_datetime && (
                                                            <button type="button" className="action-btn btn btn-outline-warning btn-sm d-inline-flex align-items-center gap-1" onClick={() => handleDevolverEquipo(item.id_ingreso_equipo)} title="Marcar como devuelto">
                                                                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>assignment_return</span> Devolver
                                                            </button>
                                                        )}
                                                        <button type="button" className="action-btn btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1" onClick={() => handleEliminarEquipo(item.id_ingreso_equipo)} title="Eliminar equipo">
                                                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span> Eliminar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr><td colSpan="11" className="text-center py-4 opacity-50">No se encontraron equipos registrados.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'directorio':
                return (
                    <div className="fade-in-up">
                        <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '1200px' }}>
                            <div className="section-header d-flex justify-content-between align-items-center flex-wrap gap-3 mb-4">
                                <div>
                                    <h3 className="mb-0">Directorio de Aprendices e Instructores</h3>
                                    <p className="opacity-50 small mb-0">Consulta y filtra el personal del centro</p>
                                </div>
                            </div>

                            <ul className="nav nav-pills mb-4 gap-2">
                                <li className="nav-item">
                                    <button className={`nav-link ${directorioTab === 'instructores' ? 'active' : ''}`} onClick={() => setDirectorioTab('instructores')}>
                                        <span className="material-symbols-outlined small me-1">school</span> Instructores
                                    </button>
                                </li>
                                <li className="nav-item">
                                    <button className={`nav-link ${directorioTab === 'aprendices' ? 'active' : ''}`} onClick={() => setDirectorioTab('aprendices')}>
                                        <span className="material-symbols-outlined small me-1">person</span> Aprendices
                                    </button>
                                </li>
                            </ul>

                            {directorioTab === 'instructores' ? (
                                <>
                                    {filteredInstructors.length > 0 ? (
                                        <div className="row g-3">
                                         {filteredInstructors.map(instructor => {
                                              return (
                                                  <div className="col-md-6 col-lg-4" key={instructor.id_usuario}>
                                                      <div className="glass-box-nested p-4 h-100">
                                                         <div className="d-flex align-items-center gap-3 mb-3">
                                                             <div className="rounded-circle bg-success d-flex align-items-center justify-content-center border border-2 border-success border-opacity-25 shadow-sm overflow-hidden" style={{ width: '48px', height: '48px', fontWeight: 'bold', color: '#000', flexShrink: 0 }}>
                                                                 {instructor.profile_photo_path ? (
                                                                     <img src={instructor.profile_photo_path} alt="Avatar" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                 ) : (
                                                                     <>{instructor.user_name?.[0]}{instructor.user_lastname?.[0]}</>
                                                                 )}
                                                             </div>
                                                             <div>
                                                                 <h5 className="mb-0">{instructor.user_name} {instructor.user_lastname}</h5>
                                                                 <span className="small opacity-50">{instructor.user_email}</span>
                                                             </div>
                                                         </div>
                                                         <div className="mb-1"><span className="material-symbols-outlined small me-1">id_card</span> {instructor.user_identification || 'S/N'}</div>
                                                     </div>
                                                 </div>
                                             );
                                         })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-5 opacity-50">
                                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>school</span>
                                            <p className="mt-2 mb-0">No se encontraron instructores con esos filtros.</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {filteredAprendices.length > 0 ? (
                                        <div className="row g-3">
                                             {filteredAprendices.map(aprendiz => {
                                                 return (
                                                     <div className="col-md-6 col-lg-4" key={aprendiz.id_usuario}>
                                                         <div className="glass-box-nested p-4 h-100">
                                                            <div className="d-flex align-items-center gap-3 mb-3">
                                                                <div className="rounded-circle bg-success d-flex align-items-center justify-content-center border border-2 border-success border-opacity-25 shadow-sm overflow-hidden" style={{ width: '48px', height: '48px', fontWeight: 'bold', color: '#000', flexShrink: 0 }}>
                                                                    {aprendiz.profile_photo_path ? (
                                                                        <img src={aprendiz.profile_photo_path} alt="Avatar" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                    ) : (
                                                                        <>{aprendiz.user_name?.[0]}{aprendiz.user_lastname?.[0]}</>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h5 className="mb-0">{aprendiz.user_name} {aprendiz.user_lastname}</h5>
                                                                    <span className="small opacity-50">{aprendiz.user_email}</span>
                                                                </div>
                                                            </div>
                                                             <div className="user-info-item mb-2"><span className="material-symbols-outlined">id_card</span>{aprendiz.user_identification || 'S/N'}</div>
                                                             <div className="user-info-item mb-2"><span className="material-symbols-outlined">groups</span>Ficha: {aprendiz.user_coursenumber}</div>
                                                             <div className="user-info-item mb-3"><span className="material-symbols-outlined">menu_book</span>{aprendiz.user_program}</div>
                                                         </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-5 opacity-50">
                                            <span className="material-symbols-outlined" style={{ fontSize: '48px' }}>person_off</span>
                                            <p className="mt-2 mb-0">No se encontraron aprendices.</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                );
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
                            <div className="col-md-6">
                                <label className="form-label opacity-50 small mb-1">Programa</label>
                                <div className="p-3 bg-dark bg-opacity-25 rounded border border-success border-opacity-10">
                                    {currentUser?.user_program}
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 pt-3 border-top border-success border-opacity-10">
                            <button className="btn btn-outline-success w-100 py-3 d-flex align-items-center justify-content-center gap-2" onClick={() => {
                                handleEditClick(currentUser);
                                setView('users');
                            }}>
                                <span className="material-symbols-outlined">edit</span>
                                Editar Información de Perfil
                            </button>
                        </div>

                        <div className="mt-4 pt-3 border-top border-success border-opacity-10 text-start">
                            <label className="form-label opacity-75 small">Foto de perfil</label>
                            {perfilArchivo ? (
                                <RecorteFoto
                                    archivo={perfilArchivo}
                                    alCancelar={() => setPerfilArchivo(null)}
                                    alConfirmar={subirFotoMiPerfil}
                                />
                            ) : (
                                <label className="btn btn-outline-success btn-sm w-100">
                                    <span className="material-symbols-outlined small me-1">photo_camera</span> Cambiar foto
                                    <input type="file" accept="image/*" hidden onChange={(e) => {
                                        if (e.target.files?.[0]) setPerfilArchivo(e.target.files[0]);
                                        e.target.value = '';
                                    }} />
                                </label>
                            )}
                        </div>

                        <div className="mt-4 pt-3 border-top border-success border-opacity-10 text-start">
                            <form onSubmit={cambiarClaveMiPerfil}>
                                <label className="form-label opacity-75 small">Nueva contraseña (opcional)</label>
                                <input type="password" placeholder="Mínimo 6 caracteres..." className="form-control" value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)} />
                                <small className="opacity-50">Si tienes verificación en dos pasos activa, al guardar se enviará un código de 6 dígitos a tu correo.</small>
                                {codigoSolicitadoAdm && (
                                    <div className="mt-2">
                                        <label className="form-label opacity-75 small">Código de 6 dígitos (enviado a tu correo)</label>
                                        <input type="text" inputMode="numeric" maxLength="6" placeholder="123456" className="form-control" value={codigo2faAdm} onChange={(e) => setCodigo2faAdm(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                                    </div>
                                )}
                                <button type="submit" className="btn btn-success w-100 mt-2" disabled={!claveNueva}>
                                    <span className="material-symbols-outlined">lock</span> Cambiar contraseña
                                </button>
                            </form>
                        </div>
                        <DosPasos />
                        <MiHuella />
                    </div>
                );
            case 'novedad_form':
                return <Novedades currentUser={currentUser} initialMode="form" />;
            case 'novedad_historial':
                return <Novedades currentUser={currentUser} initialMode="history" />;
            default:
                return null;
        }
    };

    // Nav espeja el dock del admin móvil (INICIO·NOVEDADES·USUARIOS·AMBIENTES).
    // Sin MÁS: las vistas secundarias siguen en el switch (reversible).
    const adminLinks = [
        { label: 'DASHBOARD', icon: 'dashboard', view: 'dashboard' },
        { label: 'NOVEDADES', icon: 'report_problem', view: 'novedad_historial' },
        { label: 'USUARIOS', icon: 'group', view: 'users', filter: 'all' },
        { label: 'AMBIENTES', icon: 'meeting_room', view: 'ambientes' },
        { label: 'ESCANEAR CARNET', icon: 'qr_code_scanner', view: 'escanear_carnet' }
    ];

    return (
        <div className="min-vh-100 d-flex flex-column fade-in-up" style={{ background: 'transparent' }}>
            <Navbar
                currentUser={currentUser}
                view={view}
                setView={setView}
                userFilter={userFilter}
                setUserFilter={setUserFilter}
                links={adminLinks}
            />

            <main className="container-fluid px-3 px-md-5 py-2 flex-grow-1">
                {renderView()}
            </main>

            <Footer />

            {exportModalOpen && (
                <>
                    <div className="modal fade show d-block" tabIndex="-1" role="dialog" aria-modal="true">
                        <div className="modal-dialog modal-dialog-centered">
                            <div className="modal-content glass-box modal-glass-box">
                                <div className="modal-header border-0 pb-0">
                                    <h5 className="modal-title fw-bold">Exportar historial</h5>
                                    <button type="button" className="btn-close" onClick={() => setExportModalOpen(false)} aria-label="Cerrar"></button>
                                </div>
                                <div className="modal-body">
                                    <label className="form-label opacity-75 small mb-2">Formato</label>
                                    <div className="d-flex gap-2 mb-4 flex-wrap">
                                        {[{ k: 'csv', l: 'CSV' }, { k: 'xlsx', l: 'Excel' }, { k: 'pdf', l: 'PDF' }].map(f => (
                                            <button key={f.k} type="button"
                                                className={`btn ${exportFormato === f.k ? 'btn-success' : 'btn-outline-success'} action-btn`}
                                                onClick={() => setExportFormato(f.k)}>
                                                {f.l}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="form-label opacity-75 small mb-2">Columnas a incluir</label>
                                    <div className="d-flex flex-column gap-2">
                                        {EXPORT_COLUMNAS.map(c => (
                                            <div key={c.key} className="form-check">
                                                <input className="form-check-input" type="checkbox" id={`col-${c.key}`}
                                                    checked={exportCols.includes(c.key)}
                                                    onChange={() => toggleExportCol(c.key)} />
                                                <label className="form-check-label" htmlFor={`col-${c.key}`}>{c.label}</label>
                                            </div>
                                        ))}
                                    </div>
                                    {exportCols.length === 0 && (
                                        <p className="text-danger small mt-2 mb-0">Selecciona al menos una columna.</p>
                                    )}
                                </div>
                                <div className="modal-footer border-0 pt-0 d-flex gap-2 flex-wrap">
                                    <button type="button" className="btn btn-outline-secondary action-btn flex-grow-1" onClick={() => setExportModalOpen(false)}>Cancelar</button>
                                    <button type="button" className="btn btn-success action-btn flex-grow-1" onClick={descargarExportacion} disabled={exportando || exportCols.length === 0}>
                                        {exportando ? 'Exportando...' : 'Descargar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop fade show"></div>
                </>
            )}
        </div>
    );
};

export default Admin;
