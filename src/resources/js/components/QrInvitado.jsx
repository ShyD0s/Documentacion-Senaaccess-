import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

// Vista de portería para validar el QR de invitado (admin/instructor).
// `modo`: "ambos" (defecto), "manual" o "camara". El escáner usa
// window.BarcodeDetector si el navegador lo soporta; si no, queda el manual.
const QrInvitado = ({ modo = 'ambos' }) => {
    const [qrToken, setQrToken] = useState('');
    const [tokenError, setTokenError] = useState('');
    const [validando, setValidando] = useState(false);
    const [resultado, setResultado] = useState(null); // { ok, message, user? }
    const [escaneando, setEscaneando] = useState(false);
    const [camaraError, setCamaraError] = useState('');
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const detectorRef = useRef(null);
    const timerRef = useRef(null);

    const mostrarManual = modo !== 'camara';
    const mostrarCamara = modo !== 'manual';

    // POST /api/validate-guest-qr: muestra invitado + Entrada registrada o el error real.
    const validarToken = async (token) => {
        const limpio = (token ?? qrToken).trim();
        if (!limpio) {
            setTokenError('Ingresa el código del invitado.');
            return;
        }
        setTokenError('');
        setValidando(true);
        setResultado(null);
        try {
            const response = await axios.post('/api/validate-guest-qr', { qr_token: limpio });
            setResultado({
                ok: true,
                message: response.data.message || 'Entrada registrada para el invitado.',
                user: response.data.user || null
            });
        } catch (error) {
            setResultado({
                ok: false,
                message: error.response?.data?.message || 'No se pudo validar el código. Intenta de nuevo.',
                user: null
            });
        } finally {
            setValidando(false);
        }
    };

    // Detiene la cámara liberando todos los tracks del stream.
    const detenerCamara = () => {
        clearTimeout(timerRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setEscaneando(false);
    };

    // Abre la cámara trasera y prepara el detector de QR nativo del navegador.
    const iniciarCamara = async () => {
        setCamaraError('');
        setResultado(null);
        try {
            if (typeof window.BarcodeDetector === 'undefined') {
                setCamaraError('Tu navegador no soporta el escáner con cámara. Usa la entrada manual del código.');
                return;
            }
            detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            setEscaneando(true);
        } catch (err) {
            setCamaraError('No se pudo abrir la cámara. Revisa el permiso o usa la entrada manual del código.');
        }
    };

    // Bucle de detección: cada 400 ms lee el video y valida el primer QR encontrado.
    useEffect(() => {
        if (!escaneando) return;
        let activo = true;
        const video = videoRef.current;
        if (video && streamRef.current) {
            video.srcObject = streamRef.current;
            video.play().catch(() => {});
        }
        const detectar = async () => {
            if (!activo) return;
            try {
                if (video && video.readyState >= 2 && detectorRef.current) {
                    const codigos = await detectorRef.current.detect(video);
                    if (codigos && codigos.length > 0) {
                        const valor = codigos[0].rawValue || '';
                        if (valor) {
                            setQrToken(valor);
                            detenerCamara();
                            validarToken(valor);
                            return;
                        }
                    }
                }
            } catch (err) {
                // Sigue intentando en el siguiente ciclo.
            }
            if (activo) timerRef.current = setTimeout(detectar, 400);
        };
        detectar();
        return () => {
            activo = false;
            clearTimeout(timerRef.current);
        };
    }, [escaneando]); // eslint-disable-line react-hooks/exhaustive-deps

    // Apaga la cámara al desmontar el componente.
    useEffect(() => () => {
        clearTimeout(timerRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    return (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '640px' }}>
                <h3 className="mb-1">Validar QR de invitado</h3>
                <p className="opacity-75 small mb-4">Portería: escanea el código con la cámara o ingrésalo manualmente.</p>

                {mostrarCamara && (
                    <div className="mb-4">
                        {!escaneando ? (
                            <button type="button" className="btn btn-glow w-100 fw-bold" onClick={iniciarCamara}>
                                <span className="material-symbols-outlined me-2">qr_code_scanner</span>
                                ESCANEAR CON CÁMARA
                            </button>
                        ) : (
                            <>
                                <video ref={videoRef} className="w-100 rounded border border-success border-opacity-25" style={{ maxHeight: '320px', objectFit: 'cover' }} muted playsInline />
                                <button type="button" className="btn btn-glow w-100 mt-2" onClick={detenerCamara}>
                                    DETENER CÁMARA
                                </button>
                            </>
                        )}
                        {camaraError && (
                            <div className="alert alert-warning mt-3 mb-0 small">{camaraError}</div>
                        )}
                    </div>
                )}

                {mostrarManual && (
                    <form onSubmit={(e) => { e.preventDefault(); validarToken(); }}>
                        <label className="form-label opacity-75 small">Código del invitado</label>
                        <div className="input-group">
                            <input
                                type="text"
                                className={`form-control ${tokenError ? 'is-invalid' : ''}`}
                                placeholder="Pega aquí el token del QR"
                                value={qrToken}
                                onChange={(e) => setQrToken(e.target.value)}
                            />
                            <button type="submit" className="btn btn-success fw-bold" disabled={validando}>
                                {validando ? 'Validando...' : 'Validar'}
                            </button>
                        </div>
                        {tokenError && (
                            <div className="text-danger small mt-1">
                                <span className="material-symbols-outlined small me-1">error</span>{tokenError}
                            </div>
                        )}
                    </form>
                )}

                {resultado && (
                    <div className={`alert ${resultado.ok ? 'alert-success' : 'alert-danger'} mt-4 mb-0`}>
                        <div className="fw-bold mb-1">{resultado.message}</div>
                        {resultado.ok && resultado.user && (
                            <div className="small">
                                {resultado.user.user_name} {resultado.user.user_lastname} — Doc: {resultado.user.user_identification}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default QrInvitado;
