import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Timer, Users, Activity, Scale, ChevronLeft, ChevronRight } from 'lucide-react';
import { armazemStorage, MovimentoArmazem } from '../services/armazem';
import { localIsoDate } from '../services/sheetDt';
import { useAoSincronizar } from '../services/useNuvem';

type Periodo = 'hoje' | '7d' | '30d' | 'tudo';
const PERIODOS: { id: Periodo; nome: string }[] = [
  { id: 'hoje', nome: 'Hoje' },
  { id: '7d', nome: '7 dias' },
  { id: '30d', nome: '30 dias' },
  { id: 'tudo', nome: 'Tudo' },
];

const POR_PAGINA = 20;

const formatarTempo = (ms: number | null) => {
  if (ms === null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`;
};

// Tempo médio de entrada no estoque = tempo total ÷ total de pallets.
// Tempo total: do primeiro ao último lançamento de entrada, somado por usuário e por dia.
const tempoEntrada = (movs: MovimentoArmazem[]) => {
  const entradas = movs.filter((m) => m.tipo === 'entrada');
  const pallets = entradas.reduce((a, m) => a + m.pallets, 0);
  const turnos = new Map<string, { ini: number; fim: number }>();
  entradas.forEach((m) => {
    const d = new Date(m.em);
    const t = d.getTime();
    const k = `${m.usuario}|${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const g = turnos.get(k);
    if (g) {
      g.ini = Math.min(g.ini, t);
      g.fim = Math.max(g.fim, t);
    } else turnos.set(k, { ini: t, fim: t });
  });
  let total = 0;
  turnos.forEach((g) => (total += g.fim - g.ini));
  return { total, pallets, media: total > 0 && pallets > 0 ? total / pallets : null };
};

const somar = (movs: MovimentoArmazem[], tipo: MovimentoArmazem['tipo']) =>
  movs.filter((m) => m.tipo === tipo).reduce((a, m) => a + m.pallets, 0);

// Aba Performance da Armazenagem: indicadores a partir do histórico de movimentações
export const ArmazemPerformance: React.FC = () => {
  const [todos, setTodos] = useState<MovimentoArmazem[]>(() => armazemStorage.getMovimentos());
  useAoSincronizar(['armazem_mov'], () => setTodos(armazemStorage.getMovimentos()));
  const [periodo, setPeriodo] = useState<Periodo>('hoje');

  const movs = useMemo(() => {
    if (periodo === 'tudo') return todos;
    const hoje = localIsoDate();
    const inicio = new Date(`${hoje}T00:00:00`);
    if (periodo === '7d') inicio.setDate(inicio.getDate() - 6);
    if (periodo === '30d') inicio.setDate(inicio.getDate() - 29);
    return todos.filter((m) => new Date(m.em).getTime() >= inicio.getTime());
  }, [todos, periodo]);

  const entrada = somar(movs, 'entrada');
  const baixa = somar(movs, 'baixa');
  const transferencia = somar(movs, 'transferencia');
  const tempo = tempoEntrada(movs);

  const usuarios = useMemo(() => {
    const nomes = Array.from(new Set(movs.map((m) => m.usuario)));
    return nomes
      .map((nome) => {
        const lista = movs.filter((m) => m.usuario === nome);
        return {
          nome,
          lancamentos: lista.length,
          entrada: somar(lista, 'entrada'),
          baixa: somar(lista, 'baixa'),
          transferencia: somar(lista, 'transferencia'),
          tempo: tempoEntrada(lista).media,
        };
      })
      .sort((a, b) => b.entrada + b.baixa + b.transferencia - (a.entrada + a.baixa + a.transferencia));
  }, [movs]);

  const topSkus = useMemo(() => {
    const mapa = new Map<string, { sku: string; entrada: number; baixa: number }>();
    movs.forEach((m) => {
      if (m.tipo === 'transferencia') return;
      const g = mapa.get(m.sku) || { sku: m.sku, entrada: 0, baixa: 0 };
      g[m.tipo] += m.pallets;
      mapa.set(m.sku, g);
    });
    return Array.from(mapa.values())
      .sort((a, b) => b.entrada + b.baixa - (a.entrada + a.baixa))
      .slice(0, 5);
  }, [movs]);
  const maxSku = Math.max(1, ...topSkus.map((s) => s.entrada + s.baixa));

  // Últimas movimentações: mais recentes primeiro, 20 por página
  const ordenadas = useMemo(() => [...movs].sort((a, b) => b.em.localeCompare(a.em)), [movs]);
  const [pagina, setPagina] = useState(1);
  useEffect(() => setPagina(1), [periodo]);
  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const recentes = ordenadas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const cards = [
    { nome: 'Pallets na entrada', valor: entrada, sub: 'entraram no estoque', icone: ArrowDownToLine, cor: 'text-emerald-600 bg-emerald-50' },
    { nome: 'Pallets baixados', valor: baixa, sub: 'saíram do estoque', icone: ArrowUpFromLine, cor: 'text-rose-600 bg-rose-50' },
    { nome: 'Saldo do período', valor: entrada - baixa, sub: 'entrada − baixa', icone: Scale, cor: 'text-indigo-600 bg-indigo-50' },
    {
      nome: 'Tempo médio de entrada',
      valor: formatarTempo(tempo.media),
      sub: tempo.media === null ? 'por pallet' : `${formatarTempo(tempo.total)} ÷ ${tempo.pallets} pallets`, icone: Timer, cor: 'text-amber-600 bg-amber-50' },
    { nome: 'Pallets transferidos', valor: transferencia, sub: 'entre endereços', icone: ArrowLeftRight, cor: 'text-sky-600 bg-sky-50' },
    { nome: 'Movimentações', valor: movs.length, sub: 'lançamentos', icone: Activity, cor: 'text-slate-600 bg-slate-100' },
  ];

  const tipoInfo: Record<MovimentoArmazem['tipo'], { txt: string; cor: string }> = {
    entrada: { txt: 'Entrada', cor: 'bg-emerald-100 text-emerald-800' },
    baixa: { txt: 'Baixa', cor: 'bg-rose-100 text-rose-800' },
    transferencia: { txt: 'Transf.', cor: 'bg-sky-100 text-sky-800' },
  };

  return (
    <div className="space-y-4">
      {/* Período */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={`h-9 rounded-lg transition-all ${periodo === p.id ? 'bg-indigo-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            {p.nome}
          </button>
        ))}
      </div>

      {todos.length === 0 && (
        <p className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900">
          Ainda não há movimentações registradas. O histórico começa a contar a partir de agora: cada entrada, baixa e
          transferência de pallets passa a ser registrada com usuário, data e hora.
        </p>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {cards.map((c) => (
          <div key={c.nome} className="bg-white border border-slate-200 rounded-2xl p-3 flex items-center gap-3">
            <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${c.cor}`}>
              <c.icone className="w-5 h-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-black text-slate-900 leading-tight">{c.valor}</span>
              <span className="block text-[11px] font-bold uppercase text-slate-500 leading-tight">{c.nome}</span>
              <span className="block text-[10px] text-slate-400">{c.sub}</span>
            </span>
          </div>
        ))}
      </div>

      {/* Por usuário */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          <h3 className="font-black text-slate-900">Movimentação por usuário</h3>
        </div>
        {usuarios.length === 0 ? (
          <p className="p-4 text-sm text-slate-500 text-center">Sem movimentações no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 font-black">Usuário</th>
                  <th className="text-right px-3 py-2 font-black">Lanç.</th>
                  <th className="text-right px-3 py-2 font-black">Entrada</th>
                  <th className="text-right px-3 py-2 font-black">Baixa</th>
                  <th className="text-right px-3 py-2 font-black">Transf.</th>
                  <th className="text-right px-3 py-2 font-black whitespace-nowrap">Tempo / pallet</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.nome} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-bold text-slate-900">{u.nome}</td>
                    <td className="px-3 py-2 text-right font-mono">{u.lancamentos}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{u.entrada}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-rose-700">{u.baixa}</td>
                    <td className="px-3 py-2 text-right font-mono text-sky-700">{u.transferencia}</td>
                    <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{formatarTempo(u.tempo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SKUs mais movimentados */}
      {topSkus.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <h3 className="font-black text-slate-900">SKUs mais movimentados (pallets)</h3>
          {topSkus.map((s) => (
            <div key={s.sku} className="flex items-center gap-2 text-sm">
              <span className="w-20 shrink-0 font-mono font-black text-slate-900">{s.sku}</span>
              <span className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden flex">
                <span className="h-full bg-emerald-500" style={{ width: `${(s.entrada / maxSku) * 100}%` }} />
                <span className="h-full bg-rose-500" style={{ width: `${(s.baixa / maxSku) * 100}%` }} />
              </span>
              <span className="shrink-0 text-xs font-mono whitespace-nowrap">
                <span className="font-bold text-emerald-700">+{s.entrada}</span> /{' '}
                <span className="font-bold text-rose-700">−{s.baixa}</span>
              </span>
            </div>
          ))}
          <p className="text-[11px] text-slate-500">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500 mr-1 align-middle" />
            Entrada
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500 ml-3 mr-1 align-middle" />
            Baixa
          </p>
        </div>
      )}

      {/* Últimas movimentações */}
      {recentes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <h3 className="px-4 py-3 border-b border-slate-200 font-black text-slate-900 flex items-center justify-between gap-2">
            Últimas movimentações
            <span className="text-xs font-semibold text-slate-500">{ordenadas.length} registro(s)</span>
          </h3>
          <ul className="divide-y divide-slate-100">
            {recentes.map((m) => (
              <li key={m.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <span className={`w-16 shrink-0 text-center text-[11px] font-black rounded-md py-0.5 ${tipoInfo[m.tipo].cor}`}>
                  {tipoInfo[m.tipo].txt}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono font-bold text-slate-900 truncate">
                    {m.sku} • {m.lote} • {m.endereco}
                  </span>
                  <span className="block text-[11px] text-slate-500 truncate">
                    {m.usuario} • {new Date(m.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {m.origem ? ` • ${m.origem}` : ''}
                  </span>
                </span>
                <span className="shrink-0 font-mono font-black text-slate-900">{m.pallets} pl</span>
              </li>
            ))}
          </ul>
          {totalPaginas > 1 && (
            <div className="px-3 py-2 border-t border-slate-200 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setPagina(paginaAtual - 1)}
                disabled={paginaAtual <= 1}
                className="h-10 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-sm font-bold flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-xs font-semibold text-slate-600 text-center">
                Página {paginaAtual} de {totalPaginas}
                <span className="block text-[11px] text-slate-400">
                  {(paginaAtual - 1) * POR_PAGINA + 1}–{Math.min(paginaAtual * POR_PAGINA, ordenadas.length)} de {ordenadas.length}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPagina(paginaAtual + 1)}
                disabled={paginaAtual >= totalPaginas}
                className="h-10 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 text-sm font-bold flex items-center gap-1"
              >
                Próxima
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Tempo médio de entrada no estoque = tempo total ÷ total de pallets. O tempo total vai do primeiro ao último
        lançamento de entrada, somado por usuário e por dia. O histórico fica salvo neste aparelho.
      </p>
    </div>
  );
};
