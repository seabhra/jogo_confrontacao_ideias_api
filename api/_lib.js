/* Helpers compartilhados pelas Vercel Functions (arquivo com _ não vira rota). */
const UA = "DueloDaRealidade/1.0 (jogo educativo de checagem em tempo real)";

export async function timedFetch(url, ms = 8000, opts = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, {
      ...opts,
      signal: c.signal,
      headers: { "user-agent": UA, accept: opts.accept || "*/*", ...(opts.headers || {}) }
    });
  } finally { clearTimeout(t); }
}

export function ok(res, data, sMaxAge = 180) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 2}`);
  res.status(200).json(data);
}

export function fail(res, code, msg) {
  res.setHeader("Cache-Control", "no-store");
  res.status(code).json({ erro: msg });
}

export function param(req, name) {
  const v = req.query ? req.query[name] : undefined;
  return Array.isArray(v) ? v[0] : v;
}

export function decodeXML(s) {
  if (!s) return "";
  s = s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
