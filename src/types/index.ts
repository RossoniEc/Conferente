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
  pesoUnitarioKg?: number;
}

export interface PlannedItem {
  sku: string;
  codigoCliente?: string;
  descricao: string;
  quantidadePlanejada: number;
  ean?: string;
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
] as const;

export type MotivoCorte = (typeof MOTIVOS_CORTE)[number];

export interface CorteOperacional {
  quantidade: number;
  motivo: MotivoCorte;
  timestamp: string;
}

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
  doca?: string;
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
  fotoVeiculoFim?: string;
  numeroLacre?: string;
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
  | 'select_load'
  | 'load_list'
  | 'load_inspection'
  | 'billing_inspection'
  | 'history'
  | 'settings';
