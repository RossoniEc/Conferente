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
  History
} from 'lucide-react';
import { ActiveTab, CargoInspection, UserSession } from '../types';

interface HomeScreenProps {
  onNavigate: (tab: ActiveTab) => void;
  onResumeConference: () => void;
  user: UserSession;
  inspections: CargoInspection[];
  activeInspection: CargoInspection | null;
  availableDtCount: number;
  availableVolume: number;
  skuCount: number;
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
  const concluidosCount = inspections.filter((i) => i.status === 'concluido' || i.status.startsWith('faturado')).length;
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

  // Planejado do dia: DTs ainda disponíveis na LISTA DT + em andamento + finalizadas hoje
  const planejadoDtCount = availableDtCount + emConferenciaCount + realizadoHoje;
  const planejadoVolume =
    availableVolume +
    [...emConferencia, ...finalizadasHoje].reduce(
      (acc, i) => acc + i.itensPlanejados.reduce((a, p) => a + p.quantidadePlanejada, 0),
      0
    );

  // % Evolução: DTs finalizadas hoje sobre o planejado do dia
  const evolucaoPct = planejadoDtCount > 0 ? Math.round((realizadoHoje / planejadoDtCount) * 100) : 0;

  const menuItems = [
    {
      id: 'select_load' as ActiveTab,
      number: '1',
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
      number: '2',
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
      number: '3',
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
      number: '4',
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
      number: '5',
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
      number: '6',
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
          <div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Olá, {user.name}
            </h2>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3 shrink-0">
            <div
              className="bg-slate-800/80 border border-slate-700 rounded-2xl p-3 text-center min-w-[90px]"
              title="DTs disponíveis na LISTA DT + em andamento + finalizadas hoje"
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
              <div className="mt-1.5 h-1 w-full bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    evolucaoPct >= 100 ? 'bg-emerald-400' : evolucaoPct >= 50 ? 'bg-amber-400' : 'bg-rose-400'
                  }`}
                  style={{ width: `${Math.min(evolucaoPct, 100)}%` }}
                />
              </div>
            </div>
          </div>
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
