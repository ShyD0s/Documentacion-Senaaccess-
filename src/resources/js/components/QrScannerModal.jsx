import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const playScanBeep = () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz
        osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
        // AudioContext puede estar bloqueado antes de interacción del usuario
    }
};

const QrScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
    const scannerInstanceRef = useRef(null);
    const [cameras, setCameras] = useState([]);
    const [selectedCameraId, setSelectedCameraId] = useState('');
    const [cameraActive, setCameraActive] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isScanningFile, setIsScanningFile] = useState(false);
    const fileInputRef = useRef(null);

    // Detener la cámara de manera segura
    const stopCamera = async () => {
        if (scannerInstanceRef.current) {
            try {
                if (scannerInstanceRef.current.isScanning) {
                    await scannerInstanceRef.current.stop();
                }
                scannerInstanceRef.current.clear();
            } catch (err) {
                console.warn('Error al detener cámara:', err);
            }
            scannerInstanceRef.current = null;
        }
        setCameraActive(false);
    };

    // Iniciar la cámara seleccionada
    const startCamera = async (cameraIdToUse) => {
        try {
            setErrorMessage('');
            await stopCamera();

            const html5QrCode = new Html5Qrcode('admin-qr-reader');
            scannerInstanceRef.current = html5QrCode;

            const cameraConfig = cameraIdToUse
                ? { deviceId: { exact: cameraIdToUse } }
                : { facingMode: 'environment' };

            await html5QrCode.start(
                cameraConfig,
                {
                    fps: 15,
                    qrbox: { width: 240, height: 240 },
                    aspectRatio: 1.0
                },
                (decodedText) => {
                    // Éxito al escanear
                    playScanBeep();
                    stopCamera();
                    onScanSuccess(decodedText);
                },
                () => {
                    // Error de cuadro a cuadro (se ignora para no saturar)
                }
            );

            setCameraActive(true);
        } catch (err) {
            console.error('Error iniciando cámara:', err);
            setCameraActive(false);
            if (err.name === 'NotAllowedError' || String(err).includes('Permission')) {
                setErrorMessage('Permiso de cámara denegado. Permite el acceso a la cámara web en tu navegador.');
            } else if (err.name === 'NotFoundError' || String(err).includes('NotFound')) {
                setErrorMessage('No se encontró ninguna cámara web conectada en tu equipo.');
            } else {
                setErrorMessage('No se pudo acceder a la cámara. Puedes subir una foto con el QR o verificar los permisos.');
            }
        }
    };

    // Inicializar dispositivos de cámara cuando el modal se abre
    useEffect(() => {
        if (!isOpen) {
            stopCamera();
            return;
        }

        let isMounted = true;

        Html5Qrcode.getCameras()
            .then(devices => {
                if (!isMounted) return;
                if (devices && devices.length > 0) {
                    setCameras(devices);
                    const defaultCam = devices[0].id;
                    setSelectedCameraId(defaultCam);
                    startCamera(defaultCam);
                } else {
                    setErrorMessage('No se detectaron cámaras web en el dispositivo.');
                }
            })
            .catch(err => {
                if (!isMounted) return;
                console.warn('Error listando cámaras:', err);
                // Intento genérico con facingMode
                startCamera(null);
            });

        return () => {
            isMounted = false;
            stopCamera();
        };
    }, [isOpen]);

    // Cambiar de cámara
    const handleCameraChange = (e) => {
        const newCameraId = e.target.value;
        setSelectedCameraId(newCameraId);
        startCamera(newCameraId);
    };

    // Escanear archivo de imagen con QR (fallback)
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanningFile(true);
        setErrorMessage('');

        try {
            // Detener la cámara activa para usar el escáner con el archivo
            await stopCamera();

            const html5QrCode = new Html5Qrcode('admin-qr-reader');
            scannerInstanceRef.current = html5QrCode;

            const decodedText = await html5QrCode.scanFile(file, true);
            playScanBeep();
            stopCamera();
            onScanSuccess(decodedText);
        } catch (err) {
            console.error('Error escaneando archivo:', err);
            setErrorMessage('No se detectó ningún código QR en la imagen seleccionada. Intenta con una imagen más clara.');
            setIsScanningFile(false);
            // Reanudar cámara
            if (selectedCameraId) {
                startCamera(selectedCameraId);
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="equipment-modal-overlay" onClick={onClose}>
            <div className="equipment-modal-box qr-scanner-modal-box p-4" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-success border-opacity-20">
                    <div className="d-flex align-items-center gap-2">
                        <span className="material-symbols-outlined text-success" style={{ fontSize: '28px' }}>
                            qr_code_scanner
                        </span>
                        <div>
                            <h5 className="mb-0 fw-bold">Escanear Carnet / QR</h5>
                            <span className="opacity-50 small" style={{ fontSize: '0.72rem' }}>
                                Búsqueda automática de aprendiz o usuario
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm rounded-circle d-flex align-items-center justify-content-center"
                        style={{ width: '34px', height: '34px', padding: 0 }}
                        onClick={onClose}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Selector de cámaras si hay más de una */}
                {cameras.length > 1 && (
                    <div className="mb-3">
                        <select
                            className="form-select form-select-sm"
                            value={selectedCameraId}
                            onChange={handleCameraChange}
                        >
                            {cameras.map(cam => (
                                <option key={cam.id} value={cam.id}>
                                    📷 {cam.label || `Cámara ${cam.id.slice(0, 5)}...`}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Contenedor del visor de la cámara */}
                <div className="qr-scanner-viewport-wrapper position-relative mx-auto my-2 rounded-4 overflow-hidden shadow-lg border border-2 border-success border-opacity-30">
                    {/* Elemento de renderizado para Html5Qrcode */}
                    <div id="admin-qr-reader" style={{ width: '100%', minHeight: '300px', background: '#000' }}></div>

                    {/* Línea animada de escaneo tipo láser sobre la cámara */}
                    {cameraActive && (
                        <>
                            <div className="qr-scan-laser"></div>
                            <div className="qr-target-corners">
                                <span className="corner top-left"></span>
                                <span className="corner top-right"></span>
                                <span className="corner bottom-left"></span>
                                <span className="corner bottom-right"></span>
                            </div>
                        </>
                    )}

                    {/* Mensaje de carga o error si la cámara no está activa */}
                    {!cameraActive && (
                        <div className="position-absolute inset-0 d-flex flex-column align-items-center justify-content-center p-4 text-center" style={{ top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(10, 10, 10, 0.85)', zIndex: 10 }}>
                            {errorMessage ? (
                                <>
                                    <span className="material-symbols-outlined text-warning mb-2" style={{ fontSize: '42px' }}>
                                        videocam_off
                                    </span>
                                    <p className="small text-danger mb-3">{errorMessage}</p>
                                    <button
                                        type="button"
                                        className="btn btn-outline-success btn-sm d-flex align-items-center gap-1"
                                        onClick={() => startCamera(selectedCameraId)}
                                    >
                                        <span className="material-symbols-outlined small">refresh</span>
                                        Reintentar Cámara
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="spinner-border text-success mb-2" role="status">
                                        <span className="visually-hidden">Iniciando cámara...</span>
                                    </div>
                                    <span className="small opacity-75">Iniciando cámara web...</span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Instrucciones y Opciones Alternativas */}
                <p className="text-center opacity-75 small mt-2 mb-3" style={{ fontSize: '0.75rem' }}>
                    Ubica el código QR del carnet digital frente a la cámara web para enfocarlo automáticamente.
                </p>

                {/* Botón para subir imagen con QR si la webcam falla */}
                <div className="d-flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        className="d-none"
                        onChange={handleFileUpload}
                    />
                    <button
                        type="button"
                        className="btn btn-outline-success btn-sm w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                        style={{ borderRadius: '12px', fontSize: '0.8rem' }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isScanningFile}
                    >
                        <span className="material-symbols-outlined small">photo_camera_back</span>
                        {isScanningFile ? 'Leyendo imagen...' : 'Escanear desde Imagen / Archivo'}
                    </button>
                    <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm px-4 py-2"
                        style={{ borderRadius: '12px' }}
                        onClick={onClose}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QrScannerModal;
