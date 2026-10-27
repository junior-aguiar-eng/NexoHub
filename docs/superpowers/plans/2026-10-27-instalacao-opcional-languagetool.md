# Instalação opcional do LanguageTool — execução ADR-019

Objetivo autorizado: concluir o pacote NexoHub sem incorporar binários LanguageTool/Java,
com instalação opcional do mesmo runtime oficial, validada em Windows limpo. Sem push,
deploy ou release. DOC-C2 excluído. Worktree `fix/auditoria-website`, base `54d0dab`.

Ruling: a pesquisa das fontes do pacote completo permanece na issue #12247; não é
declarada concluída nem usada como aprovação de redistribuição. O usuário escolheu
explicitamente a instalação separada do ADR-019. A prova lexical bretã já obtida será
preservada, sem prosseguir em hipóteses de outros idiomas fora deste caminho escolhido.

## 1. Política e pacote

- [x] Reproduzir em teste a incorporação indevida do runtime pelo wildcard atual.
- [x] Trocar wildcard por lista explícita de arquivos e validar a política no empacotador.
- [x] Gerar recursos de setup e mensagens Inno a partir do catálogo pt-BR.
- [x] Retirar download obrigatório dos sidecars no workflow; preservar build local.

## 2. Instalação opcional

- [x] Testar instalação em destino novo, repetição idempotente, corrupção e conflito.
- [x] Reutilizar manifesto, hashes e fluxo de staging; suportar manifesto/inventário empacotados.
- [x] Baixar por HTTPS, verificar arquivos antes de publicar o destino e recusar conflitos.
- [x] Tarefa opcional desmarcada; erro explícito e código de saída não zero quando falhar.
- [x] Instrução clara quando o revisor nativo estiver indisponível; sem acesso nativo direto pela UI.

## 3. Validação e entrega

- [x] Testes de scripts, check/typecheck, quality, licenças e verificações nativas pertinentes.
- [x] Build Windows/Inno; inspecionar instalação base sem payload LanguageTool/Java.
- [x] Em Sandbox: download/instalação opcionais reais, revisão autoral, repetição e upgrade.
- [x] Conferir falha da opção e mensagem; preservar instalação já verificada e usuário sem download.
- [x] Revisão independente final; documentação reconciliada e commits locais.

## Evidência de fontes preservada

A execução isolada com Apertium `99007c6bfff287d6a4b1b104f06a151c1cc9d4f4`, conversor LT
`5a0fa50578f4010fc037a25750ff7ae0d8b76a63`, lttoolbox 3.3.2 e locale UTF-8 reproduziu
278.023 triplas POS bretãs, sem faltas ou adições. Coletor `scripts/reproduzir-pos-bretao.mjs`.
Irlandês/árabe permaneceram hipóteses não homologadas; suas provas locais não são usadas
para afirmar correspondência dos dados nem para alterar o runtime do produto.
