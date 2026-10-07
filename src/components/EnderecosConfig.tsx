import React, { useState } from 'react';
import { Warehouse, Plus, Pencil, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import {
  armazemStorage,
  ocupacao,
  CAPACIDADE_ENDERECO,
  EnderecoConfig,
  EstoqueArmazem,
  RuaConfig,
  todosEnderecos,
} from '../services/armazem';

// Configurações > Endereços: cadastro das ruas e endereços da Armazenagem (código e capacidade em pallets)
export const EnderecosConfig: React.FC = () => {
  const [layout, setLayout] = useState<RuaConfig[]>(() => armazemStorage.getLayout());
  const [estoque, setEstoque] = useState<EstoqueArmazem>(() => armazemStorage.getEstoque());
  const [ruaSel, setRuaSel] = useState(() => layout[0]?.nome || '');
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  // Nova rua
  const [novaRuaAberta, setNovaRuaAberta] = useState(false);
  const [nrNome, setNrNome] = useState('');
  const [nrQtd, setNrQtd] = useState(24);
  const [nrCap, setNrCap] = useState(CAPACIDADE_ENDERECO);

  // Novo endereço / edição
  const [novoCod, setNovoCod] = useState('');
  const [novoCap, setNovoCap] = useState(CAPACIDADE_ENDERECO);
  const [editCod, setEditCod] = useState<string | null>(null);
  const [editNovoCod, setEditNovoCod] = useState('');
  const [editCap, setEditCap] = useState(CAPACIDADE_ENDERECO);
  const [excluirCod, setExcluirCod] = useState<string | null>(null);
  const [excluirRua, setExcluirRua] = useState(false);

  const rua = layout.find((r) => r.nome === ruaSel);
  const codigosEmUso = new Set(todosEnderecos(layout).map((e) => e.codigo));
  const oc = (cod: string) => ocupacao(estoque[cod]);

  const salvar = (novo: RuaConfig[], texto: string) => {
    setLayout(novo);
    armazemStorage.saveLayout(novo);
    setMsg({ ok: true, texto });
  };
  const erro = (texto: string) => setMsg({ ok: false, texto });

  // Próximo código livre da rua (ex.: A25)
  const sugerirCodigo = (r: RuaConfig | undefined) => {
    if (!r) return '';
    let n = r.enderecos.length + 1;
    while (codigosEmUso.has(`${r.nome}${String(n).padStart(2, '0')}`)) n++;
    return `${r.nome}${String(n).padStart(2, '0')}`;
  };

  const criarRua = () => {
    const nome = nrNome.trim().toUpperCase().replace(/\s+/g, '');
    if (!nome) return erro('Informe o nome da rua (ex.: J).');
    if (layout.some((r) => r.nome === nome)) return erro(`A rua ${nome} já existe.`);
    if (nrQtd < 1 || nrQtd > 999) return erro('Quantidade de endereços deve ser entre 1 e 999.');
    if (nrCap < 1) return erro('Capacidade deve ser de pelo menos 1 pallet.');
    const enderecos: EnderecoConfig[] = Array.from({ length: nrQtd }, (_, i) => ({
      codigo: `${nome}${String(i + 1).padStart(2, '0')}`,
      capacidade: nrCap,
    }));
    const repetido = enderecos.find((e) => codigosEmUso.has(e.codigo));
    if (repetido) return erro(`O endereço ${repetido.codigo} já existe em outra rua.`);
    salvar([...layout, { nome, enderecos }], `Rua ${nome} criada com ${nrQtd} endereço(s) de ${nrCap} pallets.`);
    setRuaSel(nome);
    setNovaRuaAberta(false);
    setNrNome('');
  };

  const removerRua = () => {
    if (!rua) return;
    const ocupados = rua.enderecos.filter((e) => oc(e.codigo) > 0);
    if (ocupados.length) {
      setExcluirRua(false);
      return erro(`Não é possível excluir a rua ${rua.nome}: ${ocupados.length} endereço(s) com estoque.`);
    }
    const novo = layout.filter((r) => r.nome !== rua.nome);
    salvar(novo, `Rua ${rua.nome} excluída.`);
    setRuaSel(novo[0]?.nome || '');
    setExcluirRua(false);
  };

  const adicionarEndereco = () => {
    if (!rua) return;
    const codigo = (novoCod || sugerirCodigo(rua)).trim().toUpperCase().replace(/\s+/g, '');
    if (!codigo) return erro('Informe o código do endereço.');
    if (codigosEmUso.has(codigo)) return erro(`O endereço ${codigo} já existe.`);
    if (novoCap < 1) return erro('Capacidade deve ser de pelo menos 1 pallet.');
    salvar(
      layout.map((r) => (r.nome === rua.nome ? { ...r, enderecos: [...r.enderecos, { codigo, capacidade: novoCap }] } : r)),
      `Endereço ${codigo} adicionado na rua ${rua.nome}.`
    );
    setNovoCod('');
  };

  const iniciarEdicao = (e: EnderecoConfig) => {
    setEditCod(e.codigo);
    setEditNovoCod(e.codigo);
    setEditCap(e.capacidade);
    setExcluirCod(null);
  };

  // Salva a edição; se o código mudou, o estoque do endereço vai junto para o novo código
  const salvarEdicao = () => {
    if (!rua || !editCod) return;
    const codigo = editNovoCod.trim().toUpperCase().replace(/\s+/g, '');
    if (!codigo) return erro('Informe o código do endereço.');
    if (codigo !== editCod && codigosEmUso.has(codigo)) return erro(`O endereço ${codigo} já existe.`);
    if (editCap < 1) return erro('Capacidade deve ser de pelo menos 1 pallet.');
    if (editCap < oc(editCod)) return erro(`O endereço tem ${oc(editCod)} pallet(s): a capacidade não pode ficar abaixo disso.`);
    if (codigo !== editCod && estoque[editCod]) {
      const novoEstoque = { ...estoque, [codigo]: estoque[editCod] };
      delete novoEstoque[editCod];
      setEstoque(novoEstoque);
      armazemStorage.saveEstoque(novoEstoque);
    }
    salvar(
      layout.map((r) =>
        r.nome === rua.nome
          ? { ...r, enderecos: r.enderecos.map((e) => (e.codigo === editCod ? { codigo, capacidade: editCap } : e)) }
          : r
      ),
      codigo !== editCod
        ? `Endereço ${editCod} renomeado para ${codigo}${estoque[editCod] ? ' (estoque transferido)' : ''}.`
        : `Endereço ${codigo} atualizado.`
    );
    setEditCod(null);
  };

  const excluirEndereco = (cod: string) => {
    if (!rua) return;
    if (oc(cod) > 0) {
      setExcluirCod(null);
      return erro(`O endereço ${cod} tem ${oc(cod)} pallet(s) em estoque. Esvazie-o na Armazenagem antes de excluir.`);
    }
    salvar(
      layout.map((r) => (r.nome === rua.nome ? { ...r, enderecos: r.enderecos.filter((e) => e.codigo !== cod) } : r)),
      `Endereço ${cod} excluído.`
    );
    setExcluirCod(null);
  };

  const inputCls =
    'h-11 px-3 bg-white border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-indigo-500';
  const btnIcon = 'w-9 h-9 rounded-lg border flex items-center justify-center transition-colors';

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <Warehouse className="w-5 h-5 text-indigo-600" />
            Endereços de Armazenagem
          </h3>
          <p className="text-xs text-slate-500">
            Ruas e endereços usados no Mapa de Estoque e na Separação. {layout.length} rua(s),{' '}
            {todosEnderecos(layout).length} endereço(s).
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNovaRuaAberta((v) => !v);
            setMsg(null);
          }}
          className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 self-start"
        >
          <Plus className="w-4 h-4" />
          Nova Rua
        </button>
      </div>

      {msg && (
        <div
          className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            msg.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {msg.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span className="flex-1">{msg.texto}</span>
          <button type="button" onClick={() => setMsg(null)} className="opacity-60 hover:opacity-100" aria-label="Fechar aviso">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Nova rua */}
      {novaRuaAberta && (
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <label className="block">
            <span className="text-xs font-bold text-slate-700">Nome da rua</span>
            <input value={nrNome} onChange={(e) => setNrNome(e.target.value.toUpperCase())} placeholder="Ex.: J" className={`mt-1 w-full ${inputCls}`} />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-700">Qtde de endereços</span>
            <input type="number" min={1} value={nrQtd} onChange={(e) => setNrQtd(Number(e.target.value) || 0)} className={`mt-1 w-full ${inputCls}`} />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-700">Capacidade (pallets)</span>
            <input type="number" min={1} value={nrCap} onChange={(e) => setNrCap(Number(e.target.value) || 0)} className={`mt-1 w-full ${inputCls}`} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={criarRua} className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">
              Criar rua
            </button>
            <button type="button" onClick={() => setNovaRuaAberta(false)} className="h-11 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold">
              Cancelar
            </button>
          </div>
          {nrNome && nrQtd > 0 && (
            <p className="sm:col-span-4 text-xs text-indigo-800">
              Serão criados {nrNome.trim().toUpperCase()}01 a {nrNome.trim().toUpperCase()}
              {String(nrQtd).padStart(2, '0')}.
            </p>
          )}
        </div>
      )}

      {/* Ruas */}
      <div className="flex flex-wrap gap-2">
        {layout.map((r) => (
          <button
            key={r.nome}
            type="button"
            onClick={() => {
              setRuaSel(r.nome);
              setEditCod(null);
              setExcluirCod(null);
              setExcluirRua(false);
            }}
            className={`h-11 min-w-12 px-3 rounded-xl border text-sm font-bold flex items-center gap-1.5 ${
              ruaSel === r.nome ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {r.nome}
            <span className={`text-[10px] font-black rounded-full px-1.5 ${ruaSel === r.nome ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
              {r.enderecos.length}
            </span>
          </button>
        ))}
      </div>

      {rua ? (
        <>
          {/* Novo endereço na rua */}
          <div className="flex flex-wrap items-end gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Novo endereço na rua {rua.nome}</span>
              <input
                value={novoCod}
                onChange={(e) => setNovoCod(e.target.value.toUpperCase())}
                placeholder={sugerirCodigo(rua)}
                className={`mt-1 w-32 font-mono ${inputCls}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-700">Capacidade</span>
              <input type="number" min={1} value={novoCap} onChange={(e) => setNovoCap(Number(e.target.value) || 0)} className={`mt-1 w-24 ${inputCls}`} />
            </label>
            <button
              type="button"
              onClick={adicionarEndereco}
              className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Adicionar endereço
            </button>
            <div className="ml-auto">
              {excluirRua ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-rose-700">Excluir a rua {rua.nome}?</span>
                  <button type="button" onClick={removerRua} className="h-9 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">
                    Sim
                  </button>
                  <button type="button" onClick={() => setExcluirRua(false)} className="h-9 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setExcluirRua(true)}
                  className="h-11 px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir rua
                </button>
              )}
            </div>
          </div>

          {/* Endereços da rua */}
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">Endereço</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Capacidade (pallets)</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Ocupado</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rua.enderecos.map((e) => (
                  <tr key={e.codigo} className={editCod === e.codigo ? 'bg-amber-50' : 'hover:bg-slate-50'}>
                    {editCod === e.codigo ? (
                      <>
                        <td className="px-3 py-2">
                          <input value={editNovoCod} onChange={(ev) => setEditNovoCod(ev.target.value.toUpperCase())} className={`w-28 font-mono ${inputCls}`} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min={1} value={editCap} onChange={(ev) => setEditCap(Number(ev.target.value) || 0)} className={`w-24 ${inputCls}`} />
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-600">{oc(e.codigo)}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1.5">
                            <button type="button" onClick={salvarEdicao} className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                              Salvar
                            </button>
                            <button type="button" onClick={() => setEditCod(null)} className="h-9 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">
                              Cancelar
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2.5 font-mono font-black text-indigo-700">{e.codigo}</td>
                        <td className="px-3 py-2.5">{e.capacidade}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-600">
                          {oc(e.codigo)} <span className="text-slate-400">({Math.round((oc(e.codigo) / e.capacidade) * 100)}%)</span>
                        </td>
                        <td className="px-3 py-2">
                          {excluirCod === e.codigo ? (
                            <div className="flex justify-end items-center gap-1.5 whitespace-nowrap">
                              <span className="text-xs font-bold text-rose-700">Excluir?</span>
                              <button type="button" onClick={() => excluirEndereco(e.codigo)} className="h-9 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">
                                Sim
                              </button>
                              <button type="button" onClick={() => setExcluirCod(null)} className="h-9 px-3 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold">
                                Não
                              </button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => iniciarEdicao(e)}
                                className={`${btnIcon} border-slate-200 text-slate-600 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50`}
                                title="Editar"
                                aria-label={`Editar ${e.codigo}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setExcluirCod(e.codigo);
                                  setEditCod(null);
                                }}
                                className={`${btnIcon} border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50`}
                                title="Excluir"
                                aria-label={`Excluir ${e.codigo}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {rua.enderecos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                      Nenhum endereço nesta rua.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="p-4 text-center text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-2xl">
          Nenhuma rua cadastrada. Use "Nova Rua" para começar.
        </p>
      )}
    </div>
  );
};
