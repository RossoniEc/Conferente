import React, { useState } from 'react';
import { 
  ScanLine, 
  Camera, 
  Truck, 
  Boxes, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Calculator, 
  FileText, 
  Mail, 
  Sparkles, 
  X, 
  Check, 
  Tag, 
  Maximize2,
  Lock,
  Unlock,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Eye,
  Scissors,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  CargoInspection,
  CheckedItem,
  ProductDePara,
  AppSettings,
  UserSession,
  MOTIVOS_CORTE,
  MotivoCorte,
  LoteQuantidade,
} from '../types';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';
import { CameraCapture } from './CameraCapture';
import { EmailSentModal } from './EmailSentModal';
import { BookSummaryModal } from './BookSummaryModal';
import { generateBookCarregamentoPdf } from '../services/pdfGenerator';
import { playBeep } from '../services/sound';
import { ListaNegraAlert, findListaNegra } from './ListaNegraAlert';
import { SignaturePad } from './SignaturePad';

interface LoadInspectionScreenProps {
  inspection: CargoInspection;
  onUpdateInspection: (updated: CargoInspection) => void;
  onFinishInspection: (finished: CargoInspection) => void;
  onNavigateHome: () => void;
  onNavigateBilling: (inspection: CargoInspection) => void;
  settings: AppSettings;
  user: UserSession;
}

export const LoadInspectionScreen: React.FC<LoadInspectionScreenProps> = ({
  inspection,
  onUpdateInspection,
  onFinishInspection,
  onNavigateHome,
  onNavigateBilling,
  settings,
  user,
}) => {
  // Modal states
  const [showItemScannerModal, setShowItemScannerModal] = useState(false);
  const [showBarcodeCamera, setShowBarcodeCamera] = useState(false);
  const [showCameraCapture, setShowCameraCapture] = useState<null | 'initial_truck' | 'cargo_pallet' | 'final_truck_seal'>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showBookSummaryModal, setShowBookSummaryModal] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null);

  // Vehicle Plate & Lacre state
  const [placaInput, setPlacaInput] = useState(inspection.placa || '');
  const [lacreInput, setLacreInput] = useState(inspection.numeroLacre || '');
  const [assinaturaConferente, setAssinaturaConferente] = useState<string | null>(inspection.assinaturaConferente || null);
  const [assinaturaMotorista, setAssinaturaMotorista] = useState<string | null>(inspection.assinaturaMotorista || null);

  // Persistent Batch/Lote replication memory
  const [replicatedLote, setReplicatedLote] = useState('L-2026A');
  const [autoReplicateLote, setAutoReplicateLote] = useState(true);

  // New Item Entry Form State
  const [currentEan, setCurrentEan] = useState('');
  const [matchedSku, setMatchedSku] = useState<ProductDePara | null>(null);
  const [currentLote, setCurrentLote] = useState(replicatedLote);
  // Vários lotes na mesma leitura: quantidade do 1º lote + lotes adicionais
  const [currentLoteQtd, setCurrentLoteQtd] = useState(0);
  const [extraLotes, setExtraLotes] = useState<LoteQuantidade[]>([]);
  const [calcMode, setCalcMode] = useState<'lastro' | 'direto'>('lastro');
  // 0 = campo vazio, aguardando digitação do conferente
  const [lastro, setLastro] = useState(0);
  const [camada, setCamada] = useState(0);
  const [pallets, setPallets] = useState(0);
  const [totalDireto, setTotalDireto] = useState(0);
  const [accumulatorHistory, setAccumulatorHistory] = useState<number[]>([]);
  const [itemPhotos, setItemPhotos] = useState<string[]>([]);
  const [itemObservacao, setItemObservacao] = useState('');

  // Editing existing checked item
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Corte Operacional form (one item at a time)
  const [corteItemId, setCorteItemId] = useState<string | null>(null);
  const [corteQtd, setCorteQtd] = useState('');
  const [corteMotivo, setCorteMotivo] = useState<MotivoCorte | ''>('');

  // Helper to lookup EAN in De/Para Table
  // EAN digitado/bipado que não existe no De/Para (exibe aviso)
  const [eanNotFound, setEanNotFound] = useState(false);

  // Busca exata no De/Para (EAN ou SKU). Chamado a cada tecla: não cria produto
  // provisório — só reconhece quando o código bate com o cadastro.
  const handleLookupEan = (eanCode: string, finalized = true) => {
    const clean = eanCode.trim();
    setCurrentEan(clean);

    const found = clean
      ? settings.deParaList.find((item) => item.ean === clean || item.sku.toUpperCase() === clean.toUpperCase())
      : undefined;

    if (found) {
      if (found.id !== matchedSku?.id) playBeep('success', settings.beepSoundEnabled);
      setMatchedSku(found);
      setEanNotFound(false);
    } else {
      setMatchedSku(null);
      // Aviso só quando a leitura terminou (Enter do leitor, câmera ou atalho), não durante a digitação
      setEanNotFound(finalized && !!clean);
      if (finalized && clean) playBeep('warning', settings.beepSoundEnabled);
    }
  };

  // Open Add Item modal
  const handleOpenAddItem = (prefillSku?: string) => {
    setEditingItemId(null);
    setItemPhotos([]);
    setItemObservacao('');

    // Pre-fill lote if replication is on
    setCurrentLote(autoReplicateLote ? replicatedLote : '');
    resetLotes();

    // Quantidades sempre abrem vazias para o conferente digitar
    setLastro(0);
    setCamada(0);
    setPallets(0);
    setTotalDireto(0);
    setAccumulatorHistory([]);

    if (prefillSku) {
      const match = settings.deParaList.find((x) => x.sku.toUpperCase() === prefillSku.toUpperCase());
      if (match) {
        setCurrentEan(match.ean);
        setMatchedSku(match);
        setShowItemScannerModal(true);
        return;
      }
    }

    // Sem SKU informada: abre com o campo EAN vazio, aguardando bipagem/digitação
    setCurrentEan('');
    setMatchedSku(null);
    setEanNotFound(false);

    setShowItemScannerModal(true);
  };

  // Quadrinhos acumuladores (+1, +5, +10, +25, +50, +100)
  const handleAddAccumulator = (qty: number) => {
    playBeep('scan', settings.beepSoundEnabled);
    const newHist = [...accumulatorHistory, qty];
    setAccumulatorHistory(newHist);
    const sum = newHist.reduce((a, b) => a + b, 0);
    setTotalDireto(sum);
  };

  const handleClearAccumulator = () => {
    setAccumulatorHistory([]);
    setTotalDireto(0);
  };

  const handleRemoveLastAccumulator = () => {
    if (accumulatorHistory.length === 0) return;
    const newHist = accumulatorHistory.slice(0, -1);
    setAccumulatorHistory(newHist);
    const sum = newHist.reduce((a, b) => a + b, 0);
    setTotalDireto(sum);
  };

  // Acumulado por SKU (várias leituras/pallets da mesma SKU somam contra o planejado)
  const getSkuTotals = (sku: string, items: CheckedItem[]) => {
    const planejado = inspection.itensPlanejados
      .filter((p) => p.sku === sku)
      .reduce((acc, p) => acc + p.quantidadePlanejada, 0);
    const skuItems = items.filter((i) => i.sku === sku);
    const carregado = skuItems.reduce((acc, i) => acc + i.quantidadeCarregada, 0);
    const corte = skuItems.reduce((acc, i) => acc + (i.corteOperacional?.quantidade || 0), 0);
    const esperado = planejado - corte;
    return { planejado, carregado, corte, esperado, excedente: carregado - esperado };
  };

  // Alerta exibido após salvar uma leitura que ultrapassa o planejado
  const [overPlanAlert, setOverPlanAlert] = useState<{ sku: string; carregado: number; esperado: number } | null>(null);

  // Volumes da leitura: (LASTRO x CAMADA x TOTAL DE PALLETS) + quadrinhos avulsos,
  // ou o total digitado (no modo "Digitar Total" os quadrinhos já compõem o total)
  const palletQty = lastro * camada * pallets;
  const quadrinhosQty = accumulatorHistory.reduce((a, b) => a + b, 0);
  const leituraQty = calcMode === 'lastro' ? palletQty + quadrinhosQty : totalDireto;

  // Com mais de um lote, a soma das quantidades por lote deve fechar com o total da leitura
  const isMultiLote = extraLotes.length > 0;
  const lotesSomados = currentLoteQtd + extraLotes.reduce((acc, l) => acc + l.quantidade, 0);
  const lotesPreenchidos = !!currentLote.trim() && extraLotes.every((l) => l.lote.trim() && l.quantidade > 0) && currentLoteQtd > 0;
  const lotesOk = !isMultiLote || (lotesPreenchidos && lotesSomados === leituraQty);

  const canSaveItem = !!matchedSku && leituraQty > 0 && lotesOk;

  const resetLotes = () => {
    setCurrentLoteQtd(0);
    setExtraLotes([]);
  };

  const updateExtraLote = (idx: number, patch: Partial<LoteQuantidade>) => {
    setExtraLotes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  // Save Checked Item
  const handleSaveCheckedItem = (addAnother = false) => {
    if (!matchedSku) {
      alert('Favor selecionar ou bipar um produto EAN válido.');
      return;
    }

    const calculatedQty = leituraQty;

    if (calculatedQty <= 0) {
      alert('Quantidade conferida deve ser maior que zero.');
      return;
    }

    // If auto replicate lote is checked, remember it
    if (autoReplicateLote && currentLote.trim()) {
      setReplicatedLote(currentLote.trim());
    }

    const lotes: LoteQuantidade[] | undefined = isMultiLote
      ? [
          { lote: currentLote.trim(), quantidade: currentLoteQtd },
          ...extraLotes.map((l) => ({ lote: l.lote.trim().toUpperCase(), quantidade: l.quantidade })),
        ]
      : undefined;

    const newItem: CheckedItem = {
      id: editingItemId || `chk-${Date.now()}`,
      sku: matchedSku.sku,
      ean: matchedSku.ean,
      descricao: matchedSku.descricao,
      lote: lotes ? lotes.map((l) => l.lote).join(' / ') : currentLote.trim() || 'SEM-LOTE',
      lotes,
      quantidadeCarregada: calculatedQty,
      lastro: calcMode === 'lastro' ? lastro : undefined,
      camada: calcMode === 'lastro' ? camada : undefined,
      pallets: calcMode === 'lastro' ? pallets : undefined,
      fotos: itemPhotos,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      acumuladorHistorico: accumulatorHistory,
      observacao: itemObservacao,
    };

    let updatedChecked = [...inspection.itensConferidos];
    if (editingItemId) {
      updatedChecked = updatedChecked.map((i) => (i.id === editingItemId ? newItem : i));
    } else {
      updatedChecked.push(newItem);
    }

    const updatedInspection: CargoInspection = {
      ...inspection,
      placa: placaInput.trim() || inspection.placa,
      itensConferidos: updatedChecked,
    };

    onUpdateInspection(updatedInspection);

    const totals = getSkuTotals(newItem.sku, updatedChecked);
    if (totals.excedente > 0) {
      setOverPlanAlert({ sku: newItem.sku, carregado: totals.carregado, esperado: totals.esperado });
      playBeep('warning', settings.beepSoundEnabled);
      if (settings.vibrationEnabled) navigator.vibrate?.([200, 100, 200]);
    } else {
      playBeep('success', settings.beepSoundEnabled);
    }

    if (addAnother) {
      // Reset for next reading
      setItemPhotos([]);
      setItemObservacao('');
      setEditingItemId(null);
      resetLotes();
      setLastro(0);
      setCamada(0);
      setPallets(0);
      setTotalDireto(0);
      setAccumulatorHistory([]);
      // Keep next product or open camera
      setShowBarcodeCamera(true);
    } else {
      setShowItemScannerModal(false);
    }
  };

  // Delete checked item (confirmação inline: window.confirm é bloqueado em iframes/webviews)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteCheckedItem = (itemId: string) => {
    onUpdateInspection({
      ...inspection,
      itensConferidos: inspection.itensConferidos.filter((i) => i.id !== itemId),
    });
    setPendingDeleteId(null);
    setOverPlanAlert(null);
    if (corteItemId === itemId) closeCorteForm();
  };

  // Corte Operacional
  const openCorteForm = (item: CheckedItem) => {
    setCorteItemId(item.id);
    setCorteQtd(item.corteOperacional ? String(item.corteOperacional.quantidade) : '');
    setCorteMotivo(item.corteOperacional?.motivo || '');
  };

  const closeCorteForm = () => {
    setCorteItemId(null);
    setCorteQtd('');
    setCorteMotivo('');
  };

  const setItemCorte = (itemId: string, corte: CheckedItem['corteOperacional']) => {
    onUpdateInspection({
      ...inspection,
      itensConferidos: inspection.itensConferidos.map((i) =>
        i.id === itemId ? { ...i, corteOperacional: corte } : i
      ),
    });
  };

  const handleSaveCorte = () => {
    const qtd = parseInt(corteQtd, 10);
    if (!corteItemId || !qtd || qtd <= 0 || !corteMotivo) return;
    setItemCorte(corteItemId, {
      quantidade: qtd,
      motivo: corteMotivo,
      timestamp: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    });
    closeCorteForm();
  };

  const handleRemoveCorte = (itemId: string) => {
    setItemCorte(itemId, undefined);
    closeCorteForm();
  };

  // Finalize load confirmation
  const handleFinalizeLoad = () => {
    if (!placaInput.trim()) {
      alert('Favor conferir e informar a placa do veículo.');
      return;
    }

    const updated: CargoInspection = {
      ...inspection,
      placa: placaInput.trim(),
      numeroLacre: lacreInput.trim(),
      assinaturaConferente: assinaturaConferente || undefined,
      assinaturaMotorista: assinaturaMotorista || undefined,
      dataFim: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      status: 'concluido',
      emailStatus: {
        enviado: true,
        destinatarios: destinatariosCarga,
        dataEnvio: new Date().toLocaleString('pt-BR'),
        assunto: `Book de Carregamento Concluído - DT: ${inspection.dt} - Placa: ${placaInput}`,
      },
    };

    onFinishInspection(updated);
    setShowFinishModal(false);

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch {}

    playBeep('success', settings.beepSoundEnabled);
    setShowEmailModal(true);
  };

  // Calculations for summary
  let totalPlanejado = 0;
  let totalCarregado = 0;
  inspection.itensPlanejados.forEach((i) => (totalPlanejado += i.quantidadePlanejada));
  inspection.itensConferidos.forEach((i) => (totalCarregado += i.quantidadeCarregada));
  const totalCorte = inspection.itensConferidos.reduce((acc, i) => acc + (i.corteOperacional?.quantidade || 0), 0);
  // O corte operacional é abatido do planejado: volume cortado não conta como falta
  const diferencaGeral = totalCarregado - (totalPlanejado - totalCorte);
  const isCargaExata = diferencaGeral === 0;

  // Grupo "Divergências & Cortes" só entra no envio quando a carga tem diferença ou corte operacional
  const temOcorrencia = diferencaGeral !== 0 || totalCorte > 0;
  const destinatariosCarga = Array.from(
    new Set([...settings.emailsCarga, ...(temOcorrencia ? settings.emailsOcorrencias || [] : [])])
  );

  // Matching Client Notes
  const loadCliente = inspection.itensPlanejados.find((p) => p.cliente)?.cliente || '';
  const matchingClientNotes = (settings.clientNotes || []).filter((note) => {
    if (!note.ativo) return false;
    const noteCli = note.cliente.toUpperCase();
    if (loadCliente && (noteCli === loadCliente.toUpperCase() || loadCliente.toUpperCase().includes(noteCli))) return true;
    if (inspection.dt.toUpperCase().includes(noteCli)) return true;
    if (inspection.motorista && inspection.motorista.toUpperCase().includes(noteCli)) return true;
    if (noteCli === 'GERAL' || noteCli === 'PADRÃO / GERAL') return true;
    return false;
  });

  // Alertas recolhidos por padrão: o ícone pisca e o conferente expande quando quiser ler
  const listaNegraMatches = findListaNegra(placaInput || inspection.placa, settings.listaNegra);
  const alertCount = listaNegraMatches.length + matchingClientNotes.length;
  const [alertsOpen, setAlertsOpen] = useState(false);

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      {/* Alertas (Lista Negra + instruções do cliente): ícone piscando que expande ao tocar */}
      {alertCount > 0 && (
        <button
          type="button"
          onClick={() => setAlertsOpen(!alertsOpen)}
          aria-expanded={alertsOpen}
          className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 border-2 text-left transition-colors ${
            alertsOpen
              ? 'bg-slate-900 border-rose-500 text-white'
              : 'bg-rose-50 border-rose-300 text-rose-900 hover:border-rose-500'
          }`}
        >
          <span className="relative flex w-10 h-10 shrink-0">
            {!alertsOpen && <span className="absolute inset-0 rounded-xl bg-rose-500 opacity-60 animate-ping" />}
            <span className="relative w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center">
              <AlertTriangle className={`w-5 h-5 ${alertsOpen ? '' : 'animate-pulse'}`} />
            </span>
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-black">
              {alertCount} {alertCount === 1 ? 'alerta' : 'alertas'} para esta carga
            </span>
            <span className={`block text-[11px] font-semibold ${alertsOpen ? 'text-slate-300' : 'text-rose-700'}`}>
              {[listaNegraMatches.length > 0 && 'Lista Negra', matchingClientNotes.length > 0 && 'Instrução do cliente']
                .filter(Boolean)
                .join(' • ')}{' '}
              — toque para {alertsOpen ? 'recolher' : 'ver'}
            </span>
          </span>
          <ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${alertsOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {alertsOpen && (
        <div className="space-y-4">
      {/* Lista Negra: placa do veículo com observação de atenção redobrada */}
      <ListaNegraAlert placa={placaInput || inspection.placa} lista={settings.listaNegra} />

      {/* Client Specific Instructions Banner (e.g. BRAMIL - REDOBRAR A ATENÇÃO) */}
      {matchingClientNotes.length > 0 && (
        <div className="space-y-2.5">
          {matchingClientNotes.map((note) => {
            const isUrgente = note.nivelAlerta === 'urgente';
            const isAtencao = note.nivelAlerta === 'atencao';

            return (
              <div
                key={note.id}
                className={`rounded-3xl p-4 sm:p-5 border-2 shadow-lg transition-all flex items-start space-x-3.5 ${
                  isUrgente
                    ? 'bg-rose-950 border-rose-500 text-white'
                    : isAtencao
                    ? 'bg-amber-950 border-amber-500 text-white'
                    : 'bg-blue-950 border-blue-500 text-white'
                }`}
              >
                <div
                  className={`p-2.5 rounded-2xl flex-shrink-0 ${
                    isUrgente ? 'bg-rose-600 text-white' : isAtencao ? 'bg-amber-500 text-slate-950' : 'bg-blue-600 text-white'
                  }`}
                >
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span
                      className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        isUrgente ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40' : 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      🚨 ALERTA DO CLIENTE: {note.cliente}
                    </span>
                    <span className="text-[10px] text-slate-300 font-bold uppercase tracking-wider">
                      Instrução Operacional Obrigatória
                    </span>
                  </div>

                  <p className="text-sm sm:text-base font-black tracking-wide text-white leading-snug uppercase">
                    {note.mensagem}
                  </p>

                  <p className="text-[11px] text-slate-300 font-medium">
                    Atenção conferente: Inspecione visualmente 100% dos pallets e fardos antes de consolidar o carregamento.
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-xl border border-slate-800 space-y-4">
        {/* Title row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                Etapa 2 • Execução de Pátio
              </span>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-black font-mono text-white">{inspection.dt}</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inspection.status === 'em_conferencia'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {inspection.status === 'em_conferencia' ? 'Em Conferência' : 'Concluído'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowBookSummaryModal(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center space-x-1.5 border border-slate-700 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Ver Book</span>
            </button>
          </div>
        </div>

        {/* Vehicle Placa Input + Initial Photo Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {/* Placa do carro input */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex-1 pr-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center">
                <Truck className="w-3 h-3 mr-1 text-amber-400" /> Placa do Veículo (Carga)
              </label>
              <input
                type="text"
                value={placaInput}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  setPlacaInput(val);
                  onUpdateInspection({ ...inspection, placa: val });
                }}
                placeholder="Ex: BRA-2E19"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono font-black text-sm uppercase tracking-wider focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Mercosul Plate Preview Tag */}
            <div className="bg-white border-2 border-blue-600 rounded-md px-2.5 py-1 text-slate-900 font-mono font-black text-xs shadow-inner flex flex-col items-center">
              <div className="w-full bg-blue-600 h-1 rounded-xs mb-0.5" />
              <span>{placaInput || 'PLACA'}</span>
            </div>
          </div>

          {/* Foto Inicial do Carro */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center">
                <Camera className="w-3 h-3 mr-1 text-amber-400" /> Foto Inicial do Veículo
              </label>
              <p className="text-[11px] text-slate-400">
                {inspection.fotoVeiculoInicio ? 'Foto registrada com sucesso' : 'Registre a frente/placa do veículo'}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {inspection.fotoVeiculoInicio ? (
                <div className="relative group">
                  <img
                    src={inspection.fotoVeiculoInicio}
                    alt="Veículo"
                    onClick={() => setExpandedPhoto(inspection.fotoVeiculoInicio!)}
                    className="w-12 h-10 object-cover rounded-lg border border-slate-700 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCameraCapture('initial_truck')}
                    className="absolute -top-1 -right-1 p-0.5 bg-slate-900 rounded-full text-slate-300 hover:text-amber-400 border border-slate-700"
                    title="Alterar Foto"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCameraCapture('initial_truck')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1 shadow-sm transition-all"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Fotografar</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quantities Overview Ribbon */}
        <div className="grid grid-cols-4 gap-2 pt-1 text-center">
          <div className="bg-slate-800/80 rounded-xl p-2 border border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Planejado</span>
            <span className="text-base sm:text-lg font-black text-slate-200">{totalPlanejado}</span>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-2 border border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Carregado</span>
            <span className="text-base sm:text-lg font-black text-emerald-400">{totalCarregado}</span>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-2 border border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-center gap-1">
              <Scissors className="w-3 h-3" /> Corte
            </span>
            <span className="text-base sm:text-lg font-black text-orange-400">{totalCorte}</span>
          </div>
          <div className="bg-slate-800/80 rounded-xl p-2 border border-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Diferença</span>
            <span
              className={`text-base sm:text-lg font-black ${
                isCargaExata ? 'text-emerald-400' : diferencaGeral > 0 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              {diferencaGeral === 0 ? '0' : diferencaGeral > 0 ? `+${diferencaGeral}` : diferencaGeral}
            </span>
          </div>
        </div>
      </div>

      {/* Prominent Action Bar: "BOTÃO ADICIONAR" (Abrir Câmera e Ler Código de Barra) */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <button
          type="button"
          onClick={() => {
            handleOpenAddItem();
            setShowBarcodeCamera(true);
          }}
          className="flex-1 py-4 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] text-slate-950 font-black rounded-2xl text-base sm:text-lg flex items-center justify-center space-x-3 shadow-xl shadow-amber-500/25 transition-all"
        >
          <Camera className="w-6 h-6 text-slate-950" />
          <span>ADICIONAR / LER CÓDIGO DE BARRAS</span>
        </button>
      </div>

      {/* Comparison: Planned SKUs vs Loaded Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center">
            <Boxes className="w-4 h-4 mr-1 text-amber-500" />
            Itens Conferidos na Carga ({inspection.itensConferidos.length})
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">
            Conferente: <strong className="text-slate-700">{user.name.split(' ')[0]}</strong>
          </span>
        </div>

        {/* Alerta após salvar leitura que ultrapassa o planejado */}
        {overPlanAlert && (
          <div className="flex items-start gap-3 bg-rose-600 text-white rounded-2xl px-4 py-3 shadow-md">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-black uppercase tracking-wide text-xs">Quantidade acima do planejado</p>
              <p>
                SKU <strong>{overPlanAlert.sku}</strong> totaliza <strong>{overPlanAlert.carregado}</strong> vol. carregados
                para <strong>{overPlanAlert.esperado}</strong> planejado (excedente de{' '}
                <strong>{overPlanAlert.carregado - overPlanAlert.esperado}</strong>). Verifique a leitura.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOverPlanAlert(null)}
              className="p-1 rounded-lg hover:bg-rose-700"
              title="Fechar alerta"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Empty state */}
        {inspection.itensConferidos.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-8 text-center text-slate-500 space-y-3">
            <ScanLine className="w-12 h-12 mx-auto text-amber-500 opacity-60 animate-bounce" />
            <h4 className="font-extrabold text-slate-800 text-base">Nenhum SKU Conferido Ainda</h4>
            <p className="text-xs max-w-sm mx-auto text-slate-500">
              Pressione o botão acima para abrir a câmera, ler o código de barras EAN do produto e consolidar os lotes e quantidades.
            </p>
            {/* Quick chips to scan from planned list */}
            {inspection.itensPlanejados.length > 0 && (
              <div className="pt-2">
                <p className="text-[11px] font-bold text-slate-400 mb-2">Ou adicione diretamente os itens planejados:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {inspection.itensPlanejados.map((p) => (
                    <button
                      key={p.sku}
                      type="button"
                      onClick={() => handleOpenAddItem(p.sku)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-amber-100 border border-slate-200 hover:border-amber-300 rounded-xl text-xs font-bold text-slate-800 transition-colors"
                    >
                      + {p.sku} ({p.quantidadePlanejada} un)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {inspection.itensConferidos.map((item, idx) => {
              // Status pelo acumulado da SKU (todas as leituras), já descontado o corte operacional
              const skuTotals = getSkuTotals(item.sku, inspection.itensConferidos);
              const diferenca = skuTotals.excedente;
              const skuHasMultipleReads = inspection.itensConferidos.filter((i) => i.sku === item.sku).length > 1;
              const isCorteOpen = corteItemId === item.id;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs hover:shadow-sm transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        {/* SKU em destaque (negrito) conforme solicitado no prompt */}
                        <span className="text-base font-black font-mono text-slate-950 tracking-tight">
                          {item.sku}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">EAN: {item.ean}</span>
                      </div>
                      <p className="text-xs text-slate-700 font-medium truncate">{item.descricao}</p>
                    </div>

                    {/* Actions */}
                    {pendingDeleteId === item.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-bold text-rose-700">Excluir?</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCheckedItem(item.id)}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                        title="Excluir leitura"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Lot and Quantities Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 rounded-xl p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">
                        {item.lotes?.length ? `Lotes (${item.lotes.length}):` : 'Lote:'}
                      </span>
                      {item.lotes?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {item.lotes.map((l, i) => (
                            <span
                              key={i}
                              className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block"
                            >
                              {l.lote} <span className="text-slate-500 font-normal">· {l.quantidade}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 inline-block">
                          {item.lote || 'SEM LOTE'}
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Cálculo Lastro:</span>
                      <span className="text-slate-700 font-medium">
                        {item.lastro && item.camada
                          ? (() => {
                              const avulsos =
                                item.quantidadeCarregada - item.lastro * item.camada * (item.pallets || 1);
                              return `${item.lastro} x ${item.camada}${
                                item.pallets ? ` x ${item.pallets} pallet${item.pallets > 1 ? 's' : ''}` : ''
                              }${avulsos > 0 ? ` + ${avulsos} quadrinhos` : ''}`;
                            })()
                          : 'Entrada Direta'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Carregado:</span>
                      <span className="text-base font-black text-emerald-700 font-mono">
                        {item.quantidadeCarregada} <span className="text-xs font-normal text-slate-500">vol.</span>
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Status Plan:</span>
                      <span
                        className={`font-bold inline-flex items-center text-xs ${
                          diferenca === 0
                            ? 'text-emerald-700'
                            : diferenca > 0
                            ? 'text-rose-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {diferenca === 0 ? 'Conforme' : diferenca > 0 ? `+${diferenca} Sobra` : `${diferenca} Falta`}
                      </span>
                      {skuHasMultipleReads && (
                        <span className="block text-[10px] text-slate-500 font-mono">
                          SKU: {skuTotals.carregado} / {skuTotals.esperado}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Alerta: acumulado da SKU acima do planejado */}
                  {diferenca > 0 && (
                    <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 text-xs text-rose-900">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>
                        {skuTotals.planejado === 0 ? (
                          <>
                            <strong>SKU fora do planejamento</strong> desta carga.
                          </>
                        ) : (
                          <>
                            <strong>Acima do planejado:</strong> SKU {item.sku} soma {skuTotals.carregado} vol. para{' '}
                            {skuTotals.esperado} planejado{skuTotals.corte > 0 ? ` (após corte de ${skuTotals.corte})` : ''}.
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Corte Operacional */}
                  {isCorteOpen ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-3">
                      <div className="flex items-center space-x-1.5 text-orange-800">
                        <Scissors className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-wide">Corte Operacional</span>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Quantidade cortada</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={corteQtd}
                          onChange={(e) => setCorteQtd(e.target.value)}
                          placeholder="0"
                          className="w-32 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Motivo</span>
                        <div className="flex flex-wrap gap-1.5">
                          {MOTIVOS_CORTE.map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setCorteMotivo(m)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                                corteMotivo === m
                                  ? 'bg-orange-600 border-orange-600 text-white'
                                  : 'bg-white border-slate-300 text-slate-700 hover:border-orange-400'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        {item.corteOperacional && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCorte(item.id)}
                            className="mr-auto text-xs font-bold text-rose-600 hover:text-rose-700"
                          >
                            Remover corte
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={closeCorteForm}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveCorte}
                          disabled={!(parseInt(corteQtd, 10) > 0) || !corteMotivo}
                          className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors"
                        >
                          Salvar corte
                        </button>
                      </div>
                    </div>
                  ) : item.corteOperacional ? (
                    <button
                      type="button"
                      onClick={() => openCorteForm(item)}
                      className="w-full flex items-center justify-between gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-left hover:border-orange-400 transition-colors"
                    >
                      <span className="flex items-center gap-1.5 text-xs text-orange-800 min-w-0">
                        <Scissors className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-black uppercase">Corte:</span>
                        <span className="font-mono font-bold">{item.corteOperacional.quantidade} vol.</span>
                        <span className="truncate">• {item.corteOperacional.motivo}</span>
                      </span>
                      <span className="text-[10px] font-bold text-orange-700 uppercase shrink-0">Editar</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openCorteForm(item)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-700 hover:text-orange-800"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                      Corte Operacional
                    </button>
                  )}

                  {/* Attached Photos */}
                  {item.fotos && item.fotos.length > 0 && (
                    <div className="flex items-center space-x-2 pt-1 overflow-x-auto">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Fotos da Carga:</span>
                      {item.fotos.map((f, photoIdx) => (
                        <img
                          key={photoIdx}
                          src={f}
                          alt="Pallet"
                          onClick={() => setExpandedPhoto(f)}
                          className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80"
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Footer Actions: "Ao termino da carga o usuário ira pressionar um finalizar carga" */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button
          type="button"
          onClick={onNavigateHome}
          className="w-full sm:w-auto px-5 py-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs sm:text-sm"
        >
          Voltar ao Menu
        </button>

        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenAddItem()}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-1.5"
          >
            <PlusCircle className="w-4 h-4 text-slate-600" />
            <span>Adicionar Mais SKUs</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFinishModal(true)}
            className="h-14 px-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-black rounded-2xl text-base sm:text-lg tracking-wide flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-600/30 transition-all"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-200" />
            <span>FINALIZAR CARGA</span>
          </button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: Adicionar SKU & Ler Código de Barra */}
      {/* ============================================================ */}
      {showItemScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl flex flex-col border border-slate-200 max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <ScanLine className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">Leitura de Código & SKU</h3>
                  <p className="text-[11px] text-slate-300">Conferência física e consolidação de quantidades</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowItemScannerModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* EAN / Barcode Input with Camera Trigger */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center">
                    <Tag className="w-3.5 h-3.5 mr-1 text-blue-600" />
                    Código de Barras (EAN do Produto):
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBarcodeCamera(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Abrir Câmera</span>
                  </button>
                </div>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentEan}
                    onChange={(e) => handleLookupEan(e.target.value, false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLookupEan(currentEan);
                    }}
                    onBlur={() => handleLookupEan(currentEan)}
                    placeholder="Bipe ou digite o EAN (Ex: 7891000100101)"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBarcodeCamera(true)}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1"
                  >
                    <Camera className="w-4 h-4" />
                    <span className="hidden sm:inline">Escanear</span>
                  </button>
                </div>

                {/* Quick Catalog Chips */}
                {/* Resumo por SKU: planejado x carregado x diferença (toque para selecionar) */}
                <div className="pt-1 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold">Itens desta Carga:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {inspection.itensPlanejados.map((it) => {
                      const dp = settings.deParaList.find((x) => x.sku === it.sku);
                      const tot = getSkuTotals(it.sku, inspection.itensConferidos);
                      const dif = tot.excedente;
                      const selected = matchedSku?.sku === it.sku;
                      return (
                        <button
                          key={it.sku}
                          type="button"
                          onClick={() => handleLookupEan(dp?.ean || it.sku)}
                          className={`text-left px-2.5 py-1.5 rounded-lg border transition-colors ${
                            selected
                              ? 'bg-amber-100 border-amber-400'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          }`}
                          title={it.descricao}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[11px] font-mono font-black ${selected ? 'text-amber-900' : 'text-slate-500'}`}
                            >
                              {it.sku}
                            </span>
                            <span
                              className={`text-[10px] font-black font-mono ${
                                dif === 0 ? 'text-emerald-700' : dif > 0 ? 'text-rose-600' : 'text-amber-700'
                              }`}
                            >
                              {dif === 0 ? 'OK' : dif > 0 ? `+${dif}` : dif}
                            </span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-600">
                            Carreg. <strong className="text-slate-900">{tot.carregado}</strong> / Plan. {tot.esperado}
                            {tot.corte > 0 && <span className="text-orange-700"> (−{tot.corte} corte)</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Highlighted SKU & Description Card */}
              {matchedSku ? (
                <div className="bg-amber-500/10 border-2 border-amber-400/60 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                      De/Para Reconhecido
                    </span>
                    <span className="text-[11px] font-mono font-bold text-slate-600">
                      {matchedSku.embalagem || 'Unidade Padrão'}
                    </span>
                  </div>
                  {/* SKU em destaque (negrito) com descrição do produto */}
                  <h4 className="text-xl font-black font-mono text-slate-950 tracking-tight">
                    {matchedSku.sku}
                  </h4>
                  <p className="text-xs font-semibold text-slate-700">{matchedSku.descricao}</p>
                </div>
              ) : eanNotFound ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs text-rose-800 text-center">
                  <strong>EAN {currentEan} não cadastrado</strong> na tabela De/Para. Confira o código ou cadastre o
                  produto em Configuração.
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                  Bipe o código de barras para carregar a SKU e a descrição do produto.
                </div>
              )}

              {/* LOTE Input with "Colar e replicar para próxima leitura" */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Número do Lote do Produto:
                  </label>
                  {/* Option to replicate lote */}
                  <button
                    type="button"
                    onClick={() => setAutoReplicateLote(!autoReplicateLote)}
                    className={`text-xs font-bold flex items-center space-x-1 px-2 py-0.5 rounded-lg transition-colors ${
                      autoReplicateLote
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {autoReplicateLote ? <Lock className="w-3 h-3 text-amber-600" /> : <Unlock className="w-3 h-3 text-slate-400" />}
                    <span>Replicar p/ Próxima Leitura</span>
                  </button>
                </div>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentLote}
                    onChange={(e) => setCurrentLote(e.target.value.toUpperCase())}
                    placeholder="Digite o Lote (Ex: L-2609A)"
                    className="flex-1 px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm text-slate-900 focus:outline-none focus:border-amber-500 uppercase"
                  />
                  {isMultiLote && (
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      placeholder="Qtd"
                      value={currentLoteQtd || ''}
                      onChange={(e) => setCurrentLoteQtd(Number(e.target.value))}
                      className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-center font-black text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                      aria-label="Quantidade do lote"
                    />
                  )}
                  {replicatedLote && !isMultiLote && (
                    <button
                      type="button"
                      onClick={() => setCurrentLote(replicatedLote)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs"
                      title="Colar Lote Anterior"
                    >
                      Colar ({replicatedLote})
                    </button>
                  )}
                </div>

                {/* Lotes adicionais */}
                {extraLotes.map((l, idx) => (
                  <div key={idx} className="flex space-x-2">
                    <input
                      type="text"
                      value={l.lote}
                      onChange={(e) => updateExtraLote(idx, { lote: e.target.value.toUpperCase() })}
                      placeholder={`Lote ${idx + 2}`}
                      className="flex-1 min-w-0 px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-mono text-sm text-slate-900 focus:outline-none focus:border-amber-500 uppercase"
                    />
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      placeholder="Qtd"
                      value={l.quantidade || ''}
                      onChange={(e) => updateExtraLote(idx, { quantidade: Number(e.target.value) })}
                      className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-center font-black text-sm text-slate-900 focus:outline-none focus:border-amber-500"
                      aria-label={`Quantidade do lote ${idx + 2}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = extraLotes.filter((_, i) => i !== idx);
                        setExtraLotes(next);
                        if (next.length === 0) setCurrentLoteQtd(0);
                      }}
                      className="p-2 text-slate-400 hover:text-rose-500 rounded-xl"
                      title="Remover lote"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setExtraLotes([...extraLotes, { lote: '', quantidade: 0 }])}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar outro lote
                  </button>
                  {isMultiLote && (
                    <span
                      className={`text-[11px] font-bold font-mono ${
                        lotesSomados === leituraQty && leituraQty > 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      Distribuído: {lotesSomados} / {leituraQty} vol
                    </span>
                  )}
                </div>
              </div>

              {/* CONSOLIDAÇÃO DE TOTAIS CARREGADOS */}
              <div className="border border-slate-200 rounded-2xl p-3.5 space-y-3 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Consolidar Totais Carregados
                  </span>
                  {/* Mode toggle */}
                  <div className="flex bg-slate-100 p-1 rounded-xl text-sm font-bold border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setCalcMode('lastro')}
                      className={`h-9 px-4 rounded-lg transition-all ${
                        calcMode === 'lastro'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Lastro x Camada
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalcMode('direto')}
                      className={`h-9 px-4 rounded-lg transition-all ${
                        calcMode === 'direto'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Digitar Total
                    </button>
                  </div>
                </div>

                {/* Opção Lastro x Camada */}
                {calcMode === 'lastro' ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1 text-center leading-tight">
                          Lastro
                          <br />
                          <span className="font-semibold text-slate-500">(cx p/ camada)</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          placeholder="—"
                          value={lastro || ''}
                          onChange={(e) => setLastro(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center font-black text-base text-slate-900 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1 text-center leading-tight">
                          Camadas
                          <br />
                          <span className="font-semibold text-slate-500">(altura)</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          placeholder="—"
                          value={camada || ''}
                          onChange={(e) => setCamada(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center font-black text-base text-slate-900 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1 text-center leading-tight">
                          Total de
                          <br />
                          <span className="font-semibold text-slate-500">Pallets</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          inputMode="numeric"
                          placeholder="—"
                          value={pallets || ''}
                          onChange={(e) => setPallets(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center font-black text-base text-slate-900 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    {/* Exibir a multiplicação conforme solicitado no prompt */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-xs text-emerald-800">
                        <Calculator className="w-4 h-4 text-emerald-600" />
                        <span>Multiplicação Instantânea:</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 font-mono">
                          {lastro || '—'} x {camada || '—'} x {pallets || '—'}
                          {quadrinhosQty > 0 ? ` = ${palletQty} + ${quadrinhosQty} quadrinhos` : ''} ={' '}
                        </span>
                        <span className="text-xl font-black text-emerald-700 font-mono">{leituraQty} volumes</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Opção Digitar Total Direto */
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Total de Volumes Físicos:
                    </label>
                    <input
                      type="number"
                      min="1"
                      inputMode="numeric"
                      placeholder="—"
                      value={totalDireto || ''}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setTotalDireto(v);
                        setAccumulatorHistory([v]);
                      }}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center font-black text-xl text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Vários quadrinhos para sistema vai acumulando os totais digitados */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase">
                      Quadrinhos Acumuladores (+ Somar Volumes):
                    </span>                    {accumulatorHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRemoveLastAccumulator}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700"
                      >
                        Desfazer Último
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-6 gap-1.5">
                    {[1, 5, 10, 20, 50, 100].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => handleAddAccumulator(qty)}
                        className="py-2 bg-slate-100 hover:bg-amber-100 active:scale-95 border border-slate-200 hover:border-amber-400 rounded-xl font-black text-xs text-slate-800 transition-all"
                      >
                        +{qty}
                      </button>
                    ))}
                  </div>

                  {/* Visual chips of accumulated chunks */}
                  {accumulatorHistory.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                      <span className="text-[10px] text-slate-400 font-bold mr-1">Blocos:</span>
                      {accumulatorHistory.map((v, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700 text-xs"
                        >
                          +{v}
                        </span>
                      ))}
                      <span className="ml-auto font-black text-emerald-700">
                        = {quadrinhosQty} vol{calcMode === 'lastro' ? ' (somados aos pallets)' : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Fotografar a Carga / Pallet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center">
                    <Camera className="w-3.5 h-3.5 mr-1 text-amber-500" />
                    Fotografar Carga / Pallet do SKU:
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCameraCapture('cargo_pallet')}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova Foto</span>
                  </button>
                </div>

                {itemPhotos.length > 0 ? (
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    {itemPhotos.map((p, i) => (
                      <div key={i} className="relative group flex-shrink-0">
                        <img
                          src={p}
                          alt="Pallet"
                          className="w-16 h-16 object-cover rounded-xl border border-slate-200 cursor-pointer"
                          onClick={() => setExpandedPhoto(p)}
                        />
                        <button
                          type="button"
                          onClick={() => setItemPhotos(itemPhotos.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCameraCapture('cargo_pallet')}
                    className="w-full py-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-600 flex items-center justify-center space-x-2 transition-colors"
                  >
                    <Camera className="w-4 h-4 text-amber-500" />
                    <span>Clique para Registrar Foto do Pallet</span>
                  </button>
                )}
              </div>
            </div>

            {/* Aviso: esta leitura fará a SKU ultrapassar o planejado */}
            {matchedSku &&
              (() => {
                const leitura = leituraQty;
                const outros = inspection.itensConferidos.filter((i) => i.id !== editingItemId);
                const t = getSkuTotals(matchedSku.sku, outros);
                const totalApos = t.carregado + leitura;
                if (totalApos <= t.esperado) return null;
                return (
                  <div className="mx-4 mb-3 p-3 bg-rose-50 border border-rose-300 rounded-xl flex items-start gap-2 text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <p className="text-xs">
                      {t.planejado === 0 ? (
                        <>
                          <strong>SKU {matchedSku.sku} não consta no planejamento</strong> desta carga.
                        </>
                      ) : (
                        <>
                          <strong>Acima do planejado:</strong> com esta leitura a SKU {matchedSku.sku} soma{' '}
                          <strong>{totalApos}</strong> vol. para <strong>{t.esperado}</strong> planejado
                          {t.corte > 0 ? ` (após corte de ${t.corte})` : ''} — excedente de{' '}
                          <strong>{totalApos - t.esperado}</strong>.
                        </>
                      )}
                    </p>
                  </div>
                );
              })()}

            {/* O que falta para liberar o registro */}
            {!canSaveItem && (
              <p className="mx-4 mb-2 text-center text-[11px] font-bold text-amber-700">
                {!matchedSku
                  ? 'Para registrar: bipe/digite o EAN ou toque em um item desta carga.'
                  : leituraQty <= 0
                  ? calcMode === 'lastro'
                    ? 'Para registrar: preencha Lastro, Camadas e Total de Pallets.'
                    : 'Para registrar: informe o total de volumes.'
                  : !lotesPreenchidos
                  ? 'Para registrar: informe o número e a quantidade de cada lote.'
                  : `Para registrar: a soma dos lotes (${lotesSomados}) deve ser igual ao total da leitura (${leituraQty}).`}
              </p>
            )}

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => handleSaveCheckedItem(true)}
                disabled={!canSaveItem}
                className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-800 font-extrabold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Salvar e Adicionar Mais SKUs</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveCheckedItem(false)}
                disabled={!canSaveItem}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-md shadow-amber-500/20 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: Finalizar Carga (Foto Veículo Final + Número do Lacre) */}
      {/* ============================================================ */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl flex flex-col border border-slate-200 max-h-[92vh] overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Finalização de Carga</h3>
                  <p className="text-xs text-slate-300">Conferência final, lacre e emissão de Book</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
              {/* Check do Total Planejado x Carregado */}
              <div
                className={`p-4 rounded-2xl border ${
                  isCargaExata
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                } space-y-2`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs uppercase tracking-wider flex items-center">
                    {isCargaExata ? (
                      <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600" />
                    )}
                    Check de Carga: {isCargaExata ? '100% CONFORME' : 'DIVERGÊNCIA IDENTIFICADA'}
                  </span>
                  <span className="font-mono font-bold text-xs">
                    {totalCarregado} carregados / {totalPlanejado} planejados
                    {totalCorte > 0 ? ` (−${totalCorte} corte)` : ''}
                  </span>
                </div>
                <p className="text-xs">
                  {isCargaExata
                    ? 'Todas as quantidades físicas carregadas batem perfeitamente com a relação planejada da DT.'
                    : `Atenção: Existe uma diferença acumulada de ${diferencaGeral} unidades entre o físico e o planejado.`}
                </p>
              </div>

              {/* Foto Final do Veículo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center">
                  <Camera className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  Foto Final do Veículo (Traseira / Baú Carregado):
                </label>
                {inspection.fotoVeiculoFim ? (
                  <div className="relative group inline-block">
                    <img
                      src={inspection.fotoVeiculoFim}
                      alt="Foto Final"
                      className="w-32 h-24 object-cover rounded-xl border border-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCameraCapture('final_truck_seal')}
                      className="mt-1 text-xs text-blue-600 font-bold hover:underline block"
                    >
                      Trocar foto
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCameraCapture('final_truck_seal')}
                    className="w-full py-3 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center space-x-2"
                  >
                    <Camera className="w-4 h-4 text-blue-600" />
                    <span>Registrar Foto Final do Veículo</span>
                  </button>
                )}
              </div>

              {/* Número do Lacre */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  Número do Lacre do Veículo:
                </label>
                <input
                  type="text"
                  required
                  value={lacreInput}
                  onChange={(e) => setLacreInput(e.target.value.toUpperCase())}
                  placeholder="Ex: LAC-982410"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-amber-500 uppercase"
                />
              </div>

              {/* Assinaturas (impressas no Book PDF) */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Assinaturas (saem no Book PDF):</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SignaturePad
                    label={`Conferente • ${user.name.split(' ')[0]}`}
                    value={assinaturaConferente}
                    onChange={setAssinaturaConferente}
                  />
                  <SignaturePad
                    label={`Motorista${inspection.motorista ? ` • ${inspection.motorista.split(' ')[0]}` : ''}`}
                    value={assinaturaMotorista}
                    onChange={setAssinaturaMotorista}
                  />
                </div>
              </div>

              {/* Grupo de E-mails Destinatários */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-1.5">
                <span className="font-bold text-slate-700 flex items-center">
                  <Mail className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  Disparo Automático do Book para Grupo:
                </span>
                <div className="flex flex-wrap gap-1">
                  {settings.emailsCarga.map((e) => (
                    <span key={e} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-700">
                      {e}
                    </span>
                  ))}
                </div>
                {temOcorrencia && (settings.emailsOcorrencias?.length || 0) > 0 && (
                  <div className="pt-1.5 border-t border-slate-200 space-y-1">
                    <span className="font-bold text-rose-700 flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      + Grupo Divergências &amp; Cortes (carga com {diferencaGeral !== 0 ? 'diferença' : ''}
                      {diferencaGeral !== 0 && totalCorte > 0 ? ' e ' : ''}
                      {totalCorte > 0 ? 'corte' : ''}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {settings.emailsOcorrencias!.map((e) => (
                        <span key={e} className="px-2 py-0.5 bg-rose-50 border border-rose-200 rounded text-[11px] font-mono text-rose-800">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowFinishModal(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleFinalizeLoad}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs sm:text-sm flex items-center space-x-2 shadow-lg shadow-emerald-600/30"
              >
                <Check className="w-4 h-4" />
                <span>CONFIRMAR E DISPARAR BOOK (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Camera Scanner Modal */}
      {showBarcodeCamera && (
        <BarcodeCameraScanner
          title="Leitor de Código de Barras EAN"
          subtitle="Posicione o código de barras no centro da mira vermelha"
          mode="barcode"
          beepEnabled={settings.beepSoundEnabled}
          onScan={(text) => {
            handleLookupEan(text);
            setShowBarcodeCamera(false);
          }}
          onClose={() => setShowBarcodeCamera(false)}
        />
      )}

      {/* Camera Photo Capture Modal */}
      {showCameraCapture && (
        <CameraCapture
          title={
            showCameraCapture === 'initial_truck'
              ? 'Foto do Veículo (Chegada)'
              : showCameraCapture === 'final_truck_seal'
              ? 'Foto Traseira & Lacre'
              : 'Foto do Pallet / Carga'
          }
          presetType={
            showCameraCapture === 'initial_truck'
              ? 'truck_front'
              : showCameraCapture === 'final_truck_seal'
              ? 'truck_back_seal'
              : 'pallet_cargo'
          }
          onCapture={(dataUrl) => {
            if (showCameraCapture === 'initial_truck') {
              const up = { ...inspection, fotoVeiculoInicio: dataUrl };
              onUpdateInspection(up);
            } else if (showCameraCapture === 'final_truck_seal') {
              const up = { ...inspection, fotoVeiculoFim: dataUrl };
              onUpdateInspection(up);
            } else if (showCameraCapture === 'cargo_pallet') {
              setItemPhotos([...itemPhotos, dataUrl]);
            }
            setShowCameraCapture(null);
          }}
          onClose={() => setShowCameraCapture(null)}
        />
      )}

      {/* Email Dispatched Confirmation Modal */}
      {showEmailModal && (
        <EmailSentModal
          type="carga"
          inspection={inspection}
          recipients={inspection.emailStatus?.destinatarios || destinatariosCarga}
          empresaNome={settings.empresaNome}
          onClose={() => {
            setShowEmailModal(false);
            onNavigateHome();
          }}
        />
      )}

      {/* Book Summary Modal */}
      {showBookSummaryModal && (
        <BookSummaryModal
          inspection={inspection}
          empresaNome={settings.empresaNome}
          unidadeCD={settings.unidadeCD}
          clientNotes={settings.clientNotes}
          onClose={() => setShowBookSummaryModal(false)}
        />
      )}

      {/* Expanded Photo Lightbox */}
      {expandedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setExpandedPhoto(null)}
        >
          <div className="relative max-w-2xl w-full">
            <button
              type="button"
              onClick={() => setExpandedPhoto(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-amber-400"
            >
              <X className="w-6 h-6" />
            </button>
            <img src={expandedPhoto} alt="Foto Ampliada" className="w-full max-h-[80vh] object-contain rounded-2xl" />
          </div>
        </div>
      )}
    </div>
  );
};
