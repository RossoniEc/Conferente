// API do CargaCheck no Cloudflare: banco D1 (registros) + R2 (fotos).
// O mesmo Worker serve o site (pasta dist) e as rotas /api/*.

interface Env {
  DB: D1Database;
  FOTOS: R2Bucket;
  ASSETS: Fetcher;
  ACCESS_KEY: string; // segredo: wrangler secret put ACCESS_KEY
}

const COOKIE = 'cc_auth';
const UM_ANO = 60 * 60 * 24 * 365;
const MAX_FOTO_BYTES = 15 * 1024 * 1024;
const LIMITE_PULL = 500;
const COLECOES = new Set(['settings', 'inspections', 'armazem', 'armazem_layout', 'separacao', 'armazem_mov']);

const json = (dados: unknown, status = 200, extra: HeadersInit = {}) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

// Token da sessão: HMAC da chave de acesso (trocar a chave invalida todas as sessões)
const tokenDaChave = async (chave: string) => {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(chave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode('cargacheck-sessao-v1')));
};

const iguais = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

const lerCookie = (req: Request, nome: string) => {
  const c = req.headers.get('cookie') || '';
  const m = c.split(/;\s*/).find((p) => p.startsWith(`${nome}=`));
  return m ? decodeURIComponent(m.slice(nome.length + 1)) : '';
};

const autenticado = async (req: Request, env: Env) => {
  if (!env.ACCESS_KEY) return false;
  const t = lerCookie(req, COOKIE);
  return !!t && iguais(t, await tokenDaChave(env.ACCESS_KEY));
};

const cookieSessao = (valor: string, maxAge: number) =>
  `${COOKIE}=${valor}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;

async function api(req: Request, env: Env, url: URL): Promise<Response> {
  const rota = url.pathname.replace(/^\/api/, '');

  // ---------- sessão ----------
  if (rota === '/status' && req.method === 'GET') {
    return json({ ok: true, configurado: !!env.ACCESS_KEY, autenticado: await autenticado(req, env) });
  }
  if (rota === '/login' && req.method === 'POST') {
    if (!env.ACCESS_KEY) return json({ erro: 'Chave de acesso ainda não configurada no servidor.' }, 503);
    const corpo = (await req.json().catch(() => ({}))) as { chave?: string };
    const chave = String(corpo.chave || '');
    if (!iguais(await tokenDaChave(chave), await tokenDaChave(env.ACCESS_KEY))) {
      return json({ erro: 'Chave de acesso inválida.' }, 401);
    }
    return json({ ok: true }, 200, { 'set-cookie': cookieSessao(await tokenDaChave(env.ACCESS_KEY), UM_ANO) });
  }
  if (rota === '/logout' && req.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': cookieSessao('', 0) });
  }

  if (!(await autenticado(req, env))) return json({ erro: 'Não autenticado.' }, 401);

  // ---------- sincronização de registros ----------
  if (rota === '/sync' && req.method === 'GET') {
    const desde = Math.max(0, Number(url.searchParams.get('desde')) || 0);
    const { results } = await env.DB.prepare(
      'SELECT colecao, id, dados, excluido, seq FROM registros WHERE seq > ? ORDER BY seq LIMIT ?'
    )
      .bind(desde, LIMITE_PULL)
      .all<{ colecao: string; id: string; dados: string | null; excluido: number; seq: number }>();
    const itens = results.map((r) => ({
      colecao: r.colecao,
      id: r.id,
      excluido: !!r.excluido,
      dados: r.dados ? JSON.parse(r.dados) : null,
      seq: r.seq,
    }));
    const cursor = itens.length ? itens[itens.length - 1].seq : desde;
    return json({ itens, cursor, mais: itens.length === LIMITE_PULL });
  }

  if (rota === '/sync' && req.method === 'POST') {
    const corpo = (await req.json().catch(() => null)) as {
      itens?: { colecao: string; id: string; dados?: unknown; excluido?: boolean }[];
      usuario?: string;
    } | null;
    const itens = (corpo?.itens || []).filter((i) => COLECOES.has(i.colecao) && typeof i.id === 'string' && i.id);
    if (itens.length === 0) return json({ ok: true, gravados: 0 });
    if (itens.length > 200) return json({ erro: 'Máximo de 200 registros por envio.' }, 413);
    const agora = new Date().toISOString();
    const usuario = String(corpo?.usuario || '').slice(0, 120);
    // Cada gravação recebe o próximo número de sequência (o batch do D1 é uma transação)
    const stmt = env.DB.prepare(
      `INSERT INTO registros (colecao, id, dados, excluido, seq, atualizado_em, atualizado_por)
       VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(seq), 0) + 1 FROM registros), ?5, ?6)
       ON CONFLICT (colecao, id) DO UPDATE SET
         dados = excluded.dados, excluido = excluded.excluido, seq = excluded.seq,
         atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`
    );
    await env.DB.batch(
      itens.map((i) =>
        stmt.bind(i.colecao, i.id, i.excluido ? null : JSON.stringify(i.dados ?? null), i.excluido ? 1 : 0, agora, usuario)
      )
    );
    return json({ ok: true, gravados: itens.length });
  }

  // ---------- fotos (R2), endereçadas pelo SHA-256 do conteúdo ----------
  const foto = rota.match(/^\/fotos\/([a-f0-9]{64})$/);
  if (foto) {
    const chave = `fotos/${foto[1]}`;
    if (req.method === 'GET') {
      const obj = await env.FOTOS.get(chave);
      if (!obj) return json({ erro: 'Foto não encontrada.' }, 404);
      return new Response(obj.body, {
        headers: {
          'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
          'cache-control': 'private, max-age=31536000, immutable',
        },
      });
    }
    if (req.method === 'PUT') {
      const tamanho = Number(req.headers.get('content-length') || 0);
      if (tamanho > MAX_FOTO_BYTES) return json({ erro: 'Foto muito grande.' }, 413);
      if (await env.FOTOS.head(chave)) return json({ ok: true, existente: true });
      const corpo = await req.arrayBuffer();
      if (corpo.byteLength > MAX_FOTO_BYTES) return json({ erro: 'Foto muito grande.' }, 413);
      // Confere se o conteúdo bate com o nome (evita sobrescrever com outra imagem)
      if (hex(await crypto.subtle.digest('SHA-256', corpo)) !== foto[1]) return json({ erro: 'Hash não confere.' }, 400);
      const tipo = req.headers.get('content-type') || 'image/jpeg';
      if (!tipo.startsWith('image/')) return json({ erro: 'Somente imagens.' }, 415);
      await env.FOTOS.put(chave, corpo, { httpMetadata: { contentType: tipo } });
      return json({ ok: true });
    }
  }

  return json({ erro: 'Rota não encontrada.' }, 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await api(req, env, url);
      } catch (e) {
        console.error(e);
        return json({ erro: 'Erro interno.' }, 500);
      }
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
