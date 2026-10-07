// Armazenagem: mapa de endereços (rua + posição), estoque em pallets por SKU/lote e estado da separação de carga.
// Os dados ficam no localStorage do aparelho, como o restante do app.

export interface ItemEndereco {
  sku: string;
  lote: string;
  quantidade: number; // pallets
  descricao?: string;
  data?: string; // data de entrada no endereço (aaaa-mm-dd), base do FIFO na separação
}

// Estoque: código do endereço (ex.: "A01") -> itens armazenados
export type EstoqueArmazem = Record<string, ItemEndereco[]>;

// Separação: DT -> linhas separadas (chave "SKU|LOTE|ENDEREÇO") e data da baixa no estoque
export interface SeparacaoDt {
  separados: Record<string, boolean>;
  baixadoEm?: string;
  // Linhas efetivamente separadas no momento da baixa (a lista não é recalculada depois)
  linhasBaixadas?: {
    chave: string;
    sku: string;
    descricao: string;
    endereco: string;
    lote: string;
    data?: string;
    pallets: number;
    volumeDt?: number;
  }[];
}
export type SeparacoesArmazem = Record<string, SeparacaoDt>;

export const RUAS = ['CH', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
export const POSICOES_POR_RUA = 24;
export const CAPACIDADE_ENDERECO = 30; // pallets por endereço

export const codigoEndereco = (rua: string, pos: number) => `${rua}${String(pos).padStart(2, '0')}`;
export const enderecosDaRua = (rua: string) =>
  Array.from({ length: POSICOES_POR_RUA }, (_, i) => codigoEndereco(rua, i + 1));
export const ruaDoEndereco = (codigo: string) => codigo.replace(/\d+$/, '');

export const ocupacao = (itens: ItemEndereco[] = []) => itens.reduce((a, i) => a + i.quantidade, 0);

// ---------- Layout configurável (Configurações > Endereços) ----------
export interface EnderecoConfig {
  codigo: string;
  capacidade: number; // pallets
}
export interface RuaConfig {
  nome: string;
  enderecos: EnderecoConfig[];
}

// Layout inicial: ruas CH, A–I com 24 endereços de 30 pallets
export const layoutPadrao = (): RuaConfig[] =>
  RUAS.map((nome) => ({
    nome,
    enderecos: enderecosDaRua(nome).map((codigo) => ({ codigo, capacidade: CAPACIDADE_ENDERECO })),
  }));

export const todosEnderecos = (layout: RuaConfig[]) => layout.flatMap((r) => r.enderecos);
export const capacidadeDe = (layout: RuaConfig[], codigo: string) =>
  todosEnderecos(layout).find((e) => e.codigo === codigo)?.capacidade ?? CAPACIDADE_ENDERECO;

const KEY_ESTOQUE = 'cargacheck_armazem';
const KEY_SEPARACAO = 'cargacheck_separacao';
const KEY_LAYOUT = 'cargacheck_armazem_layout';

const ler = <T>(key: string, padrao: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : padrao;
  } catch {
    return padrao;
  }
};
const gravar = (key: string, valor: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
};

export const armazemStorage = {
  getEstoque: () => ler<EstoqueArmazem>(KEY_ESTOQUE, {}),
  saveEstoque: (e: EstoqueArmazem) => gravar(KEY_ESTOQUE, e),
  getSeparacoes: () => ler<SeparacoesArmazem>(KEY_SEPARACAO, {}),
  saveSeparacoes: (s: SeparacoesArmazem) => gravar(KEY_SEPARACAO, s),
  getLayout: () => {
    const l = ler<RuaConfig[] | null>(KEY_LAYOUT, null);
    return l && l.length ? l : layoutPadrao();
  },
  saveLayout: (l: RuaConfig[]) => gravar(KEY_LAYOUT, l),
};

// dd/mm/aaaa para exibição
export const formatarData = (iso?: string) => (iso ? iso.split('-').reverse().join('/') : 'Sem data');

// Endereços que têm o SKU, da data de entrada mais antiga para a mais nova (FIFO).
// Itens sem data (cadastrados antes da data existir) são tratados como os mais antigos.
export const localizarSku = (estoque: EstoqueArmazem, sku: string) =>
  Object.entries(estoque)
    .flatMap(([endereco, itens]) =>
      itens.filter((i) => i.sku.toUpperCase() === sku.toUpperCase()).map((i) => ({ endereco, ...i }))
    )
    .sort(
      (a, b) =>
        (a.data || '').localeCompare(b.data || '') || a.lote.localeCompare(b.lote) || a.endereco.localeCompare(b.endereco)
    );
