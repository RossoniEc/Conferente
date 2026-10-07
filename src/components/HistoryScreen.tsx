import React, { useState } from 'react';
import {
  History,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
  Truck,
  Scissors,
  ReceiptText,
  Camera,
  X,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { AppSettings, CargoInspection, descreverMotivoCorte } from '../types';
import { generateBookCarregamentoPdf } from '../services/pdfGenerator';

interface HistoryScreenProps {
  inspections: CargoInspection[];
  settings: AppSettings;
}

// DTs encerradas: carga finalizada ou já faturada
const isEncerrada = (i: CargoInspection) => i.status === 'concluido' || i.status.startsWith('faturado');

const statusInfo = (status: CargoInspection['status']) => {
  switch (status) {
    case 'faturado_conferido':
      return { label: 'Faturada • OK', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
    case 'faturado_divergente':
      return { label: 'Faturada • Divergente', cls: 'bg-rose-100 text-rose-800 border-rose-200' };
    case 'concluido':
      return { label: 'Aguardando Faturamento', cls: 'bg-purple-100 text-purple-800 border-purple-200' };
    default:
      return { label: 'Em Conferência', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
};

// Dia (aaaa-mm-dd) em que a DT foi finalizada. Aceita "27/09/2026, 19:11" e "2026-09-27 09:45".
const dayKey = (insp: CargoInspection): string => {
  const raw = insp.dataFim || insp.dataInicio || '';
  const br = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : '';
};

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const shiftDay = (iso: string, delta: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return localIso(new Date(y, m - 1, d + delta));
};

const formatDay = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

const totais = (insp: CargoInspection) => {
  const planejado = insp.itensPlanejados.reduce((a, i) => a + i.quantidadePlanejada, 0);
  const corte = insp.itensConferidos.reduce((a, i) => a + (i.corteOperacional?.quantidade || 0), 0);
  const carregado = insp.itensConferidos.reduce((a, i) => a + i.quantidadeCarregada, 0);
  const faturado = insp.faturamento?.itensFaturados?.reduce((a, i) => a + i.quantidadeFaturada, 0);
  return { planejado, corte, carregado, faturado };
};

// DT faturada cujo carregado difere do faturado
const temDiferenca = (insp: CargoInspection) => {
  const t = totais(insp);
  return t.faturado !== undefined && t.carregado !== t.faturado;
};

// Resumo de um conjunto de DTs (cards e aba "Resumo" do Excel)
const calcResumo = (lista: CargoInspection[]) => {
  const resumo = lista.reduce(
    (acc, insp) => {
      const t = totais(insp);
      acc.planejado += t.planejado;
      acc.corte += t.corte;
      acc.carregado += t.carregado;
      if (t.faturado !== undefined) {
        acc.faturado += t.faturado;
        acc.carregadoFaturadas += t.carregado;
        acc.faturadas += 1;
      }
      return acc;
    },
    { planejado: 0, corte: 0, carregado: 0, faturado: 0, carregadoFaturadas: 0, faturadas: 0 }
  );
  const pendentesFat = lista.length - resumo.faturadas;
  // Dif. considera só as DTs já faturadas (as pendentes ainda não têm faturado)
  const difDia = resumo.carregadoFaturadas - resumo.faturado;

  // Detalhamento do corte: por motivo e por lançamento
  const cortes = lista.flatMap((insp) =>
    insp.itensConferidos
      .filter((i) => i.corteOperacional && i.corteOperacional.quantidade > 0)
      .map((i) => ({
        dt: insp.dt,
        sku: i.sku,
        descricao: i.descricao,
        quantidade: i.corteOperacional!.quantidade,
        motivo: descreverMotivoCorte(i.corteOperacional!),
        quando: i.corteOperacional!.timestamp,
      }))
  );
  const cortesPorMotivo = Object.entries(
    cortes.reduce<Record<string, number>>((acc, c) => {
      acc[c.motivo] = (acc[c.motivo] || 0) + c.quantidade;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return { resumo, pendentesFat, difDia, cortes, cortesPorMotivo };
};

// Planejado x Corte x Carregado x Faturado por SKU de uma DT
const porSku = (insp: CargoInspection) => {
  const map = new Map<string, { sku: string; descricao: string; planejado: number; corte: number; carregado: number; faturado: number }>();
  const get = (sku: string, descricao: string) => {
    if (!map.has(sku)) map.set(sku, { sku, descricao, planejado: 0, corte: 0, carregado: 0, faturado: 0 });
    return map.get(sku)!;
  };
  insp.itensPlanejados.forEach((p) => (get(p.sku, p.descricao).planejado += p.quantidadePlanejada));
  insp.itensConferidos.forEach((c) => {
    const r = get(c.sku, c.descricao);
    r.carregado += c.quantidadeCarregada;
    r.corte += c.corteOperacional?.quantidade || 0;
  });
  insp.faturamento?.itensFaturados?.forEach((f) => (get(f.sku, `Produto ${f.sku}`).faturado += f.quantidadeFaturada));
  return Array.from(map.values());
};

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ inspections, settings }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);
  const today = localIso(new Date());
  // Dia do resumo ('all' = todos os dias). Controla os cards e a lista.
  const [day, setDay] = useState<string>(today);
  const [showCorteDetail, setShowCorteDetail] = useState(false);

  const encerradas = inspections.filter(isEncerrada);
  const doDia = day === 'all' ? encerradas : encerradas.filter((i) => dayKey(i) === day);

  // Resumo do dia
  const { resumo, pendentesFat, difDia, cortes, cortesPorMotivo } = calcResumo(doDia);
  // DTs do período com volume carregado
  const dtsCarregadas = doDia.filter((i) => i.itensConferidos.some((c) => c.quantidadeCarregada > 0)).length;

  // Filtro pelo card "Dif. (Carreg − Fat)": DTs faturadas com diferença de carregamento
  const [onlyDivergentes, setOnlyDivergentes] = useState(false);
  const divergentes = doDia.filter(temDiferenca);

  const filtered = (onlyDivergentes ? divergentes : doDia).filter((i) => {
    const term = searchTerm.toLowerCase();
    return (
      i.dt.toLowerCase().includes(term) ||
      i.placa.toLowerCase().includes(term) ||
      (i.motorista || '').toLowerCase().includes(term) ||
      (i.itensPlanejados[0]?.cliente || '').toLowerCase().includes(term)
    );
  });

  const selected = inspections.find((i) => i.id === selectedId) || null;

  // Exporta o período selecionado para Excel (.xlsx) com abas Resumo, DTs, Leituras e Cortes
  const [exporting, setExporting] = useState(false);
  // somenteDivergentes: exporta só as DTs com diferença de carregamento + aba de divergência por SKU
  const handleExportExcel = async (somenteDivergentes = false) => {
    setExporting(true);
    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser');
      const h = (value: string) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E2E8F0' });
      const periodo = day === 'all' ? 'Todos os dias' : formatDay(day);
      const lista = somenteDivergentes ? divergentes : doDia;
      const { resumo, pendentesFat, difDia, cortes, cortesPorMotivo } = calcResumo(lista);

      const resumoRows = [
        [h('Indicador'), h('Valor')],
        ['Período', periodo],
        ['Filtro', somenteDivergentes ? 'Somente DTs com diferença de carregamento (Carreg ≠ Fat)' : 'Todas as DTs'],
        ['Total de DTs', lista.length],
        ['Volume planejado', resumo.planejado],
        ['Corte operacional', resumo.corte],
        ['Volume carregado', resumo.carregado],
        ['Volume faturado', resumo.faturado],
        ['DTs faturadas', resumo.faturadas],
        ['DTs pendentes de faturamento', pendentesFat],
        ['Dif. (Carregado - Faturado) das DTs faturadas', difDia],
        [],
        [h('Corte por motivo'), h('Volumes')],
        ...cortesPorMotivo.map(([motivo, qtd]) => [motivo, qtd]),
      ];

      const dtRows = [
        [
          h('DT'), h('Situação'), h('Cliente'), h('Placa'), h('Motorista'), h('Transportadora'), h('Conferente'),
          h('Início'), h('Finalização'), h('Lacre'), h('Planejado'), h('Corte'), h('Carregado'), h('Faturado'),
          h('Dif. (Carreg - Fat)'), h('Nota(s) Fiscal(is)'), h('Auditor Fiscal'),
        ],
        ...lista.map((insp) => {
          const t = totais(insp);
          return [
            insp.dt,
            statusInfo(insp.status).label,
            insp.itensPlanejados[0]?.cliente || '',
            insp.placa,
            insp.motorista || '',
            insp.transportadora || '',
            insp.conferente,
            insp.dataInicio,
            insp.dataFim || '',
            insp.numeroLacre || '',
            t.planejado,
            t.corte,
            t.carregado,
            t.faturado ?? null,
            t.faturado !== undefined ? t.carregado - t.faturado : null,
            insp.faturamento?.chaveNFe || '',
            insp.faturamento?.conferenteFat || '',
          ];
        }),
      ];

      const leituraRows = [
        [
          h('DT'), h('SKU'), h('Descrição'), h('Lote(s)'), h('Lastro'), h('Camada'), h('Pallets'),
          h('Volumes'), h('Corte'), h('Motivo do Corte'), h('Hora'),
        ],
        ...lista.flatMap((insp) =>
          insp.itensConferidos.map((i) => [
            insp.dt,
            i.sku,
            i.descricao,
            i.lotes?.length ? i.lotes.map((l) => `${l.lote} (${l.quantidade})`).join(', ') : i.lote,
            i.lastro ?? null,
            i.camada ?? null,
            i.pallets ?? null,
            i.quantidadeCarregada,
            i.corteOperacional?.quantidade ?? null,
            i.corteOperacional ? descreverMotivoCorte(i.corteOperacional) : '',
            i.timestamp,
          ])
        ),
      ];

      const corteRows = [
        [h('DT'), h('SKU'), h('Descrição'), h('Volumes'), h('Motivo'), h('Lançado em')],
        ...cortes.map((c) => [c.dt, c.sku, c.descricao, c.quantidade, c.motivo, c.quando || '']),
      ];

      // Divergência por SKU (Carregado x Faturado) das DTs faturadas
      const divergenciaRows = [
        [
          h('DT'), h('SKU'), h('Descrição'), h('Planejado'), h('Corte'), h('Planejado Líquido'),
          h('Carregado'), h('Faturado'), h('Dif. (Carreg - Fat)'), h('Situação'),
        ],
        ...lista
          .filter((insp) => insp.faturamento)
          .flatMap((insp) =>
            porSku(insp).map((r) => {
              const dif = r.carregado - r.faturado;
              return [
                insp.dt, r.sku, r.descricao, r.planejado, r.corte, r.planejado - r.corte,
                r.carregado, r.faturado, dif,
                dif === 0 ? 'OK' : dif > 0 ? 'Sobra física (não faturado)' : 'Falta física (faturado a mais)',
              ];
            })
          ),
      ];

      const w = (...widths: number[]) => widths.map((width) => ({ width }));
      const sufixo = (day === 'all' ? 'geral' : day) + (somenteDivergentes ? '_divergencias' : '');
      await writeXlsxFile([
        { sheet: 'Resumo', data: resumoRows, columns: w(44, 52) },
        { sheet: 'DTs', data: dtRows, columns: w(14, 22, 12, 11, 20, 22, 22, 17, 17, 10, 11, 9, 11, 10, 16, 22, 22), stickyRowsCount: 1 },
        { sheet: 'Divergência por SKU', data: divergenciaRows, columns: w(14, 14, 30, 10, 8, 14, 10, 10, 16, 28), stickyRowsCount: 1 },
        { sheet: 'Leituras', data: leituraRows, columns: w(14, 14, 30, 28, 8, 8, 8, 10, 8, 18, 8), stickyRowsCount: 1 },
        { sheet: 'Cortes', data: corteRows, columns: w(14, 14, 30, 10, 20, 20), stickyRowsCount: 1 },
      ]).toFile(`Historico_DTs_${sufixo}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPdf = (insp: CargoInspection) => {
    const { doc, filename } = generateBookCarregamentoPdf(insp, settings.empresaNome, settings.unidadeCD);
    doc.save(filename);
  };

  // ============================================================
  // DETALHE DA DT
  // ============================================================
  if (selected) {
    const t = totais(selected);
    const temFat = t.faturado !== undefined;
    const dif = temFat ? t.carregado - (t.faturado as number) : t.carregado - (t.planejado - t.corte);
    const st = statusInfo(selected.status);

    // Book de imagens: veículo na chegada, pallets por leitura e fechamento/lacre
    const fotos: { label: string; src: string }[] = [];
    if (selected.fotoVeiculoInicio) fotos.push({ label: 'Veículo na chegada / Placa', src: selected.fotoVeiculoInicio });
    selected.itensConferidos.forEach((item) =>
      item.fotos.forEach((f, idx) => fotos.push({ label: `${item.sku} • Lote ${item.lote || 'S/L'} #${idx + 1}`, src: f }))
    );
    selected.fotosGerais?.forEach((f, idx) => fotos.push({ label: `Foto geral #${idx + 1}`, src: f }));
    if (selected.fotoVeiculoFim) fotos.push({ label: 'Final da carga', src: selected.fotoVeiculoFim });
    if (selected.fotoLacre) {
      fotos.push({ label: `Lacre ${selected.numeroLacre || ''}`.trim(), src: selected.fotoLacre });
    }

    return (
      <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 self-start"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao Histórico
          </button>
          <button
            type="button"
            onClick={() => handleDownloadPdf(selected)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Download className="w-4 h-4" />
            Baixar Book (PDF)
          </button>
        </div>

        {/* Cabeçalho da DT */}
        <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-xl border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Doc. Transporte</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black font-mono">{selected.dt}</span>
                {selected.itensPlanejados[0]?.cliente && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {selected.itensPlanejados[0].cliente}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${st.cls}`}>{st.label}</span>
              <span className="bg-white text-slate-900 px-2.5 py-0.5 rounded border-2 border-blue-600 font-mono font-black text-xs">
                {selected.placa}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block">Motorista</span>
              <span className="font-bold">{selected.motorista || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Transportadora</span>
              <span className="font-bold">{selected.transportadora || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Conferente</span>
              <span className="font-bold">{selected.conferente}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Nº do Lacre</span>
              <span className="font-bold font-mono">{selected.numeroLacre || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Início</span>
              <span className="font-bold">{selected.dataInicio}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Finalização</span>
              <span className="font-bold">{selected.dataFim || '—'}</span>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          {[
            { label: 'Planejado', value: t.planejado, cls: 'text-slate-900' },
            { label: 'Corte', value: t.corte > 0 ? `-${t.corte}` : '—', cls: 'text-orange-700' },
            { label: 'Carregado', value: t.carregado, cls: 'text-emerald-700' },
            { label: 'Faturado', value: temFat ? t.faturado : 'Pendente', cls: 'text-purple-700' },
            {
              label: temFat ? 'Dif. (Carreg − Fat)' : 'Dif. (Carreg − Plan. líq.)',
              value: dif === 0 ? '0' : dif > 0 ? `+${dif}` : dif,
              cls: dif === 0 ? 'text-emerald-700' : 'text-rose-600',
            },
          ].map((c) => (
            <div key={c.label} className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">{c.label}</span>
              <span className={`text-lg font-black font-mono ${c.cls}`}>{c.value}</span>
            </div>
          ))}
        </div>

        {/* Conferência: leituras registradas */}
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
            <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Truck className="w-4 h-4 text-emerald-600" />
              Conferência de Carga ({selected.itensConferidos.length} leituras)
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5">SKU</th>
                  <th className="px-3.5 py-2.5">Descrição</th>
                  <th className="px-3.5 py-2.5">Lote(s)</th>
                  <th className="px-3.5 py-2.5">Cálculo</th>
                  <th className="px-3.5 py-2.5 text-right">Volumes</th>
                  <th className="px-3.5 py-2.5">Corte</th>
                  <th className="px-3.5 py-2.5 text-right">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {selected.itensConferidos.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3.5 py-2.5 font-mono font-bold text-slate-900">{item.sku}</td>
                    <td className="px-3.5 py-2.5 text-slate-700">{item.descricao}</td>
                    <td className="px-3.5 py-2.5 font-mono text-slate-700">
                      {item.lotes?.length ? item.lotes.map((l) => `${l.lote} (${l.quantidade})`).join(', ') : item.lote}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600">
                      {item.lastro && item.camada
                        ? (() => {
                            const avulsos = item.quantidadeCarregada - item.lastro * item.camada * (item.pallets || 1);
                            return `${item.lastro} x ${item.camada}${
                              item.pallets ? ` x ${item.pallets} pallet(s)` : ''
                            }${avulsos > 0 ? ` + ${avulsos} quadrinhos` : ''}`;
                          })()
                        : 'Entrada direta'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-black text-slate-900">{item.quantidadeCarregada}</td>
                    <td className="px-3.5 py-2.5 text-orange-700">
                      {item.corteOperacional ? (
                        <span className="inline-flex items-center gap-1">
                          <Scissors className="w-3 h-3" />
                          {item.corteOperacional.quantidade} • {descreverMotivoCorte(item.corteOperacional)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right text-slate-500">{item.timestamp}</td>
                  </tr>
                ))}
                {selected.itensConferidos.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3.5 py-4 text-center text-slate-500">
                      Nenhuma leitura registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Faturamento */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-2">
          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <ReceiptText className="w-4 h-4 text-purple-600" />
            Conferência de Faturamento
          </h4>
          {selected.faturamento ? (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Nota(s) Fiscal(is)</span>
                <span className="font-bold font-mono break-all">{selected.faturamento.chaveNFe || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Resultado</span>
                <span
                  className={`font-bold inline-flex items-center gap-1 ${
                    selected.faturamento.status === 'conferido_ok' ? 'text-emerald-700' : 'text-rose-600'
                  }`}
                >
                  {selected.faturamento.status === 'conferido_ok' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  {selected.faturamento.status === 'conferido_ok' ? 'Sem divergência' : 'Com divergência'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Auditor Fiscal</span>
                <span className="font-bold">{selected.faturamento.conferenteFat || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Data</span>
                <span className="font-bold">{selected.faturamento.dataConferencia || '—'}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Faturamento ainda não conferido para esta DT.</p>
          )}
        </div>

        {/* Book de imagens */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
          <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-amber-500" />
            Book de Imagens ({fotos.length})
          </h4>
          {fotos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {fotos.map((f, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setExpandedPhoto(f.src)}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100"
                >
                  <img src={f.src} alt={f.label} className="w-full h-full object-cover group-hover:opacity-90" />
                  <span className="absolute bottom-0 left-0 right-0 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-1 truncate text-left">
                    {f.label}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">Nenhuma foto registrada nesta conferência.</p>
          )}
        </div>

        {expandedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
            onClick={() => setExpandedPhoto(null)}
          >
            <button
              type="button"
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={expandedPhoto} alt="Foto ampliada" className="max-w-full max-h-full rounded-xl" />
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // LISTA DE DTs
  // ============================================================
  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6 space-y-5">
      <div className="pb-3 border-b border-slate-200">
        <span className="text-[11px] font-black uppercase tracking-wider text-sky-600 block">
          Tópico 7 • Consulta
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
          <History className="w-6 h-6 text-sky-600" />
          Histórico de DTs
        </h2>
      </div>

      {/* Resumo do dia */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
              {day === 'all' ? 'Resumo Geral' : 'Resumo do Dia'}
            </h3>
            <p className="text-xs text-slate-500">
              {day === 'all'
                ? 'Todas as DTs encerradas'
                : `${formatDay(day)}${day === today ? ' (hoje)' : ''} • DTs finalizadas no dia`}
            </p>
          </div>

          {/* Navegação entre dias */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDay(shiftDay(day === 'all' ? today : day, -1))}
              className="p-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100"
              title="Dia anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={day === 'all' ? '' : day}
              max={today}
              onChange={(e) => e.target.value && setDay(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-sky-500"
              aria-label="Escolher dia"
            />
            <button
              type="button"
              onClick={() => setDay(shiftDay(day, 1))}
              disabled={day === 'all' || day >= today}
              className="p-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Próximo dia"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setDay(today)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                day === today ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setDay('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                day === 'all' ? 'bg-sky-600 text-white border-sky-600' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Todos os dias
            </button>
            <button
              type="button"
              onClick={() => handleExportExcel()}
              disabled={exporting || doDia.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title={doDia.length === 0 ? 'Nenhuma DT no período' : 'Exportar o período para Excel (.xlsx)'}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {exporting ? 'Exportando…' : 'Exportar Excel'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">
              Volume DTs
            </span>
            <span className="text-xl font-black font-mono text-slate-900">{resumo.planejado}</span>
            <span className="block text-[10px] font-semibold text-slate-500">
              vol. • {doDia.length} DT{doDia.length === 1 ? '' : 's'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowCorteDetail(true)}
            disabled={cortes.length === 0}
            className="bg-orange-50 border border-orange-200 hover:border-orange-400 disabled:hover:border-orange-200 disabled:cursor-default rounded-2xl p-3 text-center transition-colors"
            title={cortes.length ? 'Ver detalhamento dos motivos' : 'Sem corte no período'}
          >
            <span className="text-[10px] font-bold uppercase text-orange-700 flex items-center justify-center gap-1">
              <Scissors className="w-3 h-3" /> Corte
            </span>
            <span className="text-xl font-black font-mono text-orange-700">
              {resumo.corte > 0 ? `-${resumo.corte}` : '0'}
            </span>
            {cortes.length > 0 && (
              <span className="block text-[10px] font-bold text-orange-600 underline">Ver motivos</span>
            )}
          </button>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Carregado</span>
            <span className="text-xl font-black font-mono text-emerald-700">{resumo.carregado}</span>
            <span className="block text-[10px] font-semibold text-slate-500">
              vol. • {dtsCarregadas} DT{dtsCarregadas === 1 ? '' : 's'}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Faturado</span>
            <span className="text-xl font-black font-mono text-purple-700">{resumo.faturado}</span>
            {pendentesFat > 0 && (
              <span className="block text-[10px] font-semibold text-slate-500">{pendentesFat} DT(s) pendente(s)</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOnlyDivergentes(!onlyDivergentes)}
            disabled={divergentes.length === 0 && !onlyDivergentes}
            className={`rounded-2xl p-3 text-center border transition-colors disabled:cursor-default ${
              onlyDivergentes
                ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300/50'
                : 'bg-slate-50 border-slate-200 hover:border-rose-300 disabled:hover:border-slate-200'
            }`}
            title={
              divergentes.length
                ? onlyDivergentes
                  ? 'Mostrar todas as DTs'
                  : 'Filtrar as DTs com diferença de carregamento'
                : 'Nenhuma DT com diferença no período'
            }
          >
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Dif. (Carreg − Fat)</span>
            <span className={`text-xl font-black font-mono ${difDia === 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {difDia > 0 ? `+${difDia}` : difDia}
            </span>
            {pendentesFat > 0 && resumo.faturadas > 0 && (
              <span className="block text-[10px] font-semibold text-slate-500">sobre {resumo.faturadas} DT(s) faturada(s)</span>
            )}
            {divergentes.length > 0 && (
              <span className="block text-[10px] font-bold text-rose-600 underline">
                {onlyDivergentes ? 'Limpar filtro' : `Ver ${divergentes.length} DT(s) com diferença`}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filtro ativo: DTs com diferença de carregamento */}
      {onlyDivergentes && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-rose-50 border border-rose-300 rounded-2xl px-4 py-3">
          <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            Filtrando {divergentes.length} DT(s) com diferença de carregamento (Carregado ≠ Faturado)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleExportExcel(true)}
              disabled={exporting || divergentes.length === 0}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 disabled:opacity-50"
              title="Exportar para Excel só as DTs com diferença, com a divergência por SKU"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {exporting ? 'Exportando…' : 'Exportar Excel'}
            </button>
            <button
              type="button"
              onClick={() => setOnlyDivergentes(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-300 text-rose-800 hover:bg-rose-100"
            >
              Limpar filtro
            </button>
          </div>
        </div>
      )}

      {/* Detalhamento do corte operacional */}
      {showCorteDetail && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          onClick={() => setShowCorteDetail(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-orange-600 text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h4 className="font-black text-sm uppercase tracking-wider flex items-center gap-1.5">
                  <Scissors className="w-4 h-4" /> Corte Operacional
                </h4>
                <p className="text-xs text-orange-100">
                  {day === 'all' ? 'Todos os dias' : formatDay(day)} • Total {resumo.corte} vol.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCorteDetail(false)}
                className="p-1.5 rounded-lg hover:bg-orange-700"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Por motivo */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase text-slate-500">Por motivo</span>
                {cortesPorMotivo.map(([motivo, qtd]) => {
                  const pct = resumo.corte > 0 ? Math.round((qtd / resumo.corte) * 100) : 0;
                  return (
                    <div key={motivo} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{motivo}</span>
                        <span className="font-mono font-bold text-orange-700">
                          {qtd} vol. <span className="text-slate-400 font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lançamentos */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase text-slate-500">Lançamentos</span>
                {cortes.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-bold text-slate-900">{c.dt}</span>
                      <span className="text-slate-500"> • SKU {c.sku}</span>
                      <p className="text-[11px] text-slate-500 truncate">
                        {c.descricao} • {c.motivo}
                        {c.quando ? ` • ${c.quando}` : ''}
                      </p>
                    </div>
                    <span className="font-mono font-black text-orange-700 shrink-0">-{c.quantidade}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por DT, Placa, Motorista ou Cliente..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-sky-500 shadow-sm"
          />
        </div>
        <span className="px-3 py-2 bg-sky-100 text-sky-900 border border-sky-200 rounded-xl text-xs font-bold whitespace-nowrap">
          {doDia.length} DT{doDia.length === 1 ? '' : 's'} {day === 'all' ? 'encerradas' : 'no dia'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-500 space-y-2">
          <History className="w-12 h-12 mx-auto text-slate-300" />
          <p className="text-xs">
            {searchTerm
              ? 'Nenhuma DT encontrada para a busca.'
              : day === 'all'
              ? 'Nenhuma DT encerrada ainda.'
              : `Nenhuma DT encerrada em ${formatDay(day)}.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((insp) => {
            const t = totais(insp);
            const st = statusInfo(insp.status);
            const nFotos =
              insp.itensConferidos.reduce((a, i) => a + i.fotos.length, 0) +
              (insp.fotoVeiculoInicio ? 1 : 0) +
              (insp.fotoVeiculoFim ? 1 : 0) +
              (insp.fotoLacre ? 1 : 0) +
              (insp.fotosGerais?.length || 0);
            return (
              <button
                key={insp.id}
                type="button"
                onClick={() => setSelectedId(insp.id)}
                className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-black text-base text-slate-900">{insp.dt}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.cls}`}>{st.label}</span>
                    <span className="bg-white border-2 border-blue-600 rounded px-1.5 text-[11px] font-mono font-black text-slate-900">
                      {insp.placa}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {insp.itensPlanejados[0]?.cliente ? `${insp.itensPlanejados[0].cliente} • ` : ''}
                    Finalizada: {insp.dataFim || insp.dataInicio} • Conferente: {insp.conferente.split(' ')[0]}
                  </p>
                  <p className="text-[11px] font-mono text-slate-600">
                    Plan. {t.planejado}
                    {t.corte > 0 && <span className="text-orange-700"> • Corte −{t.corte}</span>} • Carreg.{' '}
                    <strong className="text-emerald-700">{t.carregado}</strong>
                    {t.faturado !== undefined && (
                      <>
                        {' '}
                        • Fat. <strong className="text-purple-700">{t.faturado}</strong>
                      </>
                    )}
                    <span className="text-slate-400">
                      {' '}
                      • <FileText className="w-3 h-3 inline -mt-0.5" /> {nFotos} foto(s)
                    </span>
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
