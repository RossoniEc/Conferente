import React from 'react';
import { 
  QrCode, 
  ListOrdered, 
  ScanLine, 
  ReceiptText, 
  Settings as SettingsIcon, 
  ArrowRight, 
  Truck, 
  Boxes,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  Warehouse,
  PackageSearch
} from 'lucide-react';
import { ActiveTab, CargoInspection, SheetRowDT, UserSession } from '../types';

interface HomeScreenProps {
  onNavigate: (tab: ActiveTab) => void;
  onResumeConference: () => void;
  user: UserSession;
  inspections: CargoInspection[];
  activeInspection: CargoInspection | null;
  availableDtCount: number;
  availableVolume: number;
  skuCount: number;
  sheetRowsDT?: SheetRowDT[];
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigate,
  onResumeConference,
  user,
  inspections,
  activeInspection,
  availableDtCount,
  availableVolume,
  skuCount,
  sheetRowsDT = [],
}) => {
  const emConferencia = inspections.filter((i) => i.status === 'em_conferencia');
  const emConferenciaCount = emConferencia.length;
  // 100% carregada = carregado >= planejado − corte (aguarda "Finalizar Carga" no Tópico 3)
  const isCarregada = (i: CargoInspection) => {
    const plan = i.itensPlanejados.reduce((a, b) => a + b.quantidadePlanejada, 0);
    const corte = i.itensConferidos.reduce((a, b) => a + (b.corteOperacional?.quantidade || 0), 0);
    const carreg = i.itensConferidos.reduce((a, b) => a + b.quantidadeCarregada, 0);
    return plan - corte > 0 && carreg >= plan - corte;
  };
  const carregadasCount = emConferencia.filter(isCarregada).length;
  const emProcessoCount = emConferenciaCount - carregadasCount;
  const finalizadas = inspections.filter((i) => i.status === 'concluido' || i.status.startsWith('faturado'));
  const concluidosCount = finalizadas.length;
  // Volume carregado nas cargas finalizadas
  const volumeFinalizado = finalizadas.reduce(
    (acc, i) => acc + i.itensConferidos.reduce((a, it) => a + it.quantidadeCarregada, 0),
    0
  );
  // Etapa de faturamento: carga finalizada e ainda não faturada
  const aguardandoFatCount = inspections.filter((i) => i.status === 'concluido').length;

  const now = new Date();
  // Data local (toISOString usaria UTC e viraria o dia às 21h no horário de Brasília)
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayBr = now.toLocaleDateString('pt-BR');
  const isToday = (date?: string) => !!date && (date.startsWith(todayIso) || date.startsWith(todayBr));
  const finalizadasHoje = inspections.filter(
    (i) => (i.status === 'concluido' || i.status.startsWith('faturado')) && isToday(i.dataFim)
  );
  const realizadoHoje = finalizadasHoje.length;

  // Faturado do dia: DTs com conferência de faturamento confirmada hoje e o volume faturado
  const faturadasHoje = inspections.filter(
    (i) => i.status.startsWith('faturado') && isToday(i.faturamento?.dataConferencia)
  );
  const faturadoVolume = faturadasHoje.reduce(
    (acc, i) => acc + (i.faturamento?.itensFaturados || []).reduce((a, f) => a + f.quantidadeFaturada, 0),
    0
  );

  // DTs da LISTA DT agrupadas, com a data agendada (coluna DATA) e a situação na conferência
  const findInsp = (dt: string) => inspections.find((i) => i.dt.toUpperCase() === dt.toUpperCase());
  const isFinalizada = (i?: CargoInspection) => !!i && (i.status === 'concluido' || i.status.startsWith('faturado'));
  const gruposDt = Array.from(
    sheetRowsDT
      .reduce((map, r) => {
        const k = r.dt.toUpperCase();
        const g = map.get(k) || { dt: r.dt, data: r.dataAgendamento, cliente: r.cliente, placa: r.placa, volume: 0 };
        g.volume += r.quantidade;
        // DT com SKUs em datas diferentes: vale a data mais recente (reagendamento)
        if (r.dataAgendamento && (!g.data || r.dataAgendamento > g.data)) g.data = r.dataAgendamento;
        map.set(k, g);
        return map;
      }, new Map<string, { dt: string; data?: string; cliente?: string; placa: string; volume: number }>())
      .values()
  );
  const usaDataPlanilha = gruposDt.some((g) => g.data);

  // Planejado do dia: DTs com DATA de hoje na LISTA DT (sem a coluna DATA: disponíveis + em andamento + finalizadas hoje)
  const planejadasHoje = gruposDt.filter((g) => g.data === todayIso);
  const planejadoDtCount = usaDataPlanilha ? planejadasHoje.length : availableDtCount + emConferenciaCount + realizadoHoje;
  const planejadoVolume = usaDataPlanilha
    ? planejadasHoje.reduce((a, g) => a + g.volume, 0)
    : availableVolume +
      [...emConferencia, ...finalizadasHoje].reduce(
        (acc, i) => acc + i.itensPlanejados.reduce((a, p) => a + p.quantidadePlanejada, 0),
        0
      );
  // Planejado do dia por Tipo de Carga (Paletizado, Estivado…): DTs e volume de cada tipo
  const dtsHojeSet = new Set(planejadasHoje.map((g) => g.dt.toUpperCase()));
  const porTipo = Array.from(
    sheetRowsDT
      .filter((r) => dtsHojeSet.has(r.dt.toUpperCase()))
      .reduce((map, r) => {
        const tipo = r.tipoCarga || 'Sem tipo';
        const t = map.get(tipo) || { tipo, dts: new Set<string>(), volume: 0 };
        t.dts.add(r.dt.toUpperCase());
        t.volume += r.quantidade;
        map.set(tipo, t);
        return map;
      }, new Map<string, { tipo: string; dts: Set<string>; volume: number }>())
      .values()
  ).sort((a, b) => b.volume - a.volume);
  // % de cada tipo sobre o volume planejado do dia
  const volumeTipos = porTipo.reduce((a, t) => a + t.volume, 0);
  const pctTipo = (v: number) => (volumeTipos > 0 ? Math.round((v / volumeTipos) * 100) : 0);
  const corTipo = (tipo: string) => {
    const t = tipo.toLowerCase();
    if (t.startsWith('palet')) return 'bg-blue-500/15 border-blue-400/40 text-blue-200';
    if (t.startsWith('estiv') || t.startsWith('batid')) return 'bg-violet-500/15 border-violet-400/40 text-violet-200';
    if (t.startsWith('fracion')) return 'bg-amber-500/15 border-amber-400/40 text-amber-200';
    return 'bg-slate-700/60 border-slate-600 text-slate-300';
  };

  const realizadoPlanejado = usaDataPlanilha
    ? planejadasHoje.filter((g) => isFinalizada(findInsp(g.dt))).length
    : realizadoHoje;

  // % Evolução: DTs do planejado do dia já finalizadas
  const evolucaoPct = planejadoDtCount > 0 ? Math.round((realizadoPlanejado / planejadoDtCount) * 100) : 0;

  // DTs em atraso: DATA anterior a hoje e carga ainda não finalizada
  const diaMs = 86_400_000;
  const dtsAtrasadas = gruposDt
    .filter((g) => g.data && g.data < todayIso && !isFinalizada(findInsp(g.dt)))
    .map((g) => {
      const insp = findInsp(g.dt);
      const dias = Math.round(
        (new Date(todayIso + 'T00:00:00').getTime() - new Date(g.data + 'T00:00:00').getTime()) / diaMs
      );
      return { ...g, dias, emConferencia: insp?.status === 'em_conferencia' };
    })
    .sort((a, b) => b.dias - a.dias || a.dt.localeCompare(b.dt));
  const atrasoVolume = dtsAtrasadas.reduce((a, g) => a + g.volume, 0);

  const menuItems = [
    {
      id: 'storage' as ActiveTab,
      number: '1',
      title: 'Armazenagem',
      subtitle: 'Mapa de estoque por endereço (rua, SKU, lote e pallets) e otimização de endereços',
      icon: Warehouse,
      color: 'from-indigo-600 to-violet-600',
      tag: 'Estoque',
      badge: null,
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
    {
      id: 'picking' as ActiveTab,
      number: '2',
      title: 'Separação de Carga',
      subtitle: 'Lista de coleta por DT com endereço e lote (FIFO) e baixa do estoque',
      icon: PackageSearch,
      color: 'from-teal-600 to-cyan-600',
      tag: 'Picking',
      badge: null,
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
    },
    {
      id: 'select_load' as ActiveTab,
      number: '3',
      title: 'Selecionar Carga',
      subtitle: 'Importar planejamento via QR Code ou busca por DT / Placa do caminhão',
      icon: QrCode,
      color: 'from-blue-600 to-indigo-600',
      tag: 'Entrada de Carga',
      badge: `${availableDtCount} DT${availableDtCount === 1 ? '' : 's'} disponíve${availableDtCount === 1 ? 'l' : 'is'}`,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      id: 'load_inspection' as ActiveTab,
      number: '4',
      title: 'Conferência de Carga',
      subtitle: 'Scanner EAN/SKU, lote, lastro x camada, fotos de carga, lacre e Book PDF',
      icon: ScanLine,
      color: 'from-emerald-600 to-teal-600',
      tag: 'Execução de Pátio',
      badge: emProcessoCount > 0 ? `${emProcessoCount} em processo` : null,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      id: 'load_list' as ActiveTab,
      number: '5',
      title: 'Lista de Carga (100% Carregadas)',
      subtitle: 'Cargas com 100% do volume carregado, aguardando finalização (lacre e foto final)',
      icon: ListOrdered,
      color: 'from-amber-600 to-orange-600',
      tag: 'Painel Geral',
      badge: carregadasCount > 0 ? `${carregadasCount} p/ Finalizar` : null,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'billing_inspection' as ActiveTab,
      number: '6',
      title: 'Conferência de Faturamento',
      subtitle: 'Leitura da chave NF-e, check FAT Google Sheets, divergências e e-mail',
      icon: ReceiptText,
      color: 'from-purple-600 to-pink-600',
      tag: 'Auditoria NF-e',
      badge: aguardandoFatCount > 0 ? `${aguardandoFatCount} p/ Faturar` : null,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    {
      id: 'history' as ActiveTab,
      number: '7',
      title: 'Histórico de DTs',
      subtitle: 'Consultar DTs encerradas: dados da conferência, faturamento e book de imagens',
      icon: History,
      color: 'from-sky-600 to-cyan-600',
      tag: 'Consulta',
      badge: `${concluidosCount} DT${concluidosCount === 1 ? '' : 's'}`,
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
    },
    {
      id: 'settings' as ActiveTab,
      number: '8',
      title: 'Configuração',
      subtitle: 'Tabela De/Para, Comentários de Clientes, planilhas Google Sheets e e-mails',
      icon: SettingsIcon,
      color: 'from-slate-700 to-slate-900',
      tag: 'WMS Config',
      badge: `${skuCount} SKUs`,
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-7 space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-700/60 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4">
          {/* Quick Metrics */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 shrink-0">
            <div
              className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 text-center min-w-[90px]"
              title={usaDataPlanilha ? `DTs com DATA ${todayBr} na LISTA DT` : 'DTs disponíveis na LISTA DT + em andamento + finalizadas hoje'}
            >
              <span className="text-lg sm:text-xl font-black text-white block">{planejadoDtCount}</span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Planejado do Dia</span>
              <span className="block text-[10px] text-slate-500 font-mono">{planejadoVolume} vol.</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 text-center min-w-[90px]">
              <span className="text-lg sm:text-xl font-black text-amber-400 block">{emConferenciaCount}</span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Em Andamento</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 text-center min-w-[90px]">
              <span className="text-lg sm:text-xl font-black text-emerald-400 block">{concluidosCount}</span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Finalizadas</span>
              <span className="block text-[10px] text-slate-500 font-mono">{volumeFinalizado.toLocaleString('pt-BR')} vol.</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 text-center min-w-[90px]">
              <span className="text-lg sm:text-xl font-black text-sky-400 block">{faturadasHoje.length}</span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Faturado</span>
              <span className="block text-[10px] text-slate-500 font-mono">{faturadoVolume} vol.</span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 text-center min-w-[90px]">
              <span
                className={`text-lg sm:text-xl font-black block ${
                  evolucaoPct >= 100 ? 'text-emerald-400' : evolucaoPct >= 50 ? 'text-amber-400' : 'text-rose-400'
                }`}
              >
                {evolucaoPct}%
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">% Evolução</span>
              <span className="block text-[10px] text-slate-500 font-mono">
                {realizadoPlanejado}/{planejadoDtCount} DTs
              </span>
              <div className="mt-1.5 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    evolucaoPct >= 100 ? 'bg-emerald-400' : evolucaoPct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.min(evolucaoPct, 100)}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('select_load')}
              className={`rounded-2xl p-3 text-center min-w-[90px] border transition-colors ${
                dtsAtrasadas.length > 0
                  ? 'bg-rose-500/15 border-rose-500/60 hover:bg-rose-500/25'
                  : 'bg-slate-800/80 border-slate-700'
              }`}
              title="DTs com DATA anterior a hoje e carga ainda não finalizada — toque para abrir Selecionar Carga"
            >
              <span
                className={`text-lg sm:text-xl font-black block ${dtsAtrasadas.length > 0 ? 'text-rose-400' : 'text-slate-300'}`}
              >
                {dtsAtrasadas.length}
              </span>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Em Atraso</span>
              <span className="block text-[10px] text-slate-500 font-mono">{atrasoVolume} vol.</span>
            </button>
          </div>

          {/* Planejado do dia por Tipo de Carga */}
          {porTipo.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Planejado por tipo:</span>
              {porTipo.map((t) => (
                <span
                  key={t.tipo}
                  className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] leading-tight ${corTipo(t.tipo)}`}
                >
                  <span className="font-black uppercase tracking-wide">{t.tipo}</span>
                  <span className="font-black text-white text-[10px]">
                    {t.dts.size} DT{t.dts.size > 1 ? 's' : ''}
                  </span>
                  <span className="font-mono text-slate-300">{t.volume.toLocaleString('pt-BR')} vol.</span>
                  <span className="font-black text-white text-[10px] rounded bg-white/15 px-1">{pctTipo(t.volume)}%</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Active Load fast-jump banner if any */}
        {activeInspection && (
          <div className="mt-4 pt-3.5 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-slate-200">Carga em Andamento:</span>
              <span className="font-mono bg-slate-800 px-2.5 py-0.5 rounded text-amber-300 font-bold text-2xl">
                {activeInspection.dt}
              </span>
              <span className="font-mono bg-slate-800 px-2.5 py-0.5 rounded text-slate-300 font-bold text-2xl">
                {activeInspection.placa}
              </span>
            </div>
            <button
              type="button"
              onClick={onResumeConference}
              className="h-11 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 active:scale-95 transition-all"
            >
              <span>Retomar Conferência</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Main Menu Grid */}
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
          Menu Principal de Operação
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className="group relative bg-white hover:bg-slate-50 active:scale-[0.99] border border-slate-200 hover:border-slate-300 rounded-3xl p-4 sm:p-5 text-left shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    {/* Number + Icon */}
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${item.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                          Tópico {item.number}
                        </span>
                        <h4 className="text-base sm:text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                          {item.title}
                        </h4>
                      </div>
                    </div>

                    {/* Badge */}
                    {item.badge && (
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed font-normal pl-0 sm:pl-1">
                    {item.subtitle}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-slate-700">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                    {item.tag}
                  </span>
                  <div className="flex items-center space-x-1 text-blue-600 group-hover:translate-x-1 transition-transform">
                    <span>Acessar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
