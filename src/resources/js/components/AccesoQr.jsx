import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QRCode from 'qrcode';

// QR rotativo de portería (superadmin/admin): un apartado ENTRADA y otro
// SALIDA. El QR rota cada 30 s; el aprendiz/instructor lo escanea y queda
// registrado en el historial. La Salida SOLO se marca por este QR o PIN.
const AccesoQr = () => {
    const [tipo, setTipo] = useState('entrada');
    const [qrUrl, setQrUrl] = useState('');
    const [segundos, setSegundos] = useState(30);
    const [error, setError] = useState('');
    const [pin, setPin] = useState(null); // PIN corto dictado sin cámara.
    const [pinError, setPinError] = useState('');

    const generarPin = async () => {
        try {
            const { data } = await axios.post('/api/admin/pines-acceso', { tipo });
            setPin(data);
            setPinError('');
        } catch (e) {
            setPinError(e.response?.data?.message || 'No se pudo generar el PIN.');
        }
    };

    const cargar = async (t) => {
        try {
            const { data } = await axios.get(`/api/acceso/qr/${t || tipo}`);
            setQrUrl(await QRCode.toDataURL(data.qr_payload, { width: 320, margin: 2 }));
            setSegundos(Math.max(1, data.expira_en - Math.floor(Date.now() / 1000)));
            setError('');
        } catch (e) {
            setError(e.response?.data?.message || 'No se pudo generar el QR.');
        }
    };

    useEffect(() => {
        cargar(tipo);
        const id = setInterval(() => cargar(tipo), 25000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipo]);

    useEffect(() => {
        const id = setInterval(() => setSegundos((s) => (s <= 1 ? 30 : s - 1)), 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto text-center" style={{ maxWidth: '560px' }}>
                <div className="section-header">
                    <h3 className="mb-0">Control de acceso QR</h3>
                    <p className="opacity-50 small">Proyecta el QR: se renueva solo por seguridad</p>
                </div>
                <div className="btn-group mb-4" role="group" aria-label="Tipo de QR">
                    {[
                        { key: 'entrada', label: 'ENTRADA' },
                        { key: 'salida', label: 'SALIDA' }
                    ].map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            className={`btn ${tipo === t.key ? (t.key === 'entrada' ? 'btn-success' : 'btn-warning') : 'btn-outline-success'}`}
                            onClick={() => setTipo(t.key)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                {error ? (
                    <p className="text-danger">{error}</p>
                ) : qrUrl ? (
                    <>
                        <div className="carnet-qr-box mx-auto p-2 bg-white rounded-4 shadow-sm" style={{ width: '300px', height: '300px' }}>
                            <img src={qrUrl} alt={`QR de ${tipo}`} style={{ width: '100%', height: '100%' }} />
                        </div>
                        <p className="mt-3 mb-0">
                            <span className={`badge px-3 py-2 ${tipo === 'entrada' ? 'bg-success' : 'bg-warning'} bg-opacity-10 border border-opacity-25 ${tipo === 'entrada' ? 'text-success border-success' : 'text-warning border-warning'}`}>
                                {tipo === 'entrada' ? 'ENTRADA' : 'SALIDA'} • se renueva en {segundos}s
                            </span>
                        </p>
                        <p className="opacity-50 small mt-2">El aprendiz o instructor lo escanea desde su app y queda en el historial.</p>
                        <hr />
                        <p className="opacity-50 small mb-2">¿Sin cámara? Dicta este PIN (5 min, un solo uso):</p>
                        <button type="button" className="btn btn-outline-warning mb-2" onClick={generarPin}>
                            Generar PIN de {tipo}
                        </button>
                        {pinError && <p className="text-danger">{pinError}</p>}
                        {pin && (
                            <p className="mb-0">
                                <span className="badge px-4 py-3 fs-4 text-warning border border-warning" style={{ letterSpacing: '6px' }}>
                                    {pin.pin}
                                </span>
                            </p>
                        )}
                    </>
                ) : (
                    <div className="spinner-border text-success" role="status">
                        <span className="visually-hidden">Generando QR...</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccesoQr;
