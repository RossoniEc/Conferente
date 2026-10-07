import React, { useState } from 'react';
import { X, Download, FileText, CheckCircle2, AlertTriangle, User, Truck, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { CargoInspection, ClientNote, notaPorCodigoCliente, resumoRetornoPallet } from '../types';
import { baixarBookCarregamentoPdf } from '../services/pdfGenerator';

interface BookSummaryModalProps {
  inspection: CargoInspection;
  onClose: () => void;
  clientNotes?: ClientNote[];
  empresaNome?: string;
  unidadeCD?: string;
}

export const BookSummaryModal: React.FC<BookSummaryModalProps> = ({
  inspection,
  onClose,
  clientNotes = [],
  empresaNome = 'LOGÍSTICA & DISTRIBUIÇÃO NACIONAL LTDA',
  unidadeCD = 'CD 01 - Matriz São Paulo',
}) => {
  // Foto do book aberta em tela cheia
  const [fotoAmpliada, setFotoAmpliada] = useState<{ src: string; titulo: string } | null>(null);
  // Consolidate SKUs
  const map = new Map<string, {
    sku: string;
    descricao: string;
    planejado: number;
    carregado: number;
    lotes: string[];
    fotos: string[];
  }>();

  let totalPlan = 0;
  let totalCarreg = 0;

  inspection.itensPlanejados.forEach((p) => {
    totalPlan += p.quantidadePlanejada;
    map.set(p.sku, {
      sku: p.sku,
      descricao: p.descricao,
      planejado: p.quantidadePlanejada,
      carregado: 0,
      lotes: [],
      fotos: [],
    });
  });

  inspection.itensConferidos.forEach((c) => {
    totalCarreg += c.quantidadeCarregada;
    const item = map.get(c.sku);
    // Vários lotes na mesma leitura: lista cada lote com sua quantidade
    const itemLotes = c.lotes?.length
      ? c.lotes.map((l) => `${l.lote} (${l.quantidade})`)
      : c.lote
      ? [c.lote]
      : [];
    if (item) {
      item.carregado += c.quantidadeCarregada;
      itemLotes.forEach((l) => {
        if (!item.lotes.includes(l)) item.lotes.push(l);
      });
      if (c.fotos) item.fotos.push(...c.fotos);
    } else {
      map.set(c.sku, {
        sku: c.sku,
        descricao: c.descricao,
        planejado: 0,
        carregado: c.quantidadeCarregada,
        lotes: itemLotes,
        fotos: c.fotos || [],
      });
    }
  });

  const totalDiferenca = totalCarreg - totalPlan;
  const isConforme = totalDiferenca === 0;

  const handleDownloadPdf = () => baixarBookCarregamentoPdf(inspection, empresaNome, unidadeCD, clientNotes);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col border border-slate-200 max-h-[92vh] overflow-hidden">
        {/* Top Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Book de Carregamento & Relatório</h3>
              <p className="text-xs text-slate-300">
                DT: <span className="font-mono text-amber-300">{inspection.dt}</span> • Placa:{' '}
                <span className="font-mono text-amber-300">{inspection.placa}</span>
                {inspection.doca && (
                  <>
                    {' • '}
                    <span className="font-mono text-amber-300">{inspection.doca}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] text-slate-500 block flex items-center">
                <Truck className="w-3.5 h-3.5 mr-1 text-slate-400" /> Placa
              </span>
              <span className="font-bold font-mono text-slate-900 text-sm">{inspection.placa}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] text-slate-500 block flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-slate-400" /> Nº Lacre
              </span>
              <span className="font-bold font-mono text-slate-900 text-sm">{inspection.numeroLacre || 'S/ Lacre'}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] text-slate-500 block flex items-center">
                <User className="w-3.5 h-3.5 mr-1 text-slate-400" /> Conferente
              </span>
              <span className="font-bold text-slate-900 text-xs truncate block">{inspection.conferente}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <span className="text-[11px] text-slate-500 block">Status Carga</span>
              <span
                className={`inline-flex items-center text-xs font-bold ${
                  isConforme ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {isConforme ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                {isConforme ? '100% OK' : `${totalDiferenca > 0 ? `+${totalDiferenca}` : totalDiferenca} dif.`}
              </span>
            </div>
          </div>

          {/* Client Specific Note in Book */}
          {(() => {
            const loadCli = inspection.itensPlanejados.find((p) => p.cliente)?.cliente || '';
            const matching = clientNotes?.find(
              (n) => n.ativo && (
                (loadCli && (n.cliente.toUpperCase() === loadCli.toUpperCase() || loadCli.toUpperCase().includes(n.cliente.toUpperCase()))) ||
                inspection.dt.toUpperCase().includes(n.cliente.toUpperCase()) ||
                notaPorCodigoCliente(n, inspection.itensPlanejados) ||
                n.cliente.toUpperCase() === 'GERAL'
              )
            );
            if (!matching) return null;

            return (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-3.5 flex items-start space-x-3 text-rose-950">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-black uppercase text-rose-700 block tracking-wider">
                    Exigência Padrão do Cliente: {matching.cliente}
                  </span>
                  <p className="text-xs sm:text-sm font-black uppercase tracking-wide">{matching.mensagem}</p>
                </div>
              </div>
            );
          })()}

          {/* Table of SKUs and Lots */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-xs text-slate-700 uppercase tracking-wider flex justify-between items-center">
              <span>Relação de SKUs Conferidos</span>
              <span className="text-[11px] font-normal text-slate-500">
                Total Planejado: {totalPlan} | Carregado: {totalCarreg}
              </span>
            </div>
            <div className="divide-y divide-slate-100 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Descrição</th>
                    <th className="px-3 py-2">Lote(s)</th>
                    <th className="px-3 py-2 text-right">Plan.</th>
                    <th className="px-3 py-2 text-right">Carreg.</th>
                    <th className="px-3 py-2 text-right">Dif.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.from(map.values()).map((row) => {
                    const difItem = row.carregado - row.planejado;
                    return (
                      <tr key={row.sku} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2.5 font-bold font-mono text-slate-900">{row.sku}</td>
                        <td className="px-3 py-2.5 text-slate-700 max-w-xs">{row.descricao}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-600">
                          {row.lotes.length > 0 ? row.lotes.join(', ') : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium text-slate-600">{row.planejado}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-slate-900">{row.carregado}</td>
                        <td className="px-3 py-2.5 text-right font-bold">
                          {difItem === 0 ? (
                            <span className="text-emerald-600">0</span>
                          ) : difItem > 0 ? (
                            <span className="text-amber-600">+{difItem}</span>
                          ) : (
                            <span className="text-rose-600">{difItem}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Photo Gallery */}
          <div className="space-y-2">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center">
              <ImageIcon className="w-4 h-4 mr-1.5 text-amber-500" />
              Evidências Fotográficas do Book
            </h4>
            {/* Fotos agrupadas por lançamento: cada grupo com borda e cabeçalho próprios */}
            <div className="space-y-3">
              {inspection.fotoVeiculoInicio && (
                <div className="rounded-2xl border-2 border-slate-400 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-300 text-sm font-black text-slate-800">
                    Veículo na chegada • Placa {inspection.placa || '—'}
                  </div>
                  <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFotoAmpliada({ src: inspection.fotoVeiculoInicio as string, titulo: 'Veículo na chegada' })}
                      className="rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 transition-colors"
                    >
                      <img src={inspection.fotoVeiculoInicio} alt="Veículo na chegada" className="w-full aspect-[4/3] object-cover" />
                    </button>
                  </div>
                </div>
              )}
              {inspection.itensConferidos
                .map((item, idx) => ({ item, n: idx + 1 }))
                .filter(({ item }) => item.fotos.length > 0)
                .map(({ item, n }) => {
                  const cores = [
                    'border-amber-400 bg-amber-50',
                    'border-blue-400 bg-blue-50',
                    'border-emerald-400 bg-emerald-50',
                    'border-violet-400 bg-violet-50',
                    'border-rose-400 bg-rose-50',
                    'border-cyan-400 bg-cyan-50',
                  ];
                  const cor = cores[(n - 1) % cores.length];
                  const [borda, fundo] = cor.split(' ');
                  return (
                    <div key={item.id} className={`rounded-2xl border-2 ${borda} overflow-hidden`}>
                      <div className={`px-3 py-2 ${fundo} border-b ${borda} space-y-0.5`}>
                        <p className="text-sm font-black text-slate-900 flex flex-wrap items-center gap-x-2">
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Lançamento #{n}</span>
                          <span className="font-mono">{item.sku}</span>
                          <span className="text-[11px] font-bold text-slate-500">
                            {item.fotos.length} foto{item.fotos.length > 1 ? 's' : ''}
                          </span>
                        </p>
                        <p className="text-xs text-slate-700 leading-snug">{item.descricao}</p>
                        <p className="text-xs text-slate-600">
                          Qtd: <strong className="text-slate-900">{item.quantidadeCarregada.toLocaleString('pt-BR')} vol.</strong>
                          {' • '}Lote <span className="font-mono">{item.lote || 'S/L'}</span>
                        </p>
                      </div>
                      <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-white">
                        {item.fotos.map((foto, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() =>
                              setFotoAmpliada({
                                src: foto,
                                titulo: `Lançamento #${n} • ${item.sku} — ${item.descricao} • ${item.quantidadeCarregada} vol. • Lote ${item.lote || 'S/L'}`,
                              })
                            }
                            className="relative rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 transition-colors"
                          >
                            <img src={foto} alt={`${item.sku} foto ${i + 1}`} className="w-full aspect-[4/3] object-cover" />
                            {item.fotos.length > 1 && (
                              <span className="absolute top-2 left-2 text-[11px] font-black rounded-md bg-slate-900/75 text-white px-1.5 py-0.5">
                                {i + 1}/{item.fotos.length}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              {inspection.retornoPallet && (
                <div className="rounded-2xl border-2 border-amber-400 overflow-hidden">
                  <div className="px-3 py-2 bg-amber-50 border-b border-amber-300 text-sm font-black text-slate-800">
                    Retorno de pallets • {resumoRetornoPallet(inspection.retornoPallet)}
                  </div>
                  {(inspection.retornoPallet.fotoPallets || inspection.retornoPallet.fotoControle) && (
                    <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        { src: inspection.retornoPallet.fotoPallets, titulo: 'Pallets retornados' },
                        { src: inspection.retornoPallet.fotoControle, titulo: 'Controle de Recebimento' },
                      ]
                        .filter((x) => x.src)
                        .map((x) => (
                          <button
                            key={x.titulo}
                            type="button"
                            onClick={() => setFotoAmpliada({ src: x.src as string, titulo: x.titulo })}
                            className="relative rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 transition-colors"
                          >
                            <img src={x.src} alt={x.titulo} className="w-full aspect-[4/3] object-cover" />
                            <span className="absolute top-2 left-2 text-[11px] font-black rounded-md bg-slate-900/75 text-white px-1.5 py-0.5">
                              {x.titulo}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              )}
              {inspection.fotosGerais?.length > 0 && (
                <div className="rounded-2xl border-2 border-slate-400 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-300 text-sm font-black text-slate-800">
                    Fotos gerais da carga • {inspection.fotosGerais.length}
                  </div>
                  <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {inspection.fotosGerais.map((foto, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setFotoAmpliada({ src: foto, titulo: `Foto geral ${i + 1}` })}
                        className="rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 transition-colors"
                      >
                        <img src={foto} alt={`Foto geral ${i + 1}`} className="w-full aspect-[4/3] object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(inspection.fotoVeiculoFim || inspection.fotoLacre) && (
                <div className="rounded-2xl border-2 border-slate-400 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-300 text-sm font-black text-slate-800">
                    Fechamento • Lacre {inspection.numeroLacre || '—'}
                  </div>
                  <div className="p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { src: inspection.fotoVeiculoFim, titulo: 'Final da carga' },
                      { src: inspection.fotoLacre, titulo: `Lacre ${inspection.numeroLacre || ''}`.trim() },
                    ]
                      .filter((x) => x.src)
                      .map((x) => (
                        <button
                          key={x.titulo}
                          type="button"
                          onClick={() => setFotoAmpliada({ src: x.src as string, titulo: x.titulo })}
                          className="relative rounded-xl overflow-hidden border border-slate-200 hover:border-amber-400 transition-colors"
                        >
                          <img src={x.src} alt={x.titulo} className="w-full aspect-[4/3] object-cover" />
                          <span className="absolute top-2 left-2 text-[11px] font-black rounded-md bg-slate-900/75 text-white px-1.5 py-0.5">
                            {x.titulo}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
            {fotoAmpliada && (
              <div
                className="fixed inset-0 z-[60] bg-slate-950/90 flex flex-col items-center justify-center p-4"
                onClick={() => setFotoAmpliada(null)}
              >
                <img src={fotoAmpliada.src} alt={fotoAmpliada.titulo} className="max-w-full max-h-[80vh] rounded-xl object-contain" />
                <p className="mt-3 text-sm font-bold text-white text-center">{fotoAmpliada.titulo}</p>
                <button
                  type="button"
                  onClick={() => setFotoAmpliada(null)}
                  className="mt-3 h-11 px-6 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold"
                >
                  Fechar foto
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs sm:text-sm font-semibold"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center space-x-2 shadow-md shadow-blue-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Book de Carregamento (PDF)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
