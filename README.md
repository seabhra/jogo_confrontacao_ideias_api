# 🪞 Jogo de Confrontação de Ideias — Espelho Real · Ao Vivo

Jogo educativo de checagem em tempo real. A cada rodada, evidências, manchetes,
linha do tempo e a verificação falada (voz sintética) são gerados a partir de
fontes públicas consultadas **no momento da consulta**, via Vercel Functions:

- **Câmara dos Deputados — Dados Abertos** (deputados do partido em exercício)
- **Google News RSS** (manchetes reais com fonte, data e link)
- **Wikipédia PT** (contexto verificável)

## Guardrails (não remover)
- Avatar = personagem fictício **ou foto do próprio usuário com consentimento**.
  A imagem nunca sai do navegador (localStorage).
- Toda fala/evidência tem **fonte, data/hora e link**. Nada é atribuído a pessoa
  real sem citação real.
- Voz da verificação = **TTS sintético rotulado**. Nenhum rosto/voz de terceiros
  é sintetizado.
