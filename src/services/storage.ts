import { 
  AppSettings, 
  CargoInspection, 
  ProductDePara, 
  SheetRowDT, 
  SheetRowFAT, 
  UserSession,
  ClientNote,
  PlacaListaNegra
} from '../types';

const STORAGE_KEYS = {
  SETTINGS: 'cargacheck_settings',
  INSPECTIONS: 'cargacheck_inspections',
  SHEET_DT: 'cargacheck_sheet_dt',
  SHEET_FAT: 'cargacheck_sheet_fat',
  USER_SESSION: 'cargacheck_user_session',
  ACTIVE_INSPECTION_ID: 'cargacheck_active_id',
};

export const INITIAL_CLIENT_NOTES: ClientNote[] = [
  {
    id: 'cn-bramil-1',
    cliente: 'BRAMIL',
    mensagem: 'REDOBRAR A ATENÇÃO, NÃO ACEITA PALLET AVARIADO',
    nivelAlerta: 'urgente',
    ativo: true,
    dataCriacao: '2026-09-27',
  },
  {
    id: 'cn-geral-2',
    cliente: 'PADRÃO / GERAL',
    mensagem: 'Conferir integridade do filme stretch, cantoneiras e alinhamento dos fardos antes do fechamento.',
    nivelAlerta: 'informativo',
    ativo: true,
    dataCriacao: '2026-09-27',
  },
];

export const INITIAL_DE_PARA: ProductDePara[] = [
  {
    id: 'dp-bramil-1',
    ean: '7891201304012',
    sku: '201304',
    descricao: 'Papel A (BRAMIL)',
    unidade: 'FD',
    embalagem: 'Fardo Padrão',
    lastroPadrao: 20,
    camadaPadrao: 10,
    pesoUnitarioKg: 10.0,
  },
  {
    id: 'dp-bramil-2',
    ean: '7891201614029',
    sku: '201614',
    descricao: 'Papel B (BRAMIL)',
    unidade: 'FD',
    embalagem: 'Fardo Padrão',
    lastroPadrao: 23,
    camadaPadrao: 15,
    pesoUnitarioKg: 12.0,
  },
  {
    id: 'dp-bramil-3',
    ean: '7891202100035',
    sku: '202100',
    descricao: 'Toalha A (BRAMIL)',
    unidade: 'FD',
    embalagem: 'Fardo Toalha',
    lastroPadrao: 30,
    camadaPadrao: 20,
    pesoUnitarioKg: 8.5,
  },
  {
    id: 'dp-1',
    ean: '7891000100101',
    sku: 'SKU-BEV-001',
    descricao: 'Refrigerante Cola 2L Pet (Fardo c/ 6 un)',
    unidade: 'CX',
    embalagem: 'Fardo c/ 6',
    lastroPadrao: 12,
    camadaPadrao: 5,
    pesoUnitarioKg: 12.6,
  },
  {
    id: 'dp-2',
    ean: '7891000200202',
    sku: 'SKU-ALI-042',
    descricao: 'Biscoito Recheado Chocolate 140g (Cx c/ 30 un)',
    unidade: 'CX',
    embalagem: 'Caixa c/ 30',
    lastroPadrao: 15,
    camadaPadrao: 6,
    pesoUnitarioKg: 4.8,
  },
  {
    id: 'dp-3',
    ean: '7891000300303',
    sku: 'SKU-LIM-108',
    descricao: 'Detergente Líquido Neutro 500ml (Cx c/ 24 un)',
    unidade: 'CX',
    embalagem: 'Caixa c/ 24',
    lastroPadrao: 16,
    camadaPadrao: 4,
    pesoUnitarioKg: 13.0,
  },
  {
    id: 'dp-4',
    ean: '7891000400404',
    sku: 'SKU-HIG-205',
    descricao: 'Papel Higiênico Folha Dupla 30m (Fardo c/ 16 pct)',
    unidade: 'FD',
    embalagem: 'Fardo c/ 16',
    lastroPadrao: 8,
    camadaPadrao: 5,
    pesoUnitarioKg: 3.2,
  },
  {
    id: 'dp-5',
    ean: '7891000500505',
    sku: 'SKU-GRA-330',
    descricao: 'Arroz Tipo 1 Polido 5kg (Fardo c/ 6 pacotes)',
    unidade: 'FD',
    embalagem: 'Fardo 30kg',
    lastroPadrao: 10,
    camadaPadrao: 4,
    pesoUnitarioKg: 30.2,
  },
  {
    id: 'dp-6',
    ean: '7891000600606',
    sku: 'SKU-OLE-701',
    descricao: 'Óleo de Soja Refinado 900ml (Cx c/ 20 garrafas)',
    unidade: 'CX',
    embalagem: 'Caixa c/ 20',
    lastroPadrao: 14,
    camadaPadrao: 5,
    pesoUnitarioKg: 18.5,
  },
];

export const INITIAL_SHEET_DT: SheetRowDT[] = [
  // DT 61008899 (Google Sheet BRAMIL)
  {
    id: 'dt-bramil-1',
    dt: '61008899',
    placa: 'FDR-9087',
    motorista: 'Severino Silva',
    transportadora: 'TransLog Brasil S/A',
    doca: 'Doca 04',
    destino: 'BRAMIL Petrópolis - RJ',
    cidade: 'Petrópolis',
    uf: 'RJ',
    pedido: 'PED-61008-A',
    tipoVeiculo: 'Carreta Sider (3 Eixos)',
    peso: 2000,
    unidade: 'FD',
    sku: '201304',
    descricao: 'Papel A',
    quantidade: 200,
    cliente: 'BRAMIL',
    dataCriacao: '2026-09-27',
    observacao: 'Paletizado padrão PBR - Não aceita avarias',
  },
  {
    id: 'dt-bramil-2',
    dt: '61008899',
    placa: 'FDR-9087',
    motorista: 'Severino Silva',
    transportadora: 'TransLog Brasil S/A',
    doca: 'Doca 04',
    destino: 'BRAMIL Petrópolis - RJ',
    cidade: 'Petrópolis',
    uf: 'RJ',
    pedido: 'PED-61008-B',
    tipoVeiculo: 'Carreta Sider (3 Eixos)',
    peso: 4140,
    unidade: 'FD',
    sku: '201614',
    descricao: 'Papel B',
    quantidade: 345,
    cliente: 'BRAMIL',
    dataCriacao: '2026-09-27',
    observacao: 'Paletizado padrão PBR - Não aceita avarias',
  },
  {
    id: 'dt-bramil-3',
    dt: '61008899',
    placa: 'FDR-9087',
    motorista: 'Severino Silva',
    transportadora: 'TransLog Brasil S/A',
    doca: 'Doca 04',
    destino: 'BRAMIL Petrópolis - RJ',
    cidade: 'Petrópolis',
    uf: 'RJ',
    pedido: 'PED-61008-C',
    tipoVeiculo: 'Carreta Sider (3 Eixos)',
    peso: 5100,
    unidade: 'FD',
    sku: '202100',
    descricao: 'Toalha A',
    quantidade: 600,
    cliente: 'BRAMIL',
    dataCriacao: '2026-09-27',
    observacao: 'Paletizado padrão PBR - Não aceita avarias',
  },
  {
    id: 'dt-row-1',
    dt: 'DT-10492',
    placa: 'BRA-2E19',
    motorista: 'Severino Silva',
    transportadora: 'TransLog Brasil S/A',
    doca: 'Doca 07',
    destino: 'CD Campinas - SP',
    cidade: 'Campinas',
    uf: 'SP',
    pedido: 'PED-10492-01',
    tipoVeiculo: 'Truck Baú 14m',
    peso: 756,
    unidade: 'CX',
    sku: 'SKU-BEV-001',
    descricao: 'Refrigerante Cola 2L Pet (Fardo c/ 6 un)',
    quantidade: 60,
    cliente: 'SUPERMERCADOS ABC',
    dataCriacao: '2026-09-27',
  },
  {
    id: 'dt-row-2',
    dt: 'DT-10492',
    placa: 'BRA-2E19',
    motorista: 'Severino Silva',
    transportadora: 'TransLog Brasil S/A',
    doca: 'Doca 07',
    destino: 'CD Campinas - SP',
    cidade: 'Campinas',
    uf: 'SP',
    pedido: 'PED-10492-02',
    tipoVeiculo: 'Truck Baú 14m',
    peso: 432,
    unidade: 'CX',
    sku: 'SKU-ALI-042',
    descricao: 'Biscoito Recheado Chocolate 140g (Cx c/ 30 un)',
    quantidade: 90,
    cliente: 'SUPERMERCADOS ABC',
    dataCriacao: '2026-09-27',
  },
  {
    id: 'dt-row-3',
    dt: 'DT-10492',
    placa: 'BRA-2E19',
    motorista: 'Severino Silva',
    transportadora: 'TransLog Brasil S/A',
    doca: 'Doca 07',
    destino: 'CD Campinas - SP',
    cidade: 'Campinas',
    uf: 'SP',
    pedido: 'PED-10492-03',
    tipoVeiculo: 'Truck Baú 14m',
    peso: 832,
    unidade: 'CX',
    sku: 'SKU-LIM-108',
    descricao: 'Detergente Líquido Neutro 500ml (Cx c/ 24 un)',
    quantidade: 64,
    cliente: 'SUPERMERCADOS ABC',
    dataCriacao: '2026-09-27',
  },
  // DT-20831
  {
    id: 'dt-row-4',
    dt: 'DT-20831',
    placa: 'RTO-9E33',
    motorista: 'Carlos Alberto Ramos',
    transportadora: 'Expresso Rodoviário Sul',
    doca: 'Doca 12',
    destino: 'Curitiba - PR',
    cidade: 'Curitiba',
    uf: 'PR',
    pedido: 'PED-20831-A',
    tipoVeiculo: 'Carreta Baú',
    peso: 1208,
    unidade: 'FD',
    sku: 'SKU-GRA-330',
    descricao: 'Arroz Tipo 1 Polido 5kg (Fardo c/ 6 pacotes)',
    quantidade: 40,
    cliente: 'REDE SUL ALIMENTOS',
    dataCriacao: '2026-09-27',
  },
  {
    id: 'dt-row-5',
    dt: 'DT-20831',
    placa: 'RTO-9E33',
    motorista: 'Carlos Alberto Ramos',
    transportadora: 'Expresso Rodoviário Sul',
    doca: 'Doca 12',
    destino: 'Curitiba - PR',
    cidade: 'Curitiba',
    uf: 'PR',
    pedido: 'PED-20831-B',
    tipoVeiculo: 'Carreta Baú',
    peso: 1295,
    unidade: 'CX',
    sku: 'SKU-OLE-701',
    descricao: 'Óleo de Soja Refinado 900ml (Cx c/ 20 garrafas)',
    quantidade: 70,
    cliente: 'REDE SUL ALIMENTOS',
    dataCriacao: '2026-09-27',
  },
  {
    id: 'dt-row-6',
    dt: 'DT-20831',
    placa: 'RTO-9E33',
    motorista: 'Carlos Alberto Ramos',
    transportadora: 'Expresso Rodoviário Sul',
    doca: 'Doca 12',
    destino: 'Curitiba - PR',
    cidade: 'Curitiba',
    uf: 'PR',
    pedido: 'PED-20831-C',
    tipoVeiculo: 'Carreta Baú',
    peso: 128,
    unidade: 'FD',
    sku: 'SKU-HIG-205',
    descricao: 'Papel Higiênico Folha Dupla 30m (Fardo c/ 16 pct)',
    quantidade: 40,
    cliente: 'REDE SUL ALIMENTOS',
    dataCriacao: '2026-09-27',
  },
  // DT-30155
  {
    id: 'dt-row-7',
    dt: 'DT-30155',
    placa: 'FLG-4A88',
    motorista: 'Marcio Antunes',
    transportadora: 'Veloz Cargo Cargas',
    doca: 'Doca 02',
    destino: 'Belo Horizonte - MG',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    pedido: 'PED-30155-01',
    tipoVeiculo: 'Bitrem Articulado',
    peso: 1512,
    unidade: 'CX',
    sku: 'SKU-BEV-001',
    descricao: 'Refrigerante Cola 2L Pet (Fardo c/ 6 un)',
    quantidade: 120,
    cliente: 'ATACADO CENTRAL MG',
    dataCriacao: '2026-09-27',
  },
  {
    id: 'dt-row-8',
    dt: 'DT-30155',
    placa: 'FLG-4A88',
    motorista: 'Marcio Antunes',
    transportadora: 'Veloz Cargo Cargas',
    doca: 'Doca 02',
    destino: 'Belo Horizonte - MG',
    cidade: 'Belo Horizonte',
    uf: 'MG',
    pedido: 'PED-30155-02',
    tipoVeiculo: 'Bitrem Articulado',
    peso: 720,
    unidade: 'CX',
    sku: 'SKU-ALI-042',
    descricao: 'Biscoito Recheado Chocolate 140g (Cx c/ 30 un)',
    quantidade: 150,
    cliente: 'ATACADO CENTRAL MG',
    dataCriacao: '2026-09-27',
  },
];

// Base FAT vem exclusivamente da planilha Google Sheets (sem dados de simulação)
export const INITIAL_SHEET_FAT: SheetRowFAT[] = [];

export const INITIAL_LISTA_NEGRA: PlacaListaNegra[] = [
  {
    id: 'ln-fdr9087',
    placa: 'FDR-9087',
    observacao: 'Carro sem haste de amarração da carga.',
    ativo: true,
    dataCriacao: '2026-09-27',
  },
];

export const INITIAL_SETTINGS: AppSettings = {
  deParaList: INITIAL_DE_PARA,
  clientNotes: INITIAL_CLIENT_NOTES,
  listaNegra: INITIAL_LISTA_NEGRA,
  emailsCarga: [
    'expedicao.cd@empresa.com.br',
    'conferencia.cargas@logistica.com.br',
    'supervisor.armazem@empresa.com.br',
  ],
  emailsFaturamento: [
    'faturamento@empresa.com.br',
    'controladoria.log@empresa.com.br',
    'auditoria.expedicao@empresa.com.br',
  ],
  googleSheetListaDTUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT-LISTA-DT-DEMO/pubhtml',
  googleSheetFatUrl: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTAzTcIro87wD0GBjfd5Hwys82G6MgN7b7jDPj0pQGXmjmVorc_dE-VhDFzNxnocTMZu0rpnWMR4-_G/pubhtml',
  beepSoundEnabled: true,
  vibrationEnabled: true,
  lockLoteDefault: true,
  empresaNome: 'LOGÍSTICA & DISTRIBUIÇÃO NACIONAL LTDA',
  empresaCnpj: '12.345.678/0001-90',
  unidadeCD: 'CD 01 - Matriz São Paulo (Docas 04 a 12)',
};

export const INITIAL_INSPECTIONS: CargoInspection[] = [
  {
    id: 'INSP-61008899',
    dt: '61008899',
    placa: 'FDR-9087',
    motorista: 'Severino Silva',
    transportadora: 'TransLog Brasil S/A',
    status: 'em_conferencia',
    dataInicio: '2026-09-27 11:00',
    conferente: 'Carlos Eduardo Rossoni',
    matriculaConferente: 'CONF-8842',
    fotoVeiculoInicio: '',
    itensPlanejados: [
      {
        sku: '201304',
        descricao: 'Papel A',
        quantidadePlanejada: 200,
        ean: '7891201304012',
        cliente: 'BRAMIL',
      },
      {
        sku: '201614',
        descricao: 'Papel B',
        quantidadePlanejada: 345,
        ean: '7891201614029',
        cliente: 'BRAMIL',
      },
      {
        sku: '202100',
        descricao: 'Toalha A',
        quantidadePlanejada: 600,
        ean: '7891202100035',
        cliente: 'BRAMIL',
      },
    ],
    itensConferidos: [
      {
        id: 'chk-bramil-1',
        sku: '201304',
        ean: '7891201304012',
        descricao: 'Papel A',
        lote: 'LT-2026BR',
        quantidadeCarregada: 200,
        lastro: 20,
        camada: 10,
        fotos: [],
        timestamp: '11:15',
        acumuladorHistorico: [200],
      },
    ],
    fotosGerais: [],
  },
  {
    id: 'INSP-10492',
    dt: 'DT-10492',
    placa: 'BRA-2E19',
    motorista: 'Severino Silva',
    transportadora: 'TransLog Brasil S/A',
    status: 'em_conferencia',
    dataInicio: '2026-09-27 10:15',
    conferente: 'Carlos Eduardo Rossoni',
    matriculaConferente: 'CONF-8842',
    fotoVeiculoInicio: '',
    itensPlanejados: [
      {
        sku: 'SKU-BEV-001',
        descricao: 'Refrigerante Cola 2L Pet (Fardo c/ 6 un)',
        quantidadePlanejada: 60,
        ean: '7891000100101',
      },
      {
        sku: 'SKU-ALI-042',
        descricao: 'Biscoito Recheado Chocolate 140g (Cx c/ 30 un)',
        quantidadePlanejada: 90,
        ean: '7891000200202',
      },
      {
        sku: 'SKU-LIM-108',
        descricao: 'Detergente Líquido Neutro 500ml (Cx c/ 24 un)',
        quantidadePlanejada: 64,
        ean: '7891000300303',
      },
    ],
    itensConferidos: [
      {
        id: 'chk-1',
        sku: 'SKU-BEV-001',
        ean: '7891000100101',
        descricao: 'Refrigerante Cola 2L Pet (Fardo c/ 6 un)',
        lote: 'L-2609A',
        quantidadeCarregada: 60,
        lastro: 12,
        camada: 5,
        fotos: [],
        timestamp: '10:25:10',
        acumuladorHistorico: [60],
      },
    ],
    fotosGerais: [],
  },
  {
    id: 'INSP-20831',
    dt: 'DT-20831',
    placa: 'RTO-9E33',
    motorista: 'Carlos Alberto Ramos',
    transportadora: 'Expresso Rodoviário Sul',
    status: 'concluido',
    dataInicio: '2026-09-27 08:30',
    dataFim: '2026-09-27 09:45',
    conferente: 'Ana Paula Mendes',
    matriculaConferente: 'CONF-7210',
    numeroLacre: 'LAC-778910',
    fotoVeiculoInicio: '',
    fotoVeiculoFim: '',
    itensPlanejados: [
      {
        sku: 'SKU-GRA-330',
        descricao: 'Arroz Tipo 1 Polido 5kg (Fardo c/ 6 pacotes)',
        quantidadePlanejada: 40,
        ean: '7891000500505',
      },
      {
        sku: 'SKU-OLE-701',
        descricao: 'Óleo de Soja Refinado 900ml (Cx c/ 20 garrafas)',
        quantidadePlanejada: 70,
        ean: '7891000600606',
      },
      {
        sku: 'SKU-HIG-205',
        descricao: 'Papel Higiênico Folha Dupla 30m (Fardo c/ 16 pct)',
        quantidadePlanejada: 40,
        ean: '7891000400404',
      },
    ],
    itensConferidos: [
      {
        id: 'chk-10',
        sku: 'SKU-GRA-330',
        ean: '7891000500505',
        descricao: 'Arroz Tipo 1 Polido 5kg (Fardo c/ 6 pacotes)',
        lote: 'LT-ARZ09',
        quantidadeCarregada: 40,
        lastro: 10,
        camada: 4,
        fotos: [],
        timestamp: '08:50',
        acumuladorHistorico: [40],
      },
      {
        id: 'chk-11',
        sku: 'SKU-OLE-701',
        ean: '7891000600606',
        descricao: 'Óleo de Soja Refinado 900ml (Cx c/ 20 garrafas)',
        lote: 'LT-OL99',
        quantidadeCarregada: 70,
        lastro: 14,
        camada: 5,
        fotos: [],
        timestamp: '09:15',
        acumuladorHistorico: [70],
      },
      {
        id: 'chk-12',
        sku: 'SKU-HIG-205',
        ean: '7891000400404',
        descricao: 'Papel Higiênico Folha Dupla 30m (Fardo c/ 16 pct)',
        lote: 'LT-PH88',
        quantidadeCarregada: 40,
        lastro: 8,
        camada: 5,
        fotos: [],
        timestamp: '09:35',
        acumuladorHistorico: [40],
      },
    ],
    fotosGerais: [],
    emailStatus: {
      enviado: true,
      destinatarios: ['expedicao.cd@empresa.com.br', 'conferencia.cargas@logistica.com.br'],
      dataEnvio: '2026-09-27 09:47',
      assunto: 'Book de Carregamento Concluído - DT-20831 - Placa RTO-9E33',
    },
  },
];

export const INITIAL_USER: UserSession = {
  id: 'usr-1',
  name: 'Carlos Eduardo Rossoni',
  matricula: 'CONF-8842',
  role: 'conferente',
  avatar: '👨‍🏭',
  turno: '1º Turno (06:00 - 14:20)',
};

// Storage Accessors
export const storageService = {
  getSettings(): AppSettings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    try {
      const parsed: AppSettings = JSON.parse(data);
      if (!parsed.clientNotes || !Array.isArray(parsed.clientNotes)) {
        parsed.clientNotes = INITIAL_CLIENT_NOTES;
      } else {
        // Ensure BRAMIL default instruction is present
        INITIAL_CLIENT_NOTES.forEach((initNote) => {
          if (!parsed.clientNotes.some((n) => n.cliente.toUpperCase() === initNote.cliente.toUpperCase())) {
            parsed.clientNotes.unshift(initNote);
          }
        });
      }
      // Lista Negra: cria a lista para quem já tinha configurações salvas
      if (!Array.isArray(parsed.listaNegra)) {
        parsed.listaNegra = INITIAL_LISTA_NEGRA;
      }
      // Merge new dePara items if not present
      INITIAL_DE_PARA.forEach((initDp) => {
        if (!parsed.deParaList.some((dp) => dp.sku === initDp.sku)) {
          parsed.deParaList.unshift(initDp);
        }
      });
      // Troca a URL de demonstração da planilha FAT pela planilha real
      if (!parsed.googleSheetFatUrl || parsed.googleSheetFatUrl.includes('FAT-NFE-DEMO')) {
        parsed.googleSheetFatUrl = INITIAL_SETTINGS.googleSheetFatUrl;
      }
      return parsed;
    } catch {
      return INITIAL_SETTINGS;
    }
  },

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getInspections(): CargoInspection[] {
    const data = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(INITIAL_INSPECTIONS));
      return INITIAL_INSPECTIONS;
    }
    try {
      const list: CargoInspection[] = JSON.parse(data);
      // Guarantee DT 61008899 is present in list
      if (!list.some((i) => i.dt === '61008899')) {
        const bramilInsp = INITIAL_INSPECTIONS.find((i) => i.dt === '61008899');
        if (bramilInsp) list.unshift(bramilInsp);
      }
      return list;
    } catch {
      return INITIAL_INSPECTIONS;
    }
  },

  // Retorna false se o navegador recusar por falta de espaço (fotos ocupam a maior parte)
  saveInspections(inspections: CargoInspection[]): boolean {
    try {
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(inspections));
      return true;
    } catch (err) {
      console.error('Falha ao salvar conferências (armazenamento cheio?):', err);
      return false;
    }
  },

  getInspectionById(id: string): CargoInspection | undefined {
    const list = this.getInspections();
    return list.find((item) => item.id === id || item.dt.toLowerCase() === id.toLowerCase());
  },

  updateInspection(inspection: CargoInspection): void {
    const list = this.getInspections();
    const index = list.findIndex((i) => i.id === inspection.id);
    if (index >= 0) {
      list[index] = inspection;
    } else {
      list.unshift(inspection);
    }
    this.saveInspections(list);
  },

  getSheetDT(): SheetRowDT[] {
    const data = localStorage.getItem(STORAGE_KEYS.SHEET_DT);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SHEET_DT, JSON.stringify(INITIAL_SHEET_DT));
      return INITIAL_SHEET_DT;
    }
    try {
      const rows: SheetRowDT[] = JSON.parse(data);
      // Ensure DT 61008899 rows are present
      INITIAL_SHEET_DT.forEach((initRow) => {
        if (!rows.some((r) => r.dt === initRow.dt && r.sku === initRow.sku)) {
          rows.unshift(initRow);
        }
      });
      return rows;
    } catch {
      return INITIAL_SHEET_DT;
    }
  },

  saveSheetDT(rows: SheetRowDT[]): void {
    localStorage.setItem(STORAGE_KEYS.SHEET_DT, JSON.stringify(rows));
  },

  getSheetFAT(): SheetRowFAT[] {
    const data = localStorage.getItem(STORAGE_KEYS.SHEET_FAT);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SHEET_FAT, JSON.stringify(INITIAL_SHEET_FAT));
      return INITIAL_SHEET_FAT;
    }
    try {
      const rows: SheetRowFAT[] = JSON.parse(data);
      // Remove linhas de simulação gravadas por versões anteriores do app
      const isDemoRow = (r: SheetRowFAT) => r.id.startsWith('fat-bramil-') || r.id.startsWith('fat-row-');
      const clean = rows.filter((r) => !isDemoRow(r));
      if (clean.length !== rows.length) {
        localStorage.setItem(STORAGE_KEYS.SHEET_FAT, JSON.stringify(clean));
      }
      return clean;
    } catch {
      return INITIAL_SHEET_FAT;
    }
  },

  saveSheetFAT(rows: SheetRowFAT[]): void {
    localStorage.setItem(STORAGE_KEYS.SHEET_FAT, JSON.stringify(rows));
  },

  getUserSession(): UserSession {
    const data = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(INITIAL_USER));
      return INITIAL_USER;
    }
    try {
      return JSON.parse(data);
    } catch {
      return INITIAL_USER;
    }
  },

  saveUserSession(user: UserSession): void {
    localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(user));
  },

  clearUserSession(): void {
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
  },

  getActiveInspectionId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_INSPECTION_ID);
  },

  setActiveInspectionId(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_INSPECTION_ID, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_INSPECTION_ID);
    }
  },

  resetAllData(): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(INITIAL_INSPECTIONS));
    localStorage.setItem(STORAGE_KEYS.SHEET_DT, JSON.stringify(INITIAL_SHEET_DT));
    localStorage.setItem(STORAGE_KEYS.SHEET_FAT, JSON.stringify(INITIAL_SHEET_FAT));
    localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(INITIAL_USER));
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_INSPECTION_ID);
  },
};
