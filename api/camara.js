import { timedFetch, ok, fail, param } from "./_lib.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return fail(res, 405, "Método não permitido");
  const partido = String(param(req, "partido") || "").toUpperCase().trim();
  if (!/^[A-Z0-9]{2,12}$/.test(partido)) return fail(res, 400, "Parâmetro 'partido' inválido");
  try {
    let next = `https://dadosabertos.camara.leg.br/api/v2/deputados?siglaPartido=${encodeURIComponent(partido)}&itens=100&ordem=ASC&ordenarPor=nome`;
    let count = 0, nomes = [], pages = 0;
    while (next && pages < 4) {
      const r = await timedFetch(next, 8000, { accept: "application/json" });
      if (!r.ok) throw new Error("Câmara HTTP " + r.status);
      const j = await r.json();
      const arr = Array.isArray(j.dados) ? j.dados : [];
      count += arr.length;
      nomes.push(...arr.map(d => d.nome));
      const nx = (j.links || []).find(l => l.rel === "next");
      next = nx ? nx.href : null;
      pages++;
    }
    if (!count) return fail(res, 502, "Sem deputados retornados para " + partido);
    return ok(res, {
      fonte: "Câmara dos Deputados · Dados Abertos",
      partido, count, nomes: nomes.slice(0, 8),
      url: `https://dadosabertos.camara.leg.br/api/v2/deputados?siglaPartido=${encodeURIComponent(partido)}`,
      portal: "https://www.camara.leg.br/deputados/quem-sao",
      atualizado: new Date().toISOString()
    }, 300);
  } catch (e) {
    return fail(res, 502, "Falha ao consultar a Câmara: " + (e && e.message ? e.message : "rede"));
  }
}