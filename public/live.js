/* Cliente das rotas /api (same-origin). Sem proxies CORS de terceiros. */
"use strict";
const LIVE = (() => {
  const TIMEOUT = 12000;
  async function getJSON(url) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), TIMEOUT);
    try {
      const r = await fetch(url, { signal: c.signal, headers: { accept: "application/json" } });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || j.erro) throw new Error((j && j.erro) || "HTTP " + r.status);
      return j;
    } finally { clearTimeout(t); }
  }
  return {
    camara: (partido) => getJSON("/api/camara?partido=" + encodeURIComponent(partido)),
    news: (q, max = 8) => getJSON("/api/news?q=" + encodeURIComponent(q) + "&max=" + max),
    wiki: (title) => getJSON("/api/wiki?title=" + encodeURIComponent(title))
  };
})();