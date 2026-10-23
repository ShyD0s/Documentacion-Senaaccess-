import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import bonziNormal from '../assets/bonzi-sena.png';
import bonziPensando from '../assets/bonzi-pensando.png';
import bonziRespondiendo from '../assets/bonzi-respondiendo.png';
import bonziLlorando from '../assets/bonzi-llorando.png';

// ─── Sugerencias rápidas de preguntas frecuentes ────────────────────────────
const QUICK_SUGGESTIONS = [
    '¿Cómo registro un equipo?',
    '¿Cómo recupero mi contraseña?',
    '¿Cómo descargo mi carnet QR?',
    '¿Qué roles existen en el sistema?',
];

const BONZI_KEY = 'chatbot_bonzi';
const BONZI_ON  = '¡Listo! Ahora soy **Bonzi**, el asistente de SenaAccess. Escribe `/bonzi` de nuevo para volver al icono original.';
const BONZI_OFF = 'Volví al icono original del asistente. Escribe `/bonzi` cuando quieras traer a Bonzi de nuevo.';
const BONZI_MS_FINAL = 4000;

// Cada estado del mono usa su propia imagen (todas alineadas al mismo lienzo).
const IMAGENES_BONZI = {
    normal: bonziNormal,
    pensando: bonziPensando,
    respondiendo: bonziRespondiendo,
    llorando: bonziLlorando,
};

// Frases con las que el asistente admite que no puede responder.
const FRASES_SIN_RESPUESTA = [
    'no pude',
    'no puedo',
    'no tengo informaci',
    'no encontr',
    'no cuento con',
    'sin informaci',
    'no está en',
    'no esta en',
    'no lo sé',
    'no lo se',
    'no sé la respuesta',
    'no se la respuesta',
    'no tengo acceso',
    'no estoy autorizado',
    'no está permitido',
    'no esta permitido',
    'no me está permitido',
    'no me esta permitido',
    'no debo',
    'no revelo',
    'no comparto',
    'no proporciono',
    'confidencial',
];

// El chat cambia de paleta con Bonzi: morado del personaje en lugar del verde.
const TEMA_SENA = {
    header: 'linear-gradient(135deg, #39a900 0%, #2d8a00 100%)',
    border: 'rgba(57,169,0,0.25)',
    shadow: '0 12px 40px rgba(0,0,0,0.5)',
    accent: '#39a900',
    accentSoft: 'rgba(57,169,0,0.12)',
    accentBorder: 'rgba(57,169,0,0.3)',
    accentHover: 'rgba(57,169,0,0.25)',
    accentText: '#7dd56f',
    userBubble: 'linear-gradient(135deg, #39a900, #2d8a00)',
    send: 'linear-gradient(135deg, #39a900, #2d8a00)',
};

const TEMA_BONZI = {
    header: 'linear-gradient(135deg, #4c1d95 0%, #2e1065 100%)',
    border: 'rgba(168,85,247,0.35)',
    shadow: '0 12px 40px rgba(46,16,101,0.55)',
    accent: '#a855f7',
    accentSoft: 'rgba(168,85,247,0.14)',
    accentBorder: 'rgba(168,85,247,0.4)',
    accentHover: 'rgba(168,85,247,0.26)',
    accentText: '#d8b4fe',
    userBubble: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
    send: 'linear-gradient(135deg, #a855f7, #7c3aed)',
};

const ChatbotWidget = () => {
    const [isOpen, setIsOpen]       = useState(false);
    const [messages, setMessages]   = useState([
        {
            role: 'model',
            text: '¡Hola! 👋 Soy el asistente virtual de **SenaAccess**. ¿En qué puedo ayudarte hoy?',
        },
    ]);
    const [input, setInput]         = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [bonzi, setBonzi]         = useState(() => localStorage.getItem(BONZI_KEY) === '1');
    const [estadoMono, setEstadoMono] = useState('normal');
    const messagesEndRef            = useRef(null);
    const inputRef                  = useRef(null);
    const timerMono                 = useRef(null);

    // Limpia el temporizador del estado del mono al desmontar.
    useEffect(() => () => clearTimeout(timerMono.current), []);

    // Precarga las poses para que el cambio de imagen sea instantaneo.
    useEffect(() => {
        if (!bonzi) return;
        [bonziNormal, bonziPensando, bonziRespondiendo, bonziLlorando].forEach((src) => {
            const img = new Image();
            img.src = src;
        });
    }, [bonzi, isOpen]);

    // Precarga diferida al entrar al panel, sin bloquear la carga inicial.
    useEffect(() => {
        const t = setTimeout(() => {
            [bonziNormal, bonziPensando, bonziRespondiendo, bonziLlorando].forEach((src) => {
                const img = new Image();
                img.src = src;
            });
        }, 1500);
        return () => clearTimeout(t);
    }, []);

    // Auto-scroll al último mensaje
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    // Focus al input cuando se abre el chat
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 150);
        }
    }, [isOpen]);

    // Si la respuesta es un "no puedo/no sé", el mono llora en lugar de celebrar.
    const esSinRespuesta = (texto) => {
        const t = (texto || '').toLowerCase();
        return FRASES_SIN_RESPUESTA.some((frase) => t.includes(frase));
    };

    // Vuelve a la pose normal despues de mostrar la respuesta o el llanto.
    const volverANormal = () => {
        clearTimeout(timerMono.current);
        timerMono.current = setTimeout(() => setEstadoMono('normal'), BONZI_MS_FINAL);
    };

    // Pide contraseñas, tokens o credenciales de otra persona.
    const pideSensible = (texto) => {
        const t = (texto || '').toLowerCase();
        const secreto = /contrase(ñ|n)a|password|token|credencial/.test(t);
        const ajeno = /otro|otra|otros|otras|usuario|aprendiz|instructor|admin|superadmin/.test(t);
        return secreto && ajeno;
    };

    const sendMessage = async (text) => {
        const userText = (text || input).trim();
        if (!userText || isLoading) return;

        // Comando local: /bonzi alterna el icono sin llamar a la IA.
        const comando = userText.toLowerCase();
        if (comando === '/bonzi' || comando === '/bonzi reset') {
            const activar = comando === '/bonzi' ? !bonzi : false;
            clearTimeout(timerMono.current);
            setEstadoMono('normal');
            setInput('');
            setShowSuggestions(false);
            setBonzi(activar);
            localStorage.setItem(BONZI_KEY, activar ? '1' : '0');
            setMessages((prev) => [
                ...prev,
                { role: 'user', text: userText },
                { role: 'model', text: activar ? BONZI_ON : BONZI_OFF },
            ]);
            return;
        }

        setInput('');
        setShowSuggestions(false);
        const peticionSensible = pideSensible(userText);

        // Agrega mensaje del usuario
        const updatedMessages = [...messages, { role: 'user', text: userText }];
        setMessages(updatedMessages);
        setIsLoading(true);
        clearTimeout(timerMono.current);
        setEstadoMono('pensando');

        // Historial para enviar al backend (excluye el mensaje del sistema inicial)
        const history = updatedMessages.slice(1, -1).map((m) => ({
            role: m.role,
            text: m.text,
        }));

        try {
            const token = localStorage.getItem('access_token');
            const { data } = await axios.post(
                '/api/chatbot',
                { message: userText, history },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const respuesta = (data && typeof data.reply === 'string' && data.reply.trim())
                ? data.reply
                : 'No pude generar una respuesta. Intenta de nuevo.';

            setMessages((prev) => [
                ...prev,
                { role: 'model', text: respuesta },
            ]);
            setEstadoMono((peticionSensible || esSinRespuesta(respuesta)) ? 'llorando' : 'respondiendo');
            volverANormal();
        } catch (err) {
            setMessages((prev) => [
                ...prev,
                {
                    role: 'model',
                    text: '❌ Hubo un error al contactar el asistente. Verifica tu conexión e intenta de nuevo.',
                },
            ]);
            setEstadoMono('llorando');
            volverANormal();
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const clearChat = () => {
        setMessages([
            {
                role: 'model',
                text: '¡Hola! 👋 Soy el asistente virtual de **SenaAccess**. ¿En qué puedo ayudarte hoy?',
            },
        ]);
        setShowSuggestions(true);
    };

    // Renderiza texto con soporte básico de Markdown (negrita)
    const renderText = (text) => {
        const parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
                ? <strong key={i}>{part.slice(2, -2)}</strong>
                : part
        );
    };

    // Con Bonzi activo el personaje se muestra completo (sin circulo) y,
    // con el chat abierto, pasa al lado del cuadro.
    const tema = bonzi ? TEMA_BONZI : TEMA_SENA;
    // Mientras isLoading siempre se ve pensando; el resto lo decide estadoMono.
    const estadoVisual = isLoading ? 'pensando' : estadoMono;
    const imagenMono = IMAGENES_BONZI[estadoVisual] || bonziNormal;

    return (
        <>
            {/* ── Burbuja flotante (solo con el chat cerrado) ───────────── */}
            {!isOpen && (
                <button
                    id="chatbot-bubble"
                    className={bonzi ? 'chatbot-bubble chatbot-bubble-bonzi' : 'chatbot-bubble'}
                    onClick={() => setIsOpen(true)}
                    title={bonzi ? 'Bonzi — asistente SenaAccess' : 'Asistente SenaAccess'}
                    style={{
                        position: 'fixed',
                        bottom: bonzi ? '22px' : '28px',
                        right: bonzi ? '22px' : '28px',
                        width: bonzi ? '144px' : '60px',
                        height: bonzi ? '144px' : '60px',
                        borderRadius: bonzi ? '0' : '50%',
                        background: bonzi ? 'transparent' : 'linear-gradient(135deg, #39a900 0%, #2d8a00 100%)',
                        border: 'none',
                        boxShadow: bonzi ? 'none' : '0 4px 20px rgba(57,169,0,0.45)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        zIndex: 9999,
                    }}
                >
                    {bonzi ? (
                        <img
                            src={imagenMono}
                            alt="Bonzi"
                            draggable={false}
                            className="bonzi-img"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = bonziNormal; }}
                        />
                    ) : (
                        <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: '28px' }}>
                            smart_toy
                        </span>
                    )}
                </button>
            )}

            {/* ── Ventana del chat ─────────────────────────────────────── */}
            {isOpen && (
                <>
                <div
                    id="chatbot-window"
                    className={bonzi ? 'chatbot-window chatbot-window-bonzi' : 'chatbot-window'}
                    style={{
                        position: 'fixed',
                        bottom: bonzi ? '26px' : '100px',
                        right: '28px',
                        width: '370px',
                        maxWidth: 'calc(100vw - 24px)',
                        maxHeight: '540px',
                        borderRadius: '20px',
                        background: '#0d1117',
                        border: `1px solid ${tema.border}`,
                        boxShadow: tema.shadow,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        zIndex: 9998,
                        animation: 'chatSlideUp 0.25s ease-out',
                        '--bot-accent': tema.accent,
                    }}
                >
                    {/* Header */}
                    <div style={{
                        background: tema.header,
                        padding: '14px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px', lineHeight: 1.2 }}>
                                {bonzi ? 'Bonzi' : 'Asistente SenaAccess'}
                            </div>
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px' }}>
                                {bonzi ? 'Asistente SenaAccess · Gemini AI' : 'Impulsado por Gemini AI'}
                            </div>
                        </div>
                        <button
                            onClick={clearChat}
                            title="Limpiar chat"
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                color: '#fff',
                                fontSize: '11px',
                            }}
                        >
                            Limpiar
                        </button>
                        <button
                            onClick={() => setIsOpen(false)}
                            title="Cerrar chat"
                            aria-label="Cerrar chat"
                            style={{
                                background: 'rgba(255,255,255,0.15)',
                                border: 'none',
                                borderRadius: '8px',
                                width: '26px',
                                height: '26px',
                                cursor: 'pointer',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 0,
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                close
                            </span>
                        </button>
                    </div>

                    {/* Mensajes */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${tema.accent} transparent`,
                    }}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                }}
                            >
                                <div style={{
                                    maxWidth: '82%',
                                    padding: '10px 14px',
                                    borderRadius: msg.role === 'user'
                                        ? '18px 18px 4px 18px'
                                        : '18px 18px 18px 4px',
                                    background: msg.role === 'user'
                                        ? tema.userBubble
                                        : 'rgba(255,255,255,0.07)',
                                    color: '#f0f0f0',
                                    fontSize: '13px',
                                    lineHeight: 1.5,
                                    border: msg.role === 'model' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                                    whiteSpace: 'pre-wrap',
                                }}>
                                    {renderText(msg.text)}
                                </div>
                            </div>
                        ))}

                        {/* Indicador de carga (solo sin Bonzi; con Bonzi piensa el mono) */}
                        {isLoading && !bonzi && (
                            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                <div style={{
                                    padding: '10px 16px',
                                    borderRadius: '18px 18px 18px 4px',
                                    background: 'rgba(255,255,255,0.07)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    display: 'flex',
                                    gap: '5px',
                                    alignItems: 'center',
                                }}>
                                    {[0, 1, 2].map((i) => (
                                        <div key={i} style={{
                                            width: '7px',
                                            height: '7px',
                                            borderRadius: '50%',
                                            background: tema.accent,
                                            animation: `chatDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Sugerencias rápidas */}
                        {showSuggestions && !isLoading && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                {QUICK_SUGGESTIONS.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(s)}
                                        style={{
                                            background: tema.accentSoft,
                                            border: `1px solid ${tema.accentBorder}`,
                                            borderRadius: '20px',
                                            color: tema.accentText,
                                            fontSize: '11px',
                                            padding: '5px 10px',
                                            cursor: 'pointer',
                                            transition: 'background 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = tema.accentHover}
                                        onMouseLeave={(e) => e.currentTarget.style.background = tema.accentSoft}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div style={{
                        padding: '12px 14px',
                        borderTop: '1px solid rgba(255,255,255,0.07)',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-end',
                        background: 'rgba(255,255,255,0.03)',
                    }}>
                        <textarea
                            ref={inputRef}
                            id="chatbot-input"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu pregunta..."
                            rows={1}
                            disabled={isLoading}
                            style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.07)',
                                border: `1px solid ${tema.accentBorder}`,
                                borderRadius: '12px',
                                color: '#f0f0f0',
                                padding: '9px 13px',
                                fontSize: '13px',
                                resize: 'none',
                                outline: 'none',
                                lineHeight: 1.4,
                                maxHeight: '80px',
                                overflowY: 'auto',
                            }}
                            onFocus={(e) => e.target.style.borderColor = tema.accent}
                            onBlur={(e) => e.target.style.borderColor = tema.accentBorder}
                        />
                        <button
                            id="chatbot-send-btn"
                            onClick={() => sendMessage()}
                            disabled={isLoading || !input.trim()}
                            title="Enviar (Enter)"
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                background: input.trim() && !isLoading
                                    ? tema.send
                                    : 'rgba(255,255,255,0.08)',
                                border: 'none',
                                cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'background 0.2s',
                                flexShrink: 0,
                            }}
                        >
                            <span className="material-symbols-outlined" style={{
                                color: input.trim() && !isLoading ? '#fff' : 'rgba(255,255,255,0.3)',
                                fontSize: '20px',
                            }}>
                                send
                            </span>
                        </button>
                    </div>
                </div>

                {bonzi && (
                    <div className="bonzi-companion" aria-hidden="true">
                        <img
                            src={imagenMono}
                            alt=""
                            draggable={false}
                            className="bonzi-img"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = bonziNormal; }}
                        />
                        {isLoading && (
                            <div className="bonzi-hablando">
                                <span /><span /><span />
                            </div>
                        )}
                    </div>
                )}
                </>
            )}

            {/* ── Keyframes CSS ────────────────────────────────────────── */}
            <style>{`
                @keyframes chatSlideUp {
                    from { opacity: 0; transform: translateY(16px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0)   scale(1);    }
                }
                @keyframes chatDot {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40%           { transform: scale(1);   opacity: 1;   }
                }
                .bonzi-img {
                    display: block;
                    filter: drop-shadow(0 10px 16px rgba(0,0,0,0.55));
                }
                .bonzi-companion {
                    position: fixed;
                    right: 420px;
                    bottom: 26px;
                    width: 200px;
                    height: 200px;
                    z-index: 9997;
                    pointer-events: none;
                }
                .bonzi-companion .bonzi-img { width: 100%; height: 100%; object-fit: contain; }
                .bonzi-hablando {
                    position: absolute;
                    top: -24px;
                    left: 50%;
                    transform: translateX(-30%);
                    background: #2e1065;
                    border: 1px solid rgba(168,85,247,0.55);
                    border-radius: 14px 14px 14px 4px;
                    padding: 7px 9px;
                    display: flex;
                    gap: 4px;
                    align-items: center;
                    box-shadow: 0 6px 16px rgba(0,0,0,0.35);
                }
                .bonzi-hablando::before {
                    content: '';
                    position: absolute;
                    left: 34%;
                    bottom: -12px;
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background: #2e1065;
                    border: 1px solid rgba(168,85,247,0.5);
                }
                .bonzi-hablando::after {
                    content: '';
                    position: absolute;
                    left: 50%;
                    bottom: -6px;
                    width: 7px;
                    height: 7px;
                    margin-left: -3px;
                    border-radius: 50%;
                    background: #2e1065;
                    border: 1px solid rgba(168,85,247,0.55);
                }
                .bonzi-hablando span {
                    width: 6px; height: 6px; border-radius: 50%;
                    background: #c084fc;
                }
                @media (max-width: 820px) {
                    .chatbot-window-bonzi {
                        bottom: 104px !important;
                        right: 8px !important;
                        width: calc(100vw - 16px) !important;
                        max-height: calc(100vh - 120px) !important;
                    }
                    .bonzi-companion {
                        right: auto;
                        left: 10px;
                        bottom: 8px;
                        width: 88px;
                        height: 88px;
                    }
                    .bonzi-hablando {
                        top: 2px;
                        left: auto;
                        right: -10px;
                        transform: none;
                        padding: 5px 7px;
                    }
                    .bonzi-hablando::before { display: none; }
                    .bonzi-hablando::after {
                        left: -4px;
                        bottom: 8px;
                        margin-left: 0;
                    }
                    .bonzi-hablando span { width: 5px; height: 5px; }
                }
                @media (max-width: 480px) {
                    .chatbot-bubble-bonzi { width: 112px !important; height: 112px !important; }
                }
                #chatbot-window::-webkit-scrollbar { width: 4px; }
                #chatbot-window::-webkit-scrollbar-thumb { background: var(--bot-accent, #39a900); border-radius: 4px; }
            `}</style>
        </>
    );
};

export default ChatbotWidget;
