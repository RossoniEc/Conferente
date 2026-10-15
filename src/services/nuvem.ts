// Sincronização com a nuvem (Cloudflare D1 + R2).
// O aparelho continua salvando tudo localmente (funciona sem internet); este módulo envia as
// alterações para a API e traz as alterações dos outros aparelhos a cada ciclo.

type Tipo = 'lista' | 'mapa' | 'doc';
interface Colecao {
  nome: string; // nome no banco
  chave: string; // chave no localStorage
  tipo: Tipo; // lista de objetos com id | objeto indexado | documento único
  novosNoInicio?: boolean; // itens novos vindos da nuvem entram no topo da lista
  campoLocal?: string[]; // campos do documento que ficam só neste aparelho
}

const COLECOES: Colecao[] = [
  { nome: 'settings', chave: 'cargacheck_settings', tipo: 'doc', campoLocal: ['beepSoundEnabled', 'vibrationEnabled'] },
  { nome: 'inspections', chave: 'cargacheck_inspections', tipo: 'lista', novosNoInicio: true },
  { nome: 'armazem', chave: 'cargacheck_armazem', tipo: 'mapa' },
  { nome: 'armazem_layout', chave: 'cargacheck_armazem_layout', tipo: 'doc' },
  { nome: 'separacao', chave: 'cargacheck_separacao', tipo: 'mapa' },
  { nome: 'armazem_mov', chave: 'cargacheck_armazem_mov', tipo: 'lista' },
];

const KEY_SNAP = 'cargacheck_sync_snap'; // { colecao: { id: hash } } do que já está igual na nuvem
const KEY_CURSOR = 'cargacheck_sync_cursor'; // último seq recebido da nuvem
const KEY_ULTIMA = 'cargacheck_sync_ultima';
const INTERVALO_MS = 20000;
const LOTE_ENVIO = 50;
const DOC_ID = 'doc';

export const EVENTO_SYNC = 'cargacheck:sync'; // detail: { colecoes: string[] } (dados locais mudaram)
export const EVENTO_STATUS = 'cargacheck:nuvem-status';

export type EstadoNuvem = 'verificando' | 'indisponivel' | 'desconectado' | 'sincronizando' | 'ok' | 'erro';
export interface StatusNuvem {
  estado: EstadoNuvem;
  ultimaSync?: string; // ISO
  pendentes: number;
  mensagem?: string;
}

let status: StatusNuvem = { estado: 'verificando', pendentes: 0 };
let usuarioAtual = '';
let timer: ReturnType<typeof setInterval> | null = null;
let rodando = false;
let iniciado = false;

const lerJson = <T>(k: string, padrao: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : padrao;
  } catch {
    return padrao;
  }
};
const gravarJson = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
};

const setStatus = (p: Partial<StatusNuvem>) => {
  status = { ...status, ...p };
  window.dispatchEvent(new CustomEvent(EVENTO_STATUS, { detail: status }));
};
export const statusNuvem = () => status;

// Hash rápido (cyrb53) do JSON: detecta o que mudou desde a última sincronização
const hashTexto = (s: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

const semCamposLocais = (c: Colecao, item: unknown) => {
  if (!c.campoLocal || !item || typeof item !== 'object') return item;
  const copia = { ...(item as Record<string, unknown>) };
  c.campoLocal.forEach((k) => delete copia[k]);
  return copia;
};
const hashItem = (c: Colecao, item: unknown) => hashTexto(JSON.stringify(semCamposLocais(c, item)));

// ---------- leitura/gravação local por coleção ----------
const lerLocal = (c: Colecao): Map<string, unknown> => {
  const m = new Map<string, unknown>();
  const bruto = localStorage.getItem(c.chave);
  if (!bruto) return m;
  let v: unknown;
  try {
    v = JSON.parse(bruto);
  } catch {
    return m;
  }
  if (c.tipo === 'doc') m.set(DOC_ID, v);
  else if (c.tipo === 'mapa' && v && typeof v === 'object') Object.entries(v as Record<string, unknown>).forEach(([k, x]) => m.set(k, x));
  else if (c.tipo === 'lista' && Array.isArray(v))
    v.forEach((x) => x && typeof x === 'object' && 'id' in x && m.set(String((x as { id: unknown }).id), x));
  return m;
};

// Aplica alterações (id -> item | null para excluir) sobre o conteúdo local atual
const aplicarLocal = (c: Colecao, mudancas: Map<string, unknown | null>) => {
  if (mudancas.size === 0) return;
  if (c.tipo === 'doc') {
    const novo = mudancas.get(DOC_ID);
    if (novo === undefined) return;
    if (novo === null) return; // documento único não é apagado pela nuvem
    const atual = lerJson<Record<string, unknown> | null>(c.chave, null);
    const preservado: Record<string, unknown> = {};
    c.campoLocal?.forEach((k) => atual && k in atual && (preservado[k] = atual[k]));
    gravarJson(c.chave, { ...(novo as Record<string, unknown>), ...preservado });
    return;
  }
  if (c.tipo === 'mapa') {
    const atual = lerJson<Record<string, unknown>>(c.chave, {});
    mudancas.forEach((v, id) => {
      if (v === null) delete atual[id];
      else atual[id] = v;
    });
    gravarJson(c.chave, atual);
    return;
  }
  const lista = lerJson<{ id: string }[]>(c.chave, []);
  const restantes = new Map(mudancas);
  const nova: unknown[] = [];
  lista.forEach((x) => {
    const id = String(x?.id);
    if (!restantes.has(id)) return nova.push(x);
    const v = restantes.get(id);
    restantes.delete(id);
    if (v !== null) nova.push(v);
  });
  const novos = [...restantes.values()].filter((v) => v !== null);
  gravarJson(c.chave, c.novosNoInicio ? [...novos, ...nova] : [...nova, ...novos]);
};

// ---------- fotos: data URL <-> /api/fotos/<sha256> ----------
const PREFIXO_FOTO = '/api/fotos/';
const ehDataImagem = (s: string) => s.startsWith('data:image/') && s.length > 200;

const sha256 = async (buf: ArrayBuffer) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');

const enviarFoto = async (dataUrl: string): Promise<string> => {
  const blob = await (await fetch(dataUrl)).blob();
  const buf = await blob.arrayBuffer();
  const h = await sha256(buf);
  const r = await fetch(`${PREFIXO_FOTO}${h}`, {
    method: 'PUT',
    headers: { 'content-type': blob.type || 'image/jpeg' },
    body: buf,
    credentials: 'same-origin',
  });
  if (!r.ok) throw new Error(`Falha ao enviar foto (${r.status})`);
  return `${PREFIXO_FOTO}${h}`;
};

// Percorre o objeto trocando as fotos embutidas pelos endereços no R2
const externalizarFotos = async (v: unknown): Promise<unknown> => {
  if (typeof v === 'string') return ehDataImagem(v) ? enviarFoto(v) : v;
  if (Array.isArray(v)) return Promise.all(v.map(externalizarFotos));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = await externalizarFotos(x);
    return out;
  }
  return v;
};
const temFotoEmbutida = (v: unknown): boolean => {
  if (typeof v === 'string') return ehDataImagem(v);
  if (Array.isArray(v)) return v.some(temFotoEmbutida);
  if (v && typeof v === 'object') return Object.values(v).some(temFotoEmbutida);
  return false;
};

// Para gerar PDF: troca os endereços /api/fotos/... de volta por data URL
const cacheFotos = new Map<string, Promise<string>>();
const baixarFoto = (url: string) => {
  if (!cacheFotos.has(url)) {
    cacheFotos.set(
      url,
      fetch(url, { credentials: 'same-origin' })
        .then((r) => {
          if (!r.ok) throw new Error(`Foto indisponível (${r.status})`);
          return r.blob();
        })
        .then(
          (b) =>
            new Promise<string>((res, rej) => {
              const fr = new FileReader();
              fr.onload = () => res(String(fr.result));
              fr.onerror = () => rej(fr.error);
              fr.readAsDataURL(b);
            })
        )
        .catch((e) => {
          cacheFotos.delete(url);
          throw e;
        })
    );
  }
  return cacheFotos.get(url)!;
};
export const embutirFotos = async <T>(v: T): Promise<T> => {
  if (typeof v === 'string') return (v.startsWith(PREFIXO_FOTO) ? await baixarFoto(v).catch(() => '') : v) as T;
  if (Array.isArray(v)) return (await Promise.all(v.map((x) => embutirFotos(x)))) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = await embutirFotos(x);
    return out as T;
  }
  return v;
};

// ---------- API ----------
const chamar = async <T>(caminho: string, init: RequestInit = {}): Promise<T> => {
  const r = await fetch(`/api${caminho}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
  const dados = (await r.json().catch(() => ({}))) as T & { erro?: string };
  if (!r.ok) throw Object.assign(new Error(dados.erro || `Erro ${r.status}`), { status: r.status });
  return dados;
};

export const conectarNuvem = async (chave: string) => {
  await chamar('/login', { method: 'POST', body: JSON.stringify({ chave }) });
  setStatus({ estado: 'sincronizando', mensagem: undefined });
  await sincronizarAgora();
};

export const desconectarNuvem = async () => {
  await chamar('/logout', { method: 'POST' }).catch(() => undefined);
  setStatus({ estado: 'desconectado', mensagem: undefined });
};

const contarPendentes = () => {
  const snap = lerJson<Record<string, Record<string, string>>>(KEY_SNAP, {});
  let n = 0;
  COLECOES.forEach((c) => {
    const s = snap[c.nome] || {};
    const local = lerLocal(c);
    local.forEach((item, id) => s[id] !== hashItem(c, item) && n++);
    Object.keys(s).forEach((id) => !local.has(id) && n++);
  });
  return n;
};

// Traz da nuvem tudo o que mudou desde o último cursor
const puxar = async () => {
  const snap = lerJson<Record<string, Record<string, string>>>(KEY_SNAP, {});
  let cursor = Number(localStorage.getItem(KEY_CURSOR) || 0);
  const alteradas = new Set<string>();
  for (let volta = 0; volta < 100; volta++) {
    const r = await chamar<{ itens: { colecao: string; id: string; dados: unknown; excluido: boolean }[]; cursor: number; mais: boolean }>(
      `/sync?desde=${cursor}`
    );
    const porColecao = new Map<string, Map<string, unknown | null>>();
    r.itens.forEach((it) => {
      const c = COLECOES.find((x) => x.nome === it.colecao);
      if (!c) return;
      const local = lerLocal(c);
      const s = (snap[c.nome] = snap[c.nome] || {});
      // Alteração local ainda não enviada: mantém a do aparelho (será enviada em seguida)
      const pendente = local.has(it.id) && s[it.id] !== undefined && s[it.id] !== hashItem(c, local.get(it.id));
      if (pendente) return;
      const m = porColecao.get(c.nome) || new Map<string, unknown | null>();
      m.set(it.id, it.excluido ? null : it.dados);
      porColecao.set(c.nome, m);
      if (it.excluido) delete s[it.id];
      else s[it.id] = hashItem(c, it.dados);
    });
    porColecao.forEach((m, nome) => {
      const c = COLECOES.find((x) => x.nome === nome)!;
      aplicarLocal(c, m);
      alteradas.add(nome);
    });
    cursor = r.cursor;
    gravarJson(KEY_SNAP, snap);
    localStorage.setItem(KEY_CURSOR, String(cursor));
    if (!r.mais) break;
  }
  return alteradas;
};

// Envia para a nuvem o que mudou no aparelho (inclui exclusões)
const enviar = async () => {
  const snap = lerJson<Record<string, Record<string, string>>>(KEY_SNAP, {});
  const fila: { colecao: string; id: string; dados?: unknown; excluido?: boolean; hash?: string }[] = [];
  const alteradas = new Set<string>();
  for (const c of COLECOES) {
    const s = (snap[c.nome] = snap[c.nome] || {});
    const local = lerLocal(c);
    const fotosTrocadas = new Map<string, unknown>();
    for (const [id, item] of local) {
      if (s[id] === hashItem(c, item)) continue;
      let dados = item;
      if (temFotoEmbutida(item)) {
        dados = await externalizarFotos(item);
        fotosTrocadas.set(id, dados);
      }
      fila.push({ colecao: c.nome, id, dados: semCamposLocais(c, dados), hash: hashItem(c, dados) });
    }
    Object.keys(s).forEach((id) => !local.has(id) && fila.push({ colecao: c.nome, id, excluido: true }));
    // Guarda no aparelho a versão com fotos na nuvem (libera espaço), se o item não mudou nesse meio-tempo
    if (fotosTrocadas.size) {
      const atual = lerLocal(c);
      const ok = new Map<string, unknown>();
      fotosTrocadas.forEach((v, id) => hashItem(c, atual.get(id)) === hashItem(c, local.get(id)) && ok.set(id, v));
      aplicarLocal(c, ok);
      if (ok.size) alteradas.add(c.nome);
    }
  }
  for (let i = 0; i < fila.length; i += LOTE_ENVIO) {
    const lote = fila.slice(i, i + LOTE_ENVIO);
    await chamar('/sync', {
      method: 'POST',
      body: JSON.stringify({ usuario: usuarioAtual, itens: lote.map(({ hash, ...x }) => x) }),
    });
    lote.forEach((x) => {
      const s = snap[x.colecao];
      if (x.excluido) delete s[x.id];
      else s[x.id] = x.hash!;
    });
    gravarJson(KEY_SNAP, snap);
  }
  return alteradas;
};

export const sincronizarAgora = async () => {
  if (rodando) return;
  rodando = true;
  try {
    const st = await chamar<{ configurado: boolean; autenticado: boolean }>('/status');
    if (!st.autenticado) {
      setStatus({
        estado: 'desconectado',
        mensagem: st.configurado ? undefined : 'Servidor sem chave de acesso configurada.',
        pendentes: contarPendentes(),
      });
      return;
    }
    setStatus({ estado: 'sincronizando', mensagem: undefined });
    const primeira = !localStorage.getItem(KEY_CURSOR);
    const alteradas = new Set<string>();
    // Primeira vez neste aparelho: a nuvem prevalece; depois, o aparelho envia antes de receber
    if (primeira) (await puxar()).forEach((x) => alteradas.add(x));
    (await enviar()).forEach((x) => alteradas.add(x));
    (await puxar()).forEach((x) => alteradas.add(x));
    if (alteradas.size) window.dispatchEvent(new CustomEvent(EVENTO_SYNC, { detail: { colecoes: [...alteradas] } }));
    const agora = new Date().toISOString();
    localStorage.setItem(KEY_ULTIMA, agora);
    setStatus({ estado: 'ok', ultimaSync: agora, pendentes: contarPendentes(), mensagem: undefined });
  } catch (e) {
    const st = (e as { status?: number }).status;
    if (st === 401) setStatus({ estado: 'desconectado', pendentes: contarPendentes() });
    else if (st === undefined || st === 404)
      setStatus({ estado: 'indisponivel', mensagem: 'Sem conexão com a nuvem.', pendentes: contarPendentes() });
    else setStatus({ estado: 'erro', mensagem: (e as Error).message, pendentes: contarPendentes() });
  } finally {
    rodando = false;
  }
};

export const iniciarNuvem = (usuario: string) => {
  usuarioAtual = usuario;
  if (iniciado) return;
  iniciado = true;
  const ultima = localStorage.getItem(KEY_ULTIMA) || undefined;
  status = { ...status, ultimaSync: ultima };
  sincronizarAgora();
  timer = setInterval(() => document.visibilityState === 'visible' && sincronizarAgora(), INTERVALO_MS);
  window.addEventListener('online', () => sincronizarAgora());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sincronizarAgora());
};

export const pararNuvem = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
