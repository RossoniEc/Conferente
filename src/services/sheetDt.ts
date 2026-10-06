import { ProductDePara, SheetRowDT } from '../types';
import { fetchSheetCsv, splitCsvLine } from './sheetFat';

// Data local (aaaa-mm-dd) — toISOString usaria UTC e viraria o dia à noite
export const localIsoDate = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// dd/mm/aaaa (ou aaaa-mm-dd) -> aaaa-mm-dd; vazio quando não reconhece
const toIsoDate = (raw: string): string => {
  const br = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const ano = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${ano}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`;
  }
  const iso = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : '';
};

// Converte o CSV da planilha "LISTA DT" em linhas planejadas
export const parseCsvToSheetDT = (csvText: string, deParaList: ProductDePara[] = []): SheetRowDT[] => {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const first = lines[0];
  const sep = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
  const header = splitCsvLine(first, sep).map((c) => c.trim().toLowerCase().replace(/["']/g, ''));

  // "Código do Cliente" vem primeiro para não ser confundido com a coluna de SKU (código) nem de cliente
  const codCliIdx = header.findIndex((h) => (h.includes('cod') || h.includes('códig')) && h.includes('client'));
  const idx = (test: (h: string) => boolean) => header.findIndex((h, i) => i !== codCliIdx && test(h));

  let dtIdx = idx((h) => h.includes('dt') || h.includes('doc') || h.includes('transporte'));
  let skuIdx = idx((h) => h.includes('sku') || h.includes('item') || h.includes('código') || h.includes('cod'));
  let qtdIdx = header.findIndex((h) => h.includes('qtd') || h.includes('quant') || h.includes('volume') || h.includes('planej'));
  let placaIdx = header.findIndex((h) => h.includes('placa') || h.includes('veic') || h.includes('carro'));
  const motIdx = header.findIndex((h) => h.includes('motor') || h.includes('condutor'));
  const transpIdx = header.findIndex((h) => h.includes('transp') || h.includes('empresa'));
  const descIdx = header.findIndex((h) => h.includes('desc') || h.includes('prod') || h.includes('nome'));
  const cliIdx = idx((h) => h.includes('client') || h.includes('destinat') || h.includes('loja'));
  const tipoIdx = header.findIndex((h) => h === 'tipo' || h.startsWith('tipo ') || h.includes('tipo de carga') || h.includes('tipo carga'));
  const dataIdx = header.findIndex((h) => h.startsWith('data') || h.includes('agend') || h.includes('entrega'));

  const hasHeader = dtIdx >= 0 || skuIdx >= 0 || qtdIdx >= 0;
  const startRow = hasHeader ? 1 : 0;
  if (dtIdx < 0) dtIdx = 0;
  if (placaIdx < 0) placaIdx = 1;
  if (skuIdx < 0) skuIdx = 2;
  if (qtdIdx < 0) qtdIdx = 3;

  const hoje = localIsoDate();
  const parsedRows: SheetRowDT[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], sep);
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
      deParaList.find((p) => p.sku.toUpperCase() === sku.toUpperCase())?.codigoCliente ||
      undefined;
    // Tipo normalizado: "PALETIZADO" -> "Paletizado"
    const tipoRaw = tipoIdx >= 0 ? (cols[tipoIdx] || '').trim() : '';
    const tipoCarga = tipoRaw ? tipoRaw.charAt(0).toUpperCase() + tipoRaw.slice(1).toLowerCase() : undefined;
    const dataAgendamento = dataIdx >= 0 && cols[dataIdx] ? toIsoDate(cols[dataIdx]) || undefined : undefined;

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
      dataCriacao: hoje,
      dataAgendamento,
      tipoCarga,
    });
  }

  return parsedRows;
};

// Baixa e converte a planilha "LISTA DT" publicada. Lança erro com mensagem amigável.
export const fetchSheetDT = async (url: string | undefined, deParaList: ProductDePara[] = []): Promise<SheetRowDT[]> => {
  const parsed = parseCsvToSheetDT(await fetchSheetCsv(url, 'LISTA DT'), deParaList);
  if (parsed.length === 0) {
    throw new Error('Nenhuma linha válida encontrada. Confira as colunas DT, PLACA, SKU e QUANTIDADE.');
  }
  return parsed;
};
