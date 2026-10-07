import React, { useEffect, useRef, useState } from 'react';
import { 
  QrCode,
  ChevronRight,
  FileText, 
  Search, 
  Camera, 
  Truck, 
  Boxes, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  Sheet,
  CalendarDays,
  RefreshCw,
  X,
  Building2,
  Warehouse
} from 'lucide-react';
import { CargoInspection, PlannedItem, ProductDePara, SheetRowDT, UserSession, ClientNote, PlacaListaNegra, notaPorCodigoCliente } from '../types';
import { ListaNegraAlert } from './ListaNegraAlert';
import { ScrollButtonsList } from './ScrollButtonsList';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';
import { playBeep } from '../services/sound';
import { fetchSheetDT, localIsoDate } from '../services/sheetDt';

const DOCAS = Array.from({ length: 15 }, (_, i) => `Doca ${String(i + 1).padStart(2, '0')}`);

interface SelectLoadScreenProps {
  onLoadSelected: (inspection: CargoInspection) => void;
  existingInspections: CargoInspection[];
  sheetRowsDT: SheetRowDT[];
  sheetDtUrl?: string;
  onSyncSheetDT?: (rows: SheetRowDT[]) => void;
  deParaList: ProductDePara[];
  clientNotes?: ClientNote[];
  listaNegra?: PlacaListaNegra[];
  user: UserSession;
  soundEnabled: boolean;
}

export const SelectLoadScreen: React.FC<SelectLoadScreenProps> = ({
  onLoadSelected,
  existingInspections,
  sheetRowsDT,
  sheetDtUrl,
  onSyncSheetDT,
  deParaList,
  clientNotes = [],
  listaNegra = [],
  user,
  soundEnabled,
}) => {
  const activeMode = 'dt' as 'qrcode' | 'dt';
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [dtQuery, setDtQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'dt' | 'placa'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Doca de carregamento (obrigatória para iniciar a conferência)
  const [docaSel, setDocaSel] = useState('');
  const [docaErro, setDocaErro] = useState(false);

  // Parsed or queried load preview
  const [previewLoad, setPreviewLoad] = useState<{
    dt: string;
    placa: string;
    motorista?: string;
    transportadora?: string;
    items: PlannedItem[];
  } | null>(null);

  // Etapa 1 mostra só DTs novas: uma DT com conferência iniciada já avançou de etapa
  const findInspection = (dt: string) =>
    existingInspections.find((i) => i.dt.toUpperCase() === dt.toUpperCase());

  const stageMessage = (dt: string): string | null => {
    const insp = findInspection(dt);
    if (!insp) return null;
    const nome = /^DT/i.test(insp.dt) ? insp.dt : `DT ${insp.dt}`;
    if (insp.status === 'em_conferencia') {
      return `A ${nome} já está em conferência. Continue em "2. Conferência de Carga".`;
    }
    if (insp.status === 'concluido') {
      return `A ${nome} já teve a carga finalizada. Siga em "4. Conferência de Faturamento".`;
    }
    return `A ${nome} já foi faturada e encerrada.`;
  };

  const availableSheetRows = sheetRowsDT.filter((r) => !findInspection(r.dt));

  // Group unique DTs and Placas from sheet for quick chips
  const uniqueDtsInSheet = Array.from(new Set(availableSheetRows.map((r) => r.dt)));
  const uniquePlacasInSheet = Array.from(new Set(availableSheetRows.map((r) => r.placa).filter(Boolean)));

  // Sincroniza a LISTA DT ao abrir a tela, a cada minuto e ao voltar para o app (a planilha é a fonte da verdade)
  const [dtSync, setDtSync] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; msg?: string }>({ status: 'idle' });
  const syncing = useRef(false);
  const syncSheetDT = async () => {
    if (!onSyncSheetDT || !sheetDtUrl || syncing.current) return;
    syncing.current = true;
    setDtSync((prev) => ({ ...prev, status: 'loading' }));
    try {
      const rows = await fetchSheetDT(sheetDtUrl, deParaList);
      onSyncSheetDT(rows);
      setDtSync({ status: 'ok', msg: `Atualizado às ${new Date().toLocaleTimeString('pt-BR')}` });
    } catch (err) {
      setDtSync({ status: 'error', msg: err instanceof Error ? err.message : 'Erro ao sincronizar a LISTA DT.' });
    } finally {
      syncing.current = false;
    }
  };
  const syncRef = useRef(syncSheetDT);
  syncRef.current = syncSheetDT;
  useEffect(() => {
    syncRef.current();
    const timer = window.setInterval(() => syncRef.current(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // DTs disponíveis (sem conferência), agrupadas por DT; filtro Hoje usa a coluna DATA da LISTA DT
  const [filtroDts, setFiltroDts] = useState<'hoje' | 'atrasadas' | 'todas'>('hoje');
  const hojeIso = localIsoDate();
  const hojeBr = hojeIso.split('-').reverse().join('/');
  type GrupoDt = { dt: string; placa: string; cliente?: string; motorista: string; data?: string; remessa?: string; tipos: string[]; skus: number; volume: number };
  const dtsDisponiveis = Array.from(
    availableSheetRows
      .reduce((map, r) => {
        const g = map.get(r.dt) || { dt: r.dt, placa: r.placa, cliente: r.cliente, motorista: r.motorista, data: r.dataAgendamento, remessa: r.remessa, tipos: [], skus: 0, volume: 0 };
        g.skus += 1;
        g.volume += r.quantidade;
        // DT com SKUs em datas diferentes: vale a data mais recente (reagendamento)
        if (r.dataAgendamento && (!g.data || r.dataAgendamento > g.data)) g.data = r.dataAgendamento;
        if (r.tipoCarga && !g.tipos.includes(r.tipoCarga)) g.tipos.push(r.tipoCarga);
        map.set(r.dt, g);
        return map;
      }, new Map<string, GrupoDt>())
      .values()
  ).sort((x, y) => {
    // Hoje primeiro, depois por data, e as sem data por último
    const peso = (g: GrupoDt) => (g.data === hojeIso ? '0' : g.data ? '1' + g.data : '2');
    return peso(x).localeCompare(peso(y)) || x.dt.localeCompare(y.dt);
  });
  const agendadasHoje = dtsDisponiveis.filter((g) => g.data === hojeIso);
  // Atrasadas: DATA anterior a hoje e conferência ainda não iniciada (mais antigas primeiro)
  const dtsAtrasadas = dtsDisponiveis
    .filter((g) => g.data && g.data < hojeIso)
    .sort((a, b) => (a.data || '').localeCompare(b.data || '') || a.dt.localeCompare(b.dt));
  const diasAtraso = (data?: string) =>
    data ? Math.round((new Date(hojeIso + 'T00:00:00').getTime() - new Date(data + 'T00:00:00').getTime()) / 86_400_000) : 0;
  // Pesquisa por DT ou Placa (ignora traço/espaço); com texto, procura em todas as disponíveis
  const [buscaLista, setBuscaLista] = useState('');
  const termoBusca = buscaLista.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const buscando = termoBusca.length > 0;
  const listaDts = buscando
    ? dtsDisponiveis.filter(
        (g) =>
          g.dt.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(termoBusca) ||
          g.placa.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(termoBusca)
      )
    : filtroDts === 'hoje'
    ? agendadasHoje
    : filtroDts === 'atrasadas'
    ? dtsAtrasadas
    : dtsDisponiveis;
  const mostrarData = buscando || filtroDts !== 'hoje';
  const jaIniciadasHoje = new Set(
    sheetRowsDT.filter((r) => r.dataAgendamento === hojeIso && findInspection(r.dt)).map((r) => r.dt)
  ).size;

  // Fecha o card sobreposto com a tecla Esc
  useEffect(() => {
    if (!previewLoad) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewLoad(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewLoad]);

  // Tipo de carga (coluna TIPO): cor por tipo
  const TipoBadge: React.FC<{ tipo: string; dark?: boolean }> = ({ tipo, dark }) => {
    const t = tipo.toLowerCase();
    const cor = t.startsWith('palet')
      ? dark ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-blue-50 text-blue-700 border-blue-200'
      : t.startsWith('batid') || t.startsWith('estiv')
      ? dark ? 'bg-violet-500/20 text-violet-300 border-violet-500/40' : 'bg-violet-50 text-violet-700 border-violet-200'
      : t.startsWith('fracion')
      ? dark ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-800 border-amber-200'
      : dark ? 'bg-slate-700 text-slate-200 border-slate-600' : 'bg-slate-100 text-slate-700 border-slate-200';
    return (
      <span className={`text-[11px] font-bold rounded-md border px-1.5 py-0.5 whitespace-nowrap ${cor}`}>{tipo}</span>
    );
  };
  const tiposDaDt = (dt: string) =>
    Array.from(new Set(sheetRowsDT.filter((r) => r.dt === dt && r.tipoCarga).map((r) => r.tipoCarga as string)));

  const abrirDtAgendada = (dt: string) => {
    setDocaSel('');
    setDocaErro(false);
    handleSearchDt(dt, 'dt');
  };

  // QR Code structured parser
  const parseQrCodeData = (content: string) => {
    try {
      setErrorMessage(null);
      let parsedDt = '';
      let parsedPlaca = '';
      let parsedMotorista = 'Não informado';
      let parsedTransportadora = 'Não informada';
      const parsedItems: PlannedItem[] = [];

      // Try JSON first
      if (content.trim().startsWith('{')) {
        const obj = JSON.parse(content);
        parsedDt = obj.dt || obj.DT || obj.numeroDt || '';
        parsedPlaca = obj.placa || obj.Placa || '';
        parsedMotorista = obj.motorista || '';
        parsedTransportadora = obj.transportadora || '';

        const rawItens = obj.itens || obj.items || [];
        rawItens.forEach((it: { sku?: string; SKU?: string; quantidade?: number; qtd?: number; descricao?: string }) => {
          const sku = it.sku || it.SKU || '';
          const qtd = Number(it.quantidade || it.qtd || 0);
          const deParaMatch = deParaList.find((dp) => dp.sku.toUpperCase() === sku.toUpperCase());
          parsedItems.push({
            sku,
            descricao: it.descricao || deParaMatch?.descricao || `Produto ${sku}`,
            quantidadePlanejada: qtd,
            ean: deParaMatch?.ean,
          });
        });
      } else {
        // Try structured pipe/delimited format:
        // DT:DT-10492|PLACA:BRA-2E19|SKU:SKU-BEV-001:60,SKU-ALI-042:90
        const parts = content.split('|');
        for (const p of parts) {
          const [key, ...vals] = p.split(':');
          const k = key.trim().toUpperCase();
          const val = vals.join(':').trim();

          if (k === 'DT') parsedDt = val;
          else if (k === 'PLACA') parsedPlaca = val;
          else if (k === 'MOTORISTA') parsedMotorista = val;
          else if (k === 'TRANSP') parsedTransportadora = val;
          else if (k === 'SKU' || k === 'ITENS') {
            const itemTokens = val.split(',');
            itemTokens.forEach((tok) => {
              const [skuCode, qtyStr] = tok.split(':');
              if (skuCode) {
                const s = skuCode.trim();
                const q = Number(qtyStr || 0);
                const dp = deParaList.find((x) => x.sku.toUpperCase() === s.toUpperCase());
                parsedItems.push({
                  sku: s,
                  descricao: dp?.descricao || `Item ${s}`,
                  quantidadePlanejada: q,
                  ean: dp?.ean,
                });
              }
            });
          }
        }
      }

      if (!parsedDt) {
        throw new Error('QR Code não possui número de DT válido.');
      }

      const jaIniciada = stageMessage(parsedDt);
      if (jaIniciada) {
        setPreviewLoad(null);
        setShowQrScanner(false);
        setErrorMessage(jaIniciada);
        playBeep('warning', soundEnabled);
        return;
      }

      setPreviewLoad({
        dt: parsedDt.toUpperCase(),
        placa: parsedPlaca.toUpperCase() || 'PLACA-PENDENTE',
        motorista: parsedMotorista,
        transportadora: parsedTransportadora,
        items: parsedItems.length > 0 ? parsedItems : [
          { sku: 'SKU-BEV-001', descricao: 'Refrigerante Cola 2L Pet', quantidadePlanejada: 50 },
        ],
      });
      playBeep('success', soundEnabled);
      setShowQrScanner(false);
    } catch (err) {
      console.error(err);
      playBeep('error', soundEnabled);
      setErrorMessage(
        'Formato do QR Code inválido ou não estruturado. Certifique-se de que contenha DT, Placa e SKUs.'
      );
    }
  };

  // Search in Google Sheet "LISTA DT" by DT or PLACA
  const handleSearchDt = (query: string, modeOverride?: 'all' | 'dt' | 'placa') => {
    const activeFilter = modeOverride || searchMode;
    setDtQuery(query);
    setErrorMessage(null);

    const clean = query.trim().toUpperCase();
    const cleanAlphanumeric = clean.replace(/[^A-Z0-9]/g, '');

    if (!clean) {
      setPreviewLoad(null);
      return;
    }

    const allMatches = sheetRowsDT.filter((r) => {
      const rDtUpper = r.dt.toUpperCase();
      const rDtAlpha = rDtUpper.replace(/[^A-Z0-9]/g, '');
      const rPlacaUpper = (r.placa || '').toUpperCase();
      const rPlacaAlpha = rPlacaUpper.replace(/[^A-Z0-9]/g, '');

      const matchDt =
        rDtUpper.includes(clean) ||
        (cleanAlphanumeric.length >= 2 && rDtAlpha.includes(cleanAlphanumeric));
      const matchPlaca =
        rPlacaUpper.includes(clean) ||
        (cleanAlphanumeric.length >= 2 && rPlacaAlpha.includes(cleanAlphanumeric));

      if (activeFilter === 'dt') return matchDt;
      if (activeFilter === 'placa') return matchPlaca;
      return matchDt || matchPlaca;
    });

    // Só DTs que ainda não iniciaram conferência
    const matches = allMatches.filter((r) => !findInspection(r.dt));

    if (matches.length === 0 && allMatches.length > 0) {
      setPreviewLoad(null);
      setErrorMessage(stageMessage(allMatches[0].dt));
      return;
    }

    if (matches.length === 0) {
      setPreviewLoad(null);
      const tipo =
        activeFilter === 'dt'
          ? 'para a DT'
          : activeFilter === 'placa'
          ? 'para a Placa'
          : 'para a DT ou Placa';
      setErrorMessage(`Nenhum registro encontrado na planilha "LISTA DT" ${tipo} "${query}".`);
      return;
    }

    // Determine target DT
    const matchedDts = Array.from(new Set(matches.map((m) => m.dt)));
    const targetDt = matchedDts[0];
    const targetRows = matches.filter((r) => r.dt === targetDt);

    const first = targetRows[0];
    const items: PlannedItem[] = targetRows.map((m) => {
      const dp = deParaList.find((x) => x.sku.toUpperCase() === m.sku.toUpperCase());
      return {
        sku: m.sku,
        codigoCliente: m.codigoCliente || dp?.codigoCliente,
        descricao: m.descricao || dp?.descricao || `Produto ${m.sku}`,
        quantidadePlanejada: m.quantidade,
        ean: dp?.ean,
        cliente: m.cliente,
        tipoCarga: m.tipoCarga,
        lastro: m.lastro,
        camada: m.camada,
        qtdPallet: m.qtdPallet,
        quebraFardos: m.quebraFardos,
      };
    });
    // SKUs em ordem crescente (numérica quando o código é número)
    items.sort((a, b) => a.sku.localeCompare(b.sku, 'pt-BR', { numeric: true }));

    setPreviewLoad({
      dt: first.dt,
      placa: first.placa,
      motorista: first.motorista,
      transportadora: first.transportadora,
      items,
    });
    playBeep('success', soundEnabled);
  };

  // Handle Confirm and Start Inspection
  const handleStartInspection = () => {
    if (!previewLoad) return;
    if (!docaSel) {
      setDocaErro(true);
      playBeep('error', soundEnabled);
      return;
    }

    // DT que já avançou de etapa não reabre por aqui
    const jaIniciada = stageMessage(previewLoad.dt);
    if (jaIniciada) {
      setPreviewLoad(null);
      setErrorMessage(jaIniciada);
      return;
    }

    // Create new inspection
    const newInspection: CargoInspection = {
      id: `INSP-${previewLoad.dt.replace(/[^a-zA-Z0-9]/g, '')}`,
      dt: previewLoad.dt,
      placa: previewLoad.placa,
      doca: docaSel,
      motorista: previewLoad.motorista || '',
      transportadora: previewLoad.transportadora || '',
      status: 'em_conferencia',
      dataInicio: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      conferente: user.name,
      matriculaConferente: user.matricula,
      itensPlanejados: previewLoad.items,
      itensConferidos: [],
      fotosGerais: [],
    };

    onLoadSelected(newInspection);
  };

  // Preset QR Codes for instant one-click test simulation
  const demoQrs = [
    {
      label: 'QR DT 61008899 (BRAMIL / FDR-9087)',
      value: JSON.stringify({
        dt: '61008899',
        placa: 'FDR-9087',
        motorista: 'Severino Silva',
        transportadora: 'TransLog Brasil S/A',
        itens: [
          { sku: '201304', quantidade: 200, descricao: 'Papel A' },
          { sku: '201614', quantidade: 345, descricao: 'Papel B' },
          { sku: '202100', quantidade: 600, descricao: 'Toalha A' },
        ],
      }),
    },
    {
      label: 'QR DT-10492 (3 SKUs / Scania)',
      value: JSON.stringify({
        dt: 'DT-10492',
        placa: 'BRA-2E19',
        motorista: 'Severino Silva',
        transportadora: 'TransLog Brasil S/A',
        itens: [
          { sku: 'SKU-BEV-001', quantidade: 60 },
          { sku: 'SKU-ALI-042', quantidade: 90 },
          { sku: 'SKU-LIM-108', quantidade: 64 },
        ],
      }),
    },
    {
      label: 'QR DT-20831 (3 SKUs / Volvo)',
      value: 'DT:DT-20831|PLACA:RTO-9E33|MOTORISTA:Carlos Alberto Ramos|TRANSP:Expresso Sul|SKU:SKU-GRA-330:40,SKU-OLE-701:70,SKU-HIG-205:40',
    },
    {
      label: 'QR DT-30155 (2 SKUs / Carga Pesada)',
      value: JSON.stringify({
        dt: 'DT-30155',
        placa: 'FLG-4A88',
        motorista: 'Marcio Antunes',
        transportadora: 'Veloz Cargo Cargas',
        itens: [
          { sku: 'SKU-BEV-001', quantidade: 120 },
          { sku: 'SKU-ALI-042', quantidade: 150 },
        ],
      }),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-5 sm:py-6 space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 block">
            Etapa 3 • Planejamento
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
            <QrCode className="w-6 h-6 text-blue-600" />
            <span>Selecionar Carga (Planejado)</span>
          </h2>
        </div>
        <p className="text-xs text-slate-500 max-w-sm">
          Importe os dados estruturados da carga via câmera ou consulte a planilha no Google Sheets.
        </p>
      </div>

      {/* DTs disponíveis na LISTA DT (Hoje / Todas) */}
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 flex items-center gap-2 leading-tight">
              <CalendarDays className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="truncate">
                {buscando ? (
                  'Resultado da Pesquisa'
                ) : filtroDts === 'hoje' ? (
                  <>
                    <span className="sm:hidden">DTs de Hoje</span>
                    <span className="hidden sm:inline">DTs Agendadas para Hoje</span>
                  </>
                ) : filtroDts === 'atrasadas' ? (
                  'DTs Atrasadas'
                ) : (
                  'DTs Disponíveis'
                )}
              </span>
              <span className="text-xs font-black bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5">
                {listaDts.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {filtroDts === 'hoje' ? hojeBr : ''}
              <span className="hidden sm:inline">{filtroDts === 'hoje' ? ' • ' : ''}Planilha "LISTA DT"</span>
              {dtSync.msg && dtSync.status !== 'error' ? ` • ${dtSync.msg}` : ''}
              {filtroDts === 'hoje' && jaIniciadasHoje > 0 ? ` • ${jaIniciadasHoje} já iniciada(s)` : ''}
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${dtSync.status === 'loading' ? 'animate-ping' : ''}`} />
              Atualização automática a cada 1 minuto
            </p>
          </div>
          {onSyncSheetDT && (
            <button
              type="button"
              onClick={() => syncSheetDT()}
              disabled={dtSync.status === 'loading'}
              className="shrink-0 h-10 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-4 h-4 ${dtSync.status === 'loading' ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{dtSync.status === 'loading' ? 'Atualizando…' : 'Atualizar'}</span>
            </button>
          )}
        </div>

        {/* Filtro Hoje / Todas */}
        <div className={`grid grid-cols-3 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold ${buscando ? 'opacity-50' : ''}`}>
          <button
            type="button"
            onClick={() => setFiltroDts('hoje')}
            className={`h-9 rounded-lg transition-all ${
              filtroDts === 'hoje' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Hoje ({agendadasHoje.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroDts('atrasadas')}
            className={`h-9 rounded-lg transition-all ${
              filtroDts === 'atrasadas'
                ? 'bg-rose-600 text-white shadow-sm'
                : dtsAtrasadas.length > 0
                ? 'text-rose-600 hover:text-rose-800'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Atrasadas ({dtsAtrasadas.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltroDts('todas')}
            className={`h-9 rounded-lg transition-all ${
              filtroDts === 'todas' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="sm:hidden">Todas ({dtsDisponiveis.length})</span>
            <span className="hidden sm:inline">Todas Disponíveis ({dtsDisponiveis.length})</span>
          </button>
        </div>

        {/* Pesquisa por Placa ou DT */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            inputMode="search"
            value={buscaLista}
            onChange={(e) => setBuscaLista(e.target.value)}
            placeholder="Pesquisar por Placa ou DT"
            className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-300 rounded-xl font-mono text-base text-slate-900 uppercase placeholder:normal-case placeholder:font-sans placeholder:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
            aria-label="Pesquisar por Placa ou DT"
          />
          {buscando && (
            <button
              type="button"
              onClick={() => setBuscaLista('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              aria-label="Limpar pesquisa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {dtSync.status === 'error' && (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            {dtSync.msg}
          </div>
        )}

        {listaDts.length > 0 ? (
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-200 overflow-hidden">
            {listaDts.map((g) => (
              <button
                key={g.dt}
                type="button"
                onClick={() => abrirDtAgendada(g.dt)}
                className={`w-full px-3 sm:px-4 py-3 text-left flex items-center gap-2.5 sm:gap-3 transition-colors ${
                  previewLoad?.dt === g.dt ? 'bg-emerald-50' : 'bg-white hover:bg-emerald-50/70 active:bg-emerald-100'
                }`}
              >
                <Truck className="hidden min-[400px]:block w-5 h-5 text-emerald-600 shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-black font-mono text-base text-slate-900 whitespace-nowrap">DT {g.dt}</span>
                    {g.tipos.map((t) => (
                      <TipoBadge key={t} tipo={t} />
                    ))}
                    {mostrarData && (
                      <span
                        className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 whitespace-nowrap ${
                          g.data === hojeIso
                            ? 'bg-emerald-100 text-emerald-800'
                            : g.data && g.data < hojeIso
                            ? 'bg-rose-100 text-rose-700'
                            : g.data
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {g.data === hojeIso ? 'Hoje' : g.data ? g.data.split('-').reverse().join('/') : 'Sem data'}
                      </span>
                    )}
                    {g.data && g.data < hojeIso && (
                      <span className="text-[11px] font-black rounded-md px-1.5 py-0.5 whitespace-nowrap bg-rose-600 text-white">
                        {diasAtraso(g.data)} dia{diasAtraso(g.data) > 1 ? 's' : ''} de atraso
                      </span>
                    )}
                  </span>
                  {g.cliente && (
                    <span className="flex items-center gap-1 mt-0.5 text-sm font-bold text-slate-800 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{g.cliente}</span>
                    </span>
                  )}
                  <span className="block text-xs text-slate-500 truncate">
                    {[g.placa, g.remessa ? `Remessa ${g.remessa}` : '', `${g.skus} SKU${g.skus > 1 ? 's' : ''}`].filter(Boolean).join(' • ')}
                  </span>
                </span>
                <span className="text-xs font-black font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 whitespace-nowrap">
                  {g.volume} vol.
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-700 whitespace-nowrap">
                  Carregar <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          dtSync.status !== 'loading' && (
            <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 text-center">
              {buscando ? (
                <>
                  Nenhuma DT disponível com a Placa ou DT <strong>"{buscaLista}"</strong>.
                </>
              ) : filtroDts === 'hoje' ? (
                <>
                  Nenhuma DT pendente agendada para hoje. Preencha a coluna <strong>DATA</strong> da planilha com {hojeBr}.
                </>
              ) : filtroDts === 'atrasadas' ? (
                'Nenhuma DT em atraso.'
              ) : (
                'Nenhuma DT disponível na planilha "LISTA DT".'
              )}
            </p>
          )
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start space-x-3 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Atenção na Importação</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Parsed / Selected Load Preview Card */}
      {previewLoad && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewLoad(null);
          }}
        >
        <div
          id="preview-carga"
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-700 space-y-4"
        >
          <button
            type="button"
            onClick={() => setPreviewLoad(null)}
            className="absolute top-3 right-3 z-10 w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 pr-12 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                  Carga Identificada com Sucesso
                </span>
                <h4 className="text-3xl sm:text-4xl font-black font-mono text-white tracking-wide">{previewLoad.dt}</h4>
              </div>
            </div>

            {/* License plate Mercosul style badge */}
            <div className="bg-white text-slate-900 px-3 py-1 rounded-lg border-2 border-blue-600 font-mono font-black text-sm shadow-sm flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" />
              <span>{previewLoad.placa || 'Placa a informar'}</span>
            </div>
          </div>

          <ListaNegraAlert placa={previewLoad.placa} lista={listaNegra} />

          {/* Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="col-span-2 sm:col-span-4">
              <span className="text-slate-400 block">Cliente:</span>
              <span className="font-black text-base text-white">
                {Array.from(new Set(previewLoad.items.map((i) => i.cliente).filter(Boolean))).join(' • ') || 'Não informado'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Motorista:</span>
              <span className="font-bold text-slate-200">{previewLoad.motorista || 'Não informado'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Transportadora:</span>
              <span className="font-bold text-slate-200">{previewLoad.transportadora || 'Não informada'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Total de Itens:</span>
              <span className="font-bold text-amber-400">
                {previewLoad.items.reduce((acc, i) => acc + i.quantidadePlanejada, 0)} volumes
              </span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5">Tipo:</span>
              <span className="flex flex-wrap gap-1">
                {tiposDaDt(previewLoad.dt).length > 0 ? (
                  tiposDaDt(previewLoad.dt).map((t) => <TipoBadge key={t} tipo={t} dark />)
                ) : (
                  <span className="font-bold text-slate-400">Não informado</span>
                )}
              </span>
            </div>
          </div>

          {/* Client Instruction Warning in Load Preview (e.g. BRAMIL) */}
          {(() => {
            const previewCliente = previewLoad.items[0]?.cliente || '';
            const matchingNote = clientNotes.find((n) => {
              if (!n.ativo) return false;
              const cli = n.cliente.toUpperCase();
              if (previewCliente && (cli === previewCliente.toUpperCase() || previewCliente.toUpperCase().includes(cli))) return true;
              if (previewLoad.dt.toUpperCase().includes(cli)) return true;
              if (notaPorCodigoCliente(n, previewLoad.items)) return true;
              if (cli === 'GERAL' || cli === 'PADRÃO / GERAL') return true;
              return false;
            });

            if (!matchingNote) return null;

            return (
              <div className="bg-rose-950/90 border-2 border-rose-500 rounded-2xl p-3.5 text-white flex items-start space-x-3 shadow-md">
                <div className="p-2 rounded-xl bg-rose-600 text-white flex-shrink-0">
                  <AlertCircle className="w-5 h-5 animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500/30 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/40">
                      🚨 Alerta do Cliente: {matchingNote.cliente}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-black uppercase text-white tracking-wide">
                    {matchingNote.mensagem}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Items preview table */}
          <div className="bg-slate-950/60 rounded-2xl p-3 border border-slate-800">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Relação de SKUs Planejados ({previewLoad.items.length})
            </span>
            <ScrollButtonsList maxHeightClass="max-h-60">
              <div className="space-y-1.5">
              {[...previewLoad.items]
                .sort((a, b) => a.sku.localeCompare(b.sku, 'pt-BR', { numeric: true }))
                .map((item, idx) => (
                <div
                  key={`${item.sku}-${idx}`}
                  className="p-2.5 sm:p-3 rounded-2xl bg-slate-800/80 border border-slate-700/50 space-y-1"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                  {/* SKU */}
                  <div className="min-w-0 w-20 sm:w-28 shrink-0">
                    <span className="font-bold font-mono text-amber-400 text-base sm:text-xl block truncate">{item.sku}</span>
                  </div>
                  {/* Paletizado: Lastro x Camada x Pallets + Quebra de fardos, na mesma linha */}
                  {item.tipoCarga?.toLowerCase().startsWith('palet') ? (
                    <div className="flex-1 min-w-0 grid grid-cols-4 gap-1 text-center">
                      {[
                        { rot: 'Lastro', nome: 'Lastro', val: item.lastro },
                        { rot: 'Camada', nome: 'Camada', val: item.camada },
                        { rot: 'Pallets', nome: 'Quantidade de Pallets', val: item.qtdPallet },
                        { rot: 'Quebra', nome: 'Quebra de Fardos', val: item.quebraFardos },
                      ].map((c) => (
                        <div
                          key={c.rot}
                          title={c.nome}
                          className="min-w-0 rounded-lg bg-slate-900/80 border border-blue-500/30 px-0.5 py-0.5"
                        >
                          <span className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-blue-300 leading-tight truncate">
                            {c.rot}
                          </span>
                          <span className="block text-sm sm:text-base font-black font-mono text-white leading-snug">
                            {c.val != null ? c.val.toLocaleString('pt-BR') : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Sem quadros de pallet: a descrição completa ocupa o meio da linha */
                    <p className="flex-1 min-w-0 text-slate-300 text-xs sm:text-sm leading-snug break-words">{item.descricao}</p>
                  )}
                  {/* Quantidade planejada */}
                  <div className="text-right shrink-0">
                    <span className="text-xl sm:text-3xl font-black text-white leading-none block">{item.quantidadePlanejada}</span>
                    <span className="text-[10px] sm:text-xs text-slate-400 block font-semibold">planejados</span>
                  </div>
                  </div>
                  {/* Paletizado: descrição completa na linha de baixo */}
                  {item.tipoCarga?.toLowerCase().startsWith('palet') && (
                    <p className="text-slate-300 text-xs sm:text-sm leading-snug break-words">{item.descricao}</p>
                  )}
                </div>
              ))}
              </div>
            </ScrollButtonsList>
          </div>

          {/* Doca de carregamento (obrigatória) */}
          <div className="space-y-1.5">
            <label htmlFor="doca-carregamento" className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Warehouse className="w-4 h-4 text-amber-400" />
              Doca de carregamento <span className="text-rose-400">*</span>
            </label>
            <select
              id="doca-carregamento"
              value={docaSel}
              onChange={(e) => {
                setDocaSel(e.target.value);
                setDocaErro(false);
              }}
              className={`w-full h-12 px-3 rounded-xl bg-slate-800 text-white text-base font-bold border-2 focus:outline-none ${
                docaErro ? 'border-rose-500' : docaSel ? 'border-emerald-500' : 'border-slate-600 focus:border-amber-400'
              }`}
            >
              <option value="">Selecione a doca…</option>
              {DOCAS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {docaErro && <p className="text-xs font-bold text-rose-400">Selecione a doca para iniciar a conferência.</p>}
          </div>

          {/* Start Inspection CTA */}
          <button
            type="button"
            onClick={handleStartInspection}
            disabled={!docaSel}
            className="w-full py-3.5 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] text-slate-950 font-black rounded-2xl text-sm sm:text-base flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/25 transition-all"
          >
            <span>INICIAR CONFERÊNCIA DE CARGA</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      {showQrScanner && (
        <BarcodeCameraScanner
          title="Leitura de QR Code da Carga"
          subtitle="Aponte a câmera para o QR Code impresso no mapa"
          mode="qrcode"
          beepEnabled={soundEnabled}
          onScan={(text) => parseQrCodeData(text)}
          onClose={() => setShowQrScanner(false)}
          quickSamples={demoQrs}
        />
      )}
    </div>
  );
};
