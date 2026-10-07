import React, { useCallback, useEffect, useState } from 'react';
import { 
  ReceiptText, 
  Search, 
  Truck, 
  Boxes, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Barcode, 
  Mail, 
  FileSpreadsheet, 
  Check, 
  X,
  Sparkles,
  Sheet,
  ShieldCheck,
  ChevronLeft,
  RefreshCw,
  Table2,
  Copy
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CargoInspection, SheetRowFAT, AppSettings, UserSession } from '../types';
import { EmailSentModal } from './EmailSentModal';
import { playBeep } from '../services/sound';
import { fetchSheetFAT } from '../services/sheetFat';
import { ListaNegraAlert } from './ListaNegraAlert';

interface BillingInspectionScreenProps {
  inspections: CargoInspection[];
  sheetRowsFAT: SheetRowFAT[];
  onSaveSheetFAT: (rows: SheetRowFAT[]) => void;
  onUpdateInspection: (updated: CargoInspection) => void;
  onReturnToConference: (reaberta: CargoInspection) => void;
  onNavigateHome: () => void;
  settings: AppSettings;
  user: UserSession;
  initialInspection?: CargoInspection | null;
}

export const BillingInspectionScreen: React.FC<BillingInspectionScreenProps> = ({
  inspections,
  sheetRowsFAT,
  onSaveSheetFAT,
  onUpdateInspection,
  onReturnToConference,
  onNavigateHome,
  settings,
  user,
  initialInspection,
}) => {
  // Sincroniza a planilha FAT ao abrir a tela (a planilha é a fonte da verdade)
  const [fatSync, setFatSync] = useState<{ status: 'loading' | 'ok' | 'error'; msg: string }>({
    status: 'loading',
    msg: 'Sincronizando planilha FAT…',
  });

  const syncFat = useCallback(async () => {
    setFatSync({ status: 'loading', msg: 'Sincronizando planilha FAT…' });
    try {
      const rows = await fetchSheetFAT(settings.googleSheetFatUrl);
      onSaveSheetFAT(rows);
      setFatSync({
        status: 'ok',
        msg: `Planilha FAT atualizada às ${new Date().toLocaleTimeString('pt-BR')} (${rows.length} linhas)`,
      });
    } catch (err) {
      setFatSync({
        status: 'error',
        msg: `${err instanceof Error ? err.message : 'Falha na sincronização.'} Exibindo a última base salva.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.googleSheetFatUrl]);

  useEffect(() => {
    syncFat();
  }, [syncFat]);

  // Navigation step inside billing screen
  // 1: Select DT & Confirm Plate
  // 2: Scan NF-e Key & 3-way check
  const [step, setStep] = useState<1 | 2>(initialInspection ? 2 : 1);
  const [selectedInspection, setSelectedInspection] = useState<CargoInspection | null>(initialInspection || null);
  // Card com a tabela SKU / Quantidade / Lote da DT (para copiar)
  const [tabelaDt, setTabelaDt] = useState<CargoInspection | null>(null);
  const [copiado, setCopiado] = useState(false);
  const linhasTabela = (insp: CargoInspection) => {
    const mapa = new Map<string, { sku: string; quantidade: number; lote: string }>();
    insp.itensConferidos.forEach((it) => {
      const partes = it.lotes && it.lotes.length > 0 ? it.lotes : [{ lote: it.lote, quantidade: it.quantidadeCarregada }];
      partes.forEach((p) => {
        if (!p.quantidade) return;
        const lote = (p.lote || '-').trim() || '-';
        const k = `${it.sku}|${lote}`;
        const atual = mapa.get(k);
        if (atual) atual.quantidade += p.quantidade;
        else mapa.set(k, { sku: it.sku, quantidade: p.quantidade, lote });
      });
    });
    return [...mapa.values()].sort(
      (a, b) => a.sku.localeCompare(b.sku, 'pt-BR', { numeric: true }) || a.lote.localeCompare(b.lote, 'pt-BR')
    );
  };
  const copiarTabela = async (insp: CargoInspection) => {
    // Tabulado: cola direto em colunas no Excel / Google Sheets
    const texto = ['SKU\tQUANTIDADE\tLOTE', ...linhasTabela(insp).map((l) => `${l.sku}\t${l.quantidade}\t${l.lote}`)].join('\n');
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [chaveNFeInput, setChaveNFeInput] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Etapa de faturamento: só cargas finalizadas e ainda não faturadas
  const billingStage = inspections.filter((i) => i.status === 'concluido');

  const availableInspections = billingStage.filter((i) => {
    const term = searchTerm.toLowerCase();
    return (
      i.dt.toLowerCase().includes(term) ||
      i.placa.toLowerCase().includes(term) ||
      (i.motorista && i.motorista.toLowerCase().includes(term))
    );
  });

  // Nº da nota sem zeros à esquerda. Uma chave de 44 dígitos traz o nº (nNF) nas posições 26–34.
  const normalizeNota = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const nota = digits.length === 44 ? digits.slice(25, 34) : digits;
    return nota.replace(/^0+/, '');
  };

  // Uma linha da planilha FAT corresponde à chave/nota informada?
  const fatRowMatchesInput = (f: SheetRowFAT, input: string) => {
    const clean = input.trim();
    if (!clean) return false;
    if (f.chaveNFe && f.chaveNFe === clean) return true;
    const nota = normalizeNota(clean);
    return !!nota && normalizeNota(f.numeroNota) === nota;
  };

  const fatRowsForDt = (dt: string) => sheetRowsFAT.filter((f) => f.dt.toUpperCase() === dt.toUpperCase());

  // Handle selecting a DT in Step 1
  const handleSelectDt = (insp: CargoInspection) => {
    setSelectedInspection(insp);
    setConfirmReturn(false);
    // Find if there is already an NF-e in FAT sheet for this DT
    const existingFat = fatRowsForDt(insp.dt);
    if (existingFat.length > 0) {
      setChaveNFeInput(existingFat[0].chaveNFe || existingFat[0].numeroNota);
    } else {
      setChaveNFeInput('');
    }
  };

  // Devolve a DT para a etapa anterior (Conferência de Carga) para correções
  const [confirmReturn, setConfirmReturn] = useState(false);
  const handleReturnToConference = () => {
    if (!selectedInspection) return;
    const reaberta: CargoInspection = {
      ...selectedInspection,
      status: 'em_conferencia',
      dataFim: undefined,
    };
    setConfirmReturn(false);
    onReturnToConference(reaberta);
  };

  // Proceed to Step 2
  const handleProceedToBilling = () => {
    if (!selectedInspection) return;
    setStep(2);
  };

  // Notas fiscais da planilha "FAT" vinculadas a esta DT
  const dtFatRows = selectedInspection ? fatRowsForDt(selectedInspection.dt) : [];
  const notasForDt = Array.from(
    new Map(dtFatRows.map((f) => [normalizeNota(f.numeroNota) || f.chaveNFe, f])).values()
  );

  const notasRefDt = notasForDt.map((f) => f.chaveNFe || f.numeroNota).join(' / ');

  // A chave/nota informada pertence a esta DT na planilha?
  const inputMatchesDt = !!chaveNFeInput.trim() && dtFatRows.some((f) => fatRowMatchesInput(f, chaveNFeInput));

  // Calculate 3-Way Reconciliation Check
  // Total Planejado x Total Carregado x Total Faturado por SKU
  const reconciliationData = () => {
    if (!selectedInspection) return [];

    const map = new Map<string, {
      sku: string;
      descricao: string;
      planejado: number;
      corte: number;
      carregado: number;
      faturado: number;
    }>();

    // 1. Planejado
    selectedInspection.itensPlanejados.forEach((p) => {
      const existing = map.get(p.sku);
      if (existing) {
        existing.planejado += p.quantidadePlanejada;
      } else {
        map.set(p.sku, {
          sku: p.sku,
          descricao: p.descricao,
          planejado: p.quantidadePlanejada,
          corte: 0,
          carregado: 0,
          faturado: 0,
        });
      }
    });

    // 2. Carregado (Físico) + Corte Operacional
    selectedInspection.itensConferidos.forEach((c) => {
      const corte = c.corteOperacional?.quantidade || 0;
      const item = map.get(c.sku);
      if (item) {
        item.carregado += c.quantidadeCarregada;
        item.corte += corte;
      } else {
        map.set(c.sku, {
          sku: c.sku,
          descricao: c.descricao,
          planejado: 0,
          corte,
          carregado: c.quantidadeCarregada,
          faturado: 0,
        });
      }
    });

    // 3. Faturado (Planilha FAT do Google Sheets)
    // Acumulado de todas as notas da DT; uma chave/nota de outra DT soma apenas a própria nota
    const fatItems =
      chaveNFeInput.trim() && !inputMatchesDt
        ? sheetRowsFAT.filter((f) => fatRowMatchesInput(f, chaveNFeInput))
        : fatRowsForDt(selectedInspection.dt);

    fatItems.forEach((f) => {
      const item = map.get(f.sku);
      if (item) {
        item.faturado += f.quantidade;
      } else {
        const dp = settings.deParaList.find((x) => x.sku === f.sku);
        map.set(f.sku, {
          sku: f.sku,
          descricao: dp?.descricao || `Produto ${f.sku}`,
          planejado: 0,
          corte: 0,
          carregado: 0,
          faturado: f.quantidade,
        });
      }
    });

    return Array.from(map.values());
  };

  const rows = reconciliationData();

  // Summary counts
  let totPlan = 0;
  let totCorte = 0;
  let totCarreg = 0;
  let totFat = 0;
  let hasDivergence = false;

  // Linha confere quando Carregado = Faturado = Planejado líquido (planejado − corte)
  const isRowOk = (r: { planejado: number; corte: number; carregado: number; faturado: number }) =>
    r.carregado === r.faturado && r.planejado - r.corte === r.faturado;

  rows.forEach((r) => {
    totPlan += r.planejado;
    totCorte += r.corte;
    totCarreg += r.carregado;
    totFat += r.faturado;
    if (!isRowOk(r)) {
      hasDivergence = true;
    }
  });

  // Grupo "Divergências & Cortes" só entra no envio quando há divergência de faturamento ou corte
  const temOcorrenciaFat = hasDivergence || totCorte > 0;
  const destinatariosFat = Array.from(
    new Set([...settings.emailsFaturamento, ...(temOcorrenciaFat ? settings.emailsOcorrencias || [] : [])])
  );

  // Handle Confirm Conference
  const handleConfirmBilling = () => {
    if (!selectedInspection) return;

    // Sem nota escolhida (atalho/scanner), registra todas as notas da DT na planilha FAT
    const notaReferencia = chaveNFeInput.trim() || notasRefDt;
    if (!notaReferencia) return;

    const divergencias = rows.map((r) => ({
      sku: r.sku,
      descricao: r.descricao,
      planejado: r.planejado,
      carregado: r.carregado,
      faturado: r.faturado,
      diferencaFaturamento: r.carregado - r.faturado,
    }));

    const statusFat = hasDivergence ? 'divergencia' : 'conferido_ok';

    const updated: CargoInspection = {
      ...selectedInspection,
      status: hasDivergence ? 'faturado_divergente' : 'faturado_conferido',
      faturamento: {
        chaveNFe: notaReferencia,
        dataConferencia: new Date().toLocaleString('pt-BR'),
        conferenteFat: user.name,
        status: statusFat,
        itensFaturados: rows.map((r) => ({ sku: r.sku, quantidadeFaturada: r.faturado })),
        divergencias,
        emailEnviado: true,
        dataEnvioEmail: new Date().toLocaleString('pt-BR'),
      },
    };

    onUpdateInspection(updated);
    setSelectedInspection(updated);

    if (!hasDivergence) {
      try {
        confetti({ particleCount: 90, spread: 60 });
      } catch {}
      playBeep('success', settings.beepSoundEnabled);
    } else {
      playBeep('warning', settings.beepSoundEnabled);
    }

    // "ao clicar em confirmar conferencia irá enviar um resumo para uma lista de e-mail"
    setShowEmailModal(true);
  };

  // Atalhos: notas da planilha FAT para esta DT
  const nfeChips = notasForDt.map((f) => ({
    label: `NF ${f.numeroNota || f.chaveNFe.slice(25, 34)}${f.cliente ? ` • ${f.cliente}` : ''}`,
    key: f.chaveNFe || f.numeroNota,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6 space-y-5">
      {/* Top Title Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 block">
            Tópico 6 • Auditoria Fiscal & Expedição
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
            <ReceiptText className="w-6 h-6 text-purple-600" />
            <span>Conferência de Faturamento</span>
          </h2>
        </div>

        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="h-11 pl-3 pr-5 rounded-xl border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-100 hover:border-slate-400 active:scale-95 text-sm font-bold flex items-center gap-1.5 self-start sm:self-auto shadow-sm transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            <span>Trocar de DT</span>
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* STEP 1: Selecionar DT e Conferir Placa */}
      {/* ============================================================ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">1. Selecionar DT Carregada</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Busque pela caixa de pesquisa ou selecione diretamente na lista de cargas carregadas.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por DT, Placa ou Motorista..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-purple-500"
              />
            </div>

            {availableInspections.length === 0 && (
              <div className="p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
                {searchTerm
                  ? 'Nenhuma DT finalizada corresponde à busca.'
                  : 'Nenhuma carga finalizada aguardando faturamento. As DTs aparecem aqui após "Finalizar Carga".'}
              </div>
            )}

            {/* DT List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {availableInspections.map((insp) => {
                const isSelected = selectedInspection?.id === insp.id;
                const totalVol = insp.itensConferidos.reduce((a, b) => a + b.quantidadeCarregada, 0);

                return (
                  <div
                    key={insp.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectDt(insp)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectDt(insp);
                      }
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-start justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-purple-50/80 border-purple-500 shadow-md ring-2 ring-purple-400/30'
                        : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-mono font-black text-base text-slate-900">{insp.dt}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                          Aguardando Faturamento
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        Motorista: <span className="font-semibold">{insp.motorista || 'Não informado'}</span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Volumes Físicos: <span className="font-bold text-emerald-700">{totalVol} vol.</span>
                      </p>
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                      {/* Mercosul Placa */}
                      <div className="bg-white border-2 border-blue-600 rounded px-2 py-0.5 text-xs font-mono font-black text-slate-900 shadow-xs">
                        {insp.placa}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCopiado(false);
                          setTabelaDt(insp);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-black flex items-center gap-1 shadow-sm"
                      >
                        <Table2 className="w-3.5 h-3.5" />
                        Tabela
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Confirm Placa & Proceed Card */}
          {selectedInspection && (
            <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-4 animate-fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                      Conferência de Placa do Carregamento
                    </span>
                    <h4 className="text-lg font-black font-mono text-white">{selectedInspection.dt}</h4>
                  </div>
                </div>

                {/* Big Placa confirmation display */}
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-400">Placa Conferida:</span>
                  <div className="bg-white text-slate-900 px-4 py-1.5 rounded-lg border-2 border-blue-600 font-mono font-black text-base shadow-lg">
                    {selectedInspection.placa}
                  </div>
                </div>
              </div>

              <ListaNegraAlert placa={selectedInspection.placa} lista={settings.listaNegra} />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block">Conferente de Pátio:</span>
                  <span className="font-bold text-slate-200">{selectedInspection.conferente}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Nº do Lacre:</span>
                  <span className="font-bold text-amber-400 font-mono">{selectedInspection.numeroLacre || 'Sem Lacre'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Volumes Carregados:</span>
                  <span className="font-bold text-emerald-400">
                    {selectedInspection.itensConferidos.reduce((a, b) => a + b.quantidadeCarregada, 0)} volumes
                  </span>
                </div>
              </div>

              {/* Ações: voltar à etapa anterior ou seguir para o faturamento */}
              {confirmReturn ? (
                <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-3 space-y-2">
                  <p className="text-xs text-amber-200 font-semibold">
                    Devolver a {/^DT/i.test(selectedInspection.dt) ? '' : 'DT '}
                    {selectedInspection.dt} para a <strong>Conferência de Carga</strong>? Ela sai do
                    faturamento e volta a ficar "em conferência" para correções; depois, finalize a carga novamente.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmReturn(false)}
                      className="px-4 py-2 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-800 text-xs font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleReturnToConference}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Sim, voltar à Conferência de Carga
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmReturn(true)}
                    className="sm:w-auto px-5 py-4 rounded-2xl border border-slate-600 text-slate-200 hover:bg-slate-800 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors"
                    title="Devolver a DT para a Conferência de Carga"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    <span>Voltar à Etapa Anterior</span>
                  </button>
                  {/* Action: "clicar em seguir conferencia de Faturamento" */}
                  <button
                    type="button"
                    onClick={handleProceedToBilling}
                    className="flex-1 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-[0.99] text-white font-black rounded-2xl text-sm sm:text-base flex items-center justify-center space-x-2 shadow-lg shadow-purple-600/30 transition-all"
                  >
                    <span>SEGUIR CONFERÊNCIA DE FATURAMENTO</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: Leitura Chave NF-e & Check Triplo Acumulado */}
      {/* ============================================================ */}
      {step === 2 && selectedInspection && (
        <div className="space-y-4">
          {/* Header Info of Selected DT */}
          <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <ReceiptText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                  DT em Conferência de NF-e
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-black font-mono text-white">{selectedInspection.dt}</span>
                  <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-bold">
                    Placa: {selectedInspection.placa}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block">Auditor Fiscal:</span>
                <span className="text-xs font-bold text-slate-200">{user.name}</span>
              </div>
              <button
                type="button"
                onClick={syncFat}
                disabled={fatSync.status === 'loading'}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 disabled:cursor-wait text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                title={fatSync.msg}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fatSync.status === 'loading' ? 'animate-spin' : ''}`} />
                <span>{fatSync.status === 'loading' ? 'Atualizando…' : 'Atualizar Google Sheet'}</span>
              </button>
            </div>
          </div>

          {/* Notas fiscais da DT (planilha FAT) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">

            {chaveNFeInput.trim() && (
              <p
                className={`text-[11px] font-bold flex items-center ${
                  inputMatchesDt ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {inputMatchesDt
                  ? `✓ Nota ${normalizeNota(chaveNFeInput)} localizada na planilha FAT para a DT ${selectedInspection.dt}`
                  : `✗ Nota ${normalizeNota(chaveNFeInput) || chaveNFeInput} não pertence à DT ${selectedInspection.dt} na planilha FAT`}
              </p>
            )}

            {/* Quick Chips of NFe keys in Google Sheets FAT database */}
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-bold text-slate-400 flex items-center">
                <Sheet className="w-3 h-3 mr-1 text-emerald-600" /> Notas Localizadas na Planilha FAT:
              </span>
              {nfeChips.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  Nenhuma nota desta DT na planilha. Sincronize a planilha FAT em Configuração.
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {nfeChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => {
                      // Toque de novo na nota selecionada desmarca
                      setChaveNFeInput(chaveNFeInput === chip.key ? '' : chip.key);
                      playBeep('scan', settings.beepSoundEnabled);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                      chaveNFeInput === chip.key
                        ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs'
                        : 'bg-slate-100 hover:bg-purple-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CHECK TRÍPLO: Total Planejado x Total Carregado x Total Faturado */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
              <div>
                <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 uppercase tracking-wider flex items-center">
                  <FileSpreadsheet className="w-4 h-4 mr-1.5 text-purple-600" />
                  Check do Acumulado: Planejado x Carregado x Faturado
                </h4>
                <div className="flex items-center gap-2 text-[11px]">
                  <span
                    className={
                      fatSync.status === 'error'
                        ? 'text-rose-600 font-semibold'
                        : fatSync.status === 'ok'
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                    }
                  >
                    {fatSync.msg}
                  </span>
                  <button
                    type="button"
                    onClick={syncFat}
                    disabled={fatSync.status === 'loading'}
                    className="inline-flex items-center gap-1 font-bold text-purple-700 hover:text-purple-900 disabled:opacity-50"
                    title="Buscar novamente a planilha FAT"
                  >
                    <RefreshCw className={`w-3 h-3 ${fatSync.status === 'loading' ? 'animate-spin' : ''}`} />
                    Atualizar
                  </button>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                  !hasDivergence
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                {!hasDivergence ? (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                )}
                {!hasDivergence ? '100% CONFORME (SEM DIVERGÊNCIA)' : 'DIVERGÊNCIA IDENTIFICADA'}
              </span>
            </div>

            {/* Comparative Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5">SKU</th>
                    <th className="px-3.5 py-2.5">Descrição</th>
                    <th className="px-3.5 py-2.5 text-right">Planejado</th>
                    <th className="px-3.5 py-2.5 text-right">Corte</th>
                    <th className="px-3.5 py-2.5 text-right">Carregado</th>
                    <th className="px-3.5 py-2.5 text-right">Faturado (FAT)</th>
                    <th className="px-3.5 py-2.5 text-right">Carregado − Faturado</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const difCarregFat = row.carregado - row.faturado;
                    const isOk = isRowOk(row);
                    // Motivo da divergência, para orientar a revisão
                    const statusLabel = isOk
                      ? 'OK'
                      : row.planejado === 0 && row.carregado === 0
                      ? 'FATURADO FORA DO PLANO'
                      : row.faturado === 0 && row.carregado > 0
                      ? 'NÃO FATURADO'
                      : difCarregFat !== 0
                      ? 'DIVERGENTE'
                      : 'FATURADO ≠ PLANEJADO';

                    return (
                      <tr key={row.sku} className={isOk ? 'hover:bg-slate-50' : 'bg-rose-50/40 hover:bg-rose-50/70'}>
                        <td className="px-3.5 py-3 font-mono font-bold text-slate-900">{row.sku}</td>
                        <td className="px-3.5 py-3 text-slate-700 max-w-xs">{row.descricao}</td>
                        <td className="px-3.5 py-3 text-right font-medium text-slate-600">{row.planejado}</td>
                        <td className="px-3.5 py-3 text-right font-medium text-orange-700">
                          {row.corte > 0 ? `−${row.corte}` : '—'}
                        </td>
                        <td className="px-3.5 py-3 text-right font-black text-slate-900">{row.carregado}</td>
                        <td className="px-3.5 py-3 text-right font-black text-purple-700 font-mono">
                          {row.faturado}
                        </td>
                        <td className="px-3.5 py-3 text-right font-bold">
                          {difCarregFat === 0 ? (
                            <span className="text-emerald-600">0</span>
                          ) : difCarregFat > 0 ? (
                            <span className="text-amber-600">+{difCarregFat} (Sobra Físico)</span>
                          ) : (
                            <span className="text-rose-600">{difCarregFat} (Falta Físico)</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-center">
                          {isOk ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 whitespace-nowrap">
                              {statusLabel}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Table Footer */}
                <tfoot className="bg-slate-100 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-3.5 py-2.5 text-slate-900 uppercase text-[11px]">
                      Totais Acumulados:
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono">{totPlan}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-orange-700">
                      {totCorte > 0 ? `−${totCorte}` : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-emerald-700">{totCarreg}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono text-purple-700">{totFat}</td>
                    <td className="px-3.5 py-2.5 text-right font-mono">
                      {totCarreg - totFat === 0 ? (
                        <span className="text-emerald-700">0</span>
                      ) : (
                        <span className="text-rose-700">{totCarreg - totFat}</span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span className="text-[11px] font-bold text-slate-700">
                        {!hasDivergence ? 'Aprovado' : 'Revisar'}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Divergence alert callout if any */}
          {hasDivergence && (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-900 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Divergência entre Carga Física e Nota Fiscal Identificada</span>
              </div>
              <p>
                Os volumes carregados no caminhão não coincidem exatamente com o faturado na planilha FAT. O resumo com todas as divergências será enviado automaticamente por e-mail para a equipe fiscal e auditoria.
              </p>
            </div>
          )}


          {/* Bottom Actions: "Confirmar conferencia ou cancelar" */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs sm:text-sm"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleConfirmBilling}
              disabled={!chaveNFeInput.trim() && !notasRefDt}
              title={!chaveNFeInput.trim() && !notasRefDt ? 'Nenhuma nota desta DT na planilha FAT' : undefined}
              className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-white font-black rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-lg shadow-purple-600/30 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>CONFIRMAR CONFERÊNCIA</span>
            </button>
          </div>
        </div>
      )}


      {/* Email Dispatched Modal */}
      {showEmailModal && selectedInspection && (
        <EmailSentModal
          type="faturamento"
          inspection={selectedInspection}
          recipients={destinatariosFat}
          empresaNome={settings.empresaNome}
          unidadeCD={settings.unidadeCD}
          clientNotes={settings.clientNotes}
          onClose={() => {
            setShowEmailModal(false);
            onNavigateHome();
          }}
        />
      )}

      {/* Card: tabela SKU / Quantidade / Lote */}
      {tabelaDt && (() => {
        const linhas = linhasTabela(tabelaDt);
        const total = linhas.reduce((a, l) => a + l.quantidade, 0);
        return (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setTabelaDt(null)}
          >
            <div
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 px-5 py-4 bg-slate-900 text-white">
                <div>
                  <h3 className="font-black text-base flex items-center gap-2">
                    <Table2 className="w-5 h-5 text-purple-300" />
                    Itens da DT {tabelaDt.dt}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {linhas.length} linha(s) • {total} vol. • Placa {tabelaDt.placa || '-'}
                  </p>
                </div>
                <button type="button" onClick={() => setTabelaDt(null)} className="p-2 rounded-lg hover:bg-slate-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {linhas.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-500">Nenhum item conferido nesta DT.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-100 text-[11px] uppercase tracking-wider text-slate-600">
                      <tr>
                        <th className="text-left px-4 py-2 font-black">SKU</th>
                        <th className="text-right px-4 py-2 font-black">Quantidade</th>
                        <th className="text-left px-4 py-2 font-black">Lote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhas.map((l) => (
                        <tr key={`${l.sku}|${l.lote}`} className="border-t border-slate-100 even:bg-slate-50">
                          <td className="px-4 py-2 font-mono font-black text-slate-900">{l.sku}</td>
                          <td className="px-4 py-2 text-right font-mono font-bold text-slate-800">{l.quantidade}</td>
                          <td className="px-4 py-2 font-mono text-slate-700">{l.lote}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-300 bg-slate-50">
                        <td className="px-4 py-2 text-xs font-black uppercase text-slate-600">Total</td>
                        <td className="px-4 py-2 text-right font-mono font-black text-slate-900">{total}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>

              <div className="p-4 border-t border-slate-200">
                <button
                  type="button"
                  disabled={linhas.length === 0}
                  onClick={() => copiarTabela(tabelaDt)}
                  className={`w-full h-12 rounded-xl text-white font-black flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                    copiado ? 'bg-emerald-600' : 'bg-purple-600 hover:bg-purple-700'
                  }`}
                >
                  {copiado ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copiado ? 'Copiado!' : 'Copiar tabela'}
                </button>
                <p className="mt-1.5 text-center text-[10px] text-slate-400">Cola direto em colunas no Excel / Google Sheets.</p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
