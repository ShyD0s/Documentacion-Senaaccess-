import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { showAlert } from './CustomAlert';

const accesoriosVacios = () => ({ tipo: '', marca: '', color: '', inalambrico: false });

const EquipmentForm = ({ onSaved, adminMode = false }) => {
    const [form, setForm] = useState({
        equipo_type: 'Portátil',
        equipo_brand: '',
        equipo_model: '',
        equipo_color: '',
        equipo_serial: '',
        equipo_propiedad: 'Prestado',
        equipo_observations: '',
        fk_id_usuario: ''
    });
    const [usuariosList, setUsuariosList] = useState([]);
    const [accesorios, setAccesorios] = useState([]);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (adminMode) {
            axios.get('/api/admin/users')
                .then(response => {
                    const list = (response.data || []).filter(u => ['Instructor', 'Aprendiz'].includes(u.role?.rol_name));
                    setUsuariosList(list);
                })
                .catch(error => console.error('Error cargando usuarios:', error));
        }
    }, [adminMode]);

    const handleChange = (e) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
        if (errors[e.target.name]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[e.target.name];
                return next;
            });
        }
    };

    const handleAccesorioChange = (index, field, value) => {
        setAccesorios(prev => prev.map((acc, i) => i === index ? { ...acc, [field]: value } : acc));
    };

    const addAccesorio = () => setAccesorios(prev => [...prev, accesoriosVacios()]);
    const removeAccesorio = (index) => setAccesorios(prev => prev.filter((_, i) => i !== index));

    const fieldError = (name) => (
        errors[name] ? <div className="text-danger small mt-1"><span className="material-symbols-outlined small me-1">error</span>{errors[name][0]}</div> : null
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                equipo_accesorios: accesorios.filter(a => a.tipo?.trim())
            };
            if (!adminMode) {
                delete payload.fk_id_usuario;
            }
            const response = await axios.post(adminMode ? '/api/admin/equipment' : '/api/my-equipment', payload);
            showAlert(response.data.message || 'Equipo registrado con éxito');
            setForm({
                equipo_type: 'Portátil',
                equipo_brand: '',
                equipo_model: '',
                equipo_color: '',
                equipo_serial: '',
                equipo_propiedad: 'Prestado',
                equipo_observations: '',
                fk_id_usuario: ''
            });
            setAccesorios([]);
            setErrors({});
            if (onSaved) onSaved(response.data.data);
        } catch (error) {
            if (error.response?.data?.errors) {
                setErrors(error.response.data.errors);
            }
            showAlert('Error al registrar el equipo: ' + (error.response?.data?.message || 'Error desconocido'), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '600px' }}>
                <div className="section-header">
                    <h3 className="mb-0">{adminMode ? 'Registrar Equipo' : 'Registrar Mi Equipo'}</h3>
                    <p className="opacity-50 small">{adminMode ? 'Registra el ingreso de un dispositivo al centro y asígnalo a su dueño' : 'Registra el ingreso de tu dispositivo al centro'}</p>
                </div>
                <div className="admin-scrollable-container" style={{ maxHeight: '55vh' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="row">
                            {adminMode && (
                                <div className="col-12 mb-3">
                                    <label className="form-label opacity-75 small">Dueño del Equipo</label>
                                    <select name="fk_id_usuario" className={`form-select ${errors.fk_id_usuario ? 'is-invalid' : ''}`} value={form.fk_id_usuario} onChange={handleChange} required>
                                        <option value="" disabled>Seleccione el usuario dueño...</option>
                                        {usuariosList.map(u => (
                                            <option key={u.id_usuario} value={u.id_usuario}>
                                                {u.user_name} {u.user_lastname} — {u.role?.rol_name || 'Usuario'} ({u.user_identification})
                                            </option>
                                        ))}
                                    </select>
                                    {fieldError('fk_id_usuario')}
                                </div>
                            )}
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Tipo de Equipo</label>
                                <select name="equipo_type" className="form-select" value={form.equipo_type} onChange={handleChange} required>
                                    <option value="Portátil">Portátil</option>
                                    <option value="Cámara">Cámara</option>
                                    <option value="Herramienta">Herramienta</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label opacity-75 small">Marca</label>
                                <input type="text" name="equipo_brand" className={`form-control ${errors.equipo_brand ? 'is-invalid' : ''}`} placeholder="Ej: Lenovo, HP..." value={form.equipo_brand} onChange={handleChange} required />
                                {fieldError('equipo_brand')}
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label opacity-75 small">Modelo</label>
                                <input type="text" name="equipo_model" className="form-control" placeholder="Ej: ThinkPad X1..." value={form.equipo_model} onChange={handleChange} />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label opacity-75 small">Color</label>
                                <input type="text" name="equipo_color" className={`form-control ${errors.equipo_color ? 'is-invalid' : ''}`} placeholder="Ej: Gris Espacial..." value={form.equipo_color} onChange={handleChange} required />
                                {fieldError('equipo_color')}
                            </div>
                            <div className="col-md-6 mb-3">
                                <label className="form-label opacity-75 small">Número de Serie</label>
                                <input type="text" name="equipo_serial" className={`form-control ${errors.equipo_serial ? 'is-invalid' : ''}`} placeholder="S/N único..." value={form.equipo_serial} onChange={handleChange} required />
                                {fieldError('equipo_serial')}
                            </div>
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">El equipo es</label>
                                <select name="equipo_propiedad" className="form-select" value={form.equipo_propiedad} onChange={handleChange}>
                                    <option value="Prestado">Prestado (del centro de formación)</option>
                                    <option value="Propio">Propio (de uno mismo)</option>
                                </select>
                            </div>
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Accesorios (opcional)</label>
                                {accesorios.map((acc, index) => (
                                    <div className="border rounded p-2 mb-2" key={index}>
                                        <div className="row g-2 align-items-end">
                                            <div className="col-6 col-sm-5">
                                                <input type="text" className="form-control form-control-sm" placeholder="Tipo (Mouse, Teclado...)" value={acc.tipo} onChange={(e) => handleAccesorioChange(index, 'tipo', e.target.value)} />
                                            </div>
                                            <div className="col-6 col-sm-5">
                                                <input type="text" className="form-control form-control-sm" placeholder="Marca" value={acc.marca} onChange={(e) => handleAccesorioChange(index, 'marca', e.target.value)} />
                                            </div>
                                            <div className="col-12 col-sm-2 d-flex justify-content-end">
                                                <button type="button" className="btn btn-outline-danger btn-sm action-btn" onClick={() => removeAccesorio(index)} title="Quitar accesorio">
                                                    <span className="material-symbols-outlined small">close</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="btn btn-outline-success btn-sm action-btn" onClick={addAccesorio}>
                                    <span className="material-symbols-outlined small">add</span> Añadir accesorio
                                </button>
                            </div>
                            <div className="col-12 mb-3">
                                <label className="form-label opacity-75 small">Observaciones / Estado</label>
                                <textarea name="equipo_observations" className="form-control" rows="2" placeholder="Detalles adicionales del estado del equipo..." value={form.equipo_observations} onChange={handleChange}></textarea>
                            </div>
                        </div>
                        <button type="submit" className="btn btn-success w-100 py-2 action-btn" disabled={saving}>
                            <span className="material-symbols-outlined">save</span> {saving ? 'Guardando...' : 'Registrar Equipo'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default EquipmentForm;