import React, { useMemo, useRef, useState } from 'react';
import { Warehouse, Download, Search, X, Minus, Plus, Pencil, Lightbulb, MapPin, PackageOpen, ChevronDown, CheckCircle2, CalendarDays, Layers, ArrowRight, Camera } from 'lucide-react';
import { BarcodeCameraScanner } from './BarcodeCameraScanner';
import { ProductDePara } from '../types';
import {
  CAPACIDADE_ENDERECO,
  capacidadeDe,
  EstoqueArmazem,
  ItemEndereco,
  armazemStorage,
  ocupacao,
  formatarData,
} from '../services/armazem';
import { localIsoDate } from '../services/sheetDt';
import { playBeep } from '../services/sound';

interface StorageScreenProps {
  deParaList: ProductDePara[];
  soundEnabled: boolean;
}

// Tela de Armazenagem: mapa de estoque por endereço e sugestões de otimização
export const StorageScreen: React.FC<StorageScreenProps> = ({ deParaList, soundEnabled }) => {
  const [aba, setAba] = useState<'mapa' | 'otimizacao'>('mapa');
  const [estoque, setEstoque] = useState<EstoqueArmazem>(() => armazemStorage.getEstoque());
  // Layout do armazém (Configurações > Endereços): ruas, endereços e capacidade de cada um
  const [layout] = useState(() => armazemStorage.getLayout());
  const RUAS_L = layout.map((r) => r.nome);
  const endsDaRua = (r: string) => layout.find((x) => x.nome === r)?.enderecos.map((e) => e.codigo) || [];
  const cap = (cod: string) => capacidadeDe(layout, cod);
  const ruaDe = (cod: string) => layout.find((r) => r.enderecos.some((e) => e.codigo === cod))?.nome || '';
  const [rua, setRua] = useState(() => (RUAS_L.includes('A') ? 'A' : RUAS_L[0] || ''));
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);

  // Modal "Configurar Endereço"
  const [endereco, setEndereco] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<ItemEndereco[]>([]);
  const [skuInput, setSkuInput] = useState('');
  const [loteInput, setLoteInput] = useState('');
  // Data de entrada do item (padrão: hoje) — a Separação sugere sempre a mais antiga
  const [dataInput, setDataInput] = useState(localIsoDate());
  const dataRef = useRef<HTMLInputElement | null>(null);
  const [qtdInput, setQtdInput] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  // Lista de sugestões do campo SKU
  const [skuAberto, setSkuAberto] = useState(false);
  const [skuAtivo, setSkuAtivo] = useState(0);
  const termoSku = skuInput.split(' — ')[0].trim().toLowerCase();
  const sugestoesSku = deParaList
    .filter((p) => !termoSku || p.sku.toLowerCase().includes(termoSku) || p.descricao.toLowerCase().includes(termoSku))
    .slice(0, 30);
  // Leitura pela câmera: localiza o produto pelo EAN (ou SKU) no De/Para
  const [cameraAberta, setCameraAberta] = useState(false);
  const lerCodigoCamera = (texto: string) => {
    setCameraAberta(false);
    const codigo = texto.trim().toUpperCase();
    const digitos = codigo.replace(/\D/g, '');
    const p =
      deParaList.find((x) => digitos && x.ean.replace(/\D/g, '') === digitos) ||
      deParaList.find((x) => x.sku.toUpperCase() === codigo);
    if (p) {
      escolherSku(p);
      setErro(null);
      playBeep('success', soundEnabled);
      setTimeout(() => document.getElementById('armazem-lote')?.focus(), 50);
    } else {
      setSkuInput('');
      setErro(`Código ${codigo} não encontrado na tabela De/Para. Cadastre o EAN em Configuração.`);
      playBeep('error', soundEnabled);
    }
  };
  const escolherSku = (p: ProductDePara) => {
    setSkuInput(`${p.sku} — ${p.descricao}`);
    setSkuAberto(false);
  };

  // Índice do item em edição no endereço (null = incluindo item novo)
  const [editIdx, setEditIdx] = useState<number | null>(null);

  const salvarEstoque = (novo: EstoqueArmazem) => {
    setEstoque(novo);
    armazemStorage.saveEstoque(novo);
  };

  const descricaoSku = (sku: string) => deParaList.find((p) => p.sku.toUpperCase() === sku.toUpperCase())?.descricao;

  // Pesquisa por SKU ou lote: mostra os endereços de todas as ruas que contêm o termo
  const termo = busca.trim().toUpperCase();
  const enderecosVisiveis = useMemo(() => {
    if (!termo) return endsDaRua(rua);
    return RUAS_L.flatMap(endsDaRua).filter((cod) =>
      (estoque[cod] || []).some((i) => i.sku.toUpperCase().includes(termo) || i.lote.toUpperCase().includes(termo))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, rua, estoque, layout]);

  const abrirEndereco = (cod: string) => {
    setEndereco(cod);
    setRascunho([...(estoque[cod] || [])]);
    setSkuInput('');
    setLoteInput('');
    setDataInput(localIsoDate());
    setQtdInput(1);
    setErro(null);
    setEditIdx(null);
    setSalvoMsg(null);
  };

  const ocupadoRascunho = ocupacao(rascunho);

  // Editar: carrega o item no formulário; ao salvar, substitui (quantidade 0 remove o item)
  const editarItem = (idx: number) => {
    const i = rascunho[idx];
    setEditIdx(idx);
    setSkuInput(i.descricao || descricaoSku(i.sku) ? `${i.sku} — ${i.descricao || descricaoSku(i.sku)}` : i.sku);
    setLoteInput(i.lote);
    setDataInput(i.data || localIsoDate());
    setQtdInput(i.quantidade);
    setErro(null);
  };
  const cancelarEdicao = () => {
    setEditIdx(null);
    setSkuInput('');
    setLoteInput('');
    setDataInput(localIsoDate());
    setQtdInput(1);
    setErro(null);
  };

  const adicionarItem = () => {
    const sku = skuInput.split(' — ')[0].trim().toUpperCase();
    const lote = loteInput.trim().toUpperCase();
    const data = dataInput || undefined;
    if (editIdx !== null && qtdInput <= 0) {
      const retirado = rascunho[editIdx];
      gravarEndereco(
        rascunho.filter((_, k) => k !== editIdx),
        `${retirado.sku} / lote ${retirado.lote} retirado do endereço.`
      );
      cancelarEdicao();
      playBeep('warning', soundEnabled);
      return;
    }
    if (!sku || !lote || qtdInput <= 0 || !data) {
      setErro('Informe SKU, lote, data de entrada e quantidade.');
      playBeep('error', soundEnabled);
      return;
    }
    const base = editIdx !== null ? rascunho.filter((_, k) => k !== editIdx) : rascunho;
    const capEnd = endereco ? cap(endereco) : CAPACIDADE_ENDERECO;
    if (ocupacao(base) + qtdInput > capEnd) {
      setErro(`Capacidade excedida: o endereço comporta ${capEnd} pallets (livre: ${capEnd - ocupacao(base)}).`);
      playBeep('error', soundEnabled);
      return;
    }
    // Mesmo SKU + lote + data no endereço: soma a quantidade (datas diferentes ficam separadas para o FIFO)
    const novo = [...base];
    const idx = novo.findIndex((i) => i.sku === sku && i.lote === lote && (i.data || '') === (data || ''));
    if (editIdx !== null) {
      // Edição: grava no lugar do item (se virou um SKU/lote que já existe, soma com ele)
      if (idx >= 0) novo[idx] = { ...novo[idx], quantidade: novo[idx].quantidade + qtdInput };
      else novo.splice(editIdx, 0, { sku, lote, quantidade: qtdInput, descricao: descricaoSku(sku), data });
    } else if (idx >= 0) novo[idx] = { ...novo[idx], quantidade: novo[idx].quantidade + qtdInput };
    else novo.push({ sku, lote, quantidade: qtdInput, descricao: descricaoSku(sku), data });
    gravarEndereco(
      novo,
      `${sku} / lote ${lote}: ${editIdx !== null ? 'alteração salva' : `${qtdInput} pallet(s) adicionado(s)`} no estoque.`
    );
    setSkuInput('');
    setLoteInput('');
    setDataInput(localIsoDate());
    setQtdInput(1);
    setErro(null);
    setEditIdx(null);
    playBeep('scan', soundEnabled);
  };

  // Grava os itens do endereço direto no estoque (ADICIONAR / SALVAR ALTERAÇÃO / RETIRAR já salvam)
  const [salvoMsg, setSalvoMsg] = useState<string | null>(null);
  const gravarEndereco = (itens: ItemEndereco[], msg: string) => {
    if (!endereco) return;
    setRascunho(itens);
    const novo = { ...estoque };
    if (itens.length) novo[endereco] = itens;
    else delete novo[endereco];
    salvarEstoque(novo);
    setSalvoMsg(msg);
  };

  // Exporta o estoque (um item por linha) para Excel
  const exportarExcel = async () => {
    setExportando(true);
    try {
      const { default: writeXlsxFile } = await import('write-excel-file/browser');
      const h = (value: string) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E2E8F0' });
      const linhas: (string | number | { value: string; fontWeight: 'bold'; backgroundColor: string })[][] = [
        [h('Endereço'), h('Rua'), h('SKU'), h('Descrição'), h('Lote'), h('Data de entrada'), h('Pallets'), h('Ocupação do endereço')],
      ];
      RUAS_L.flatMap(endsDaRua).forEach((cod) => {
        const itens = estoque[cod] || [];
        const pct = `${Math.round((ocupacao(itens) / cap(cod)) * 100)}%`;
        if (!itens.length) linhas.push([cod, ruaDe(cod), '', '', '', '', 0, '0%']);
        itens.forEach((i) =>
          linhas.push([cod, ruaDe(cod), i.sku, i.descricao || descricaoSku(i.sku) || '', i.lote, i.data ? formatarData(i.data) : '', i.quantidade, pct])
        );
      });
      const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      await writeXlsxFile(linhas, {
        columns: [12, 6, 14, 40, 14, 14, 9, 20].map((width) => ({ width })),
        stickyRowsCount: 1,
      }).toFile(`Armazenagem_${hoje}.xlsx`);
    } finally {
      setExportando(false);
    }
  };

  // ---------- Otimização de endereços ----------
  const resumoRuas = RUAS_L.map((r) => {
    const ends = endsDaRua(r);
    const ocupado = ends.reduce((a, cod) => a + ocupacao(estoque[cod]), 0);
    const livres = ends.filter((cod) => !(estoque[cod] || []).length).length;
    return { rua: r, ocupado, capacidade: ends.reduce((a, cod) => a + cap(cod), 0) || 1, livres };
  });

  const sugestoes = useMemo(() => {
    const lista: { tipo: 'consolidar' | 'baixa'; texto: string }[] = [];
    // SKU + lote espalhado em vários endereços: consolidar onde já há mais pallets, se couber
    const porSkuLote = new Map<string, { endereco: string; qtd: number }[]>();
    Object.entries(estoque).forEach(([cod, itens]) =>
      itens.forEach((i) => {
        const k = `${i.sku}|${i.lote}`;
        porSkuLote.set(k, [...(porSkuLote.get(k) || []), { endereco: cod, qtd: i.quantidade }]);
      })
    );
    porSkuLote.forEach((locais, k) => {
      if (locais.length < 2) return;
      const [sku, lote] = k.split('|');
      const destino = [...locais].sort((a, b) => b.qtd - a.qtd)[0];
      const mover = locais.filter((l) => l.endereco !== destino.endereco);
      const qtdMover = mover.reduce((a, l) => a + l.qtd, 0);
      const livreDestino = cap(destino.endereco) - ocupacao(estoque[destino.endereco]);
      if (qtdMover <= livreDestino) {
        lista.push({
          tipo: 'consolidar',
          texto: `SKU ${sku} lote ${lote}: mover ${qtdMover} pallet(s) de ${mover.map((m) => m.endereco).join(', ')} para ${destino.endereco} e liberar ${mover.length} endereço(s).`,
        });
      }
    });
    // Endereços com baixa ocupação (até 10%): candidatos a esvaziar
    Object.entries(estoque).forEach(([cod, itens]) => {
      const oc = ocupacao(itens);
      if (oc > 0 && oc <= cap(cod) * 0.1) {
        lista.push({
          tipo: 'baixa',
          texto: `${cod} está com ${oc} pallet(s) (${Math.round((oc / cap(cod)) * 100)}% da capacidade): avalie remanejar e liberar o endereço.`,
        });
      }
    });
    return lista;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estoque, layout]);

  const totalPallets = Object.values(estoque).reduce((a, itens) => a + ocupacao(itens), 0);
  // Resumo do armazém: posições ocupadas/vazias e pallets armazenados/disponíveis
  const todasPosicoes = RUAS_L.flatMap(endsDaRua);
  const posicoesOcupadas = todasPosicoes.filter((cod) => (estoque[cod] || []).length > 0).length;
  const posicoesVazias = todasPosicoes.length - posicoesOcupadas;
  const capacidadeTotal = todasPosicoes.reduce((a, cod) => a + cap(cod), 0);
  const palletsArmazenados = todasPosicoes.reduce((a, cod) => a + ocupacao(estoque[cod]), 0);
  const palletsDisponiveis = Math.max(0, capacidadeTotal - palletsArmazenados);
  const pctOcupacaoPallet = capacidadeTotal ? Math.round((palletsArmazenados / capacidadeTotal) * 1000) / 10 : 0;

  // ---------- Agrupamento por SKU: o mesmo SKU no menor número de endereços ----------
  type Movimento = { de: string; para: string; lote: string; data?: string; quantidade: number };
  type PlanoSku = {
    sku: string;
    descricao?: string;
    total: number;
    locais: { endereco: string; qtd: number }[];
    destino?: string;
    destinoVazio?: boolean;
    movimentos: Movimento[];
    liberados: number;
    motivo?: string;
  };
  const analiseAgrupamento = useMemo(() => {
    const porSku = new Map<string, { endereco: string; qtd: number }[]>();
    Object.entries(estoque).forEach(([cod, itens]) =>
      itens.forEach((i) => {
        const locs = porSku.get(i.sku) || [];
        const l = locs.find((x) => x.endereco === cod);
        if (l) l.qtd += i.quantidade;
        else locs.push({ endereco: cod, qtd: i.quantidade });
        porSku.set(i.sku, locs);
      })
    );
    const livre = (cod: string) => cap(cod) - ocupacao(estoque[cod]);
    const planos: PlanoSku[] = [];
    porSku.forEach((locais, sku) => {
      if (locais.length < 2) return;
      const total = locais.reduce((a, l) => a + l.qtd, 0);
      const descricao = descricaoSku(sku);
      // 1º: um endereço que já tem o SKU e comporta o restante (prioriza o que já tem mais pallets)
      const candidatos = [...locais].sort((a, b) => b.qtd - a.qtd);
      let destino = candidatos.find((c) => livre(c.endereco) >= total - c.qtd)?.endereco;
      let destinoVazio = false;
      // 2º: um endereço vazio que comporte tudo, de preferência na rua onde o SKU mais aparece
      if (!destino) {
        const ruaPrincipal = ruaDe(candidatos[0].endereco);
        const vazios = RUAS_L.flatMap(endsDaRua).filter((cod) => !(estoque[cod] || []).length && cap(cod) >= total);
        destino = vazios.find((cod) => ruaDe(cod) === ruaPrincipal) || vazios[0];
        destinoVazio = !!destino;
      }
      if (!destino) {
        planos.push({
          sku, descricao, total, locais, movimentos: [], liberados: 0,
          motivo: `Não há endereço com espaço para ${total} pallets juntos. Mínimo de ${Math.ceil(total / Math.max(...RUAS_L.flatMap(endsDaRua).map(cap)))} endereço(s).`,
        });
        return;
      }
      const movimentos: Movimento[] = [];
      locais
        .filter((l) => l.endereco !== destino)
        .forEach((l) =>
          (estoque[l.endereco] || [])
            .filter((i) => i.sku === sku)
            .forEach((i) => movimentos.push({ de: l.endereco, para: destino as string, lote: i.lote, data: i.data, quantidade: i.quantidade }))
        );
      // Endereços que ficam vazios depois de tirar o SKU
      const liberados = locais.filter(
        (l) => l.endereco !== destino && (estoque[l.endereco] || []).every((i) => i.sku === sku)
      ).length;
      planos.push({ sku, descricao, total, locais, destino, destinoVazio, movimentos, liberados });
    });
    return planos.sort((a, b) => b.locais.length - a.locais.length || b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estoque, layout]);

  const skusNoEstoque = new Set(Object.values(estoque).flatMap((itens) => itens.map((i) => i.sku))).size;
  const skusAgrupados = skusNoEstoque - analiseAgrupamento.length;
  const pctAgrupado = skusNoEstoque ? Math.round((skusAgrupados / skusNoEstoque) * 100) : 100;
  const enderecosLiberaveis = analiseAgrupamento.reduce((a, p) => a + p.liberados, 0);
  const enderecosMisturados = Object.entries(estoque).filter(([, itens]) => new Set(itens.map((i) => i.sku)).size > 1);
  const [confirmarAgrupar, setConfirmarAgrupar] = useState<string | null>(null);
  const [agrupadoMsg, setAgrupadoMsg] = useState<string | null>(null);

  // Executa as movimentações do plano: retira dos endereços de origem e soma no destino (mantém lote e data)
  const aplicarAgrupamento = (plano: PlanoSku) => {
    if (!plano.destino) return;
    const novo: EstoqueArmazem = JSON.parse(JSON.stringify(estoque));
    plano.movimentos.forEach((m) => {
      const origem = (novo[m.de] || []).filter((i) => !(i.sku === plano.sku && i.lote === m.lote && (i.data || '') === (m.data || '')));
      if (origem.length) novo[m.de] = origem;
      else delete novo[m.de];
      const destino = novo[m.para] || [];
      const idx = destino.findIndex((i) => i.sku === plano.sku && i.lote === m.lote && (i.data || '') === (m.data || ''));
      if (idx >= 0) destino[idx].quantidade += m.quantidade;
      else destino.push({ sku: plano.sku, lote: m.lote, data: m.data, quantidade: m.quantidade, descricao: plano.descricao });
      novo[m.para] = destino;
    });
    salvarEstoque(novo);
    setConfirmarAgrupar(null);
    setAgrupadoMsg(`SKU ${plano.sku} agrupado em ${plano.destino}: ${plano.movimentos.length} movimentação(ões) registrada(s).`);
    playBeep('success', soundEnabled);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-5 sm:py-6 space-y-5">
      {/* Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 block">Etapa 1 • Estoque</span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Warehouse className="w-6 h-6 text-indigo-600" />
            Armazenagem
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          {totalPallets} pallet(s) armazenado(s) • {RUAS_L.length} rua(s), {RUAS_L.flatMap(endsDaRua).length} endereço(s)
        </p>
      </div>

      {/* Abas + Exportar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-200/70 rounded-xl text-sm font-bold">
          <button
            type="button"
            onClick={() => setAba('mapa')}
            className={`h-10 px-4 rounded-lg transition-all ${aba === 'mapa' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Mapa de Estoque
          </button>
          <button
            type="button"
            onClick={() => setAba('otimizacao')}
            className={`h-10 px-4 rounded-lg transition-all ${aba === 'otimizacao' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Otimização End.
          </button>
        </div>
        <button
          type="button"
          onClick={exportarExcel}
          disabled={exportando}
          className="h-11 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold flex items-center gap-2 disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {exportando ? 'Exportando…' : 'Exportar para Excel'}
        </button>
      </div>

      {aba === 'mapa' ? (
        <>
          {/* Pesquisa */}
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por SKU ou Lote..."
              className="w-full h-12 pl-11 pr-11 bg-white border border-slate-300 rounded-xl text-base focus:outline-none focus:border-indigo-500"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 hover:text-slate-700"
                aria-label="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Ruas */}
          {!termo && (
            <div className="flex flex-wrap gap-2">
              {RUAS_L.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRua(r)}
                  className={`h-12 min-w-14 px-4 rounded-xl border text-base font-bold transition-colors ${
                    rua === r
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {termo && (
            <p className="text-sm text-slate-600">
              {enderecosVisiveis.length} endereço(s) com <strong>"{busca}"</strong>
            </p>
          )}

          {/* Endereços */}
          <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {enderecosVisiveis.map((cod) => {
              const itens = estoque[cod] || [];
              const oc = ocupacao(itens);
              const pct = Math.round((oc / cap(cod)) * 100);
              const lotes = Array.from(new Set(itens.map((i) => i.lote)));
              return (
                <button
                  key={cod}
                  type="button"
                  onClick={() => abrirEndereco(cod)}
                  className="text-left rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 active:scale-[0.98] transition-all"
                >
                  <div className={`py-3 text-center text-xl font-black text-white ${oc >= cap(cod) ? 'bg-rose-600' : 'bg-indigo-700'}`}>
                    {cod}
                  </div>
                  <div className="p-3 space-y-1 text-sm">
                    <p className="truncate">
                      <strong>SKU:</strong> {itens.length === 0 ? '-' : itens.length === 1 ? itens[0].sku : `${new Set(itens.map((i) => i.sku)).size} SKUs`}
                    </p>
                    <p className="truncate">
                      <strong>Lote:</strong> {lotes.length === 0 ? '-' : lotes.length === 1 ? lotes[0] : `${lotes.length} lotes`}
                    </p>
                    <p className={`text-xs ${oc ? 'text-slate-600' : 'text-slate-400'}`}>{oc ? `${oc} Pallets` : 'Vazio'}</p>
                    {oc > 0 && (
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${pct >= 100 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            {enderecosVisiveis.length === 0 && (
              <p className="col-span-full p-6 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-2xl">
                Nenhum endereço encontrado.
              </p>
            )}
          </div>
        </>
      ) : (
        /* ---------- Otimização de endereços ---------- */
        <div className="space-y-4">
          {/* Agrupamento por SKU */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Agrupamento por SKU
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Objetivo: cada SKU em um único endereço. Facilita a separação (menos deslocamento) e libera endereços.
              </p>
            </div>

            {/* Resumo do armazém */}
            <div className="grid grid-cols-2 min-[480px]:grid-cols-3 sm:grid-cols-5 gap-2">
              {[
                { valor: posicoesOcupadas.toLocaleString('pt-BR'), rotulo: 'Posições ocupadas', cor: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
                { valor: posicoesVazias.toLocaleString('pt-BR'), rotulo: 'Posições vazias', cor: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                { valor: palletsArmazenados.toLocaleString('pt-BR'), rotulo: 'Pallets armazenados', cor: 'bg-slate-50 border-slate-200 text-slate-800' },
                { valor: palletsDisponiveis.toLocaleString('pt-BR'), rotulo: 'Pallets disponíveis', cor: 'bg-sky-50 border-sky-200 text-sky-700' },
                {
                  valor: `${pctOcupacaoPallet.toLocaleString('pt-BR')}%`,
                  rotulo: 'Ocupação por pallet',
                  cor:
                    pctOcupacaoPallet >= 90
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : pctOcupacaoPallet >= 70
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-violet-50 border-violet-200 text-violet-700',
                },
              ].map((c) => (
                <div key={c.rotulo} className={`rounded-xl border px-2 py-1.5 text-center ${c.cor}`}>
                  <span className="block text-base font-black leading-tight">{c.valor}</span>
                  <span className="block text-[9px] font-bold uppercase leading-tight opacity-80">{c.rotulo}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                <span className={`block text-2xl font-black ${pctAgrupado >= 90 ? 'text-emerald-600' : pctAgrupado >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {pctAgrupado}%
                </span>
                <span className="text-[10px] uppercase font-semibold text-slate-500">SKUs agrupados</span>
              </div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5">
                <span className="block text-2xl font-black text-slate-900">{skusNoEstoque}</span>
                <span className="text-[10px] uppercase font-semibold text-slate-500">SKUs no estoque</span>
              </div>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5">
                <span className="block text-2xl font-black text-rose-600">{analiseAgrupamento.length}</span>
                <span className="text-[10px] uppercase font-semibold text-rose-700">SKUs espalhados</span>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5">
                <span className="block text-2xl font-black text-emerald-600">{enderecosLiberaveis}</span>
                <span className="text-[10px] uppercase font-semibold text-emerald-700">Endereços a liberar</span>
              </div>
            </div>

            {agrupadoMsg && (
              <p className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {agrupadoMsg}
              </p>
            )}

            {analiseAgrupamento.length === 0 ? (
              <p className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 text-center font-semibold">
                Todos os SKUs estão agrupados: cada um ocupa um único endereço.
              </p>
            ) : (
              <ul className="space-y-3">
                {analiseAgrupamento.map((p, ordem) => (
                  <li key={p.sku} className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">
                        {ordem + 1}
                      </span>
                      <span className="font-mono font-black text-indigo-700">{p.sku}</span>
                      {p.descricao && <span className="text-sm text-slate-700 flex-1 min-w-0">{p.descricao}</span>}
                      <span className="text-xs font-bold text-slate-600 whitespace-nowrap">
                        {p.total} pallet(s) em {p.locais.length} endereços
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex flex-wrap gap-1.5">
                        {p.locais.map((l) => (
                          <span
                            key={l.endereco}
                            className={`text-xs font-bold rounded-lg border px-2 py-1 ${
                              l.endereco === p.destino ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-slate-300 text-slate-700'
                            }`}
                          >
                            {l.endereco}: {l.qtd} pallet(s)
                          </span>
                        ))}
                      </div>

                      {p.destino ? (
                        <>
                          <p className="text-sm text-slate-800">
                            <strong>Orientação:</strong> concentrar o SKU no endereço{' '}
                            <strong className="font-mono text-emerald-700">{p.destino}</strong>
                            {p.destinoVazio ? ' (endereço vazio com espaço para todos os pallets)' : ' (já tem a maior parte e comporta o restante)'}.
                            {p.liberados > 0 && <> Libera <strong>{p.liberados}</strong> endereço(s).</>}
                          </p>
                          <ol className="space-y-1 text-sm">
                            {p.movimentos.map((m, i) => (
                              <li key={i} className="flex flex-wrap items-center gap-2 text-slate-700">
                                <span className="text-xs font-black text-slate-400 w-5">{i + 1}.</span>
                                Mover <strong>{m.quantidade}</strong> pallet(s) do lote <span className="font-mono">{m.lote}</span>
                                <span className="font-mono font-bold">{m.de}</span>
                                <ArrowRight className="w-4 h-4 text-emerald-600" />
                                <span className="font-mono font-bold text-emerald-700">{m.para}</span>
                              </li>
                            ))}
                          </ol>
                          {confirmarAgrupar === p.sku ? (
                            <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300">
                              <span className="text-sm font-bold text-amber-900 flex-1 min-w-0">
                                Confirmar que os pallets já foram movidos fisicamente para {p.destino}?
                              </span>
                              <button
                                type="button"
                                onClick={() => aplicarAgrupamento(p)}
                                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold"
                              >
                                Sim, atualizar estoque
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmarAgrupar(null)}
                                className="h-10 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmarAgrupar(p.sku);
                                setAgrupadoMsg(null);
                              }}
                              className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-2"
                            >
                              <Layers className="w-4 h-4" />
                              Registrar agrupamento em {p.destino}
                            </button>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">{p.motivo}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {enderecosMisturados.length > 0 && (
              <div className="pt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Endereços com SKUs misturados ({enderecosMisturados.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {enderecosMisturados.map(([cod, itens]) => (
                    <span key={cod} className="text-xs rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-2 py-1">
                      <strong className="font-mono">{cod}</strong>: {Array.from(new Set(itens.map((i) => i.sku))).join(', ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              Ocupação por rua
            </h3>
            <div className="space-y-2">
              {resumoRuas.map((r) => {
                const pct = Math.round((r.ocupado / r.capacidade) * 100);
                return (
                  <div key={r.rua} className="flex items-center gap-3 text-sm">
                    <span className="w-9 font-black text-slate-800">{r.rua}</span>
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${pct >= 90 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="w-44 text-right text-xs font-mono text-slate-600">
                      {pct}% • {r.livres} endereço(s) livre(s)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              Sugestões de otimização
              <span className="text-xs font-black bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">{sugestoes.length}</span>
            </h3>
            {sugestoes.length ? (
              <ul className="space-y-2">
                {sugestoes.map((s, i) => (
                  <li
                    key={i}
                    className={`p-3 rounded-xl border text-sm ${
                      s.tipo === 'consolidar' ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <strong>{s.tipo === 'consolidar' ? 'Consolidar: ' : 'Baixa ocupação: '}</strong>
                    {s.texto}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500 text-center">
                Nenhuma sugestão no momento: os lotes estão concentrados e os endereços bem ocupados.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ---------- Modal Configurar Endereço ---------- */}
      {endereco && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setEndereco(null)}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">Configurar Endereço: {endereco}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEndereco(null)}
                className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                {/* SKU: campo com lista de sugestões própria (alinhada ao campo) */}
                <div className="relative">
                  <label htmlFor="armazem-sku" className="text-sm font-bold text-slate-700">
                    SKU*
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      id="armazem-sku"
                      type="text"
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={skuAberto}
                      aria-controls="armazem-sku-lista"
                      value={skuInput}
                      onChange={(e) => {
                        setSkuInput(e.target.value);
                        setSkuAberto(true);
                        setSkuAtivo(0);
                      }}
                      onFocus={() => setSkuAberto(true)}
                      onBlur={() => setTimeout(() => setSkuAberto(false), 150)}
                      onKeyDown={(e) => {
                        if (!skuAberto || sugestoesSku.length === 0) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setSkuAtivo((i) => Math.min(i + 1, sugestoesSku.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setSkuAtivo((i) => Math.max(i - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          escolherSku(sugestoesSku[skuAtivo]);
                        } else if (e.key === 'Escape') {
                          setSkuAberto(false);
                        }
                      }}
                      placeholder="Digite para localizar o item"
                      className="w-full h-12 pl-3 pr-10 bg-white border border-slate-300 rounded-xl text-base focus:outline-none focus:border-indigo-500 placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSkuAberto((v) => !v);
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"
                      aria-label="Mostrar itens"
                    >
                      <ChevronDown className={`w-5 h-5 transition-transform ${skuAberto ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                    {/* Ler o código de barras com a câmera do celular */}
                    <button
                      type="button"
                      onClick={() => {
                        setSkuAberto(false);
                        setCameraAberta(true);
                      }}
                      className="shrink-0 h-12 w-12 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 flex items-center justify-center shadow-sm"
                      title="Ler código de barras com a câmera"
                      aria-label="Ler código de barras com a câmera"
                    >
                      <Camera className="w-6 h-6" />
                    </button>
                  </div>
                  {skuAberto && (
                    <ul
                      id="armazem-sku-lista"
                      role="listbox"
                      className="absolute left-0 right-0 top-full mt-1 z-20 max-h-64 overflow-y-auto bg-white border border-slate-300 rounded-xl shadow-xl divide-y divide-slate-100"
                    >
                      {sugestoesSku.length === 0 ? (
                        <li className="px-3 py-3 text-sm text-slate-500">Nenhum item encontrado na tabela De/Para.</li>
                      ) : (
                        sugestoesSku.map((p, i) => (
                          <li
                            key={p.id}
                            role="option"
                            aria-selected={i === skuAtivo}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              escolherSku(p);
                            }}
                            onMouseEnter={() => setSkuAtivo(i)}
                            className={`px-3 py-2.5 cursor-pointer flex items-baseline gap-3 ${i === skuAtivo ? 'bg-indigo-50' : 'bg-white'}`}
                          >
                            <span className="w-20 shrink-0 font-mono font-black text-indigo-700">{p.sku}</span>
                            <span className="flex-1 min-w-0 text-sm text-slate-700 leading-snug">{p.descricao}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="armazem-lote" className="text-sm font-bold text-slate-700">
                    Lote*
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      id="armazem-lote"
                      type="text"
                      value={loteInput}
                      onChange={(e) => setLoteInput(e.target.value.toUpperCase())}
                      placeholder="Digite o lote..."
                      className="flex-1 min-w-0 h-12 px-3 bg-white border border-slate-300 rounded-xl text-base focus:outline-none focus:border-indigo-500"
                    />
                    {/* Data de entrada: hoje por padrão; o ícone abre o calendário só se precisar alterar */}
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const el = dataRef.current;
                          if (!el) return;
                          try {
                            el.showPicker();
                          } catch {
                            el.focus();
                            el.click();
                          }
                        }}
                        title={`Data de entrada: ${formatarData(dataInput)} — toque para alterar`}
                        aria-label={`Data de entrada ${formatarData(dataInput)}. Alterar`}
                        className={`h-12 rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                          dataInput && dataInput !== localIsoDate()
                            ? 'px-3 bg-amber-50 border-amber-400 text-amber-800'
                            : 'w-12 bg-white border-slate-300 text-slate-500 hover:text-indigo-700 hover:border-indigo-300'
                        }`}
                      >
                        <CalendarDays className="w-5 h-5" />
                        {dataInput && dataInput !== localIsoDate() && (
                          <span className="text-xs font-bold font-mono whitespace-nowrap">
                            {formatarData(dataInput).slice(0, 5)}
                          </span>
                        )}
                      </button>
                      <input
                        ref={dataRef}
                        type="date"
                        tabIndex={-1}
                        aria-hidden="true"
                        value={dataInput}
                        max={localIsoDate()}
                        onChange={(e) => setDataInput(e.target.value || localIsoDate())}
                        className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                      />
                    </div>
                  </div>
                </div>
                  <div>
                    <span className="text-sm font-bold text-slate-700">Quantidade* (pallets)</span>
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setQtdInput((q) => Math.max(editIdx !== null ? 0 : 1, q - 1))}
                        className="w-12 h-12 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center"
                        aria-label="Diminuir"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={qtdInput}
                        onChange={(e) => setQtdInput(Math.max(editIdx !== null ? 0 : 1, Number(e.target.value) || 0))}
                        className="flex-1 min-w-0 h-12 text-center bg-white border border-slate-300 rounded-xl text-lg font-black focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setQtdInput((q) => q + 1)}
                        className="w-12 h-12 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center"
                        aria-label="Aumentar"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
                {erro && <p className="text-sm font-semibold text-rose-700">{erro}</p>}
                {editIdx !== null && (
                  <p className="text-xs font-semibold text-amber-700">
                    Editando o item {rascunho[editIdx]?.sku} / lote {rascunho[editIdx]?.lote}. Quantidade 0 retira o item do endereço.
                  </p>
                )}
                <div className={editIdx !== null ? 'grid grid-cols-[1fr_auto] gap-2' : ''}>
                  <button
                    type="button"
                    onClick={adicionarItem}
                    className={`w-full h-12 rounded-xl text-white font-bold text-base ${
                      editIdx !== null ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-700 hover:bg-indigo-800'
                    }`}
                  >
                    {editIdx !== null ? (qtdInput <= 0 ? 'RETIRAR ITEM' : 'SALVAR ALTERAÇÃO') : 'ADICIONAR'}
                  </button>
                  {editIdx !== null && (
                    <button
                      type="button"
                      onClick={cancelarEdicao}
                      className="h-12 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
                {salvoMsg && !erro && (
                  <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {salvoMsg}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-extrabold text-slate-900">
                  Itens no Endereço (Ocupado: {ocupadoRascunho}/{endereco ? cap(endereco) : CAPACIDADE_ENDERECO})
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">SKU</th>
                        <th className="px-3 py-2 text-left font-semibold">Lote</th>
                        <th className="px-3 py-2 text-left font-semibold">Entrada</th>
                        <th className="px-3 py-2 text-right font-semibold">Qtd.</th>
                        <th className="px-2 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rascunho.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                            <PackageOpen className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                            Endereço vazio.
                          </td>
                        </tr>
                      ) : (
                        rascunho.map((i, idx) => (
                          <tr key={`${i.sku}-${i.lote}`} className={editIdx === idx ? 'bg-amber-50' : ''}>
                            <td className="px-3 py-2">
                              <span className="font-mono font-bold text-indigo-700">{i.sku}</span>
                              {(i.descricao || descricaoSku(i.sku)) && (
                                <span className="block text-xs text-slate-500">{i.descricao || descricaoSku(i.sku)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono">{i.lote}</td>
                            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{formatarData(i.data)}</td>
                            <td className="px-3 py-2 text-right font-black">{i.quantidade}</td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => editarItem(idx)}
                                className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50 inline-flex items-center justify-center"
                                title="Editar"
                                aria-label={`Editar ${i.sku} lote ${i.lote}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {cameraAberta && (
        <BarcodeCameraScanner
          title="Ler código de barras do produto"
          subtitle="Posicione o código de barras (EAN) no centro da mira"
          mode="barcode"
          beepEnabled={soundEnabled}
          onScan={lerCodigoCamera}
          onClose={() => setCameraAberta(false)}
        />
      )}
    </div>
  );
};
