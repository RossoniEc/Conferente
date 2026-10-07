import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ScrollButtonsListProps {
  children: React.ReactNode;
  maxHeightClass?: string; // altura máxima da área rolável (classe Tailwind)
  className?: string;
}

// Lista rolável sem barra lateral: botões grandes "Subir" e "Descer" fazem a rolagem (uso com luva / tela de toque)
export const ScrollButtonsList: React.FC<ScrollButtonsListProps> = ({
  children,
  maxHeightClass = 'max-h-56',
  className = '',
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanUp(el.scrollTop > 2);
    setCanDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, [update, children]);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ top: dir * el.clientHeight * 0.8, behavior: 'smooth' });
  };

  const temRolagem = canUp || canDown;
  const btn =
    'w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-extrabold transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed';

  return (
    <div className={`space-y-1.5 ${className}`}>
      {temRolagem && (
        <button
          type="button"
          onClick={() => scroll(-1)}
          disabled={!canUp}
          className={`${btn} bg-slate-700 hover:bg-slate-600 text-white`}
          aria-label="Subir a lista"
        >
          <ChevronUp className="w-6 h-6" />
          Subir
        </button>
      )}
      <div
        ref={ref}
        onScroll={update}
        className={`${maxHeightClass} overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        {children}
      </div>
      {temRolagem && (
        <button
          type="button"
          onClick={() => scroll(1)}
          disabled={!canDown}
          className={`${btn} bg-slate-700 hover:bg-slate-600 text-white`}
          aria-label="Descer a lista"
        >
          <ChevronDown className="w-6 h-6" />
          Descer
        </button>
      )}
    </div>
  );
};
