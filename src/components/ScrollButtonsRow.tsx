import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ScrollButtonsRowProps {
  children: React.ReactNode;
  className?: string;
}

// Linha rolável na horizontal sem barra: botões grandes ◀ ▶ nas laterais (uso com luva / tela de toque)
export const ScrollButtonsRow: React.FC<ScrollButtonsRowProps> = ({ children, className = '' }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
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
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const temRolagem = canLeft || canRight;
  const btn =
    'shrink-0 w-12 self-stretch rounded-xl flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white transition-all active:scale-95 disabled:opacity-25 disabled:cursor-not-allowed';

  return (
    <div className={`flex items-stretch gap-1.5 ${className}`}>
      {temRolagem && (
        <button type="button" onClick={() => scroll(-1)} disabled={!canLeft} className={btn} aria-label="Itens anteriores">
          <ChevronLeft className="w-7 h-7" />
        </button>
      )}
      <div
        ref={ref}
        onScroll={update}
        className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {temRolagem && (
        <button type="button" onClick={() => scroll(1)} disabled={!canRight} className={btn} aria-label="Próximos itens">
          <ChevronRight className="w-7 h-7" />
        </button>
      )}
    </div>
  );
};
