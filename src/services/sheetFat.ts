import { SheetRowFAT } from '../types';

// Converte a URL da planilha Google Sheets no endpoint de exportação CSV
export const getGoogleSheetCsvUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.includes('/pubhtml')) {
    return trimmed.replace('/pubhtml', '/pub?output=csv');
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1] && !trimmed.includes('output=csv') && !trimmed.includes('format=csv')) {
    return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv`;
  }
  return trimmed;
};

// Divide uma linha CSV respeitando campos entre aspas ("1.234,00" etc.)
export const splitCsvLine = (line: string, sep: string): string[] => {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let c = 0; c < line.length; c++) {
    const ch = line[c];
    if (ch === '"') {
      if (inQuotes && line[c + 1] === '"') {
        cur += '"';
        c++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
};

// Baixa o CSV de uma planilha publicada no Google Sheets. Lança erro com mensagem amigável.
export const fetchSheetCsv = async (url: string | undefined, nome: string): Promise<string> => {
  const inputUrl = url?.trim();
  if (!inputUrl || !inputUrl.startsWith('http') || inputUrl.includes('-DEMO')) {
    throw new Error(`Informe a URL da planilha ${nome} publicada no Google Sheets (Arquivo > Compartilhar > Publicar na Web).`);
  }

  let response: Response;
  try {
    response = await fetch(getGoogleSheetCsvUrl(inputUrl), {
      headers: { Accept: 'text/csv,text/plain;q=0.9' },
      cache: 'no-store',
    });
  } catch {
    throw new Error('Erro ao conectar no Google Sheets. Verifique a conexão ou se a planilha está publicada na Web.');
  }
  if (!response.ok) {
    throw new Error(`Planilha ${nome} indisponível (HTTP ${response.status}). Verifique se ela está publicada na Web.`);
  }
  const text = await response.text();
  if (/^\s*<!DOCTYPE html/i.test(text)) {
    throw new Error(`A planilha ${nome} não está publicada na Web (o Google pediu login). Publique-a e cole o link aqui.`);
  }
  return text;
};

// Converte o CSV da planilha "FAT" em linhas de faturamento
export const parseCsvToSheetFAT = (csvText: string): SheetRowFAT[] => {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const first = lines[0];
  const sep = first.includes(';') ? ';' : first.includes('\t') ? '\t' : ',';
  const splitLine = (line: string) => splitCsvLine(line, sep);

  const header = splitLine(first).map((c) => c.toLowerCase());

  const chaveIdx = header.findIndex((h) => h.includes('chave') || h.includes('nfe') || h.includes('nf-e'));
  let dtIdx = header.findIndex((h) => h === 'dt' || h.includes('dt') || h.includes('doc'));
  let skuIdx = header.findIndex((h) => h.includes('sku') || h.includes('item') || h.includes('código'));
  let qtdIdx = header.findIndex((h) => h.includes('qtd') || h.includes('quant') || h.includes('fatur'));
  const notaIdx = header.findIndex((h) => h.includes('nota') || h.includes('numero') || h.includes('número'));
  const dataIdx = header.findIndex((h) => h.includes('data') || h.includes('emiss'));
  const clienteIdx = header.findIndex((h) => h.includes('cliente'));

  const hasHeader = chaveIdx >= 0 || dtIdx >= 0 || skuIdx >= 0;
  const startRow = hasHeader ? 1 : 0;
  if (dtIdx < 0) dtIdx = 0;
  if (skuIdx < 0) skuIdx = 1;
  if (qtdIdx < 0) qtdIdx = 2;

  // dd/mm/aaaa -> aaaa-mm-dd
  const toIsoDate = (raw: string) => {
    const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : raw;
  };

  const parsedRows: SheetRowFAT[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length < 2) continue;

    const dt = cols[dtIdx] || '';
    const sku = cols[skuIdx] || '';
    if (!sku) continue;

    // Quantidade em formato BR: "1.234" / "1.234,5"
    const rawQtd = (cols[qtdIdx] || '0').replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
    const quantidade = Math.round(parseFloat(rawQtd)) || 0;
    // Planilhas sem coluna de chave: a conferência casa pelo número da nota
    const chaveNFe = chaveIdx >= 0 ? (cols[chaveIdx] || '').replace(/\D/g, '') : '';
    const numeroNota = notaIdx >= 0 ? cols[notaIdx] || '' : '';

    parsedRows.push({
      id: `csv-fat-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
      chaveNFe,
      dt: dt.toUpperCase(),
      sku: sku.toUpperCase(),
      quantidade,
      numeroNota,
      dataEmissao: dataIdx >= 0 && cols[dataIdx] ? toIsoDate(cols[dataIdx]) : '',
      cliente: clienteIdx >= 0 ? cols[clienteIdx] || undefined : undefined,
    });
  }

  return parsedRows;
};

// Baixa e converte a planilha "FAT" publicada. Lança erro com mensagem amigável.
export const fetchSheetFAT = async (url: string | undefined): Promise<SheetRowFAT[]> => {
  const parsed = parseCsvToSheetFAT(await fetchSheetCsv(url, 'FAT'));
  if (parsed.length === 0) {
    throw new Error('Nenhuma linha válida encontrada. Confira as colunas NOTA FISCAL, DT, SKU e QUANTIDADE.');
  }
  return parsed;
};
