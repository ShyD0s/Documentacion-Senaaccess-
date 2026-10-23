import React, { useState, useEffect, useRef } from 'react';

// Recorte circular de foto sin librerias: preview en <canvas> con marco
// circular, zoom (range) y arrastre (mouse/touch via pointer events).
// Al confirmar entrega un Blob JPEG cuadrado de 512px listo para multipart.
const TAM = 300;

const RecorteFoto = ({ archivo, alConfirmar, alCancelar }) => {
    const canvasRef = useRef(null);
    const [img, setImg] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const arrastre = useRef(null);

    useEffect(() => {
        const url = URL.createObjectURL(archivo);
        const image = new Image();
        image.onload = () => {
            setImg(image);
            setZoom(1);
            setPos({ x: 0, y: 0 });
            URL.revokeObjectURL(url);
        };
        image.src = url;
    }, [archivo]);

    // Limita el desplazamiento para que el circulo siempre quede cubierto.
    const limitar = (x, y, escala) => {
        if (!img) return { x, y };
        const base = Math.max(TAM / img.width, TAM / img.height) * escala;
        const mx = Math.max(0, (img.width * base - TAM) / 2);
        const my = Math.max(0, (img.height * base - TAM) / 2);
        return {
            x: Math.min(mx, Math.max(-mx, x)),
            y: Math.min(my, Math.max(-my, y))
        };
    };

    // Dibuja fondo atenuado + circulo nitido + anillo verde.
    const dibujar = () => {
        const canvas = canvasRef.current;
        if (!canvas || !img) return;
        const ctx = canvas.getContext('2d');
        const base = Math.max(TAM / img.width, TAM / img.height) * zoom;
        const w = img.width * base;
        const h = img.height * base;
        const dx = TAM / 2 - w / 2 + pos.x;
        const dy = TAM / 2 - h / 2 + pos.y;
        ctx.clearRect(0, 0, TAM, TAM);
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.drawImage(img, dx, dy, w, h);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.arc(TAM / 2, TAM / 2, TAM / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, dx, dy, w, h);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(TAM / 2, TAM / 2, TAM / 2 - 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#02D914';
        ctx.lineWidth = 4;
        ctx.stroke();
    };

    useEffect(() => {
        dibujar();
    });

    const iniciarArrastre = (e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        arrastre.current = { inicioX: e.clientX - pos.x, inicioY: e.clientY - pos.y };
    };

    const moverArrastre = (e) => {
        if (!arrastre.current) return;
        setPos(limitar(e.clientX - arrastre.current.inicioX, e.clientY - arrastre.current.inicioY, zoom));
    };

    const terminarArrastre = () => {
        arrastre.current = null;
    };

    const cambiarZoom = (e) => {
        const z = parseFloat(e.target.value);
        setZoom(z);
        setPos(limitar(pos.x, pos.y, z));
    };

    // Recorta a 512px cuadrados con la misma transformacion del preview.
    const confirmar = () => {
        if (!img) return;
        const salida = document.createElement('canvas');
        salida.width = 512;
        salida.height = 512;
        const ctx = salida.getContext('2d');
        const base = Math.max(512 / img.width, 512 / img.height) * zoom;
        const w = img.width * base;
        const h = img.height * base;
        const k = 512 / TAM;
        ctx.save();
        ctx.beginPath();
        ctx.arc(256, 256, 256, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 256 - w / 2 + pos.x * k, 256 - h / 2 + pos.y * k, w, h);
        ctx.restore();
        salida.toBlob((blob) => {
            if (blob) alConfirmar(blob);
        }, 'image/jpeg', 0.85);
    };

    return (
        <div className="text-center border border-success border-opacity-25 rounded p-3 mb-3">
            <p className="small opacity-75 mb-2">Ajusta tu foto: arrastra para mover, usa el deslizador para zoom</p>
            <canvas
                ref={canvasRef}
                width={TAM}
                height={TAM}
                className="rounded-circle"
                style={{ touchAction: 'none', cursor: 'move', maxWidth: '100%' }}
                onPointerDown={iniciarArrastre}
                onPointerMove={moverArrastre}
                onPointerUp={terminarArrastre}
                onPointerCancel={terminarArrastre}
            />
            <input
                type="range"
                className="form-range mt-3"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={cambiarZoom}
                aria-label="Zoom de la foto"
            />
            <div className="d-flex gap-2 mt-2">
                <button type="button" className="btn btn-success flex-grow-1" onClick={confirmar} disabled={!img}>
                    <span className="material-symbols-outlined">check</span> Usar esta foto
                </button>
                <button type="button" className="btn btn-outline-secondary px-4" onClick={alCancelar}>
                    Cancelar
                </button>
            </div>
        </div>
    );
};

export default RecorteFoto;
