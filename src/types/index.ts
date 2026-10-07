export interface UserSession {
  id: string;
  name: string;
  matricula: string;
  role: 'conferente' | 'supervisor' | 'expedicao';
  avatar?: string;
  turno?: string;
}

export interface ProductDePara {
  id: string;
  ean: string;
  sku: string;
  codigoCliente?: string; // código do produto no cadastro do cliente
  descricao: string;
  unidade: string;
  embalagem: string;
  lastroPadrao?: number;
  camadaPadrao?: number;
  plPadraoLinha?: number; // volumes por pallet padrão de linha: base da qtde de pallets na Separação (Picking)
  pesoUnitarioKg?: number;
}

export interface PlannedItem {
  sku: string;
  codigoCliente?: string;
  descricao: string;
  quantidadePlanejada: number;
  ean?: string;
  tipoCarga?: string; // coluna TIPO da planilha (Batido, Paletizado, Fracionado)
  lastro?: number; // caixas por camada
  camada?: number; // camadas por pallet
  qtdPallet?: number; // quantidade de pallets
  quebraFardos?: number; // fardos avulsos (fora dos pallets fechados)
  unidade?: string;
  cliente?: string;
  doca?: string;
  destino?: string;
  pedido?: string;
  lote?: string;
  peso?: number;
  observacao?: string;
  colunasExtras?: Record<string, string>;
}

export interface CheckedItem {
  id: string;
  sku: string;
  ean: string;
  descricao: string;
  lote: string; // lote único, ou os lotes unidos por " / " quando houver vários
  lotes?: LoteQuantidade[]; // distribuição por lote (apenas quando há mais de um lote)
  quantidadeCarregada: number;
  lastro?: number;
  camada?: number;
  pallets?: number;
  fotos: string[]; // base64 or object URL
  timestamp: string;
  acumuladorHistorico: number[];
  observacao?: string;
  corteOperacional?: CorteOperacional;
}

export interface LoteQuantidade {
  lote: string;
  quantidade: number;
}

export const MOTIVOS_CORTE = [
  'Cubagem',
  'Sem Saldo Fiscal',
  'Sem Saldo Físico',
  'Não Localizado',
  'Bloqueio Qualidade',
  'Outros',
] as const;

export type MotivoCorte = (typeof MOTIVOS_CORTE)[number];

export interface CorteOperacional {
  quantidade: number;
  motivo: MotivoCorte;
  observacao?: string; // descrição obrigatória quando o motivo é "Outros"
  timestamp: string;
}

// Texto do motivo para telas, Excel e PDF ("Outros: descrição")
export const descreverMotivoCorte = (c: { motivo: string; observacao?: string }) =>
  c.motivo === 'Outros' && c.observacao ? `Outros: ${c.observacao}` : c.motivo;

export type InspectionStatus = 
  | 'planejado' 
  | 'em_conferencia' 
  | 'concluido' 
  | 'faturado_divergente' 
  | 'faturado_conferido';

export interface CargoInspection {
  id: string; // INSP-XXXX
  dt: string;
  placa: string;
  motorista?: string;
  transportadora?: string;
  cliente?: string;
  doca?: string; // doca de carregamento (Doca 01 a Doca 15), obrigatória ao iniciar
  destino?: string;
  pedido?: string;
  tipoVeiculo?: string;
  pesoTotal?: number;
  status: InspectionStatus;
  dataInicio: string;
  dataFim?: string;
  conferente: string;
  matriculaConferente?: string;
  fotoVeiculoInicio?: string;
  fotoVeiculoFim?: string; // foto final da carga (traseira / baú carregado)
  fotoLacre?: string; // foto do lacre instalado
  retornoPallet?: RetornoPallet; // a carga retornou com pallets? (obrigatório antes de conferir)
  numeroLacre?: string;
  // Assinaturas coletadas na finalização (PNG em base64), impressas no Book PDF
  assinaturaConferente?: string;
  assinaturaMotorista?: string;
  itensPlanejados: PlannedItem[];
  itensConferidos: CheckedItem[];
  fotosGerais: string[];
  observacoes?: string;
  emailStatus?: {
    enviado: boolean;
    destinatarios: string[];
    dataEnvio: string;
    assunto?: string;
  };
  faturamento?: {
    chaveNFe?: string;
    dataConferencia?: string;
    conferenteFat?: string;
    status: 'pendente' | 'conferido_ok' | 'divergencia';
    itensFaturados: { sku: string; quantidadeFaturada: number }[];
    divergencias: {
      sku: string;
      descricao: string;
      planejado: number;
      carregado: number;
      faturado: number;
      diferencaFaturamento: number; // carregado - faturado
    }[];
    emailEnviado?: boolean;
    dataEnvioEmail?: string;
  };
}

export interface SheetRowDT {
  id: string;
  dt: string;
  placa: string;
  motorista: string;
  transportadora: string;
  sku: string;
  codigoCliente?: string; // código do produto no cadastro do cliente
  descricao: string;
  quantidade: number;
  dataCriacao: string;
  dataAgendamento?: string; // coluna DATA / Data para Expedicao da planilha (aaaa-mm-dd)
  ov?: string; // ordem de venda (coluna OV)
  remessa?: string; // número da remessa (coluna REMESSA)
  categoria?: string; // coluna Categoria
  tipoCarga?: string; // coluna TIPO da planilha (Batido, Paletizado, Fracionado)
  lastro?: number; // caixas por camada
  camada?: number; // camadas por pallet
  qtdPallet?: number; // quantidade de pallets
  quebraFardos?: number; // fardos avulsos (fora dos pallets fechados)
  cliente?: string;
  doca?: string;
  destino?: string;
  cidade?: string;
  uf?: string;
  lote?: string;
  pedido?: string;
  peso?: number;
  tipoVeiculo?: string;
  unidade?: string;
  observacao?: string;
  colunasExtras?: Record<string, string>;
}

export interface SheetRowFAT {
  id: string;
  chaveNFe: string;
  dt: string;
  sku: string;
  quantidade: number;
  numeroNota: string;
  dataEmissao: string;
  cliente?: string;
}

export interface ClientNote {
  id: string;
  cliente: string;
  codigoCliente?: string; // código do cliente (coluna CODIGO DO CLIENTE da LISTA DT)
  mensagem: string;
  nivelAlerta?: 'urgente' | 'atencao' | 'informativo';
  ativo: boolean;
  dataCriacao?: string;
}

// Lista Negra: placas que exigem atenção redobrada do conferente
export interface PlacaListaNegra {
  id: string;
  placa: string;
  observacao: string;
  ativo: boolean;
  dataCriacao?: string;
}

export interface AppSettings {
  deParaList: ProductDePara[];
  clientNotes: ClientNote[];
  listaNegra?: PlacaListaNegra[];
  emailsCarga: string[];
  emailsFaturamento: string[];
  // Recebem o e-mail só quando há divergência (carga ou faturamento) ou corte operacional
  emailsOcorrencias?: string[];
  googleSheetListaDTUrl?: string;
  googleSheetFatUrl?: string;
  beepSoundEnabled: boolean;
  vibrationEnabled: boolean;
  lockLoteDefault: boolean;
  empresaNome: string;
  empresaCnpj: string;
  unidadeCD: string;
}

export type ActiveTab = 
  | 'home'
  | 'storage'
  | 'picking'
  | 'select_load'
  | 'load_list'
  | 'load_inspection'
  | 'billing_inspection'
  | 'history'
  | 'settings';

// Anotação do cliente identificada pelo código do cliente presente nos itens da carga
export const notaPorCodigoCliente = (
  n: { codigoCliente?: string },
  itens: { codigoCliente?: string }[]
) => {
  const cod = (n.codigoCliente || '').trim().toUpperCase();
  return !!cod && itens.some((p) => (p.codigoCliente || '').trim().toUpperCase() === cod);
};

// Retorno de pallets na chegada do veículo
export interface RetornoPallet {
  possui: boolean; // Sim / Não
  quantidade?: number; // volume de pallets retornados
  fotoPallets?: string;
  fotoControle?: string; // foto do Controle de Recebimento
  situacao?: 'ok' | 'avariados' | 'faltando';
  quantidadeFaltando?: number;
  quantidadeAvariados?: number;
}

export const SITUACAO_RETORNO_PALLET: Record<NonNullable<RetornoPallet['situacao']>, string> = {
  ok: 'Todos OK',
  avariados: 'Avariados',
  faltando: 'Faltando',
};

// Pendências do retorno de pallets (vazio = completo)
export const pendenciasRetornoPallet = (r?: RetornoPallet): string[] => {
  if (!r) return ['responda se a carga retornou com pallet'];
  if (!r.possui) return [];
  const p: string[] = [];
  if (!r.quantidade || r.quantidade <= 0) p.push('informe a quantidade de pallets retornados');
  if (!r.fotoPallets) p.push('tire a foto dos pallets');
  if (!r.fotoControle) p.push('tire a foto do Controle de Recebimento');
  if (!r.situacao) p.push('informe a situação dos pallets');
  if (r.situacao === 'faltando' && (!r.quantidadeFaltando || r.quantidadeFaltando <= 0)) p.push('informe quantos pallets estão faltando');
  if (r.situacao === 'avariados' && (!r.quantidadeAvariados || r.quantidadeAvariados <= 0)) p.push('informe quantos pallets estão avariados');
  return p;
};

// Resumo em texto (Book / PDF)
export const resumoRetornoPallet = (r?: RetornoPallet): string => {
  if (!r) return 'Não informado';
  if (!r.possui) return 'Não';
  const sit = r.situacao ? SITUACAO_RETORNO_PALLET[r.situacao] : 'situação não informada';
  return `Sim • ${r.quantidade || 0} pallet(s) • ${sit}${r.situacao === 'faltando' ? ` (${r.quantidadeFaltando || 0} faltando)` : r.situacao === 'avariados' ? ` (${r.quantidadeAvariados || 0} avariado(s))` : ''}`;
};
