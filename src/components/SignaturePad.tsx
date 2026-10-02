import React, { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine } from 'lucide-react';

interface SignaturePadProps {
  label: string;
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
}

// Quadro de assinatura (dedo, caneta ou mouse). Gera PNG com fundo transparente para o Book PDF.
export const SignaturePad: React.FC<SignaturePadProps> = ({ label, value, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasInk, setHasInk] = useState(!!value);

  // Ajusta a resolução do canvas à tela (traço nítido) e redesenha a assinatura existente
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = '#0f172a';
    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext('2d');
    if (ctx && last.current) {
      ctx.beginPath();
      ctx.arc(last.current.x, last.current.y, 1.2, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
    }
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const ctx = e.currentTarget.getContext('2d');
    const p = point(e);
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    last.current = p;
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setHasInk(true);
    if (canvasRef.current) onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 flex items-center min-w-0">
          <PenLine className="w-3.5 h-3.5 mr-1 text-blue-600 shrink-0" />
          <span className="truncate">{label}</span>
        </label>
        {hasInk && (
          <button
            type="button"
            onClick={clear}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
          >
            <Eraser className="w-3.5 h-3.5" /> Limpar
          </button>
        )}
      </div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          className="w-full h-32 bg-white border-2 border-dashed border-slate-300 rounded-xl cursor-crosshair touch-none"
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
            Assine aqui com o dedo
          </span>
        )}
        <span className="pointer-events-none absolute left-4 right-4 bottom-6 border-b border-slate-300" />
      </div>
    </div>
  );
};
