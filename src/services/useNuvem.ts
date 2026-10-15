import { useEffect, useRef, useState } from 'react';
import { EVENTO_STATUS, EVENTO_SYNC, StatusNuvem, statusNuvem } from './nuvem';

// Estado da conexão com a nuvem (atualiza a cada mudança)
export const useStatusNuvem = () => {
  const [st, setSt] = useState<StatusNuvem>(() => statusNuvem());
  useEffect(() => {
    const h = (e: Event) => setSt((e as CustomEvent<StatusNuvem>).detail);
    window.addEventListener(EVENTO_STATUS, h);
    return () => window.removeEventListener(EVENTO_STATUS, h);
  }, []);
  return st;
};

// Executa o callback quando a sincronização alterar alguma das coleções informadas
export const useAoSincronizar = (colecoes: string[], cb: () => void) => {
  const ref = useRef(cb);
  ref.current = cb;
  const chave = colecoes.join('|');
  useEffect(() => {
    const lista = chave.split('|');
    const h = (e: Event) => {
      const alteradas = (e as CustomEvent<{ colecoes: string[] }>).detail?.colecoes || [];
      if (alteradas.some((c) => lista.includes(c))) ref.current();
    };
    window.addEventListener(EVENTO_SYNC, h);
    return () => window.removeEventListener(EVENTO_SYNC, h);
  }, [chave]);
};
