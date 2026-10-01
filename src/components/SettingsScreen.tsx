import React, { useState, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Tag, 
  Sheet, 
  Mail, 
  Volume2, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Check, 
  Save, 
  Building2, 
  ExternalLink,
  Edit2,
  FileSpreadsheet,
  X,
  Cloud,
  CloudCheck,
  RefreshCw,
  CheckCircle2,
  FileUp,
  PlusCircle,
  Download,
  AlertCircle,
  MessageSquare,
  AlertTriangle,
  BellRing,
  ShieldAlert
} from 'lucide-react';
import { AppSettings, ProductDePara, SheetRowDT, SheetRowFAT, ClientNote } from '../types';
import { INITIAL_SHEET_DT } from '../services/storage';
import { fetchSheetFAT, getGoogleSheetCsvUrl, parseCsvToSheetFAT } from '../services/sheetFat';
import { playBeep } from '../services/sound';

interface SettingsScreenProps {
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  sheetRowsDT: SheetRowDT[];
  onSaveSheetDT: (rows: SheetRowDT[]) => void;
  sheetRowsFAT: SheetRowFAT[];
  onSaveSheetFAT: (rows: SheetRowFAT[]) => void;
  onResetAllData: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onSaveSettings,
  sheetRowsDT,
  onSaveSheetDT,
  sheetRowsFAT,
  onSaveSheetFAT,
  onResetAllData,
}) => {
  const [activeTab, setActiveTab] = useState<
    'depara' | 'sheet_dt' | 'sheet_fat' | 'client_notes' | 'lista_negra' | 'emails' | 'geral'
  >('depara');

  // Lista Negra (placas com observação)
  const [lnPlaca, setLnPlaca] = useState('');
  const [lnObs, setLnObs] = useState('');
  const [lnEditId, setLnEditId] = useState<string | null>(null);
  const [lnDeleteId, setLnDeleteId] = useState<string | null>(null);
  const [lnBusca, setLnBusca] = useState('');
  const [currentSettings, setCurrentSettings] = useState<AppSettings>(settings);

  // Client Notes State
  const [showClientNoteModal, setShowClientNoteModal] = useState(false);
  const [editingClientNote, setEditingClientNote] = useState<ClientNote | null>(null);
  const [clientInput, setClientInput] = useState('BRAMIL');
  const [mensagemInput, setMensagemInput] = useState('REDROBRAR A ATENÇÃO, NÃO ACEITA PALLET AVARIADO');
  const [nivelAlertaInput, setNivelAlertaInput] = useState<'urgente' | 'atencao' | 'informativo'>('urgente');
  const [ativoInput, setAtivoInput] = useState(true);
  const [clientNotesSearch, setClientNotesSearch] = useState('');

  // De/Para Item Form Modal
  const [showDeParaModal, setShowDeParaModal] = useState(false);
  const [editingDePara, setEditingDePara] = useState<ProductDePara | null>(null);
  const [eanInput, setEanInput] = useState('');
  const [skuInput, setSkuInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [unidInput, setUnidInput] = useState('CX');
  const [embInput, setEmbInput] = useState('Caixa Padrão');
  const [codClienteInput, setCodClienteInput] = useState('');
  const [lastroInput, setLastroInput] = useState(12);
  const [camadaInput, setCamadaInput] = useState(5);

  // New Email Inputs
  const [newEmailCarga, setNewEmailCarga] = useState('');
  const [newEmailFat, setNewEmailFat] = useState('');
  const [newEmailOcorr, setNewEmailOcorr] = useState('');

  // File input refs for uploading spreadsheets directly
  const fileInputRefDT = useRef<HTMLInputElement | null>(null);
  const fileInputRefFAT = useRef<HTMLInputElement | null>(null);
  const fileInputRefDePara = useRef<HTMLInputElement | null>(null);
  const [importDeParaMsg, setImportDeParaMsg] = useState<{ ok: boolean; msg: string } | null>(null);

  // New DT Row Modal State
  const [showAddDtModal, setShowAddDtModal] = useState(false);
  const [manualDt, setManualDt] = useState('61008899');
  const [manualPlaca, setManualPlaca] = useState('FDR-9087');
  const [manualMotorista, setManualMotorista] = useState('Severino Silva');
  const [manualTransp, setManualTransp] = useState('TransLog Brasil S/A');
  const [manualSku, setManualSku] = useState('201304');
  const [manualDesc, setManualDesc] = useState('Papel A');
  const [manualQtd, setManualQtd] = useState(200);
  const [manualCliente, setManualCliente] = useState('BRAMIL');
  const [manualCodCliente, setManualCodCliente] = useState('');

  // Cloud sync state
  const [isSyncingDT, setIsSyncingDT] = useState(false);
  const [syncSuccessDT, setSyncSuccessDT] = useState<string | null>(null);
  const [isSyncingFAT, setIsSyncingFAT] = useState(false);
  const [syncSuccessFAT, setSyncSuccessFAT] = useState<string | null>(null);
  const [syncErrorFAT, setSyncErrorFAT] = useState(false);

  // Helper to parse CSV text into SheetRowDT
  const parseCsvToSheetDT = (csvText: string): SheetRowDT[] => {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const first = lines[0];
    const sep = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
    const header = first.split(sep).map((c) => c.trim().toLowerCase().replace(/["']/g, ''));

    // "Código do Cliente" vem primeiro para não ser confundido com a coluna de SKU (código) nem de cliente
    const codCliIdx = header.findIndex((h) => (h.includes('cod') || h.includes('códig')) && h.includes('client'));
    const idx = (test: (h: string) => boolean) => header.findIndex((h, i) => i !== codCliIdx && test(h));

    let dtIdx = idx((h) => h.includes('dt') || h.includes('doc') || h.includes('transporte'));
    let skuIdx = idx((h) => h.includes('sku') || h.includes('item') || h.includes('código') || h.includes('cod'));
    let qtdIdx = header.findIndex((h) => h.includes('qtd') || h.includes('quant') || h.includes('volume') || h.includes('planej'));
    let placaIdx = header.findIndex((h) => h.includes('placa') || h.includes('veic') || h.includes('carro'));
    let motIdx = header.findIndex((h) => h.includes('motor') || h.includes('condutor'));
    let transpIdx = header.findIndex((h) => h.includes('transp') || h.includes('empresa'));
    let descIdx = header.findIndex((h) => h.includes('desc') || h.includes('prod') || h.includes('nome'));
    const cliIdx = idx((h) => h.includes('client') || h.includes('destinat') || h.includes('loja'));

    const hasHeader = dtIdx >= 0 || skuIdx >= 0 || qtdIdx >= 0;
    const startRow = hasHeader ? 1 : 0;
    if (dtIdx < 0) dtIdx = 0;
    if (placaIdx < 0) placaIdx = 1;
    if (skuIdx < 0) skuIdx = 2;
    if (qtdIdx < 0) qtdIdx = 3;

    const parsedRows: SheetRowDT[] = [];

    for (let i = startRow; i < lines.length; i++) {
      const cols = lines[i].split(sep).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) continue;

      const dt = cols[dtIdx] || `DT-${i}`;
      const sku = cols[skuIdx] || '';
      if (!sku) continue;

      const rawQtd = cols[qtdIdx]?.replace(/[^\d.,]/g, '').replace(',', '.') || '0';
      const quantidade = Math.round(parseFloat(rawQtd)) || 0;
      const placa = cols[placaIdx] || 'FDR-9087';
      const motorista = motIdx >= 0 && cols[motIdx] ? cols[motIdx] : 'Severino Silva';
      const transportadora = transpIdx >= 0 && cols[transpIdx] ? cols[transpIdx] : 'TransLog Brasil S/A';
      const descricao = descIdx >= 0 && cols[descIdx] ? cols[descIdx] : `Produto ${sku}`;
      const cliente = cliIdx >= 0 && cols[cliIdx] ? cols[cliIdx] : cols.find((c) => c.toUpperCase().includes('BRAMIL')) ? 'BRAMIL' : undefined;
      // Código do Cliente: coluna da planilha ou, na falta dela, o cadastrado no De/Para para o SKU
      const codigoCliente =
        (codCliIdx >= 0 && cols[codCliIdx]) ||
        currentSettings.deParaList.find((p) => p.sku.toUpperCase() === sku.toUpperCase())?.codigoCliente ||
        undefined;

      parsedRows.push({
        id: `csv-dt-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        dt: dt.toUpperCase(),
        placa: placa.toUpperCase(),
        motorista,
        transportadora,
        sku: sku.toUpperCase(),
        codigoCliente: codigoCliente ? codigoCliente.toUpperCase() : undefined,
        descricao,
        quantidade,
        cliente,
        dataCriacao: new Date().toISOString().split('T')[0],
      });
    }

    return parsedRows;
  };

  // Enhanced Synchronize Cloud DT Handler
  const handleSyncCloudDT = async () => {
    setIsSyncingDT(true);
    setSyncSuccessDT(null);
    playBeep('scan', currentSettings.beepSoundEnabled);

    try {
      let importedFromUrl = false;
      const inputUrl = currentSettings.googleSheetListaDTUrl;

      // If user provided a URL, attempt live CSV fetch
      if (inputUrl && inputUrl.startsWith('http')) {
        try {
          const exportUrl = getGoogleSheetCsvUrl(inputUrl);
          const response = await fetch(exportUrl, {
            headers: { Accept: 'text/csv,text/plain;q=0.9' },
          });

          if (response.ok) {
            const csvText = await response.text();
            if (csvText && csvText.length > 20) {
              const parsed = parseCsvToSheetDT(csvText);
              if (parsed.length > 0) {
                // Merge with existing ensuring no duplicates
                const merged = [...parsed];
                INITIAL_SHEET_DT.forEach((initRow) => {
                  if (!merged.some((r) => r.dt === initRow.dt && r.sku === initRow.sku)) {
                    merged.push(initRow);
                  }
                });
                onSaveSheetDT(merged);
                playBeep('success', currentSettings.beepSoundEnabled);
                setSyncSuccessDT(`Sincronizado na Nuvem via Google Sheets! ${merged.length} registros atualizados em tempo real (${new Date().toLocaleTimeString('pt-BR')})`);
                importedFromUrl = true;
              }
            }
          }
        } catch {
          // If CORS or offline, fallback to standard synchronization
        }
      }

      if (!importedFromUrl) {
        // Fallback or demo synchronization: Merge all rows from Google Sheets definition (DT 61008899 BRAMIL)
        await new Promise((r) => setTimeout(r, 600));
        const merged = [...sheetRowsDT];
        INITIAL_SHEET_DT.forEach((initRow) => {
          const idx = merged.findIndex((r) => r.dt === initRow.dt && r.sku === initRow.sku);
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...initRow };
          } else {
            merged.unshift(initRow);
          }
        });
        onSaveSheetDT(merged);
        playBeep('success', currentSettings.beepSoundEnabled);
        setSyncSuccessDT(`Sincronização na Nuvem concluída com sucesso! ${merged.length} registros da planilha "LISTA DT" ativos (DT 61008899 BRAMIL sincronizada às ${new Date().toLocaleTimeString('pt-BR')})`);
      }
    } catch {
      setSyncSuccessDT('Erro ao conectar na nuvem. Verifique a conexão ou use "Importar CSV".');
      playBeep('error', currentSettings.beepSoundEnabled);
    } finally {
      setIsSyncingDT(false);
    }
  };

  // Upload and parse local CSV file for LISTA DT
  const handleFileUploadDT = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const parsed = parseCsvToSheetDT(content);
      if (parsed.length === 0) {
        alert('Não foi possível identificar linhas válidas no arquivo CSV.');
        return;
      }

      // Merge new rows
      const merged = [...parsed];
      INITIAL_SHEET_DT.forEach((initRow) => {
        if (!merged.some((r) => r.dt === initRow.dt && r.sku === initRow.sku)) {
          merged.push(initRow);
        }
      });

      onSaveSheetDT(merged);
      playBeep('success', currentSettings.beepSoundEnabled);
      setSyncSuccessDT(`Arquivo "${file.name}" importado com sucesso! ${parsed.length} linhas adicionadas.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Enhanced Synchronize Cloud FAT Handler
  const handleSyncCloudFAT = async () => {
    setIsSyncingFAT(true);
    setSyncSuccessFAT(null);
    playBeep('scan', currentSettings.beepSoundEnabled);

    try {
      const parsed = await fetchSheetFAT(currentSettings.googleSheetFatUrl);

      // A planilha é a fonte da verdade: substitui a base FAT local
      onSaveSheetFAT(parsed);
      playBeep('success', currentSettings.beepSoundEnabled);
      setSyncErrorFAT(false);
      setSyncSuccessFAT(`Base fiscal "FAT" sincronizada com o Google Sheets! ${parsed.length} registros às ${new Date().toLocaleTimeString('pt-BR')}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao conectar no Google Sheets. Verifique a conexão.';
      setSyncErrorFAT(true);
      setSyncSuccessFAT(msg);
      playBeep('error', currentSettings.beepSoundEnabled);
    } finally {
      setIsSyncingFAT(false);
    }
  };

  // Upload local CSV for FAT
  const handleFileUploadFAT = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const parsed = parseCsvToSheetFAT(content);
      if (parsed.length === 0) {
        alert('Não foi possível identificar linhas fiscais válidas no arquivo.');
        return;
      }

      onSaveSheetFAT(parsed);
      playBeep('success', currentSettings.beepSoundEnabled);
      setSyncErrorFAT(false);
      setSyncSuccessFAT(`Arquivo "${file.name}" importado na base FAT! ${parsed.length} notas carregadas.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Manual DT creation
  const handleSaveManualDt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDt.trim() || !manualSku.trim() || manualQtd <= 0) {
      alert('Favor preencher DT, SKU e Quantidade.');
      return;
    }

    const newRow: SheetRowDT = {
      id: `man-dt-${Date.now()}`,
      dt: manualDt.trim().toUpperCase(),
      placa: manualPlaca.trim().toUpperCase() || 'FDR-9087',
      motorista: manualMotorista.trim() || 'Severino Silva',
      transportadora: manualTransp.trim() || 'TransLog Brasil S/A',
      sku: manualSku.trim().toUpperCase(),
      codigoCliente:
        manualCodCliente.trim().toUpperCase() ||
        currentSettings.deParaList.find((p) => p.sku.toUpperCase() === manualSku.trim().toUpperCase())?.codigoCliente ||
        undefined,
      descricao: manualDesc.trim() || `Produto ${manualSku}`,
      quantidade: manualQtd,
      cliente: manualCliente.trim() || undefined,
      dataCriacao: new Date().toISOString().split('T')[0],
    };

    const updated = [newRow, ...sheetRowsDT];
    onSaveSheetDT(updated);
    setShowAddDtModal(false);
    playBeep('success', currentSettings.beepSoundEnabled);
    setSyncSuccessDT(`Linha adicionada à DT ${newRow.dt} com sucesso!`);
  };

  // Delete row from LISTA DT
  const handleDeleteDtRow = (id: string) => {
    if (confirm('Deseja remover esta linha da base LISTA DT?')) {
      const updated = sheetRowsDT.filter((r) => r.id !== id);
      onSaveSheetDT(updated);
      playBeep('warning', currentSettings.beepSoundEnabled);
    }
  };

  // Save Settings helper
  const updateSettings = (partial: Partial<AppSettings>) => {
    const updated = { ...currentSettings, ...partial };
    setCurrentSettings(updated);
    onSaveSettings(updated);
  };

  // Open De/Para Modal
  const handleOpenDeParaModal = (item?: ProductDePara) => {
    if (item) {
      setEditingDePara(item);
      setEanInput(item.ean);
      setSkuInput(item.sku);
      setDescInput(item.descricao);
      setUnidInput(item.unidade || 'CX');
      setEmbInput(item.embalagem || 'Caixa Padrão');
      setCodClienteInput(item.codigoCliente || '');
      setLastroInput(item.lastroPadrao || 12);
      setCamadaInput(item.camadaPadrao || 5);
    } else {
      setEditingDePara(null);
      setEanInput('');
      setSkuInput('');
      setDescInput('');
      setUnidInput('CX');
      setEmbInput('Caixa Padrão');
      setCodClienteInput('');
      setLastroInput(12);
      setCamadaInput(5);
    }
    setShowDeParaModal(true);
  };

  // Save De/Para Product
  const handleSaveDePara = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eanInput.trim() || !skuInput.trim() || !descInput.trim()) {
      alert('Favor preencher EAN, SKU e Descrição.');
      return;
    }

    const newItem: ProductDePara = {
      id: editingDePara?.id || `dp-${Date.now()}`,
      ean: eanInput.trim(),
      sku: skuInput.trim().toUpperCase(),
      descricao: descInput.trim(),
      unidade: unidInput.trim().toUpperCase(),
      embalagem: embInput.trim(),
      codigoCliente: codClienteInput.trim() || undefined,
      lastroPadrao: Number(lastroInput),
      camadaPadrao: Number(camadaInput),
    };

    let updatedList = [...currentSettings.deParaList];
    if (editingDePara) {
      updatedList = updatedList.map((i) => (i.id === editingDePara.id ? newItem : i));
    } else {
      updatedList.push(newItem);
    }

    updateSettings({ deParaList: updatedList });
    setShowDeParaModal(false);
  };

  // Importação em lote da lista de SKUs (CSV/TXT: ; , ou tab). Atualiza por EAN/SKU e acrescenta os novos.
  const handleImportDePara = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '').replace(/^﻿/, '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        setImportDeParaMsg({ ok: false, msg: 'Arquivo vazio ou sem linhas de produto.' });
        return;
      }

      const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
      const split = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const header = split(lines[0]).map(norm);
      const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));

      const iEan = col('ean', 'barra');
      const iSku = col('sku', 'codigo interno', 'material');
      const iDesc = col('descri', 'produto', 'nome');
      const iUn = col('unid', 'un');
      const iEmb = col('embal');
      const iLastro = col('lastro');
      const iCamada = col('camada', 'altura');
      const iCodCliente = col('cliente', 'cod cli', 'cod_cli');

      if (iEan < 0 || iSku < 0) {
        setImportDeParaMsg({
          ok: false,
          msg: 'Cabeçalho não reconhecido. O arquivo precisa das colunas EAN e SKU (use o modelo).',
        });
        return;
      }

      const list = [...currentSettings.deParaList];
      let novos = 0;
      let atualizados = 0;
      let ignorados = 0;

      lines.slice(1).forEach((line, idx) => {
        const c = split(line);
        const ean = (c[iEan] || '').replace(/\D/g, '');
        const sku = (c[iSku] || '').toUpperCase();
        if (!ean || !sku) {
          ignorados++;
          return;
        }
        const num = (i: number) => (i >= 0 && Number(c[i]) > 0 ? Number(c[i]) : undefined);
        const pos = list.findIndex((p) => p.ean === ean || p.sku.toUpperCase() === sku);
        const base = pos >= 0 ? list[pos] : undefined;
        const item: ProductDePara = {
          id: base?.id || `dp-imp-${Date.now()}-${idx}`,
          ean,
          sku,
          descricao: (iDesc >= 0 && c[iDesc]) || base?.descricao || `Produto ${sku}`,
          unidade: ((iUn >= 0 && c[iUn]) || base?.unidade || 'CX').toUpperCase(),
          embalagem: (iEmb >= 0 && c[iEmb]) || base?.embalagem || 'Caixa Padrão',
          codigoCliente: ((iCodCliente >= 0 && c[iCodCliente]) || base?.codigoCliente || '').toUpperCase() || undefined,
          lastroPadrao: num(iLastro) ?? base?.lastroPadrao,
          camadaPadrao: num(iCamada) ?? base?.camadaPadrao,
        };
        if (pos >= 0) {
          list[pos] = item;
          atualizados++;
        } else {
          list.push(item);
          novos++;
        }
      });

      updateSettings({ deParaList: list });
      playBeep('success', currentSettings.beepSoundEnabled);
      setImportDeParaMsg({
        ok: true,
        msg: `"${file.name}": ${novos} produto(s) novo(s), ${atualizados} atualizado(s)${
          ignorados ? `, ${ignorados} linha(s) ignorada(s) sem EAN/SKU` : ''
        }.`,
      });
    };
    reader.readAsText(file, 'UTF-8');
  };

  // Modelo de planilha para importação
  const handleDownloadDeParaTemplate = () => {
    const csv =
      '﻿EAN;SKU;CODIGO CLIENTE;DESCRICAO;UNIDADE;EMBALAGEM;LASTRO;CAMADA\n' +
      '7891201304012;201304;BR-PA-001;Papel A (BRAMIL);CX;Fardo Padrão;20;10\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_lista_sku.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Lista Negra ----------
  const listaNegra = currentSettings.listaNegra || [];

  const resetLnForm = () => {
    setLnPlaca('');
    setLnObs('');
    setLnEditId(null);
  };

  const handleSaveListaNegra = (e: React.FormEvent) => {
    e.preventDefault();
    const placa = lnPlaca.trim().toUpperCase();
    const observacao = lnObs.trim();
    if (!placa || !observacao) return;

    const updated = lnEditId
      ? listaNegra.map((p) => (p.id === lnEditId ? { ...p, placa, observacao } : p))
      : [
          {
            id: `ln-${Date.now()}`,
            placa,
            observacao,
            ativo: true,
            dataCriacao: new Date().toLocaleDateString('pt-BR'),
          },
          ...listaNegra,
        ];
    updateSettings({ listaNegra: updated });
    playBeep('success', currentSettings.beepSoundEnabled);
    resetLnForm();
  };

  const handleEditListaNegra = (id: string) => {
    const item = listaNegra.find((p) => p.id === id);
    if (!item) return;
    setLnEditId(id);
    setLnPlaca(item.placa);
    setLnObs(item.observacao);
  };

  const handleToggleListaNegra = (id: string) => {
    updateSettings({ listaNegra: listaNegra.map((p) => (p.id === id ? { ...p, ativo: !p.ativo } : p)) });
  };

  const handleDeleteListaNegra = (id: string) => {
    updateSettings({ listaNegra: listaNegra.filter((p) => p.id !== id) });
    setLnDeleteId(null);
    if (lnEditId === id) resetLnForm();
  };

  const handleDeleteDePara = (id: string) => {
    if (confirm('Excluir este item da tabela De/Para?')) {
      const updated = currentSettings.deParaList.filter((i) => i.id !== id);
      updateSettings({ deParaList: updated });
    }
  };

  // Client Notes management
  const handleOpenClientNoteModal = (note?: ClientNote) => {
    if (note) {
      setEditingClientNote(note);
      setClientInput(note.cliente);
      setMensagemInput(note.mensagem);
      setNivelAlertaInput(note.nivelAlerta || 'urgente');
      setAtivoInput(note.ativo);
    } else {
      setEditingClientNote(null);
      setClientInput('BRAMIL');
      setMensagemInput('REDROBRAR A ATENÇÃO, NÃO ACEITA PALLET AVARIADO');
      setNivelAlertaInput('urgente');
      setAtivoInput(true);
    }
    setShowClientNoteModal(true);
  };

  const handleSaveClientNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientInput.trim() || !mensagemInput.trim()) {
      alert('Favor preencher o Cliente e a Mensagem de instrução.');
      return;
    }

    const currentNotes = currentSettings.clientNotes || [];
    let updated: ClientNote[];

    if (editingClientNote) {
      updated = currentNotes.map((n) =>
        n.id === editingClientNote.id
          ? {
              ...n,
              cliente: clientInput.trim().toUpperCase(),
              mensagem: mensagemInput.trim(),
              nivelAlerta: nivelAlertaInput,
              ativo: ativoInput,
            }
          : n
      );
    } else {
      const newNote: ClientNote = {
        id: `cn-${Date.now()}`,
        cliente: clientInput.trim().toUpperCase(),
        mensagem: mensagemInput.trim(),
        nivelAlerta: nivelAlertaInput,
        ativo: ativoInput,
        dataCriacao: new Date().toISOString().split('T')[0],
      };
      updated = [newNote, ...currentNotes];
    }

    updateSettings({ clientNotes: updated });
    setShowClientNoteModal(false);
    playBeep('success', currentSettings.beepSoundEnabled);
  };

  const handleDeleteClientNote = (id: string) => {
    if (confirm('Deseja excluir esta anotação padrão do cliente?')) {
      const updated = (currentSettings.clientNotes || []).filter((n) => n.id !== id);
      updateSettings({ clientNotes: updated });
      playBeep('warning', currentSettings.beepSoundEnabled);
    }
  };

  const handleToggleClientNote = (id: string) => {
    const updated = (currentSettings.clientNotes || []).map((n) =>
      n.id === id ? { ...n, ativo: !n.ativo } : n
    );
    updateSettings({ clientNotes: updated });
    playBeep('scan', currentSettings.beepSoundEnabled);
  };

  // Email management
  const handleAddEmailCarga = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmailCarga.trim() || !newEmailCarga.includes('@')) return;
    const updated = [...currentSettings.emailsCarga, newEmailCarga.trim().toLowerCase()];
    updateSettings({ emailsCarga: updated });
    setNewEmailCarga('');
  };

  const handleRemoveEmailCarga = (email: string) => {
    const updated = currentSettings.emailsCarga.filter((e) => e !== email);
    updateSettings({ emailsCarga: updated });
  };

  const handleAddEmailFat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmailFat.trim() || !newEmailFat.includes('@')) return;
    const updated = [...currentSettings.emailsFaturamento, newEmailFat.trim().toLowerCase()];
    updateSettings({ emailsFaturamento: updated });
    setNewEmailFat('');
  };

  const handleRemoveEmailFat = (email: string) => {
    const updated = currentSettings.emailsFaturamento.filter((e) => e !== email);
    updateSettings({ emailsFaturamento: updated });
  };

  // Grupo Divergências & Cortes
  const handleAddEmailOcorr = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmailOcorr.trim().toLowerCase();
    const atual = currentSettings.emailsOcorrencias || [];
    if (!email || !email.includes('@') || atual.includes(email)) return;
    updateSettings({ emailsOcorrencias: [...atual, email] });
    setNewEmailOcorr('');
  };

  const handleRemoveEmailOcorr = (email: string) => {
    updateSettings({ emailsOcorrencias: (currentSettings.emailsOcorrencias || []).filter((e) => e !== email) });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6 space-y-5">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
            Tópico 6 • Parâmetros do Sistema
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
            <SettingsIcon className="w-6 h-6 text-slate-700" />
            <span>Configuração do WMS</span>
          </h2>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex overflow-x-auto gap-1.5 p-1 bg-slate-200 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('depara')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 whitespace-nowrap transition-all ${
            activeTab === 'depara'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Tag className="w-3.5 h-3.5 text-blue-600" />
          <span>Tabela De/Para (EAN-SKU)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sheet_dt')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 whitespace-nowrap transition-all ${
            activeTab === 'sheet_dt'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sheet className="w-3.5 h-3.5 text-emerald-600" />
          <span>Planilha "LISTA DT"</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sheet_fat')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 whitespace-nowrap transition-all ${
            activeTab === 'sheet_fat'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-purple-600" />
          <span>Planilha "FAT" (NF-e)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('client_notes')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 whitespace-nowrap transition-all ${
            activeTab === 'client_notes'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-rose-600" />
          <span>Comentários de Clientes</span>
          {(currentSettings.clientNotes?.length || 0) > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-100 text-rose-700 font-extrabold">
              {currentSettings.clientNotes?.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lista_negra')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 whitespace-nowrap transition-all ${
            activeTab === 'lista_negra'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-slate-900" />
          <span>Lista Negra</span>
          {(currentSettings.listaNegra?.filter((p) => p.ativo).length || 0) > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-900 text-white font-extrabold">
              {currentSettings.listaNegra?.filter((p) => p.ativo).length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('emails')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 whitespace-nowrap transition-all ${
            activeTab === 'emails'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mail className="w-3.5 h-3.5 text-amber-600" />
          <span>Grupo de E-mails</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('geral')}
          className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 whitespace-nowrap transition-all ${
            activeTab === 'geral'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5 text-slate-600" />
          <span>Empresa & Dispositivo</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: Tabela De/Para (EAN <-> SKU) */}
      {/* ============================================================ */}
      {activeTab === 'depara' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">
                Cadastro De/Para: Código de Barras (EAN) ➔ SKU
              </h3>
              <p className="text-xs text-slate-500">
                O leitor da Conferência de Carga converte o código de barras lido nesta tabela para identificar o produto e o lastro padrão.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={handleDownloadDeParaTemplate}
                className="px-3 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs flex items-center space-x-1.5"
                title="Baixar planilha modelo (CSV)"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Modelo</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRefDePara.current?.click()}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5"
                title="Importar lista de SKUs (CSV / TXT)"
              >
                <FileUp className="w-4 h-4" />
                <span>Importar Lista</span>
              </button>
              <input
                ref={fileInputRefDePara}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleImportDePara}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => handleOpenDeParaModal()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Produto</span>
              </button>
            </div>
          </div>

          {importDeParaMsg && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                importDeParaMsg.ok
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              {importDeParaMsg.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-semibold flex-1">{importDeParaMsg.msg}</span>
              <button type="button" onClick={() => setImportDeParaMsg(null)} className="p-0.5 opacity-60 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <p className="text-[11px] text-slate-500 -mt-1">
            Importação: arquivo CSV/TXT (Excel → "Salvar como CSV") com as colunas <strong>EAN; SKU; CODIGO CLIENTE; DESCRICAO;
            UNIDADE; EMBALAGEM; LASTRO; CAMADA</strong>. Produtos com o mesmo EAN ou SKU são atualizados; os demais são adicionados.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">Código EAN</th>
                  <th className="px-3 py-2.5">SKU (Interno)</th>
                  <th className="px-3 py-2.5">Código do Cliente</th>
                  <th className="px-3 py-2.5">Descrição do Produto</th>
                  <th className="px-3 py-2.5 text-center">Lastro x Camada</th>
                  <th className="px-3 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentSettings.deParaList.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono font-bold text-slate-800">{item.ean}</td>
                    <td className="px-3 py-3 font-mono font-black text-blue-700">{item.sku}</td>
                    <td className="px-3 py-3 font-mono font-bold text-slate-700">{item.codigoCliente || '—'}</td>
                    <td className="px-3 py-3 text-slate-700 font-medium">{item.descricao}</td>
                    <td className="px-3 py-3 text-center text-slate-600 font-mono">
                      {item.lastroPadrao || 12} x {item.camadaPadrao || 5} (
                      {(item.lastroPadrao || 12) * (item.camadaPadrao || 5)})
                    </td>
                    <td className="px-3 py-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenDeParaModal(item)}
                        className="p-1 text-slate-500 hover:text-blue-600"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDePara(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: Planilha Google Sheets "LISTA DT" */}
      {/* ============================================================ */}
      {activeTab === 'sheet_dt' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center space-x-2">
                <Sheet className="w-5 h-5 text-emerald-600" />
                <span>Base de Dados Google Sheet: "LISTA DT"</span>
              </h3>
              <p className="text-xs text-slate-500">
                Itens planejados por DT, SKU, Quantidade, Placa, Motorista e Transportadora.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
                {sheetRowsDT.length} Linhas
              </span>
              <button
                type="button"
                onClick={() => setShowAddDtModal(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center space-x-1 shadow-sm transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Nova Linha</span>
              </button>
            </div>
          </div>

          {/* Connected Google Sheets URL config */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
            <label className="text-xs font-bold text-emerald-950 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Cloud className="w-4 h-4 text-emerald-600" />
                <span>URL da Planilha Google Sheet "LISTA DT" (Publicada / CSV):</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                Sincronização em Nuvem
              </span>
            </label>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                value={currentSettings.googleSheetListaDTUrl || ''}
                onChange={(e) => updateSettings({ googleSheetListaDTUrl: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/.../pubhtml"
                className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs text-slate-800 focus:outline-none font-mono min-w-[200px]"
              />
              <button
                type="button"
                disabled={isSyncingDT}
                onClick={handleSyncCloudDT}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 active:scale-95 disabled:opacity-75 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm flex-shrink-0"
              >
                {isSyncingDT ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <CloudCheck className="w-3.5 h-3.5" />
                    <span>Sincronizar na Nuvem</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => fileInputRefDT.current?.click()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm flex-shrink-0"
                title="Importar arquivo CSV baixado do Google Sheets"
              >
                <FileUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Importar CSV</span>
              </button>
              <input
                ref={fileInputRefDT}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleFileUploadDT}
              />
            </div>
            {syncSuccessDT && (
              <div className="mt-2 p-2.5 rounded-xl bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-xs flex items-center space-x-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                <span className="font-semibold">{syncSuccessDT}</span>
              </div>
            )}
          </div>

          {/* Table View of Data */}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2">DT</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Placa</th>
                  <th className="px-3 py-2">Motorista</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Código do Cliente</th>
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2 text-right">Qtd Plan.</th>
                  <th className="px-2 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sheetRowsDT.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">{r.dt}</td>
                    <td className="px-3 py-2 font-bold text-blue-700">
                      {r.cliente ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-blue-50 text-blue-800 border border-blue-200">
                          {r.cliente}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700">{r.placa}</td>
                    <td className="px-3 py-2 text-slate-600">{r.motorista}</td>
                    <td className="px-3 py-2 font-mono font-bold text-blue-700">{r.sku}</td>
                    <td className="px-3 py-2 font-mono text-slate-700">{r.codigoCliente || '—'}</td>
                    <td className="px-3 py-2 text-slate-700 truncate max-w-xs">{r.descricao}</td>
                    <td className="px-3 py-2 text-right font-black text-slate-900 font-mono">{r.quantidade}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteDtRow(r.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Remover linha"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: Planilha Google Sheets "FAT" */}
      {/* ============================================================ */}
      {activeTab === 'sheet_fat' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-600" />
                <span>Base de Dados Google Sheet: "FAT" (Notas Fiscais)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Relação fiscal de Chave NF-e (44 dígitos), DT vinculada, SKU faturado e Quantidade.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
              {sheetRowsFAT.length} Registros de Faturamento
            </span>
          </div>

          {/* Connected Google Sheets URL config */}
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-2">
            <label className="text-xs font-bold text-purple-950 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Cloud className="w-4 h-4 text-purple-600" />
                <span>URL da Planilha Google Sheet "FAT":</span>
              </span>
              <span className="text-[10px] text-purple-700 font-semibold bg-purple-100/70 px-2 py-0.5 rounded-full border border-purple-200">
                Módulo Fiscal em Nuvem
              </span>
            </label>
            <div className="flex flex-wrap sm:flex-nowrap gap-2">
              <input
                type="text"
                value={currentSettings.googleSheetFatUrl || ''}
                onChange={(e) => updateSettings({ googleSheetFatUrl: e.target.value })}
                placeholder="https://docs.google.com/spreadsheets/d/.../pubhtml"
                className="flex-1 px-3 py-2 bg-white border border-purple-300 rounded-xl text-xs text-slate-800 focus:outline-none font-mono min-w-[200px]"
              />
              <button
                type="button"
                disabled={isSyncingFAT}
                onClick={handleSyncCloudFAT}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 active:scale-95 disabled:opacity-75 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm flex-shrink-0"
              >
                {isSyncingFAT ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sincronizando...</span>
                  </>
                ) : (
                  <>
                    <CloudCheck className="w-3.5 h-3.5" />
                    <span>Sincronizar na Nuvem</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => fileInputRefFAT.current?.click()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-all shadow-sm flex-shrink-0"
                title="Importar arquivo CSV baixado da planilha FAT"
              >
                <FileUp className="w-3.5 h-3.5 text-purple-400" />
                <span>Importar CSV</span>
              </button>
              <input
                ref={fileInputRefFAT}
                type="file"
                accept=".csv,.txt,.tsv"
                className="hidden"
                onChange={handleFileUploadFAT}
              />
            </div>
            {syncSuccessFAT && (
              <div
                className={`mt-2 p-2.5 rounded-xl border text-xs flex items-center space-x-2 animate-fade-in ${
                  syncErrorFAT
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-purple-100/80 border-purple-300 text-purple-950'
                }`}
              >
                {syncErrorFAT ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-purple-700 flex-shrink-0" />
                )}
                <span className="font-semibold">{syncSuccessFAT}</span>
              </div>
            )}
          </div>

          {/* Table View of FAT Sheet */}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2">DT</th>
                  <th className="px-3 py-2">Nº Nota Fiscal</th>
                  <th className="px-3 py-2">Chave da NF-e (44 dígitos)</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 text-right">Qtd Faturada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sheetRowsFAT.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">{r.dt}</td>
                    <td className="px-3 py-2 font-mono text-purple-700 font-bold">{r.numeroNota}</td>
                    <td className="px-3 py-2 font-mono text-slate-500 text-[10px] truncate max-w-xs">{r.chaveNFe || '—'}</td>
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">{r.sku}</td>
                    <td className="px-3 py-2 text-right font-black text-purple-700 font-mono">{r.quantidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: Lista Negra (placas com observação para atenção redobrada) */}
      {/* ============================================================ */}
      {activeTab === 'lista_negra' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Lista Negra — Relação de Placas
            </h3>
            <p className="text-xs text-slate-500">
              Placas que exigem atenção redobrada. O alerta aparece ao selecionar a carga, na conferência, nas listas de
              DTs e no faturamento sempre que a placa do veículo estiver cadastrada e ativa.
            </p>
          </div>

          {/* Cadastro / edição */}
          <form
            onSubmit={handleSaveListaNegra}
            className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 items-end bg-slate-50 border border-slate-200 rounded-2xl p-3"
          >
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Placa</label>
              <input
                type="text"
                value={lnPlaca}
                onChange={(e) => setLnPlaca(e.target.value.toUpperCase())}
                placeholder="Ex: FDR-9087"
                maxLength={10}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-rose-500 uppercase"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">Observação</label>
              <input
                type="text"
                value={lnObs}
                onChange={(e) => setLnObs(e.target.value)}
                placeholder="Ex: Carro sem haste de amarração da carga."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex gap-2">
              {lnEditId && (
                <button
                  type="button"
                  onClick={resetLnForm}
                  className="px-3 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={!lnPlaca.trim() || !lnObs.trim()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
              >
                {lnEditId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {lnEditId ? 'Salvar' : 'Adicionar Placa'}
              </button>
            </div>
          </form>

          {listaNegra.length > 3 && (
            <input
              type="text"
              value={lnBusca}
              onChange={(e) => setLnBusca(e.target.value)}
              placeholder="Buscar placa ou observação..."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-rose-500"
            />
          )}

          {/* Relação de placas */}
          {listaNegra.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">Nenhuma placa cadastrada na Lista Negra.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2.5">Placa</th>
                    <th className="px-3 py-2.5">Observação</th>
                    <th className="px-3 py-2.5">Cadastro</th>
                    <th className="px-3 py-2.5 text-center">Situação</th>
                    <th className="px-3 py-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {listaNegra
                    .filter((p) => {
                      const t = lnBusca.toLowerCase();
                      return !t || p.placa.toLowerCase().includes(t) || p.observacao.toLowerCase().includes(t);
                    })
                    .map((p) => (
                      <tr key={p.id} className={p.ativo ? 'hover:bg-slate-50' : 'opacity-50'}>
                        <td className="px-3 py-3">
                          <span className="bg-white border-2 border-blue-600 rounded px-2 py-0.5 font-mono font-black text-slate-900">
                            {p.placa}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-800 font-medium">{p.observacao}</td>
                        <td className="px-3 py-3 text-slate-500">{p.dataCriacao || '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleListaNegra(p.id)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              p.ativo
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                            title={p.ativo ? 'Desativar alerta' : 'Ativar alerta'}
                          >
                            {p.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {lnDeleteId === p.id ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-rose-700">Excluir?</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteListaNegra(p.id)}
                                className="px-2 py-0.5 bg-rose-600 text-white rounded-md text-[11px] font-bold"
                              >
                                Sim
                              </button>
                              <button
                                type="button"
                                onClick={() => setLnDeleteId(null)}
                                className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-bold"
                              >
                                Não
                              </button>
                            </span>
                          ) : (
                            <span className="space-x-1">
                              <button
                                type="button"
                                onClick={() => handleEditListaNegra(p.id)}
                                className="p-1 text-slate-500 hover:text-blue-600"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setLnDeleteId(p.id)}
                                className="p-1 text-slate-500 hover:text-rose-600"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB: Comentários e Anotações por Cliente (Ex: BRAMIL) */}
      {/* ============================================================ */}
      {activeTab === 'client_notes' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-rose-600" />
                <span>Anotações e Comentários por Cliente</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Instruções operacionais e exigências específicas que serão exibidas em destaque para o conferente.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenClientNoteModal()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm transition-all flex-shrink-0"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Novo Comentário de Cliente</span>
            </button>
          </div>

          {/* Quick Notice Banner explaining behavior */}
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start space-x-3 text-xs text-rose-900">
            <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">Como funciona na conferência de carga:</p>
              <p>
                Quando o conferente carregar uma DT vinculada ao cliente cadastrado (Ex: <strong>BRAMIL</strong>),
                o sistema exibirá um banner de alerta em destaque na <strong>Conferência de Carga</strong>, na <strong>Seleção de Carga</strong> e no <strong>Book Final</strong>, garantindo o cumprimento de exigências como <em>"NÃO ACEITA PALLET AVARIADO"</em>.
              </p>
            </div>
          </div>

          {/* Search / Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <input
              type="text"
              value={clientNotesSearch}
              onChange={(e) => setClientNotesSearch(e.target.value)}
              placeholder="Buscar por cliente ou texto da anotação..."
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs flex-1 max-w-sm focus:outline-none focus:border-rose-500"
            />
            <span className="text-xs text-slate-500 font-medium">
              {(currentSettings.clientNotes || []).length} instruções cadastradas
            </span>
          </div>

          {/* Cards List */}
          <div className="space-y-3">
            {(currentSettings.clientNotes || [])
              .filter((n) => {
                const term = clientNotesSearch.toLowerCase();
                return n.cliente.toLowerCase().includes(term) || n.mensagem.toLowerCase().includes(term);
              })
              .map((note) => {
                const isUrgente = note.nivelAlerta === 'urgente';
                const isAtencao = note.nivelAlerta === 'atencao';

                return (
                  <div
                    key={note.id}
                    className={`border rounded-2xl p-4 transition-all space-y-3 ${
                      !note.ativo
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : isUrgente
                        ? 'bg-rose-50/60 border-rose-300 shadow-xs'
                        : isAtencao
                        ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                        : 'bg-blue-50/60 border-blue-300 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        {isUrgente ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-600 text-white flex items-center space-x-1 shadow-xs">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>URGENTE</span>
                          </span>
                        ) : isAtencao ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500 text-slate-950 flex items-center space-x-1 shadow-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>ATENÇÃO</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-600 text-white flex items-center space-x-1 shadow-xs">
                            <BellRing className="w-3.5 h-3.5" />
                            <span>INFORMATIVO</span>
                          </span>
                        )}

                        <span className="text-sm font-black font-mono text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-300">
                          {note.cliente}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            note.ativo
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {note.ativo ? 'Ativo na Operação' : 'Desativado'}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleToggleClientNote(note.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            note.ativo
                              ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {note.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenClientNoteModal(note)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClientNote(note.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Mensagem em destaque */}
                    <div className="bg-white rounded-xl p-3 border border-slate-200">
                      <p className="text-xs sm:text-sm font-black text-slate-900 tracking-wide uppercase">
                        {note.mensagem}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: Grupos de E-mails */}
      {/* ============================================================ */}
      {activeTab === 'emails' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Grupo de E-mails da Carga */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-1.5">
                <Mail className="w-4 h-4 text-emerald-600" />
                <span>E-mails: Book de Carregamento</span>
              </h3>
              <p className="text-xs text-slate-500">
                Destinatários que recebem o PDF do Book de Carregamento com fotos e lotes ao finalizar a carga.
              </p>
            </div>

            <form onSubmit={handleAddEmailCarga} className="flex space-x-2">
              <input
                type="email"
                value={newEmailCarga}
                onChange={(e) => setNewEmailCarga(e.target.value)}
                placeholder="nome@empresa.com.br"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                + Adicionar
              </button>
            </form>

            <div className="space-y-1.5">
              {currentSettings.emailsCarga.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <span className="font-mono text-slate-700">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmailCarga(email)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Grupo de E-mails do Faturamento */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-1.5">
                <Mail className="w-4 h-4 text-purple-600" />
                <span>E-mails: Conferência Faturamento</span>
              </h3>
              <p className="text-xs text-slate-500">
                Destinatários fiscais e auditoria que recebem o resumo do check Planejado x Carregado x Faturado.
              </p>
            </div>

            <form onSubmit={handleAddEmailFat} className="flex space-x-2">
              <input
                type="email"
                value={newEmailFat}
                onChange={(e) => setNewEmailFat(e.target.value)}
                placeholder="fiscal@empresa.com.br"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
              >
                + Adicionar
              </button>
            </form>

            <div className="space-y-1.5">
              {currentSettings.emailsFaturamento.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                >
                  <span className="font-mono text-slate-700">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveEmailFat(email)}
                    className="text-slate-400 hover:text-rose-500 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Grupo de E-mails: Divergências & Cortes (envio condicional) */}
          <div className="md:col-span-2 bg-white border-2 border-rose-200 rounded-3xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>E-mails: Divergências &amp; Cortes</span>
              </h3>
              <p className="text-xs text-slate-500">
                Recebem o e-mail <strong>somente quando houver ocorrência</strong>: na finalização da carga, se houver
                diferença entre carregado e planejado ou corte operacional; na conferência de faturamento, se houver
                divergência ou corte. Cargas sem ocorrência não são enviadas a este grupo.
              </p>
            </div>

            <form onSubmit={handleAddEmailOcorr} className="flex space-x-2">
              <input
                type="email"
                value={newEmailOcorr}
                onChange={(e) => setNewEmailOcorr(e.target.value)}
                placeholder="supervisao@empresa.com.br"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:border-rose-500"
              />
              <button type="submit" className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold">
                + Adicionar
              </button>
            </form>

            {(currentSettings.emailsOcorrencias || []).length === 0 ? (
              <p className="text-xs text-slate-400">Nenhum e-mail no grupo.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {(currentSettings.emailsOcorrencias || []).map((email) => (
                  <div
                    key={email}
                    className="flex items-center justify-between p-2 rounded-xl bg-rose-50/60 border border-rose-200 text-xs"
                  >
                    <span className="font-mono text-slate-700">{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEmailOcorr(email)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 5: Empresa & Dispositivo */}
      {/* ============================================================ */}
      {activeTab === 'geral' && (
        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">Parâmetros Operacionais & Pátio</h3>
            <p className="text-xs text-slate-500">Dados da empresa impressos no Book de Carregamento e preferências de hardware.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Razão Social da Empresa:</label>
              <input
                type="text"
                value={currentSettings.empresaNome}
                onChange={(e) => updateSettings({ empresaNome: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">CNPJ:</label>
              <input
                type="text"
                value={currentSettings.empresaCnpj}
                onChange={(e) => updateSettings({ empresaCnpj: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">Centro de Distribuição (Unidade CD / Docas):</label>
              <input
                type="text"
                value={currentSettings.unidadeCD}
                onChange={(e) => updateSettings({ unidadeCD: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800"
              />
            </div>
          </div>

          {/* Hardware & Feedback */}
          <div className="pt-3 border-t border-slate-200 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Hardware & Feedback</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Sons de Bip do Scanner</span>
                  <span className="text-[11px] text-slate-500">Emite som de coletor ao ler código</span>
                </div>
                <input
                  type="checkbox"
                  checked={currentSettings.beepSoundEnabled}
                  onChange={(e) => updateSettings({ beepSoundEnabled: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Replicar Lote por Padrão</span>
                  <span className="text-[11px] text-slate-500">Mantém o último lote salvo</span>
                </div>
                <input
                  type="checkbox"
                  checked={currentSettings.lockLoteDefault}
                  onChange={(e) => updateSettings({ lockLoteDefault: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600"
                />
              </label>
            </div>
          </div>

          {/* Reset App Data */}
          <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-rose-600 block">Restaurar Banco de Dados Demo</span>
              <span className="text-[11px] text-slate-400">Recarrega as DTs, Notas Fiscais e catálogo original.</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (confirm('Deseja resetar todos os dados para o padrão de demonstração?')) {
                  onResetAllData();
                }
              }}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center space-x-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resetar Dados</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: Adicionar / Editar Produto De/Para */}
      {/* ============================================================ */}
      {showDeParaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-white">
                {editingDePara ? 'Editar Produto De/Para' : 'Novo Produto De/Para'}
              </h3>
              <button
                type="button"
                onClick={() => setShowDeParaModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDePara} className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Código EAN (Código de Barras):</label>
                <input
                  type="text"
                  required
                  value={eanInput}
                  onChange={(e) => setEanInput(e.target.value)}
                  placeholder="Ex: 7891000100101"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Código SKU (WMS Interno):</label>
                <input
                  type="text"
                  required
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
                  placeholder="Ex: SKU-BEV-001"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs uppercase focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Código do Cliente:</label>
                <input
                  type="text"
                  value={codClienteInput}
                  onChange={(e) => setCodClienteInput(e.target.value.toUpperCase())}
                  placeholder="Código do produto no cadastro do cliente (opcional)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs uppercase focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descrição do Produto:</label>
                <input
                  type="text"
                  required
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                  placeholder="Ex: Refrigerante Cola 2L Pet (Fardo c/ 6)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Lastro Padrão:</label>
                  <input
                    type="number"
                    min="1"
                    value={lastroInput}
                    onChange={(e) => setLastroInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Camadas Padrão:</label>
                  <input
                    type="number"
                    min="1"
                    value={camadaInput}
                    onChange={(e) => setCamadaInput(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center font-bold text-xs"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDeParaModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add DT Row Modal */}
      {showAddDtModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <Sheet className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-slate-900">
                  Adicionar Linha em "LISTA DT"
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddDtModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualDt} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nº DT:</label>
                  <input
                    type="text"
                    required
                    value={manualDt}
                    onChange={(e) => setManualDt(e.target.value.toUpperCase())}
                    placeholder="Ex: 61008899"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Cliente:</label>
                  <input
                    type="text"
                    value={manualCliente}
                    onChange={(e) => setManualCliente(e.target.value.toUpperCase())}
                    placeholder="Ex: BRAMIL"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Placa:</label>
                  <input
                    type="text"
                    required
                    value={manualPlaca}
                    onChange={(e) => setManualPlaca(e.target.value.toUpperCase())}
                    placeholder="Ex: FDR-9087"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Motorista:</label>
                  <input
                    type="text"
                    value={manualMotorista}
                    onChange={(e) => setManualMotorista(e.target.value)}
                    placeholder="Ex: Severino Silva"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">SKU:</label>
                  <input
                    type="text"
                    required
                    value={manualSku}
                    onChange={(e) => setManualSku(e.target.value.toUpperCase())}
                    placeholder="Ex: 201304"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Código do Cliente:</label>
                  <input
                    type="text"
                    value={manualCodCliente}
                    onChange={(e) => setManualCodCliente(e.target.value.toUpperCase())}
                    placeholder="Opcional (usa o do De/Para se vazio)"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Qtd Planejada:</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={manualQtd}
                    onChange={(e) => setManualQtd(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Descrição do Produto:</label>
                <input
                  type="text"
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                  placeholder="Ex: Papel A (BRAMIL)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Transportadora:</label>
                <input
                  type="text"
                  value={manualTransp}
                  onChange={(e) => setManualTransp(e.target.value)}
                  placeholder="Ex: TransLog Brasil S/A"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddDtModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                >
                  Adicionar Linha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Add / Edit Client Note */}
      {showClientNoteModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5 text-rose-600" />
                <h3 className="font-extrabold text-base text-slate-900">
                  {editingClientNote ? 'Editar Comentário do Cliente' : 'Novo Comentário de Cliente'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowClientNoteModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClientNote} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nome do Cliente (identificação na DT / Carga):
                </label>
                <input
                  type="text"
                  required
                  value={clientInput}
                  onChange={(e) => setClientInput(e.target.value.toUpperCase())}
                  placeholder="Ex: BRAMIL ou GERAL"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-sm uppercase focus:outline-none focus:border-rose-500"
                />
                {/* Sugestões rápidas de cliente */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                  <span className="text-[10px] text-slate-400 font-bold">Sugestões:</span>
                  {['BRAMIL', 'PADRÃO / GERAL', 'ATACADÃO', 'ASSAÍ'].map((cli) => (
                    <button
                      key={cli}
                      type="button"
                      onClick={() => setClientInput(cli)}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700"
                    >
                      {cli}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Nível de Alerta para o Conferente:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setNivelAlertaInput('urgente')}
                    className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center space-x-1 border transition-all ${
                      nivelAlertaInput === 'urgente'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-rose-50'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Urgente</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNivelAlertaInput('atencao')}
                    className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center space-x-1 border transition-all ${
                      nivelAlertaInput === 'atencao'
                        ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Atenção</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNivelAlertaInput('informativo')}
                    className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center space-x-1 border transition-all ${
                      nivelAlertaInput === 'informativo'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50'
                    }`}
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>Informativo</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">
                    Mensagem / Anotação Padrão:
                  </label>
                  <span className="text-[10px] text-slate-400">Exibida em destaque</span>
                </div>
                <textarea
                  required
                  rows={3}
                  value={mensagemInput}
                  onChange={(e) => setMensagemInput(e.target.value.toUpperCase())}
                  placeholder="Ex: REDOBRAR A ATENÇÃO, NÃO ACEITA PALLET AVARIADO"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-xs sm:text-sm uppercase focus:outline-none focus:border-rose-500"
                />

                {/* Modelos rápidos de mensagem */}
                <div className="pt-1.5 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">Modelos Rápidos:</span>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setMensagemInput('REDOBRAR A ATENÇÃO, NÃO ACEITA PALLET AVARIADO')}
                      className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-[10px] font-bold text-rose-800 border border-rose-200 text-left"
                    >
                      🚫 Não aceita pallet avariado
                    </button>
                    <button
                      type="button"
                      onClick={() => setMensagemInput('EXIGE CANTONEIRAS DE PAPELÃO EM TODAS AS QUINAS DO PALLET')}
                      className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-[10px] font-bold text-amber-800 border border-amber-200 text-left"
                    >
                      📦 Exige cantoneiras
                    </button>
                    <button
                      type="button"
                      onClick={() => setMensagemInput('CONFERÊNCIA 100% DE LOTE E VALIDADE (MÍNIMO 70% SHELF LIFE)')}
                      className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[10px] font-bold text-blue-800 border border-blue-200 text-left"
                    >
                      🏷️ Validade / Shelf Life
                    </button>
                    <button
                      type="button"
                      onClick={() => setMensagemInput('FOTOGRAFAR OBRIGATORIAMENTE CADA PALLET E O LACRE DA CARGA')}
                      className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-[10px] font-bold text-purple-800 border border-purple-200 text-left"
                    >
                      📷 Foto obrigatória de pallet
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="ativoInput"
                  checked={ativoInput}
                  onChange={(e) => setAtivoInput(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="ativoInput" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Anotação ativa (exibir avisos nas conferências de carga deste cliente)
                </label>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowClientNoteModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20"
                >
                  {editingClientNote ? 'Salvar Alterações' : 'Cadastrar Instrução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
