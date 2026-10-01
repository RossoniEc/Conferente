import React, { useState } from 'react';
import { 
  QrCode, 
  FileText, 
  Search, 
  Camera, 
  Truck, 
  Boxes, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Sparkles,
  Sheet
} from 'lucide-react';
import { CargoInspection, PlannedItem, ProductDePara, SheetRowDT, UserSession, ClientNote, PlacaListaNegra } from '../types';
import { ListaNegraAlert } from './ListaNegraAlert';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';
import { playBeep } from '../services/sound';

interface SelectLoadScreenProps {
  onLoadSelected: (inspection: CargoInspection) => void;
  existingInspections: CargoInspection[];
  sheetRowsDT: SheetRowDT[];
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
  deParaList,
  clientNotes = [],
  listaNegra = [],
  user,
  soundEnabled,
}) => {
  const [activeMode, setActiveMode] = useState<'qrcode' | 'dt'>('qrcode');
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [dtQuery, setDtQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'all' | 'dt' | 'placa'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      };
    });

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
      motorista: previewLoad.motorista || 'Motorista Não Informado',
      transportadora: previewLoad.transportadora || 'Transportadora Padrão',
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
            Etapa 1 • Planejamento
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

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-200 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setActiveMode('qrcode');
            setErrorMessage(null);
          }}
          className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all ${
            activeMode === 'qrcode'
              ? 'bg-white text-slate-900 shadow-md shadow-slate-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <QrCode className="w-4 h-4 text-blue-600" />
          <span>1. QR CODE da Carga</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveMode('dt');
            setErrorMessage(null);
          }}
          className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all ${
            activeMode === 'dt'
              ? 'bg-white text-slate-900 shadow-md shadow-slate-300'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <Search className="w-4 h-4 text-emerald-600" />
          <span>2. Buscar DT ou Placa</span>
        </button>
      </div>

      {/* Option 1: QR CODE */}
      {activeMode === 'qrcode' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Leitura do QR CODE da Carga</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Aponte a câmera para o QR Code impresso no mapa de expedição ou no manifesto eletrônico.
              </p>
            </div>
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <QrCode className="w-6 h-6" />
            </span>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowQrScanner(true)}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-extrabold rounded-2xl text-sm sm:text-base flex items-center justify-center space-x-3 shadow-lg shadow-blue-600/25 transition-all"
            >
              <Camera className="w-5 h-5 text-amber-300" />
              <span>ABRIR CÂMERA PARA LER QR CODE</span>
            </button>
          </div>

          {/* Quick Demo QR Presets */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-500" />
              Ou Selecione um QR Code Pré-Configurado para Teste:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {demoQrs
                .filter((item) => {
                  // Só QR Codes de DTs que ainda não iniciaram conferência
                  let dt = '';
                  try {
                    dt = JSON.parse(item.value).dt || '';
                  } catch {
                    dt = item.value.match(/DT:([^|]+)/i)?.[1]?.trim() || '';
                  }
                  return !dt || !findInspection(dt);
                })
                .map((item) => {
                  // Total de volumes planejados no QR (JSON ou "SKU:código:qtd,...")
                  let totalVol = 0;
                  try {
                    const obj = JSON.parse(item.value);
                    totalVol = (obj.itens || obj.items || []).reduce(
                      (a: number, it: { quantidade?: number; qtd?: number }) => a + Number(it.quantidade || it.qtd || 0),
                      0
                    );
                  } catch {
                    const skus = item.value.match(/(?:SKU|ITENS):([^|]+)/i)?.[1] || '';
                    totalVol = skus.split(',').reduce((a, tok) => a + Number(tok.split(':')[1] || 0), 0);
                  }
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => parseQrCodeData(item.value)}
                      className="p-3 bg-slate-50 hover:bg-blue-50/80 active:bg-blue-100 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all"
                    >
                      <span className="font-bold text-xs text-slate-800 block truncate">{item.label}</span>
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-blue-600 font-medium">Toque para carregar</span>
                        <span className="text-[11px] font-black font-mono text-slate-900 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">
                          {totalVol} vol. planejados
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Option 2: Documento de Transporte (DT) ou Placa */}
      {activeMode === 'dt' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Buscar por DT ou Placa no Google Sheets</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Digite o número da DT ou a Placa do veículo para consultar a base "LISTA DT".
              </p>
            </div>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Sheet className="w-6 h-6" />
            </span>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={dtQuery}
                onChange={(e) => handleSearchDt(e.target.value)}
                placeholder={
                  searchMode === 'placa'
                    ? 'Digite a Placa do caminhão (Ex: FDR-9087, BRA-2E19)...'
                    : searchMode === 'dt'
                    ? 'Digite o número da DT (Ex: 61008899, DT-10492)...'
                    : 'Buscar por DT ou Placa (Ex: 61008899 ou FDR-9087)...'
                }
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-mono font-bold text-sm focus:outline-none focus:border-blue-500 focus:bg-white transition-all uppercase"
              />
            </div>

            {/* Mode Filters & Quick Suggestions */}
            <div className="space-y-2.5 pt-0.5">
              {/* Filter Tabs: Ambos / DT / Placa */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit text-xs font-bold text-slate-600">
                <button
                  type="button"
                  onClick={() => {
                    setSearchMode('all');
                    if (dtQuery) handleSearchDt(dtQuery, 'all');
                  }}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    searchMode === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Buscar DT ou Placa
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchMode('dt');
                    if (dtQuery) handleSearchDt(dtQuery, 'dt');
                  }}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    searchMode === 'dt'
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Apenas DT
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchMode('placa');
                    if (dtQuery) handleSearchDt(dtQuery, 'placa');
                  }}
                  className={`px-3 py-1 rounded-lg transition-all ${
                    searchMode === 'placa'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'hover:text-slate-900'
                  }`}
                >
                  Apenas Placa
                </button>
              </div>

              {/* Quick Suggestions Chips: Both DTs and Placas */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1 text-emerald-600" /> DTs Disponíveis:
                  </span>
                  {uniqueDtsInSheet.map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => {
                        setSearchMode('dt');
                        handleSearchDt(dt, 'dt');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-mono font-bold transition-colors"
                    >
                      {dt}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center">
                    <Truck className="w-3.5 h-3.5 mr-1 text-blue-600" /> Placas Disponíveis:
                  </span>
                  {uniquePlacasInSheet.map((placa) => (
                    <button
                      key={placa}
                      type="button"
                      onClick={() => {
                        setSearchMode('placa');
                        handleSearchDt(placa, 'placa');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-mono font-bold transition-colors"
                    >
                      {placa}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
        <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-4 animate-fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
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
              <span>{previewLoad.placa}</span>
            </div>
          </div>

          <ListaNegraAlert placa={previewLoad.placa} lista={listaNegra} />

          {/* Details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block">Motorista:</span>
              <span className="font-bold text-slate-200">{previewLoad.motorista || 'Severino Silva'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Transportadora:</span>
              <span className="font-bold text-slate-200">{previewLoad.transportadora || 'TransLog Brasil S/A'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Total de Itens:</span>
              <span className="font-bold text-amber-400">
                {previewLoad.items.reduce((acc, i) => acc + i.quantidadePlanejada, 0)} volumes
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
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {previewLoad.items.map((item) => (
                <div
                  key={item.sku}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/80 text-xl border border-slate-700/50"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-bold font-mono text-amber-400 text-lg sm:text-xl block truncate">{item.sku}</span>
                    <span className="text-slate-300 text-sm sm:text-base truncate block">{item.descricao}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-2xl sm:text-3xl font-black text-white">{item.quantidadePlanejada}</span>
                    <span className="text-xs sm:text-sm text-slate-400 block font-semibold">planejados</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Start Inspection CTA */}
          <button
            type="button"
            onClick={handleStartInspection}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] text-slate-950 font-black rounded-2xl text-sm sm:text-base flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/25 transition-all"
          >
            <span>INICIAR CONFERÊNCIA DE CARGA</span>
            <ArrowRight className="w-5 h-5" />
          </button>
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
