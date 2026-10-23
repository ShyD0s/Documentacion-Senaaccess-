import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import { showAlert } from './CustomAlert';

const UserQrCarnet = ({ currentUser, onClose, asModal = false }) => {
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [generating, setGenerating] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const carnetRef = useRef(null);

    // Preparar el payload del QR
    const qrPayload = JSON.stringify({
        app: 'SENA_ACCESS',
        id_usuario: currentUser?.id_usuario,
        user_identification: currentUser?.user_identification || '',
        user_name: `${currentUser?.user_name || ''} ${currentUser?.user_lastname || ''}`.trim(),
        user_email: currentUser?.user_email || '',
        user_coursenumber: currentUser?.user_coursenumber || 0,
        role: currentUser?.role?.rol_name || ''
    });

    useEffect(() => {
        if (!currentUser) return;

        // Generar el código QR con alta calidad
        QRCode.toDataURL(qrPayload, {
            width: 280,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            },
            errorCorrectionLevel: 'H'
        })
            .then(url => {
                setQrDataUrl(url);
                setGenerating(false);
            })
            .catch(err => {
                console.error('Error generando QR:', err);
                setGenerating(false);
            });
    }, [currentUser]);

    // Descargar el carnet completo como imagen usando html2canvas
    const handleDownloadCarnet = async () => {
        if (!carnetRef.current || generating) return;
        setDownloading(true);
        try {
            // Ocultar el footer con los botones antes de capturar
            const footer = carnetRef.current.querySelector('.carnet-footer');
            if (footer) footer.style.display = 'none';

            const canvas = await html2canvas(carnetRef.current, {
                backgroundColor: null,
                scale: 3,
                useCORS: true,
                allowTaint: true,
                logging: false,
            });

            if (footer) footer.style.display = '';

            const link = document.createElement('a');
            link.download = `Carnet_SENA_${currentUser?.user_identification || currentUser?.user_name || 'usuario'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            showAlert('\u2705 Carnet descargado con éxito');
        } catch (err) {
            console.error('Error al descargar carnet:', err);
            showAlert('Error al generar la imagen del carnet', 'error');
        } finally {
            setDownloading(false);
        }
    };

    // Icono dinámico según el rol
    const getRolIcon = (rolName) => {
        const rol = (rolName || '').toLowerCase();
        if (rol === 'aprendiz') return 'school';
        if (rol === 'instructor') return 'person_book';
        if (rol === 'superadmin') return 'admin_panel_settings';
        if (rol === 'admin' || rol === 'portero') return 'badge';
        if (rol === 'funcionario') return 'badge';
        return 'badge';
    };

    const content = (
        <div className="carnet-digital-wrapper fade-in-up">
            <div className="carnet-card glass-box mx-auto" ref={carnetRef}>
                {/* Encabezado del Carnet */}
                <div className="carnet-header d-flex align-items-center justify-content-between p-3 border-bottom border-success border-opacity-25">
                    <div className="d-flex align-items-center gap-2">
                        <img src="/Icons/logoSena.png" alt="SENA" style={{ height: '36px' }} />
                        <div>
                            <h6 className="mb-0 fw-bold" style={{ letterSpacing: '1px', fontSize: '0.9rem' }}>
                                SENA <span className="text-success neon-text">ACCESS</span>
                            </h6>
                            <span className="badge bg-success bg-opacity-15 text-success border border-success border-opacity-25" style={{ fontSize: '0.6rem' }}>
                                CARNET DIGITAL OFICIAL
                            </span>
                        </div>
                    </div>
                    <span className="material-symbols-outlined text-success" style={{ fontSize: '28px' }}>
                        verified
                    </span>
                </div>

                {/* Cuerpo del Carnet */}
                <div className="carnet-body p-4 text-center">
                    {/* Foto o Avatar */}
                    <div className="user-avatar-lg mx-auto mb-3 shadow overflow-hidden border border-2 border-success border-opacity-50" style={{ width: '90px', height: '90px' }}>
                        {currentUser?.profile_photo_path ? (
                            <img src={currentUser.profile_photo_path} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <span style={{ fontSize: '2rem' }}>
                                {currentUser?.user_name?.[0]}{currentUser?.user_lastname?.[0]}
                            </span>
                        )}
                    </div>

                    {/* Datos Principales */}
                    <h4 className="fw-bold mb-1" style={{ fontSize: '1.35rem' }}>
                        {currentUser?.user_name} {currentUser?.user_lastname}
                    </h4>
                    <span className="badge bg-success bg-opacity-20 text-success border border-success border-opacity-40 px-3 py-1 mb-3" style={{ fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        {currentUser?.role?.rol_name || 'Usuario'}
                    </span>

                    {/* Código QR Generado */}
                    <div className="carnet-qr-box mx-auto my-3 p-2 bg-white rounded-4 shadow-sm" style={{ width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {generating ? (
                            <div className="spinner-border text-success" role="status">
                                <span className="visually-hidden">Generando QR...</span>
                            </div>
                        ) : qrDataUrl ? (
                            <img src={qrDataUrl} alt="Código QR Personal" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        ) : (
                            <span className="text-danger small">Error generando QR</span>
                        )}
                    </div>

                    <p className="small opacity-75 mb-3" style={{ fontSize: '0.78rem' }}>
                        Muestra este código al administrador en la entrada para registrar tu ingreso y equipos.
                    </p>

                    {/* Metadatos del Aprendiz / Usuario */}
                    <div className="row g-2 text-start small">
                        <div className="col-6">
                            <div className="user-info-box p-2 rounded-3">
                                <span className="opacity-50 d-block" style={{ fontSize: '0.68rem' }}>DOCUMENTO</span>
                                <span className="fw-bold text-truncate d-block">{currentUser?.user_identification || 'No registrado'}</span>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="user-info-box p-2 rounded-3">
                                <span className="opacity-50 d-block" style={{ fontSize: '0.68rem' }}>FICHA</span>
                                <span className="fw-bold text-truncate d-block">{currentUser?.user_coursenumber || 'N/A'}</span>
                            </div>
                        </div>
                        <div className="col-6">
                            <div className="user-info-box p-2 rounded-3">
                                <span className="opacity-50 d-block" style={{ fontSize: '0.68rem' }}>PROGRAMA</span>
                                <span className="fw-bold text-truncate d-block">{currentUser?.user_program || 'General'}</span>
                            </div>
                        </div>
                        {/* ── ROL en el contenedor vacío ── */}
                        <div className="col-6">
                            <div className="user-info-box p-2 rounded-3 d-flex align-items-center gap-2">
                                <span className="material-symbols-outlined text-success" style={{ fontSize: '18px' }}>
                                    {getRolIcon(currentUser?.role?.rol_name)}
                                </span>
                                <div className="overflow-hidden">
                                    <span className="opacity-50 d-block" style={{ fontSize: '0.68rem' }}>ROL</span>
                                    <span className="fw-bold text-truncate d-block" style={{ textTransform: 'capitalize' }}>
                                        {currentUser?.role?.rol_name || 'N/A'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pie del Carnet con Acciones */}
                <div className="carnet-footer p-3 border-top border-success border-opacity-15 d-flex gap-2">
                    <button
                        type="button"
                        className="btn btn-success btn-sm flex-grow-1 py-2 d-flex align-items-center justify-content-center gap-2"
                        style={{ borderRadius: '12px' }}
                        onClick={handleDownloadCarnet}
                        disabled={downloading || generating}
                    >
                        <span className="material-symbols-outlined small">
                            {downloading ? 'hourglass_empty' : 'id_card'}
                        </span>
                        {downloading ? 'Generando...' : 'Descargar Carnet'}
                    </button>
                    {asModal && onClose && (
                        <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm px-3 py-2"
                            style={{ borderRadius: '12px' }}
                            onClick={onClose}
                        >
                            Cerrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );

    if (asModal) {
        return (
            <div className="equipment-modal-overlay" onClick={onClose}>
                <div style={{ maxWidth: '440px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                    {content}
                </div>
            </div>
        );
    }

    return content;
};

export default UserQrCarnet;
