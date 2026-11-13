import { timedFetch, ok, fail, param, decodeXML } from "./_lib.js";

function parseRSS(xml, max) {
  const items = [];
  const blocos = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const pick = (bloco, re) => { const m = re.exec(bloco); return m ? decodeXML(m[1].trim()) : ""; };
  for (const bloco of blocos) {
    if (items.length >= max) break;
    const titulo = pick(bloco, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const link = pick(bloco, /<link[^>]*>([\s\S]*?)<\/link>/i);
    const data = pick(bloco, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    let fonte = pick(bloco, /<source[^>]*>([\s\S]*?)<\/source>/i);
    if (!fonte && titulo.includes(" - ")) fonte = titulo.split(" - ").pop().trim();
    if (titulo && link) items.push({ titulo, link, fonte: fonte || "Imprensa", data });
  }
  return items;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Método não permitido");
  const q = String(param(req, "q") || "").trim().slice(0, 220);
  const max = Math.min(12, Math.max(1, parseInt(param(req, "max") || "8", 10) || 8));
  if (q.length < 3) return fail(res, 400, "Parâmetro 'q' muito curto");
  const rss = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  try {
    const r = await timedFetch(rss, 8000, { accept: "application/rss+xml, application/xml, text/xml" });
    if (!r.ok) throw new Error("Google News HTTP " + r.status);
    const xml = await r.text();
    const itens = parseRSS(xml, max);
    if (!itens.length) return fail(res, 502, "Nenhuma manchete retornada");
    return ok(res, { fonte: "Google News RSS", consulta: q, itens, atualizado: new Date().toISOString() }, 120);
  } catch (e) {
    return fail(res, 502, "Falha ao consultar o Google News: " + (e && e.message ? e.message : "rede"));
  }
}
