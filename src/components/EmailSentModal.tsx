import React from 'react';
import { Mail, CheckCircle2, Download, FileText, X, AlertTriangle } from 'lucide-react';
import { CargoInspection } from '../types';
import { generateBookCarregamentoPdf } from '../services/pdfGenerator';

interface EmailSentModalProps {
  type: 'carga' | 'faturamento';
  inspection: CargoInspection;
  recipients: string[];
  onClose: () => void;
  empresaNome?: string;
}

export const EmailSentModal: React.FC<EmailSentModalProps> = ({
  type,
  inspection,
  recipients,
  onClose,
  empresaNome = 'LOGÍSTICA & DISTRIBUIÇÃO NACIONAL LTDA',
}) => {
  const isCarga = type === 'carga';

  // Calculate stats
  let totalPlan = 0;
  let totalCarreg = 0;
  inspection.itensPlanejados.forEach((i) => (totalPlan += i.quantidadePlanejada));
  inspection.itensConferidos.forEach((i) => (totalCarreg += i.quantidadeCarregada));

  const dif = totalCarreg - totalPlan;
  const isOk = dif === 0;

  const handleDownloadPdf = () => {
    const { doc, filename } = generateBookCarregamentoPdf(inspection, empresaNome);
    doc.save(filename);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">E-mail Disparado com Sucesso!</h3>
              <p className="text-xs text-slate-300">
                {isCarga ? 'Book de Carregamento & Relatório' : 'Conferência de Faturamento x Carga'}
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

        {/* Email Preview Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-slate-700 text-xs sm:text-sm">
          {/* Metadata */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <div className="flex items-start">
              <span className="w-24 font-bold text-slate-500 text-xs">Para (Grupo):</span>
              <div className="flex-1 flex flex-wrap gap-1">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono text-[11px]"
                  >
                    {email}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center">
              <span className="w-24 font-bold text-slate-500 text-xs">Assunto:</span>
              <span className="font-bold text-slate-800 text-xs">
                {isCarga
                  ? `[CARGACHECK] Book de Carregamento Concluído - DT: ${inspection.dt} | Placa: ${inspection.placa}`
                  : `[CARGACHECK] Faturamento Conferido - DT: ${inspection.dt} | NFe: ${inspection.faturamento?.chaveNFe?.substring(25, 34) || 'OK'}`}
              </span>
            </div>

            <div className="flex items-center">
              <span className="w-24 font-bold text-slate-500 text-xs">Data/Hora:</span>
              <span className="text-slate-600 text-xs">{new Date().toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Email Content Summary Card */}
          <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-bold text-slate-900">Resumo da Operação</span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  isOk ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isOk ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                {isOk ? '100% CONFORME' : `DIVERGÊNCIA (${dif > 0 ? `+${dif}` : dif})`}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block">DT:</span>
                <span className="font-bold text-slate-800 font-mono">{inspection.dt}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Placa do Veículo:</span>
                <span className="font-bold text-slate-800 font-mono">{inspection.placa}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Nº Lacre:</span>
                <span className="font-bold text-slate-800">{inspection.numeroLacre || 'Sem lacre'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Conferente:</span>
                <span className="font-bold text-slate-800">{inspection.conferente}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Planejado:</span>
                <span className="font-bold text-slate-800">{totalPlan} vol.</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Carregado:</span>
                <span className="font-bold text-emerald-700 font-bold">{totalCarreg} vol.</span>
              </div>
            </div>

            {/* Attached PDF badge */}
            <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-rose-500" />
                <div>
                  <p className="font-bold text-xs text-slate-800">
                    Book_Carregamento_{inspection.dt}_{inspection.placa}.pdf
                  </p>
                  <p className="text-[10px] text-slate-500">Documento com fotos, lotes e assinaturas (Anexo)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex space-x-3 justify-end">
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold rounded-xl text-xs sm:text-sm flex items-center space-x-2"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Baixar Book (PDF)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
