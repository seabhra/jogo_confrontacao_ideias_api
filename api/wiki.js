import { timedFetch, ok, fail, param } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Método não permitido");
  const title = String(param(req, "title") || "").trim().slice(0, 160);
  if (title.length < 2) return fail(res, 400, "Parâmetro 'title' inválido");
  const slug = encodeURIComponent(title.replace(/ /g, "_"));
  const api = `https://pt.wikipedia.org/api/rest_v1/page/summary/${slug}`;
  try {
    const r = await timedFetch(api, 8000, { accept: "application/json" });
    if (!r.ok) throw new Error("Wikipédia HTTP " + r.status);
    const j = await r.json();
    const texto = j.extract || "";
    if (!texto) throw new Error("sem resumo");
    return ok(res, {
      fonte: "Wikipédia (PT)",
      titulo: j.title || title,
      texto,
      url: (j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) || `https://pt.wikipedia.org/wiki/${slug}`,
      atualizado: new Date().toISOString()
    }, 3600);
  } catch (e) {
    return fail(res, 502, "Falha ao consultar a Wikipédia: " + (e && e.message ? e.message : "rede"));
  }
}