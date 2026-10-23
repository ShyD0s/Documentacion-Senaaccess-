import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { showAlert } from './CustomAlert';
import { huellaDisponible, registrarHuella, mensajeErrorHuella } from '../utils/webauthn';

// Bloque "Mi huella" reutilizado en los perfiles de los cuatro roles.
// Registra la huella del dispositivo con WebAuthn (Windows Hello, Touch ID,
// huella de Android). La clave privada nunca sale del dispositivo: el servidor
// solo guarda la clave publica y valida la firma.
const MiHuella = () => {
    const [dispositivos, setDispositivos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState(false);
    const [soportado, setSoportado] = useState(false);

    const cargar = async () => {
        try {
            const response = await axios.get('/api/huellas');
            setDispositivos(response.data.dispositivos || []);
        } catch (error) {
            console.error('Error al consultar las huellas:', error);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        setSoportado(huellaDisponible());
        cargar();
    }, []);

    const registrar = async () => {
        setProcesando(true);
        try {
            const opciones = await axios.post('/api/huellas/registro/opciones', {
                nombre_dispositivo: navigator.platform || 'Este dispositivo',
            });
            const credencial = await registrarHuella(opciones.data.opciones);
            await axios.post('/api/huellas/registro', {
                reto: opciones.data.reto,
                ...credencial,
            });
            showAlert('Huella registrada en este dispositivo.');
            await cargar();
        } catch (error) {
            const mensaje = error?.response?.data?.message || mensajeErrorHuella(error);
            showAlert(mensaje, 'error');
        } finally {
            setProcesando(false);
        }
    };

    const eliminar = async (id) => {
        try {
            await axios.delete(`/api/huellas/${id}`);
            showAlert('Huella del dispositivo eliminada.');
            await cargar();
        } catch (error) {
            showAlert(error?.response?.data?.message || 'No se pudo eliminar la huella.', 'error');
        }
    };

    return (
        <div className="mt-4 pt-3 border-top border-success border-opacity-10">
            <div className="d-flex align-items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-success">fingerprint</span>
                <h6 className="mb-0 fw-bold">Mi huella</h6>
            </div>
            <p className="small opacity-75 mb-3">
                Entra sin escribir tu clave usando la huella, el PIN o el reconocimiento facial de este
                dispositivo. La biometria se queda en el dispositivo: el centro solo guarda la llave publica.
            </p>

            {!soportado && !cargando && (
                <div className="alert alert-warning small">
                    Este navegador no permite usar la huella. Puedes entrar con tu correo y clave, o registrar
                    la huella desde el celular.
                </div>
            )}

            {cargando ? (
                <p className="small opacity-50 mb-0">Buscando dispositivos registrados...</p>
            ) : (
                <>
                    {dispositivos.length > 0 && (
                        <div className="d-flex flex-column gap-2 mb-3">
                            {dispositivos.map((dispositivo) => (
                                <div
                                    key={dispositivo.id}
                                    className="d-flex align-items-center justify-content-between gap-2 p-3 rounded border border-success border-opacity-10 bg-dark bg-opacity-25"
                                >
                                    <div className="d-flex align-items-center gap-2 text-start">
                                        <span className="material-symbols-outlined text-success">smartphone</span>
                                        <div>
                                            <div className="small fw-bold">{dispositivo.nombre}</div>
                                            <div className="small opacity-50">
                                                {dispositivo.ultimo_uso
                                                    ? `Ultimo uso: ${new Date(dispositivo.ultimo_uso).toLocaleString('es-CO')}`
                                                    : 'Registrado, sin uso todavia'}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-outline-danger btn-sm"
                                        onClick={() => eliminar(dispositivo.id)}
                                        aria-label={`Quitar la huella de ${dispositivo.nombre}`}
                                    >
                                        QUITAR
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        type="button"
                        className="btn btn-outline-success w-100 py-3 d-flex align-items-center justify-content-center gap-2"
                        onClick={registrar}
                        disabled={procesando || !soportado}
                    >
                        <span className="material-symbols-outlined">fingerprint</span>
                        {procesando ? 'REGISTRANDO...' : 'REGISTRAR HUELLA EN ESTE DISPOSITIVO'}
                    </button>
                </>
            )}
        </div>
    );
};

export default MiHuella;
