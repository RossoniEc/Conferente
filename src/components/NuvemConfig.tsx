import React, { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, KeyRound, LogOut, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { conectarNuvem, desconectarNuvem, sincronizarAgora } from '../services/nuvem';
import { useStatusNuvem } from '../services/useNuvem';

const TEXTO: Record<string, { titulo: string; cor: string }> = {
  verificando: { titulo: 'Verificando conexão…', cor: 'bg-slate-100 text-slate-700 border-slate-200' },
  indisponivel: { titulo: 'Nuvem indisponível', cor: 'bg-amber-50 text-amber-900 border-amber-300' },
  desconectado: { titulo: 'Aparelho não conectado', cor: 'bg-slate-100 text-slate-800 border-slate-300' },
  sincronizando: { titulo: 'Sincronizando…', cor: 'bg-sky-50 text-sky-900 border-sky-300' },
  ok: { titulo: 'Conectado e sincronizado', cor: 'bg-emerald-50 text-emerald-900 border-emerald-300' },
  erro: { titulo: 'Erro na sincronização', cor: 'bg-rose-50 text-rose-900 border-rose-300' },
};

// Configurações > Nuvem: conecta o aparelho ao banco do Cloudflare com a chave de acesso
export const NuvemConfig: React.FC = () => {
  const st = useStatusNuvem();
  const [chave, setChave] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const conectado = st.estado === 'ok' || st.estado === 'sincronizando' || st.estado === 'erro';
  const t = TEXTO[st.estado];

  const conectar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      await conectarNuvem(chave.trim());
      setChave('');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <Cloud className="w-5 h-5 text-sky-600" />
          Banco de dados na nuvem (Cloudflare)
        </h3>
        <p className="text-xs text-slate-500">
          Cargas, estoque, endereços, separação, histórico, De/Para, configurações e fotos ficam compartilhados entre os
          aparelhos conectados. Sem internet o app continua funcionando e envia tudo quando a conexão voltar.
        </p>
      </div>

      <div className={`p-3 rounded-xl border flex items-start gap-3 ${t.cor}`}>
        {st.estado === 'sincronizando' || st.estado === 'verificando' ? (
          <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
        ) : st.estado === 'ok' ? (
          <CheckCircle2 className="w-5 h-5 shrink-0" />
        ) : st.estado === 'desconectado' ? (
          <CloudOff className="w-5 h-5 shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 shrink-0" />
        )}
        <div className="min-w-0 text-sm">
          <p className="font-black">{t.titulo}</p>
          {st.mensagem && <p>{st.mensagem}</p>}
          <p className="text-xs opacity-80">
            {st.ultimaSync
              ? `Última sincronização: ${new Date(st.ultimaSync).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}`
              : 'Ainda não sincronizado neste aparelho.'}
            {st.pendentes > 0 ? ` • ${st.pendentes} alteração(ões) aguardando envio` : ''}
          </p>
        </div>
      </div>

      {conectado ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => sincronizarAgora()}
            disabled={st.estado === 'sincronizando'}
            className="h-12 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-black flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 ${st.estado === 'sincronizando' ? 'animate-spin' : ''}`} />
            Sincronizar agora
          </button>
          <button
            type="button"
            onClick={() => desconectarNuvem()}
            className="h-12 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            Desconectar este aparelho
          </button>
        </div>
      ) : (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (chave.trim()) conectar();
          }}
        >
          <label htmlFor="nuvem-chave" className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-slate-500" />
            Chave de acesso
          </label>
          <div className="flex gap-2">
            <input
              id="nuvem-chave"
              type="password"
              autoComplete="off"
              value={chave}
              onChange={(e) => setChave(e.target.value)}
              placeholder="Digite a chave de acesso"
              className="flex-1 min-w-0 h-12 px-3 bg-slate-50 border border-slate-300 rounded-xl text-base focus:outline-none focus:border-sky-500 focus:bg-white"
            />
            <button
              type="submit"
              disabled={!chave.trim() || enviando || st.estado === 'indisponivel'}
              className="shrink-0 h-12 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-black flex items-center gap-2"
            >
              {enviando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Cloud className="w-5 h-5" />}
              Conectar
            </button>
          </div>
          {erro && <p className="text-sm font-semibold text-rose-700">{erro}</p>}
          <p className="text-[11px] text-slate-500">
            A chave é digitada uma vez por aparelho. Na primeira conexão, os dados da nuvem prevalecem sobre os deste
            aparelho; o que existir só aqui é enviado.
          </p>
        </form>
      )}
    </div>
  );
};
