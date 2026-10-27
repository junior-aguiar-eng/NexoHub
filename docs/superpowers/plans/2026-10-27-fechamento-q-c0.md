# Fechamento do Q-C0 — plano de execução

> Execução inline com `superpowers:executing-plans`; verificar cada resultado antes de marcar.

**Objetivo:** concluir os critérios efetivos do Q-C0, preservando evidências e limitações.
**Arquitetura:** ferramentas e motores existentes, sem serviço remoto; atualização local LanguageTool autorizada em ADR-018.
**Tecnologias:** pnpm, TypeScript strict, React, Playwright/Chromium, Tauri/Rust, Windows x64.
**Contrato:** seção Q-C0 do plano `2026-09-24-estabilizacao-ferramentas-atuais.md` e
`docs/DEFINITION-OF-DONE.md`.

## Restrições

- Pedido de 27/10 autoriza commit e execução das pendências do Q-C0; push/deploy não solicitados.
- DOC-C2 permanece excluído. Não implementar perspectiva ou outro pré-processador do scanner.
- Preservar checkout principal e trabalho anterior no worktree `fix/auditoria-website`.
- Captura de câmera física depende de material preparado e consentimento específico do usuário.
- Sem declarar máquina limpa, pouca RAM ou segundo dispositivo com base neste Windows de 32 GB.
- Limites intrínsecos de suporte não são funcionalidades novas autorizadas pelo gate de qualidade.

## Tarefa 1 — preservar a entrega atual

Arquivos: alterações de compressão/scanner, E2E, corpus e documentos já presentes no início.

- [x] Confirmar worktree, remoto, HEAD `b345b62` e índice sem staged anterior.
- [x] Repetir suíte completa sem builds/E2E concorrentes; investigar qualquer falha sem enfraquecer teste.
- [x] Revisar a entrega por leitura independente e resolver achados materiais.
- [x] Executar check/quality e commit da unidade lógica aprovada.

## Tarefa 2 — validar o catálogo web integral

Arquivos: runners existentes, relatórios locais e `docs/quality/Q-C0-FECHAMENTO.md`.

- [x] Build raiz e E2E integral Chromium com dois workers, registrando recusas, skips e falhas.
- [x] Build `/hub/` e runner oficial integral de subpasta com dois workers.
- [x] Investigar falhas reproduzidas; corrigir somente causas dentro do escopo, com regressões.
- [x] Registrar resultados por comando e preservar todos os testes anteriores.

## Tarefa 3 — corpus, licenças e recursos

Arquivos: `docs/quality/q-c0.json`, documentos técnicos e relatórios existentes.

- [x] Revisar as 35 entradas: origem/licença/hash, suportados, recusados e não medidos.
- [x] Auditar inventários/avisos distribuídos e advisories atuais, sem alterar lockfiles automaticamente.
- [x] Consolidar medições já realizadas e identificar exatamente corpus/dispositivo/frio/quente/bytes/memória.
- [x] Executar medições faltantes viáveis no hardware atual, sem equiparar emulação a hardware físico.
- [x] Capturar amostra física autorizada e preservar proveniência; leitura OCR reprovada nessa amostra.
- [x] Windows Sandbox limpo de 4 GB identificado e exercitado; sem alegar segundo hardware físico.

## Tarefa 4 — Windows instalado

Arquivos: scripts existentes, instalador e relatório de fechamento; sem alterar configuração sensível.

- [x] Conferir dependências/runtime e construir o aplicativo Windows pelo pipeline do projeto.
- [x] Gerar e identificar instalador por hash; verificar instalação/abertura/operações em destino de teste.
- [x] Distinguir ensaio nesta máquina de uma instalação limpa; registrar evidência específica por operação.

## Tarefa 5 — aceite final

- [x] Reconciliar cada checkbox global com suas evidências e registrar somente os critérios satisfeitos.
- [x] Executar formatter/lint/typecheck, quality e testes pertinentes às últimas mudanças.
- [x] Commit das novas unidades verificadas, com diff staged e mensagem fiel em português.
- [x] Declarar Q-C0 completo somente quando não restar critério sem prova.

## Registro de execução

- 27/10: câmera `HD User Facing` reconhecida; Windows 11 Pro x64 `10.0.26300`, Acer Nitro
  AN515-43 com 32.147.910.656 bytes de RAM física. Isso identifica um dispositivo disponível.
- O usuário autorizou câmera com página preparada e informou possuir somente este Windows.
  O Sandbox foi iniciado e forneceu uma VM limpa com 4 GB para ensaio restrito do scanner.

- Resultados: commits `fedebc5`, `1fb656c` e `fb00631`; 887 testes JS/TS e 35 Python;
  E2E raiz 370 aprovados/5 skips e subpasta 286 aprovados. Foto textual capturada, OCR
  0/4 referências; miniatura nativa corrigida e PDF exportado com JPEG intacto no host
  e no Sandbox. Detalhes no relatório de fechamento.
- Atualização LanguageTool 20261027 autorizada para adoção/instalação local em ADR-018.
  Instalação verificada e integração real Rust aprovadas; distribuição ainda condicionada
  às fontes e obrigações de licença.

- Fechamento final: 893 JS/TS, check/typecheck, quality 7, licenças e versão aprovados;
  E2E focados 6 raiz + 6 subpasta após guarda de concorrência. Build Tauri 7 min 26 s,
  Inno 154 s, instalação/upgrade de ensaio e 155 JARs verificados; download nativo exato
  depois de aplicar sugestões durante processamento. Commits finais registrados no Git.
