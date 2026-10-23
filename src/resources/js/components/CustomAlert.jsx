import React, { useState, useEffect } from 'react';

// Referencia global para lanzar alertas desde cualquier archivo JS sin necesidad de Hooks o Context
let alertTrigger = null;

/**
 * Muestra una alerta custom con animación.
 * @param {string} message Mensaje a mostrar en la alerta.
 * @param {string} type Tipo de alerta: 'success', 'error', 'warning'. Por defecto es 'success'.
 * @returns {Promise<boolean>} Resuelve true al cerrar la alerta.
 */
export const showAlert = (message, type = 'success') => {
    return new Promise((resolve) => {
        if (alertTrigger) {
            alertTrigger({ message, type, isConfirm: false, resolve });
        } else {
            // Fallback en caso de que no esté montado aún
            alert(message);
            resolve(true);
        }
    });
};

/**
 * Muestra un modal de confirmación con opciones Confirmar / Cancelar.
 * @param {string} message Mensaje o pregunta a confirmar.
 * @returns {Promise<boolean>} Resuelve true si el usuario presiona "Confirmar" y false si presiona "Cancelar".
 */
export const showConfirm = (message) => {
    return new Promise((resolve) => {
        if (alertTrigger) {
            alertTrigger({ message, type: 'warning', isConfirm: true, resolve });
        } else {
            // Fallback en caso de que no esté montado aún
            const result = window.confirm(message);
            resolve(result);
        }
    });
};

const CustomAlert = () => {
    const [state, setState] = useState({
        visible: false,
        message: '',
        type: 'success',
        isConfirm: false,
        resolve: null
    });

    useEffect(() => {
        alertTrigger = (config) => {
            setState({
                visible: true,
                message: config.message,
                type: config.type,
                isConfirm: config.isConfirm,
                resolve: config.resolve
            });
        };
        return () => {
            alertTrigger = null;
        };
    }, []);

    if (!state.visible) return null;

    const handleAction = (value) => {
        setState(prev => ({ ...prev, visible: false }));
        if (state.resolve) {
            state.resolve(value);
        }
    };

    const isSuccess = state.type === 'success';
    const isError = state.type === 'error';
    const isWarning = state.type === 'warning';

    return (
        <div className="custom-alert-overlay" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)',
            background: 'rgba(0, 0, 0, 0.45)',
            animation: 'fadeIn 0.25s ease-out'
        }}>
            <div className="glass-box p-4 p-md-5 text-center mx-3" style={{
                maxWidth: '420px',
                animation: 'scaleInBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                border: isSuccess ? '1.5px solid rgba(22, 163, 74, 0.35)' : isError ? '1.5px solid rgba(220, 53, 69, 0.35)' : '1.5px solid var(--primary-color)',
                boxShadow: isSuccess ? '0 20px 50px rgba(22, 163, 74, 0.15)' : isError ? '0 20px 50px rgba(220, 53, 69, 0.15)' : '0 20px 50px rgba(2, 217, 20, 0.15)',
                margin: 0
            }}>
                {/* SVG Animado según el tipo */}
                <div className="d-flex justify-content-center mb-4">
                    {isSuccess && (
                        <div className="animated-checkmark-wrapper">
                            <svg className="animated-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                <circle className="animated-checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                                <path className="animated-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                            </svg>
                        </div>
                    )}
                    {isError && (
                        <div className="animated-cross-wrapper">
                            <svg className="animated-cross" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                <circle className="animated-cross-circle" cx="26" cy="26" r="25" fill="none" />
                                <path className="animated-cross-line1" fill="none" d="M16 16l20 20" />
                                <path className="animated-cross-line2" fill="none" d="M36 16L16 36" />
                            </svg>
                        </div>
                    )}
                    {isWarning && (
                        <div className="animated-warning-wrapper">
                            <svg className="animated-warning" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" style={{ width: '80px', height: '80px' }}>
                                <circle className="animated-warning-circle" cx="26" cy="26" r="25" fill="none" />
                                <path className="animated-warning-line1" fill="none" d="M26 14v16" />
                                <circle className="animated-warning-dot" cx="26" cy="38" r="2.5" />
                            </svg>
                        </div>
                    )}
                </div>

                <h3 className="fw-bold mb-3" style={{ color: 'var(--text-color)', fontSize: '1.6rem', letterSpacing: '-0.5px' }}>
                    {isSuccess ? '¡Éxito!' : isError ? '¡Atención!' : '¿Confirmar Acción?'}
                </h3>
                
                <p className="theme-text mb-4 opacity-90" style={{ fontSize: '0.95rem', lineHeight: '1.6', wordBreak: 'break-word' }}>
                    {state.message}
                </p>

                {state.isConfirm ? (
                    <div className="d-flex gap-3 justify-content-center">
                        <button
                            onClick={() => handleAction(true)}
                            className="btn btn-primary-login px-4 py-2 fw-bold"
                            style={{ borderRadius: '12px', border: 'none', minWidth: '120px' }}
                        >
                            CONFIRMAR
                        </button>
                        <button
                            onClick={() => handleAction(false)}
                            className="btn btn-outline-danger px-4 py-2 fw-bold"
                            style={{ borderRadius: '12px', border: '1px solid rgba(220, 53, 69, 0.3)', color: '#dc3545', minWidth: '120px', background: 'transparent' }}
                        >
                            CANCELAR
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={() => handleAction(true)}
                        className="btn btn-glow btn-primary-login px-5 py-2.5 fw-bold w-100"
                        style={{ borderRadius: '12px', letterSpacing: '2px', border: 'none' }}
                    >
                        ACEPTAR
                    </button>
                )}
            </div>
        </div>
    );
};

export default CustomAlert;
