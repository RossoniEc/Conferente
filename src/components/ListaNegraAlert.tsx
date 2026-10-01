import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { PlacaListaNegra } from '../types';

// Compara placas ignorando hífen, espaço e maiúsculas/minúsculas (FDR-9087 = fdr9087)
export const normalizePlaca = (placa: string) => placa.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const findListaNegra = (placa: string | undefined, lista: PlacaListaNegra[] = []) => {
  if (!placa) return [];
  const alvo = normalizePlaca(placa);
  return lista.filter((p) => p.ativo && normalizePlaca(p.placa) === alvo);
};

interface ListaNegraAlertProps {
  placa?: string;
  lista?: PlacaListaNegra[];
  compact?: boolean;
}

// Alerta de placa na Lista Negra: banner completo ou linha compacta (cards de lista)
export const ListaNegraAlert: React.FC<ListaNegraAlertProps> = ({ placa, lista = [], compact = false }) => {
  const matches = findListaNegra(placa, lista);
  if (matches.length === 0) return null;

  if (compact) {
    return (
      <div className="mt-2 bg-slate-900 text-white rounded-xl p-2 flex items-start gap-2 text-[11px]">
        <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
        <span className="font-bold">
          LISTA NEGRA: {matches.map((m) => m.observacao).join(' • ')}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border-2 border-rose-500 rounded-2xl p-4 flex items-start gap-3 text-white shadow-lg shadow-rose-500/20">
      <div className="w-10 h-10 rounded-xl bg-rose-600 flex items-center justify-center shrink-0 animate-pulse">
        <ShieldAlert className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-black uppercase tracking-wider text-rose-400">
          ⚠ Veículo na Lista Negra • Placa {placa}
        </p>
        {matches.map((m) => (
          <p key={m.id} className="text-sm font-black">
            {m.observacao}
          </p>
        ))}
        <p className="text-[11px] text-slate-300">Redobre a atenção antes de carregar e ao fechar o veículo.</p>
      </div>
    </div>
  );
};
