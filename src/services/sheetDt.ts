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

// Número no formato BR: "1.234" (milhar) / "1.234,5" / "15,025"; vazio ou "-" = não informado
const parseNum = (txt: string | undefined): number | undefined => {
  let raw = (txt || '').replace(/[^\d,.-]/g, '');
  if (!raw || raw === '-') return undefined;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)) raw = raw.replace(/\./g, '');
  const n = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

// Título da coluna sem acento, em minúsculas e com espaços simples ("Data para Expedição" -> "data para expedicao")
const normalizaTitulo = (c: string) =>
  c
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ');

// Converte o CSV da planilha "LISTA DT" em linhas planejadas.
// Aceita o modelo antigo (DT, PLACA, SKU, QUANTIDADE, TIPO, LASTRO, CAMADA, QUANTIDADE PALLET, QUEBRA FARDOS, DATA)
// e o novo (CODIGO DO CLIENTE, CLIENTE, OV, SKU, DESCRICAO, QTDE REMESSA, QTDE PALETES, Tipo de Carga,
// Categoria, REMESSA, DT TRANSPORTE, Data para Expedicao).
export const parseCsvToSheetDT = (csvText: string, deParaList: ProductDePara[] = []): SheetRowDT[] => {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const first = lines[0];
  const sep = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
  const header = splitCsvLine(first, sep).map(normalizaTitulo);

  // Cada campo pega a primeira coluna que atende ao teste e ainda não foi usada por outro campo
  const usados = new Set<number>();
  const col = (...tests: ((h: string) => boolean)[]) => {
    for (const test of tests) {
      const i = header.findIndex((h, k) => !usados.has(k) && test(h));
      if (i >= 0) {
        usados.add(i);
        return i;
      }
    }
    return -1;
  };

  const codCliIdx = col((h) => h.includes('cod') && h.includes('client'));
  let dtIdx = col(
    (h) => h === 'dt' || h.startsWith('dt '),
    (h) => h.includes('transporte') && !h.includes('transportad'),
    (h) => h.includes('doc')
  );
  let skuIdx = col(
    (h) => h.includes('sku'),
    (h) => h.includes('item'),
    (h) => h.includes('cod')
  );
  const palletIdx = col((h) => h.includes('pallet') || h.includes('palete'));
  let qtdIdx = col(
    (h) => h.includes('remessa') && (h.includes('qtd') || h.includes('quant')),
    (h) => h === 'quantidade' || h === 'qtd' || h === 'qtde',
    (h) => h.includes('qtd') || h.includes('quant') || h.includes('volume') || h.includes('planej')
  );
  const remessaIdx = col((h) => h.includes('remessa'));
  const ovIdx = col((h) => h === 'ov' || h.startsWith('ov ') || h.includes('ordem de venda') || h === 'pedido');
  const categoriaIdx = col((h) => h.includes('categoria'));
  const tipoIdx = col((h) => h === 'tipo' || h.startsWith('tipo '));
  const dataIdx = col((h) => h.startsWith('data') || h.includes('agend') || h.includes('expedi') || h.includes('entrega'));
  let placaIdx = col((h) => h.includes('placa') || h.includes('veic') || h.includes('carro'));
  const motIdx = col((h) => h.includes('motor') || h.includes('condutor'));
  const transpIdx = col((h) => h.includes('transportad') || h.includes('empresa'));
  const descIdx = col((h) => h.includes('desc'), (h) => h.includes('prod') || h.includes('nome'));
  const cliIdx = col((h) => h.includes('client') || h.includes('destinat') || h.includes('loja'));
  const lastroIdx = col((h) => h.includes('lastro'));
  const camadaIdx = col((h) => h.includes('camada'));
  const quebraIdx = col((h) => h.includes('quebra'));

  const hasHeader = dtIdx >= 0 || skuIdx >= 0 || qtdIdx >= 0;
  const startRow = hasHeader ? 1 : 0;
  // Sem cabeçalho: ordem fixa DT, PLACA, SKU, QUANTIDADE
  if (!hasHeader) {
    dtIdx = 0;
    placaIdx = 1;
    skuIdx = 2;
    qtdIdx = 3;
  }

  const hoje = localIsoDate();
  const parsedRows: SheetRowDT[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], sep);
    if (cols.length < 2) continue;

    const texto = (k: number) => (k >= 0 && cols[k] ? cols[k] : undefined);
    const num = (k: number) => (k >= 0 ? parseNum(cols[k]) : undefined);

    const sku = texto(skuIdx) || '';
    if (!sku) continue;
    const dt = texto(dtIdx) || `DT-${i}`;

    const quantidade = Math.round(num(qtdIdx) || 0);
    // Modelo novo não traz placa/motorista/transportadora: ficam em branco (a placa é informada na conferência)
    const placa = texto(placaIdx) || '';
    const motorista = texto(motIdx) || '';
    const transportadora = texto(transpIdx) || '';
    const descricao = texto(descIdx) || `Produto ${sku}`;
    const cliente = texto(cliIdx);
    // Código do Cliente: coluna da planilha ou, na falta dela, o cadastrado no De/Para para o SKU
    const codigoCliente =
      texto(codCliIdx) || deParaList.find((p) => p.sku.toUpperCase() === sku.toUpperCase())?.codigoCliente || undefined;
    // Tipo normalizado: "PALETIZADO" -> "Paletizado"
    const tipoRaw = (texto(tipoIdx) || '').trim();
    const tipoCarga = tipoRaw ? tipoRaw.charAt(0).toUpperCase() + tipoRaw.slice(1).toLowerCase() : undefined;
    const dataRaw = texto(dataIdx);
    const dataAgendamento = dataRaw ? toIsoDate(dataRaw) || undefined : undefined;

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
      lastro: num(lastroIdx),
      camada: num(camadaIdx),
      qtdPallet: num(palletIdx),
      quebraFardos: num(quebraIdx),
      ov: texto(ovIdx),
      remessa: texto(remessaIdx),
      categoria: texto(categoriaIdx),
    });
  }

  return parsedRows;
};

// Baixa e converte a planilha "LISTA DT" publicada. Lança erro com mensagem amigável.
export const fetchSheetDT = async (url: string | undefined, deParaList: ProductDePara[] = []): Promise<SheetRowDT[]> => {
  const parsed = parseCsvToSheetDT(await fetchSheetCsv(url, 'LISTA DT'), deParaList);
  if (parsed.length === 0) {
    throw new Error('Nenhuma linha válida encontrada. Confira as colunas DT TRANSPORTE, SKU e QTDE REMESSA.');
  }
  return parsed;
};
