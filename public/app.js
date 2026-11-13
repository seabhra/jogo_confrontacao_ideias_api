/* Duelo da Realidade — Espelho Real · Ao Vivo (Vercel + GitHub).
   Rodadas montadas em tempo real a partir de /api (Câmara/News/Wikipédia).
   Guardrails: avatar do usuário (consentimento) ou fictício; citações reais com
   fonte/hora; voz de verificação sintética rotulada. Sem síntese de terceiros. */
"use strict";
const $ = s => document.querySelector(s);

/* Desafios do jogo (a alegação a confrontar). As EVIDÊNCIAS vêm ao vivo. */
const TEMAS = [
  { alegacao: "As urnas não elegeram bolsonaristas!", newsQuery: "urnas eletrônicas PL bancada eleitos deputados", wiki: "Urna eletrônica brasileira", camara: "PL", bancada: true },
  { alegacao: "Só a eleição presidencial foi fraudada!", newsQuery: "PL TSE ação urnas anulação segundo turno", wiki: "Urna eletrônica brasileira", camara: "PL", bancada: true },
  { alegacao: "Ninguém auditou as urnas!", newsQuery: "urna eletrônica auditoria teste integridade código-fonte TSE", wiki: "Urna eletrônica brasileira", camara: null, bancada: false },
  { alegacao: "As Forças Armadas comprovaram fraude!", newsQuery: "relatório Forças Armadas urnas fraude TSE eleição", wiki: "Urna eletrônica brasileira", camara: null, bancada: false },
  { alegacao: "O partido não aceita o resultado!", newsQuery: "PL resultado eleição anulação urnas segundo turno", wiki: "Eleições gerais no Brasil em 2022", camara: "PL", bancada: true }
];
const AVATARES = ["🧑‍🏫", "🕵️", "🤖", "🧑‍🎤", "🦉", "🧠"];

const estado = {
  rodada: 0, conv: 95, encerrada: false, mult: 1, carregando: false,
  pontos: { precisao: 0, evidencia: 0, raciocinio: 0 },
  usados: new Set(), perguntaFeita: false, origemAberta: false, mutacaoVista: false,
  avatar: null, mudo: false, vitorias: 0, atual: null, coletadas: []
};

/* ---------- Áudio (WebAudio, ligado por padrão, mudo no topo) ---------- */
let AC = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} } if (AC && AC.state === "suspended") AC.resume(); return AC; }
function tom(freq, dur, tipo = "sine", vol = .12, when = 0) {
  const c = ac(); if (!c || estado.mudo) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
  o.type = tipo; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + .02);
}
const sfx = {
  click: () => tom(520, .07, "triangle", .08),
  evid: () => { tom(523, .12, "sine", .1); tom(659, .14, "sine", .1, .07); tom(784, .18, "sine", .1, .14); },
  boa: () => { tom(660, .12, "triangle", .11); tom(990, .2, "triangle", .11, .09); },
  ruim: () => { tom(180, .25, "sawtooth", .09); tom(120, .3, "sawtooth", .08, .05); },
  win: () => { [523, 659, 784, 1046].forEach((f, i) => tom(f, .22, "triangle", .12, i * .11)); },
  tick: () => tom(880, .06, "square", .06)
};

/* ---------- Partículas ---------- */
const fx = $("#fx"), fxc = fx.getContext("2d");
let parts = [], fxRun = false;
function sizeFx() { const d = Math.min(devicePixelRatio || 1, 2); fx.width = innerWidth * d; fx.height = innerHeight * d; fx.style.width = innerWidth + "px"; fx.style.height = innerHeight + "px"; fxc.setTransform(d, 0, 0, d, 0, 0); }
sizeFx(); addEventListener("resize", sizeFx);
function burst(x, y, cores, n = 26) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 5;
    parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 1, cor: cores[i % cores.length], r: 2 + Math.random() * 3 });
  }
  if (parts.length > 500) parts.splice(0, parts.length - 500);
  if (!fxRun) { fxRun = true; requestAnimationFrame(loopFx); }
}
function loopFx() {
  fxc.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += .12; p.vx *= .985; p.life -= .02;
    fxc.globalAlpha = Math.max(0, p.life); fxc.fillStyle = p.cor;
    fxc.beginPath(); fxc.arc(p.x, p.y, p.r, 0, Math.PI * 2); fxc.fill();
  }
  fxc.globalAlpha = 1;
  if (parts.length) requestAnimationFrame(loopFx); else { fxRun = false; fxc.clearRect(0, 0, innerWidth, innerHeight); }
}
function burstEl(sel, cores, n) { const r = $(sel).getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, cores, n); }

/* ---------- Voz da verificação (TTS sintético, rotulado) ---------- */
let vozPT = null;
function carregarVoz() { if (!("speechSynthesis" in window)) return; const v = speechSynthesis.getVoices(); vozPT = v.find(x => /pt[-_]BR/i.test(x.lang)) || v.find(x => /^pt/i.test(x.lang)) || null; }
if ("speechSynthesis" in window) { carregarVoz(); speechSynthesis.onvoiceschanged = carregarVoz; }
function falar(texto, sel) {
  const p = $(sel); p.classList.add("falando");
  const fim = () => p.classList.remove("falando");
  if (estado.mudo || !("speechSynthesis" in window)) { setTimeout(fim, 1200); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto); u.lang = "pt-BR"; if (vozPT) u.voice = vozPT; u.rate = 1.03;
  u.onend = fim; u.onerror = fim; speechSynthesis.speak(u);
}

/* ---------- Helpers ---------- */
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("visivel"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("visivel"), 2000); }
function abrirModal(id) { $("#" + id).classList.add("aberto"); }
function fecharModais() { document.querySelectorAll(".modal.aberto").forEach(m => m.classList.remove("aberto")); }
document.addEventListener("click", e => {
  if (e.target.matches("[data-fechar]")) { const m = e.target.closest(".modal"); if (m && !m.hasAttribute("data-trava")) m.classList.remove("aberto"); }
  else if (e.target.classList.contains("modal") && !e.target.hasAttribute("data-trava")) e.target.classList.remove("aberto");
});
document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".modal.aberto:not([data-trava])").forEach(m => m.classList.remove("aberto")); });
const total = () => estado.pontos.precisao + estado.pontos.evidencia + estado.pontos.raciocinio;
const hora = iso => { const d = new Date(iso); return isNaN(d) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };
const safeUrl = u => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : "#"; } catch (_) { return "#"; } };
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function atualizarPlacar() {
  $("#pontos").textContent = total();
  const c = Math.max(0, Math.round(estado.conv));
  $("#badgeConv").textContent = "Convicção: " + c + "%";
  $("#convBarFill").style.width = c + "%";
  $("#badgeVerif").textContent = (estado.usados.size || estado.perguntaFeita) ? "Verificação: ativa ✅" : "Verificação: aguardando";
}
function renderDots() {
  $("#dots").innerHTML = TEMAS.map((_, i) => `<span class="${i === estado.rodada ? "atual" : i < estado.rodada ? "completa" : ""}"></span>`).join("");
  $("#numRodada").textContent = estado.rodada + 1;
}
function renderFontes(st, cache) {
  const chip = (nome, val) => {
    if (val === null || val === undefined) return `<span class="chip na">— ${nome} · n/a</span>`;
    const cls = cache ? "cache" : val ? "ok" : "fail";
    return `<span class="chip ${cls}">${val ? "✓" : "✕"} ${nome}${cache ? " · cache" : ""}</span>`;
  };
  $("#fontesStatus").innerHTML = chip("Câmara", st.camara) + chip("Google News", st.news) + chip("Wikipédia", st.wiki);
  $("#atualizadoEm").textContent = (cache ? "cache de " : "consulta ") + hora(new Date().toISOString());
  $("#livePill").style.opacity = cache ? .5 : 1;
}

/* ---------- Montagem da rodada a partir dos dados AO VIVO ---------- */
function tierFonte(f) {
  f = (f || "").toLowerCase();
  const t3 = ["g1", "folha", "estadão", "estadao", "bbc", "agência brasil", "agencia brasil", "senado", "câmara", "camara", "tse", "conjur", "migalhas", "uol", "cnn", "globo", "nexo", "poder360", "gazeta"];
  const t2 = ["lupa", "aos fatos", "fato ou boato", "comprova", "veja", "carta", "exame", "infomoney", "r7", "record", "band"];
  if (t3.some(x => f.includes(x))) return 3;
  if (t2.some(x => f.includes(x))) return 2;
  return 1;
}
const KW_SUCESSO = /elege|eleito|bancada|maior|vitória|vit[óo]ria|conquista|cadeira|deputad|senad/i;
const KW_NEGA = /fraud|anula|n[ãa]o reconhe|questiona|impugna|contest|suspeita|golpe|inv[áa]lid/i;
const KW_VERIF = /n[ãa]o (h[áa]|apontou|encontrou|houve)|sem (fraude|prova|ind[íi]cio)|desment|falso|checagem|fato ou boato|v[áa]lido/i;
const scoreNegacao = t => (KW_NEGA.test(t) ? 2 : 0) - (KW_VERIF.test(t) ? 3 : 0);

function montarRodada(tema, { camara, news, wiki, status }) {
  const evidencias = [];
  if (camara) evidencias.push({
    id: "cam", espelho: true, tier: 3, peso: 3,
    titulo: `Base oficial ao vivo: ${camara.count} deputados do ${tema.camara} em exercício`,
    detalhe: `Consulta à API de Dados Abertos da Câmara (legislatura atual). Amostra: ${camara.nomes.join(", ")}.`,
    resposta: `Dado oficial em tempo real: a Câmara registra agora ${camara.count} deputados do ${tema.camara} em exercício, eleitos pelo mesmo sistema.` ,
    fonte: "Câmara · Dados Abertos · " + hora(camara.atualizado), url: camara.portal
  });
  news.slice(0, 4).forEach((n, i) => {
    const tier = tierFonte(n.fonte);
    const esp = tema.bancada && KW_SUCESSO.test(n.titulo);
    evidencias.push({
      id: "news" + i, espelho: esp, tier, peso: tier,
      titulo: n.titulo, detalhe: `Manchete real publicada por ${n.fonte}.`,
      resposta: `Manchete ao vivo de ${n.fonte}: ${n.titulo}`,
      fonte: `${n.fonte} · ${hora(n.data)}`, url: n.link
    });
  });
  if (wiki) evidencias.push({
    id: "wiki", espelho: false, tier: 2, peso: 2,
    titulo: "Contexto verificável: " + wiki.titulo,
    detalhe: wiki.texto.slice(0, 240) + (wiki.texto.length > 240 ? "…" : ""),
    resposta: "Contexto da Wikipédia: o sistema eleitoral brasileiro tem camadas de verificação e auditoria.",
    fonte: "Wikipédia PT · " + hora(wiki.atualizado), url: wiki.url
  });

  const n = camara ? camara.count : null;
  const ref = n ? `os ${n} deputados do ${tema.camara} que a Câmara registra agora` : "os deputados do partido eleitos pelo mesmo sistema";
  const perguntas = [
    { texto: `A mesma urna, na mesma seção, elegeu ${ref}. Como ela fraudaria só o voto para presidente?`, score: 100, conv: -18, feedback: "Teste de consistência: a alegação exige que a urna erre só em um cargo, na mesma cédula. Insustentável." },
    { texto: "Que indício de fraude, verificável em fonte pública, sustenta essa alegação hoje?", score: 60, conv: -10, feedback: "Boa: devolve o ônus da prova a quem alega, com fonte checável." },
    { texto: "Isso é tudo mentira de gente mal-intencionada, ponto final.", score: -20, conv: 6, feedback: "Ad hominem não refuta nada — e fortalece a convicção do outro lado." }
  ];

  const ordenadas = [...news].sort((a, b) => (new Date(a.data) - new Date(b.data)) || 0);
  let mutIdx = -1, viuNeg = false;
  ordenadas.forEach((it, i) => { if (scoreNegacao(it.titulo) > 0) viuNeg = true; else if (viuNeg && KW_SUCESSO.test(it.titulo) && mutIdx < 0) mutIdx = i; });
  const origem = ordenadas.map((it, i) => ({ data: hora(it.data), evento: it.titulo, url: it.link, mutacao: i === mutIdx }));

  let convicta = null, best = 0;
  news.forEach(it => { const s = scoreNegacao(it.titulo); if (s > best) { best = s; convicta = it; } });
  const falaConvicta = convicta
    ? { texto: "“" + convicta.titulo + "”", tipo: "manchete real", fonte: convicta.fonte + " · " + hora(convicta.data), url: convicta.link }
    : { texto: "“" + tema.alegacao + "”", tipo: "alegação do desafio", fonte: "sem manchete ao vivo disponível", url: null };

  const fontes = [...new Set(news.map(x => x.fonte))].slice(0, 4).join(", ") || "fontes consultadas";
  const partes = ["Verificação em tempo real, consultada às " + hora(new Date().toISOString()) + "."];
  if (camara) partes.push(`A base oficial da Câmara registra ${camara.count} deputados do ${tema.camara} em exercício agora.`);
  partes.push(`${news.length} manchetes recentes, de ${fontes}, tratam do tema.`);
  if (wiki) partes.push("A Wikipédia confirma o contexto do sistema eleitoral.");
  partes.push(`A alegação “${tema.alegacao}” não encontra respaldo nas fontes ao vivo consultadas.`);
  const verificacao = partes.join(" ");

  return { tema, evidencias, perguntas, origem, falaConvicta, verificacao, status, camara, news, wiki, gerado: new Date().toISOString() };
}

/* ---------- Coleta ao vivo + cache ---------- */
async function coletar(tema) {
  const [cam, nw, wk] = await Promise.allSettled([
    tema.camara ? LIVE.camara(tema.camara) : Promise.resolve(null),
    LIVE.news(tema.newsQuery, 8),
    LIVE.wiki(tema.wiki)
  ]);
  const camara = cam.status === "fulfilled" ? cam.value : null;
  const news = nw.status === "fulfilled" ? (nw.value.itens || []) : [];
  const wiki = wk.status === "fulfilled" ? wk.value : null;
  const status = { camara: tema.camara ? !!camara : null, news: news.length > 0, wiki: !!wiki };
  if (!camara && !news.length && !wiki) throw new Error("offline");
  return montarRodada(tema, { camara, news, wiki, status });
}
const cacheKey = i => "dr_live_v2_" + i;
function salvarCache(i, r) { try { localStorage.setItem(cacheKey(i), JSON.stringify(r)); } catch (_) {} }
function lerCache(i) { try { const s = localStorage.getItem(cacheKey(i)); return s ? JSON.parse(s) : null; } catch (_) { return null; } }

async function carregarRodada() {
  if (estado.carregando) return;
  estado.carregando = true;
  const i = estado.rodada, tema = TEMAS[i];
  $("#loading").style.display = "flex"; $("#erroBox").hidden = true;
  $("#loadingMsg").textContent = "Cruzando Câmara, Google News e Wikipédia em tempo real…";
  ["#btnEvidencias", "#btnPergunta", "#btnOrigem"].forEach(s => $(s).disabled = true);
  let rodada = null, cache = false;
  try { rodada = await coletar(tema); salvarCache(i, rodada); }
  catch (_) { const c = lerCache(i); if (c) { rodada = c; cache = true; } }
  $("#loading").style.display = "none";
  estado.carregando = false;
  if (!rodada) {
    $("#erroMsg").textContent = "Não foi possível consultar as fontes ao vivo agora (rede ou fonte indisponível). Verifique a conexão e tente novamente.";
    $("#erroBox").hidden = false;
    return;
  }
  estado.atual = rodada;
  estado.coletadas[i] = rodada;
  iniciarRodada(rodada, cache);
}

/* ---------- Início / fluxo de rodada ---------- */
function iniciarRodada(r, cache) {
  const dif = $("#difficulty").value;
  estado.conv = dif === "dificil" ? 99 : 95;
  estado.mult = dif === "dificil" ? .8 : 1;
  estado.encerrada = false; estado.usados = new Set();
  estado.perguntaFeita = false; estado.origemAberta = false; estado.mutacaoVista = false;
  $("#alegacao").textContent = "“" + r.tema.alegacao + "”";
  const fc = r.falaConvicta;
  $("#falaConvicta").innerHTML = `${esc(fc.texto)}<span class="fonte">${esc(fc.tipo)} · ${fc.url ? `<a href="${esc(safeUrl(fc.url))}" target="_blank" rel="noopener noreferrer">${esc(fc.fonte)}</a>` : esc(fc.fonte)}</span>`;
  $("#falaVerificadora").innerHTML = "<em>Aguardando evidências…</em>";
  ["#btnEvidencias", "#btnPergunta", "#btnOrigem"].forEach(s => $(s).disabled = false);
  renderDots(); renderFontes(r.status, cache); atualizarPlacar();
  if (cache) toast("Sem rede: usando a última consulta real em cache.");
}
function respostaVerificadora(texto) {
  $("#falaVerificadora").innerHTML = `${esc(texto)}<span class="tag-ia">🔊 voz sintética (IA) — não é voz de pessoa real</span>`;
  falar(texto, "#painelVerificadora");
}
const aplicarConv = delta => { estado.conv = Math.min(100, Math.max(0, estado.conv + delta)); };

/* ---------- Ações ---------- */
$("#btnEvidencias").addEventListener("click", () => {
  sfx.click();
  const r = estado.atual; if (!r) return;
  $("#listaEvidencias").innerHTML = r.evidencias.map(ev => `
    <div class="carta ${estado.usados.has(ev.id) ? "usada" : ""}">
      <div class="top"><b>${esc(ev.titulo)}</b><span class="tier ${ev.espelho ? "espelho" : ""}">${ev.espelho ? "ESPELHO ×1,5" : "TIER " + ev.tier}</span></div>
      <p>${esc(ev.detalhe)}</p>
      <span class="fonte">Fonte: <a href="${esc(safeUrl(ev.url))}" target="_blank" rel="noopener noreferrer">${esc(ev.fonte)}</a></span>
      <button data-ev="${ev.id}">Apresentar</button>
    </div>`).join("");
  abrirModal("modalEvidencias");
});
$("#listaEvidencias").addEventListener("click", e => {
  const b = e.target.closest("[data-ev]"); if (!b || estado.encerrada) return;
  const ev = estado.atual.evidencias.find(x => x.id === b.dataset.ev);
  if (!ev || estado.usados.has(ev.id)) return;
  estado.usados.add(ev.id);
  const drop = Math.round(ev.peso * 8 * (ev.espelho ? 1.5 : 1) * estado.mult);
  const pts = Math.round(ev.peso * 10 * (ev.espelho ? 1.5 : 1));
  aplicarConv(-drop); estado.pontos.evidencia += pts;
  respostaVerificadora(ev.resposta);
  sfx.evid(); burstEl("#painelVerificadora", ["#22e08a", "#37e6ff", "#ffd23a"]);
  toast(`+${pts} evidência${ev.espelho ? " (espelho)" : ""} · convicção −${drop}%`);
  b.closest(".carta").classList.add("usada");
  atualizarPlacar(); checarFim();
});

$("#btnPergunta").addEventListener("click", () => {
  sfx.click();
  const r = estado.atual; if (!r) return;
  $("#feedbackPergunta").textContent = "";
  $("#listaPerguntas").innerHTML = r.perguntas.map((p, i) => `<button class="pergunta" data-p="${i}" ${estado.perguntaFeita ? "disabled" : ""}>${esc(p.texto)}</button>`).join("");
  abrirModal("modalPergunta");
});
$("#listaPerguntas").addEventListener("click", e => {
  const b = e.target.closest("[data-p]"); if (!b || estado.perguntaFeita || estado.encerrada) return;
  const p = estado.atual.perguntas[+b.dataset.p];
  estado.perguntaFeita = true;
  estado.pontos.precisao += Math.max(0, p.score);
  aplicarConv(p.conv < 0 ? Math.round(p.conv * estado.mult) : p.conv);
  $("#feedbackPergunta").textContent = (p.score > 0 ? "+" + p.score + " precisão · " : "") + p.feedback;
  respostaVerificadora(p.feedback);
  if (p.score > 0) { sfx.boa(); burstEl("#painelVerificadora", ["#a06bff", "#37e6ff"]); } else { sfx.ruim(); burstEl("#painelConvicta", ["#ff3b5c", "#ff4fd8"]); }
  document.querySelectorAll(".pergunta").forEach(x => x.disabled = true);
  toast(p.score > 0 ? `+${p.score} precisão` : "Ad hominem: convicção +6%");
  atualizarPlacar(); checarFim();
});

$("#btnOrigem").addEventListener("click", () => {
  sfx.click();
  const r = estado.atual; if (!r) return;
  if (!estado.origemAberta) { estado.origemAberta = true; estado.pontos.raciocinio += 20; toast("+20 raciocínio crítico"); atualizarPlacar(); }
  $("#timeline").innerHTML = r.origem.length
    ? r.origem.map((o, i) => `<li><b>${esc(o.data)}</b> — ${esc(o.evento)} <a href="${esc(safeUrl(o.url))}" target="_blank" rel="noopener noreferrer">fonte</a>${o.mutacao ? `<button class="mutacao" data-mut="${i}">mutação</button>` : ""}</li>`).join("")
    : "<li>Sem cobertura ao vivo disponível para esta consulta.</li>";
  abrirModal("modalOrigem");
});
$("#timeline").addEventListener("click", e => {
  const b = e.target.closest("[data-mut]"); if (!b || estado.mutacaoVista) return;
  estado.mutacaoVista = true; estado.pontos.raciocinio += 15;
  b.textContent = "mutação ✓"; b.disabled = true;
  respostaVerificadora("Mutação identificada: a narrativa mudou de enquadramento ao longo da cobertura, sem ganhar prova.");
  sfx.tick(); toast("+15 raciocínio crítico"); atualizarPlacar();
});

/* ---------- Fim ---------- */
function checarFim() {
  if (estado.encerrada) return;
  const r = estado.atual;
  const tudo = r.evidencias.every(ev => estado.usados.has(ev.id)) && estado.perguntaFeita && estado.origemAberta;
  if (estado.conv < 30) {
    estado.encerrada = true; estado.vitorias++;
    $("#tituloFim").textContent = "✅ Rodada vencida — a evidência ao vivo venceu o grito.";
    $("#textoFim").textContent = r.verificacao;
    respostaVerificadora(r.verificacao);
    sfx.win(); burstEl("#arena", ["#22e08a", "#ffd23a", "#37e6ff", "#a06bff"], 60);
    $("#btnProxima").textContent = estado.rodada < TEMAS.length - 1 ? "Próxima rodada ➜" : "Ver raio-X 🏆";
    abrirModal("modalFimRodada");
  } else if (tudo) {
    estado.encerrada = true;
    $("#tituloFim").textContent = "🤝 Rodada encerrada — a convicção resistiu (" + Math.round(estado.conv) + "%).";
    $("#textoFim").textContent = "As fontes ao vivo desta consulta foram limitadas. Reveja os links, atualize as fontes e tente outra combinação.";
    $("#btnProxima").textContent = estado.rodada < TEMAS.length - 1 ? "Próxima rodada ➜" : "Ver raio-X 🏆";
    abrirModal("modalFimRodada");
  }
  if (estado.encerrada) ["#btnEvidencias", "#btnPergunta", "#btnOrigem"].forEach(s => $(s).disabled = true);
}
$("#btnProxima").addEventListener("click", () => {
  fecharModais();
  if (estado.rodada < TEMAS.length - 1) { estado.rodada++; carregarRodada(); }
  else fimDeJogo();
});
function fimDeJogo() {
  const p = estado.pontos;
  $("#resumoFim").innerHTML = `Vitórias: <b>${estado.vitorias}/5</b> · Precisão <b>${p.precisao}</b> · Evidência <b>${p.evidencia}</b> · Raciocínio <b>${p.raciocinio}</b> · Total <b>${total()}</b>.<br>O espelho não fabrica falas: mostra contradições reais, consultadas ao vivo, com fonte e hora.`;
  abrirModal("modalFim"); sfx.win();
}
$("#btnCopiar").addEventListener("click", async () => {
  const txt = "DUELO DA REALIDADE — raio-X (fontes ao vivo)\n" + estado.coletadas.filter(Boolean).map((r, i) =>
    `Rodada ${i + 1}: "${r.tema.alegacao}" (consulta ${hora(r.gerado)})\nVerificação: ${r.verificacao}\nFontes: ` +
    r.evidencias.map(e => e.fonte + " " + e.url).join(" | ")).join("\n\n");
  try { await navigator.clipboard.writeText(txt); toast("Raio-X copiado com fontes ao vivo."); }
  catch (_) { const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); toast("Raio-X copiado."); }
});
function reiniciar() {
  estado.rodada = 0; estado.vitorias = 0; estado.coletadas = [];
  estado.pontos = { precisao: 0, evidencia: 0, raciocinio: 0 };
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  fecharModais(); carregarRodada();
}
$("#btnReiniciar").addEventListener("click", reiniciar);
$("#btnRestart").addEventListener("click", () => { sfx.click(); reiniciar(); });
$("#btnRetry").addEventListener("click", () => { sfx.click(); carregarRodada(); });
$("#btnRetryErro").addEventListener("click", () => { sfx.click(); carregarRodada(); });
$("#difficulty").addEventListener("change", () => { if (estado.atual && !estado.encerrada) { iniciarRodada(estado.atual, false); toast("Dificuldade aplicada — rodada reiniciada."); } });
$("#btnMudo").addEventListener("click", () => {
  estado.mudo = !estado.mudo; $("#btnMudo").textContent = estado.mudo ? "🔇" : "🔊";
  if (estado.mudo && "speechSynthesis" in window) speechSynthesis.cancel();
  if (!estado.mudo) { ac(); sfx.click(); }
});

/* ---------- Avatar ---------- */
function aplicarAvatar() {
  const a = estado.avatar || { tipo: "emoji", valor: AVATARES[0] };
  const html = a.tipo === "img" ? `<img src="${esc(a.valor)}" alt="Avatar do jogador">` : `<span>${esc(a.valor)}</span>`;
  $("#avatarConvicta").innerHTML = html; $("#avatarVerificadora").innerHTML = html;
}
function salvarAvatar(a) { estado.avatar = a; try { localStorage.setItem("dr_avatar", JSON.stringify(a)); } catch (_) {} aplicarAvatar(); }
$("#presets").innerHTML = AVATARES.map(e => `<button data-emoji="${e}" title="Personagem fictício">${e}</button>`).join("");
$("#presets").addEventListener("click", e => { const b = e.target.closest("[data-emoji]"); if (!b) return; salvarAvatar({ tipo: "emoji", valor: b.dataset.emoji }); sfx.click(); toast("Avatar fictício aplicado aos dois lados."); fecharModais(); });
$("#inputAvatar").addEventListener("change", e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { const img = $("#previewAvatar"); img.src = r.result; img.hidden = false; }; r.readAsDataURL(f); });
$("#consentAvatar").addEventListener("change", e => { $("#btnUsarImagem").disabled = !e.target.checked; });
$("#btnUsarImagem").addEventListener("click", () => { const src = $("#previewAvatar").src; if (!src) return; salvarAvatar({ tipo: "img", valor: src }); sfx.click(); toast("Sua imagem fica só neste navegador."); fecharModais(); });
$("#btnAvatar").addEventListener("click", () => { sfx.click(); abrirModal("modalAvatar"); });

/* ---------- Init ---------- */
(function init() {
  try { const s = localStorage.getItem("dr_avatar"); if (s) estado.avatar = JSON.parse(s); } catch (_) {}
  aplicarAvatar(); renderDots(); atualizarPlacar();
  if (!estado.avatar) abrirModal("modalAvatar");
  carregarRodada();
  document.addEventListener("pointerdown", () => ac(), { once: true });
})();