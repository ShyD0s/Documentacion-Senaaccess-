import React, { useState, useRef } from 'react';
import axios from 'axios';

// Escáner de acceso para aprendiz/instructor: apunta al QR de ENTRADA o
// SALIDA de portería (o pega el código manual) y registra en el historial.
const EscanearAcceso = () => {
    const [codigo, setCodigo] = useState('');
    const [validando, setValidando] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [escaneando, setEscaneando] = useState(false);
    const [camaraError, setCamaraError] = useState('');
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);

    const validar = async (valor) => {
        const limpio = (valor ?? codigo).trim();
        if (!limpio || validando) return;
        setValidando(true);
        setResultado(null);
        try {
            const { data } = await axios.post('/api/acceso/validar', { qr_payload: limpio });
            setResultado({ ok: true, message: data.message });
            setCodigo('');
        } catch (e) {
            setResultado({ ok: false, message: e.response?.data?.message || 'No se pudo registrar. Intenta de nuevo.' });
        } finally {
            setValidando(false);
        }
    };

    const detenerCamara = () => {
        clearTimeout(timerRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setEscaneando(false);
    };

    const iniciarCamara = async () => {
        setCamaraError('');
        setResultado(null);
        try {
            if (typeof window.BarcodeDetector === 'undefined') {
                setCamaraError('Tu navegador no soporta el escáner con cámara. Pega el código manual.');
                return;
            }
            const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setEscaneando(true);
            const loop = async () => {
                if (!streamRef.current) return;
                try {
                    const codes = await detector.detect(videoRef.current);
                    if (codes.length > 0) {
                        detenerCamara();
                        validar(codes[0].rawValue);
                        return;
                    }
                } catch (_) { /* cuadro sin QR */ }
                timerRef.current = setTimeout(loop, 400);
            };
            loop();
        } catch (e) {
            setCamaraError('No se pudo abrir la cámara. Revisa los permisos o pega el código manual.');
        }
    };

    return (
        <div className="fade-in-up">
            <div className="glass-box p-4 mb-5 mx-auto" style={{ maxWidth: '560px' }}>
                <div className="section-header text-center">
                    <h3 className="mb-0">Marcar entrada / salida</h3>
                    <p className="opacity-50 small">Escanea el QR de portería con tu cámara o pega el código</p>
                </div>
                {resultado && (
                    <div className={`alert ${resultado.ok ? 'alert-success' : 'alert-danger'} text-center`}>{resultado.message}</div>
                )}
                {escaneando ? (
                    <>
                        <video ref={videoRef} className="w-100 rounded-4 bg-black" style={{ maxHeight: '320px' }} playsInline muted />
                        <button type="button" className="btn btn-outline-secondary w-100 mt-2" onClick={detenerCamara}>Detener cámara</button>
                    </>
                ) : (
                    <button type="button" className="btn btn-success w-100 py-2 mb-3" onClick={iniciarCamara}>
                        <span className="material-symbols-outlined small me-1">qr_code_scanner</span> Escanear con cámara
                    </button>
                )}
                {camaraError && <p className="text-warning small text-center">{camaraError}</p>}
                <div className="input-group mt-2">
                    <input
                        type="text"
                        className="form-control"
                        placeholder="...o pega aquí el código del QR"
                        value={codigo}
                        onChange={(e) => setCodigo(e.target.value)}
                    />
                    <button type="button" className="btn btn-outline-success" disabled={validando || !codigo.trim()} onClick={() => validar()}>
                        {validando ? 'Marcando...' : 'Marcar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EscanearAcceso;
