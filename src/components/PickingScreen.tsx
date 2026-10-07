import React, { useMemo, useState } from 'react';
import { PackageSearch, Search, X, CheckCircle2, Circle, AlertTriangle, Truck, ArrowLeft, Boxes, Flag } from 'lucide-react';
import { CargoInspection, ProductDePara, SheetRowDT } from '../types';
import { armazemStorage, localizarSku, formatarData, EstoqueArmazem, SeparacoesArmazem } from '../services/armazem';
import { localIsoDate } from '../services/sheetDt';
import { playBeep } from '../services/sound';

interface PickingScreenProps {
  sheetRowsDT: SheetRowDT[];
  inspections: CargoInspection[];
  deParaList: ProductDePara[];
  soundEnabled: boolean;
}

interface LinhaSeparacao {
  chave: string;
  sku: string;
  descricao: string;
  endereco: string;
  lote: string;
  data?: string;
  pallets: number;
  volumeDt: number; // quantidade do SKU na DT (volumes)
}

// Separação de Carga: monta a lista de coleta por DT (endereço + lote, FIFO) e dá baixa no estoque
export const PickingScreen: React.FC<PickingScreenProps> = ({ sheetRowsDT, inspections, deParaList, soundEnabled }) => {
  const [estoque, setEstoque] = useState<EstoqueArmazem>(() => armazemStorage.getEstoque());
  const [separacoes, setSeparacoes] = useState<SeparacoesArmazem>(() => armazemStorage.getSeparacoes());
  const [filtro, setFiltro] = useState<'hoje' | 'todas'>('hoje');
  const [busca, setBusca] = useState('');
  const [dtSel, setDtSel] = useState<string | null>(null);
  const [confirmarBaixa, setConfirmarBaixa] = useState(false);
  // Flag: mostra só as DTs não iniciadas e em processo (esconde as já separadas e baixadas)
  const [somentePendentes, setSomentePendentes] = useState(false);

  const hojeIso = localIsoDate();
  const finalizada = (dt: string) =>
    inspections.some(
      (i) => i.dt.toUpperCase() === dt.toUpperCase() && (i.status === 'concluido' || i.status.startsWith('faturado'))
    );

  // DTs da LISTA DT ainda não finalizadas, agrupadas
  const dts = useMemo(() => {
    const map = new Map<string, { dt: string; cliente?: string; placa: string; data?: string; skus: number; volume: number; tipos: Set<string> }>();
    sheetRowsDT.forEach((r) => {
      if (finalizada(r.dt)) return;
      const k = r.dt.toUpperCase();
      const g = map.get(k) || { dt: r.dt, cliente: r.cliente, placa: r.placa, data: r.dataAgendamento, skus: 0, volume: 0, tipos: new Set<string>() };
      g.skus += 1;
      g.volume += r.quantidade;
      if (r.tipoCarga) g.tipos.add(r.tipoCarga);
      if (r.dataAgendamento && (!g.data || r.dataAgendamento > g.data)) g.data = r.dataAgendamento;
      map.set(k, g);
    });
    return Array.from(map.values()).sort((a, b) => (a.data || '9').localeCompare(b.data || '9') || a.dt.localeCompare(b.dt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetRowsDT, inspections]);

  const termo = busca.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const listaDts = dts.filter((g) =>
    (!somentePendentes || !separacoes[g.dt.toUpperCase()]?.baixadoEm) &&
    (termo
      ? g.dt.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(termo) || g.placa.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(termo)
      : filtro === 'hoje'
      ? g.data === hojeIso
      : true)
  );
  const pendentesCount = dts.filter(
    (g) => !separacoes[g.dt.toUpperCase()]?.baixadoEm && (filtro === 'todas' || g.data === hojeIso)
  ).length;

  // Pallets necessários por SKU: volumes ÷ PL Padrão Linha (De/Para); sem PL usa lastro × camada; sem nada usa QTDE PALETES
  const linhasDaDt = (dt: string) => {
    const rows = sheetRowsDT.filter((r) => r.dt.toUpperCase() === dt.toUpperCase());
    const porSku = new Map<string, { sku: string; descricao: string; volume: number; pallets: number }>();
    rows.forEach((r) => {
      const dp = deParaList.find((p) => p.sku.toUpperCase() === r.sku.toUpperCase());
      // Base: PL Padrão Linha do De/Para; sem PL, lastro x camada da planilha ou do De/Para
      const cxPallet =
        dp?.plPadraoLinha ||
        (r.lastro && r.camada ? r.lastro * r.camada : 0) ||
        (dp?.lastroPadrao && dp?.camadaPadrao ? dp.lastroPadrao * dp.camadaPadrao : 0);
      const pallets = cxPallet ? Math.ceil(r.quantidade / cxPallet) : Math.ceil(r.qtdPallet || 1);
      const g = porSku.get(r.sku) || { sku: r.sku, descricao: r.descricao, volume: 0, pallets: 0 };
      g.volume += r.quantidade;
      g.pallets += pallets;
      porSku.set(r.sku, g);
    });
    const linhas: LinhaSeparacao[] = [];
    const faltas: { sku: string; descricao: string; faltam: number }[] = [];
    porSku.forEach((s) => {
      let restante = s.pallets;
      for (const loc of localizarSku(estoque, s.sku)) {
        if (restante <= 0) break;
        const qtd = Math.min(loc.quantidade, restante);
        linhas.push({
          chave: `${s.sku}|${loc.lote}|${loc.endereco}|${loc.data || ''}`,
          sku: s.sku,
          descricao: s.descricao,
          endereco: loc.endereco,
          lote: loc.lote,
          data: loc.data,
          pallets: qtd,
          volumeDt: s.volume,
        });
        restante -= qtd;
      }
      if (restante > 0) faltas.push({ sku: s.sku, descricao: s.descricao, faltam: restante });
    });
    // SKUs em ordem crescente; dentro do mesmo SKU mantém a sugestão FIFO (data de entrada mais antiga primeiro)
    const porCodigo = (a: { sku: string }, b: { sku: string }) => a.sku.localeCompare(b.sku, 'pt-BR', { numeric: true });
    linhas.sort(porCodigo);
    faltas.sort(porCodigo);
    return { linhas, faltas, skus: Array.from(porSku.values()) };
  };

  const statusDt = (dt: string, total: number) => {
    const sep = separacoes[dt.toUpperCase()];
    if (sep?.baixadoEm) return { txt: 'Separada', cor: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    const feitos = Object.values(sep?.separados || {}).filter(Boolean).length;
    if (feitos === 0) return { txt: 'Não iniciada', cor: 'bg-slate-100 text-slate-600 border-slate-200' };
    if (total > 0 && feitos >= total) return { txt: 'Pronta p/ baixa', cor: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
    return { txt: `Em separação (${feitos}/${total})`, cor: 'bg-amber-100 text-amber-800 border-amber-200' };
  };

  const salvarSeparacoes = (novo: SeparacoesArmazem) => {
    setSeparacoes(novo);
    armazemStorage.saveSeparacoes(novo);
  };

  const alternar = (dt: string, chave: string) => {
    const k = dt.toUpperCase();
    const atual = separacoes[k] || { separados: {} };
    if (atual.baixadoEm) return;
    const marcado = !atual.separados[chave];
    salvarSeparacoes({ ...separacoes, [k]: { ...atual, separados: { ...atual.separados, [chave]: marcado } } });
    playBeep(marcado ? 'scan' : 'warning', soundEnabled);
  };

  // Baixa no estoque: retira os pallets separados dos endereços
  const baixarEstoque = (dt: string, linhas: LinhaSeparacao[]) => {
    const novo: EstoqueArmazem = JSON.parse(JSON.stringify(estoque));
    linhas.forEach((l) => {
      const itens = novo[l.endereco] || [];
      const idx = itens.findIndex((i) => i.sku === l.sku && i.lote === l.lote && (i.data || '') === (l.data || ''));
      if (idx < 0) return;
      itens[idx].quantidade -= l.pallets;
      if (itens[idx].quantidade <= 0) itens.splice(idx, 1);
      if (itens.length) novo[l.endereco] = itens;
      else delete novo[l.endereco];
    });
    setEstoque(novo);
    armazemStorage.saveEstoque(novo);
    const k = dt.toUpperCase();
    salvarSeparacoes({
      ...separacoes,
      [k]: {
        ...(separacoes[k] || { separados: {} }),
        baixadoEm: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
        linhasBaixadas: linhas,
      },
    });
    setConfirmarBaixa(false);
    playBeep('success', soundEnabled);
  };

  // ---------- Detalhe da DT ----------
  if (dtSel) {
    const g = dts.find((d) => d.dt === dtSel);
    const calc = linhasDaDt(dtSel);
    const sep = separacoes[dtSel.toUpperCase()] || { separados: {} };
    // Depois da baixa, mostra o que foi separado (e não o estoque que sobrou)
    const linhas: LinhaSeparacao[] = sep.baixadoEm
      ? (sep.linhasBaixadas || []).map((l) => ({ ...l, volumeDt: l.volumeDt ?? 0 }))
      : calc.linhas;
    const faltas = sep.baixadoEm ? [] : calc.faltas;
    const skus = calc.skus;
    const feitos = sep.baixadoEm ? linhas.length : linhas.filter((l) => sep.separados[l.chave]).length;
    const pct = linhas.length ? Math.round((feitos / linhas.length) * 100) : 0;
    const totalPallets = linhas.reduce((a, l) => a + l.pallets, 0);
    return (
      <div className="max-w-4xl mx-auto px-4 py-5 sm:py-6 space-y-4">
        <button
          type="button"
          onClick={() => {
            setDtSel(null);
            setConfirmarBaixa(false);
          }}
          className="h-11 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-sm font-bold flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar à lista de DTs
        </button>

        <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-teal-300">Lista de separação</span>
              <h2 className="text-3xl font-black font-mono">DT {dtSel}</h2>
              <p className="text-sm text-slate-300">
                {[g?.cliente, g?.placa, g?.data ? `expedição ${g.data.split('-').reverse().join('/')}` : ''].filter(Boolean).join(' • ')}
              </p>
            </div>
            <span className={`text-xs font-bold rounded-lg border px-2 py-1 ${statusDt(dtSel, linhas.length).cor}`}>
              {statusDt(dtSel, linhas.length).txt}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-800 rounded-xl p-2">
              <span className="block text-xl font-black">{skus.length}</span>
              <span className="text-[10px] uppercase text-slate-400 font-semibold">SKUs</span>
            </div>
            <div className="bg-slate-800 rounded-xl p-2">
              <span className="block text-xl font-black text-amber-300">{totalPallets}</span>
              <span className="text-[10px] uppercase text-slate-400 font-semibold">Pallets a separar</span>
            </div>
            <div className="bg-slate-800 rounded-xl p-2">
              <span className="block text-xl font-black text-emerald-300">{pct}%</span>
              <span className="text-[10px] uppercase text-slate-400 font-semibold">
                Separado ({feitos}/{linhas.length})
              </span>
            </div>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {faltas.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-900 space-y-1">
            <p className="font-black flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Estoque insuficiente na Armazenagem
            </p>
            {faltas.map((f) => (
              <p key={f.sku} className="text-sm">
                <strong className="font-mono">{f.sku}</strong> {f.descricao}: faltam <strong>{f.faltam}</strong> pallet(s)
              </p>
            ))}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {linhas.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">
              {sep.baixadoEm ? (
                'Separação baixada antes do registro detalhado das linhas: os itens separados não estão disponíveis para consulta.'
              ) : (
                <>
                  Nenhum endereço com estoque para os SKUs desta DT. Cadastre o estoque em <strong>Armazenagem</strong>.
                </>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {linhas.map((l) => {
                const ok = !!sep.baixadoEm || !!sep.separados[l.chave];
                return (
                  <li key={l.chave}>
                    <button
                      type="button"
                      onClick={() => alternar(dtSel, l.chave)}
                      disabled={!!sep.baixadoEm}
                      className={`w-full p-3 sm:p-4 text-left flex items-center gap-3 transition-colors ${
                        ok ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'
                      } disabled:cursor-default`}
                    >
                      {ok ? (
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="w-8 h-8 text-slate-300 shrink-0" />
                      )}
                      <span className="w-16 sm:w-20 shrink-0 text-center rounded-xl bg-indigo-700 text-white font-black text-lg py-2">
                        {l.endereco}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-mono font-black text-base text-slate-900">{l.sku}</span>
                        <span className="block text-xs sm:text-sm text-slate-600 break-words">{l.descricao}</span>
                        <span className="block text-xs text-slate-500">
                          Lote <strong className="font-mono">{l.lote}</strong> • Entrada{' '}
                          <strong className="font-mono">{formatarData(l.data)}</strong>
                        </span>
                      </span>
                      <span className="text-right shrink-0">
                        {l.volumeDt > 0 && (
                          <>
                            <span className="block text-3xl sm:text-4xl font-black text-slate-900 leading-none">
                              {l.volumeDt.toLocaleString('pt-BR')}
                            </span>
                            <span className="block text-[10px] sm:text-xs text-slate-500 font-semibold">vol. na DT</span>
                          </>
                        )}
                        <span className="inline-block mt-1 text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-1.5 py-0.5">
                          {l.pallets} pallet(s)
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {sep.baixadoEm ? (
          <p className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-semibold text-center">
            Separação concluída e baixada do estoque em {sep.baixadoEm}. Siga para "Selecionar Carga".
          </p>
        ) : linhas.length > 0 && feitos === linhas.length ? (
          confirmarBaixa ? (
            <div className="p-4 rounded-2xl bg-white border-2 border-emerald-400 space-y-3">
              <p className="text-sm font-bold text-slate-800">
                Dar baixa de {totalPallets} pallet(s) dos endereços da Armazenagem?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => baixarEstoque(dtSel, linhas)}
                  className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black"
                >
                  Sim, baixar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmarBaixa(false)}
                  className="h-12 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold"
                >
                  Não
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmarBaixa(true)}
              className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg flex items-center justify-center gap-2"
            >
              <Boxes className="w-6 h-6" />
              CONCLUIR SEPARAÇÃO E BAIXAR ESTOQUE
            </button>
          )
        ) : (
          linhas.length > 0 && (
            <p className="text-center text-sm font-bold text-amber-700">
              Toque em cada linha ao separar o pallet. Faltam {linhas.length - feitos} de {linhas.length}.
            </p>
          )
        )}
      </div>
    );
  }

  // ---------- Lista de DTs ----------
  return (
    <div className="max-w-4xl mx-auto px-4 py-5 sm:py-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-teal-600 block">Etapa 2 • Separação</span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <PackageSearch className="w-6 h-6 text-teal-600" />
            Separação de Carga
          </h2>
        </div>
        <p className="text-xs text-slate-500 max-w-sm">
          Lista de coleta por DT com endereço e lote sugeridos (data de entrada mais antiga primeiro — FIFO), a partir do estoque da Armazenagem.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-sm space-y-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold">
          {(['hoje', 'todas'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              className={`h-9 rounded-lg transition-all ${filtro === f ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              {f === 'hoje' ? `Hoje (${dts.filter((d) => d.data === hojeIso).length})` : `Todas (${dts.length})`}
            </button>
          ))}
        </div>

        <div className="flex items-stretch gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por Placa ou DT"
            className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base uppercase placeholder:normal-case placeholder:font-sans placeholder:text-sm focus:outline-none focus:border-teal-500 focus:bg-white"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700"
              aria-label="Limpar pesquisa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
          <button
            type="button"
            onClick={() => setSomentePendentes((v) => !v)}
            aria-pressed={somentePendentes}
            title="Mostrar somente DTs Não iniciadas e em processo"
            className={`shrink-0 h-12 px-3 sm:px-4 rounded-xl border text-sm font-bold flex items-center gap-2 transition-colors ${
              somentePendentes
                ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-sm'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Flag className={`w-5 h-5 ${somentePendentes ? 'fill-slate-950' : ''}`} />
            <span className="hidden sm:inline">Pendentes</span>
            <span className={`text-xs font-black rounded-full px-1.5 ${somentePendentes ? 'bg-slate-950/15' : 'bg-slate-100'}`}>
              {pendentesCount}
            </span>
          </button>
        </div>
        {somentePendentes && (
          <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5" />
            Mostrando somente DTs Não iniciadas e em processo. Toque na bandeira para ver todas.
          </p>
        )}

        {listaDts.length ? (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {listaDts.map((g) => {
              const total = linhasDaDt(g.dt).linhas.length;
              const st = statusDt(g.dt, total);
              return (
                <button
                  key={g.dt}
                  type="button"
                  onClick={() => setDtSel(g.dt)}
                  className="w-full px-3 sm:px-4 py-3 text-left flex items-center gap-3 bg-white hover:bg-teal-50/70 active:bg-teal-100 transition-colors"
                >
                  <Truck className="hidden min-[400px]:block w-5 h-5 text-teal-600 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-black font-mono text-base text-slate-900">DT {g.dt}</span>
                      <span className={`text-[11px] font-bold rounded-md border px-1.5 py-0.5 whitespace-nowrap ${st.cor}`}>{st.txt}</span>
                    </span>
                    {g.cliente && <span className="block text-sm font-bold text-slate-800 truncate">{g.cliente}</span>}
                    <span className="block text-xs text-slate-500 truncate">
                      {[g.placa, `${g.skus} SKU${g.skus > 1 ? 's' : ''}`, Array.from(g.tipos).join('/'), g.data ? g.data.split('-').reverse().join('/') : '']
                        .filter(Boolean)
                        .join(' • ')}
                    </span>
                  </span>
                  <span className="text-xs font-black font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 whitespace-nowrap">
                    {g.volume} vol.
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 text-center">
            {termo ? `Nenhuma DT com "${busca}".` : filtro === 'hoje' ? 'Nenhuma DT para expedição hoje.' : 'Nenhuma DT pendente na LISTA DT.'}
          </p>
        )}
      </div>
    </div>
  );
};
