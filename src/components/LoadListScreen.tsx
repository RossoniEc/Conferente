import React, { useState } from 'react';
import { 
  ListOrdered, 
  Search, 
  Truck, 
  Boxes, 
  Clock, 
  ArrowRight, 
  PlusCircle, 
  FileText, 
  CheckCircle2, 
  AlertTriangle,
  ReceiptText,
  AlertCircle
} from 'lucide-react';
import { CargoInspection, ClientNote, PlacaListaNegra } from '../types';
import { BookSummaryModal } from './BookSummaryModal';
import { ListaNegraAlert } from './ListaNegraAlert';

interface LoadListScreenProps {
  inspections: CargoInspection[];
  clientNotes?: ClientNote[];
  onSelectInspection: (inspection: CargoInspection) => void;
  onNavigateNewLoad: () => void;
  // Cabeçalho (a mesma lista serve ao Tópico 3 e ao seletor de DT do Tópico 2)
  headerTag?: string;
  title?: string;
  // 'carregadas' = só 100% carregadas (Tópico 3); 'em_processo' = abaixo de 100% (Tópico 2)
  mode?: 'carregadas' | 'em_processo';
  listaNegra?: PlacaListaNegra[];
}

export const LoadListScreen: React.FC<LoadListScreenProps> = ({
  inspections,
  clientNotes = [],
  onSelectInspection,
  onNavigateNewLoad,
  headerTag = 'Tópico 3 • Gestão de Pátio',
  title = 'Lista de Carga (100% Carregadas)',
  mode = 'carregadas',
  listaNegra = [],
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInspectionForBook, setSelectedInspectionForBook] = useState<CargoInspection | null>(null);

  // Etapa de pátio: só DTs em conferência. Carga finalizada segue para o Faturamento.
  const emConferencia = inspections.filter((insp) => insp.status === 'em_conferencia');

  // Carga 100% carregada = carregado >= planejado já descontado o corte
  const isCarregada = (insp: CargoInspection) => {
    const plan = insp.itensPlanejados.reduce((a, b) => a + b.quantidadePlanejada, 0);
    const corte = insp.itensConferidos.reduce((a, b) => a + (b.corteOperacional?.quantidade || 0), 0);
    const carreg = insp.itensConferidos.reduce((a, b) => a + b.quantidadeCarregada, 0);
    return plan - corte > 0 && carreg >= plan - corte;
  };
  // Tópico 3 lista só as 100% carregadas (aguardando "Finalizar Carga");
  // Tópico 2 lista só as que ainda estão em processo
  const listaDaEtapa = emConferencia.filter((insp) => (mode === 'carregadas' ? isCarregada(insp) : !isCarregada(insp)));

  const matchesSearch = (insp: CargoInspection) => {
    const term = searchTerm.toLowerCase();
    return (
      insp.dt.toLowerCase().includes(term) ||
      insp.placa.toLowerCase().includes(term) ||
      (insp.motorista && insp.motorista.toLowerCase().includes(term)) ||
      (insp.conferente && insp.conferente.toLowerCase().includes(term))
    );
  };

  const filtered = listaDaEtapa.filter(matchesSearch);

  const getStatusBadge = (status: CargoInspection['status']) => {
    switch (status) {
      case 'em_conferencia':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5" />
            Em Conferência
          </span>
        );
      case 'concluido':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Carga Concluída
          </span>
        );
      case 'faturado_conferido':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <ReceiptText className="w-3.5 h-3.5 mr-1 text-purple-600" />
            Faturado 100% OK
          </span>
        );
      case 'faturado_divergente':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Divergência FAT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            Planejado
          </span>
        );
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6 space-y-5">
      {/* Title & Add Load Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 block">
            {headerTag}
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center space-x-2">
            <ListOrdered className="w-6 h-6 text-amber-600" />
            <span>{title}</span>
          </h2>
        </div>

        <button
          type="button"
          onClick={onNavigateNewLoad}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-md shadow-blue-600/20 transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Importar Nova Carga</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por DT, Placa ou Motorista..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-amber-500 shadow-sm"
          />
        </div>

        <span
          className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap border ${
            mode === 'carregadas'
              ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
              : 'bg-amber-100 text-amber-900 border-amber-200'
          }`}
        >
          {listaDaEtapa.length} DT{listaDaEtapa.length === 1 ? '' : 's'}{' '}
          {mode === 'carregadas' ? '100% carregada' + (listaDaEtapa.length === 1 ? '' : 's') : 'em processo'}
        </span>
      </div>

      {/* Cards List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center text-slate-500 space-y-3">
          <Truck className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700 text-sm">Nenhuma carga encontrada</h3>
          <p className="text-xs max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum resultado para a busca digitada. Tente outro termo.'
              : mode === 'carregadas'
              ? 'Nenhuma carga 100% carregada aguardando finalização. As cargas em andamento estão em "2. Conferência de Carga".'
              : 'Nenhuma carga em processo no momento. Importe uma nova carga para iniciar.'}
          </p>
          <button
            type="button"
            onClick={onNavigateNewLoad}
            className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs"
          >
            Importar Carga Agora
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((insp) => {
            const totalPlan = insp.itensPlanejados.reduce((a, b) => a + b.quantidadePlanejada, 0);
            const totalCarreg = insp.itensConferidos.reduce((a, b) => a + b.quantidadeCarregada, 0);
            const totalCorte = insp.itensConferidos.reduce((a, b) => a + (b.corteOperacional?.quantidade || 0), 0);
            // O corte operacional sai do planejado: o % é sobre o que efetivamente deve ser carregado
            const planLiquido = totalPlan - totalCorte;
            const percent = planLiquido > 0 ? Math.min(100, Math.round((totalCarreg / planLiquido) * 100)) : 0;
            const isEmAndamento = insp.status === 'em_conferencia';

            return (
              <div
                key={insp.id}
                className="bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Doc. Transporte
                      </span>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-black font-mono text-slate-900">{insp.dt}</h3>
                        {insp.itensPlanejados[0]?.cliente && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                            {insp.itensPlanejados[0].cliente}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(insp.status)}
                      {/* Mercosul Placa */}
                      <div className="bg-white border-2 border-blue-600 rounded-md px-2 py-0.5 text-xs font-mono font-black text-slate-900 shadow-xs flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                        <span>{insp.placa}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metadata line */}
                  <div className="text-xs text-slate-500 space-y-1">
                    <p className="truncate">
                      <span className="font-semibold text-slate-700">Motorista:</span> {insp.motorista || 'Severino Silva'}
                    </p>
                    <p className="truncate">
                      <span className="font-semibold text-slate-700">Transportadora:</span>{' '}
                      {insp.transportadora || 'TransLog Brasil'}
                    </p>
                    <p className="flex items-center text-[11px] text-slate-400">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      Início: {insp.dataInicio} • Conferente: {insp.conferente.split(' ')[0]}
                    </p>
                  </div>

                  {/* Lista Negra: placa com observação */}
                  <ListaNegraAlert placa={insp.placa} lista={listaNegra} compact />

                  {/* Client standard instruction alert */}
                  {(() => {
                    const loadCliente = insp.itensPlanejados[0]?.cliente || '';
                    const noteMatch = clientNotes.find(
                      (n) => n.ativo && (
                        (loadCliente && (n.cliente.toUpperCase() === loadCliente.toUpperCase() || loadCliente.toUpperCase().includes(n.cliente.toUpperCase()))) ||
                        insp.dt.toUpperCase().includes(n.cliente.toUpperCase())
                      )
                    );
                    if (!noteMatch) return null;

                    return (
                      <div className="mt-2 bg-rose-50 border border-rose-200 rounded-xl p-2 flex items-center space-x-2 text-rose-900 text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        <span className="font-bold truncate">
                          {noteMatch.cliente}: {noteMatch.mensagem}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Volumes and Progress Bar */}
                <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-600 flex items-center">
                      <Boxes className="w-3.5 h-3.5 mr-1 text-amber-500" />
                      Total de Volumes:
                    </span>
                    <span className="font-extrabold text-slate-900">
                      <span className="text-emerald-700 font-mono text-sm">{totalCarreg}</span>
                      <span className="text-slate-400 font-normal"> / {planLiquido} planejado</span>
                    </span>
                  </div>
                  {totalCorte > 0 && (
                    <p className="text-[10px] font-semibold text-orange-700 text-right -mt-1">
                      {totalPlan} planejado − {totalCorte} corte operacional
                    </p>
                  )}

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        percent >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                    <span>{insp.itensConferidos.length} SKUs conferidos</span>
                    <span>{percent}% concluído</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center space-x-2">
                  {/* Primary Action Button: "Ao selecionar vai abrir a pagina 3. Conferencia de Carga" */}
                  <button
                    type="button"
                    onClick={() => onSelectInspection(insp)}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-98 text-slate-950 font-black rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-1.5 shadow-sm transition-all"
                  >
                    <span>
                      {mode === 'carregadas' ? 'ABRIR E FINALIZAR' : isEmAndamento ? 'CONFERIR CARGA' : 'VER / EDITAR CARGA'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* View Book PDF */}
                  <button
                    type="button"
                    onClick={() => setSelectedInspectionForBook(insp)}
                    title="Ver Book de Carregamento"
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                  </button>

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Book Summary Modal */}
      {selectedInspectionForBook && (
        <BookSummaryModal
          inspection={selectedInspectionForBook}
          clientNotes={clientNotes}
          onClose={() => setSelectedInspectionForBook(null)}
        />
      )}
    </div>
  );
};
