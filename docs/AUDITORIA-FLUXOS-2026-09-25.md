# Auditoria funcional das ferramentas anunciadas

Data: 25/09/2026. Checkout: `codex/estabilizacao-ferramentas`, base `c93b0d8`, com alterações locais ainda sem commit.

## Escopo e critério

A vitrine anuncia seis ferramentas nas plataformas web e Windows: Organizar, Juntar, Dividir,
Rotacionar e Comprimir PDF e Comparar textos. Para cada uma, o critério é selecionar ou informar a
entrada, executar, obter conteúdo válido e salvar o resultado. No Windows, a operação também deve
persistir original, artifact derivado e linhagem no projeto local.

## Falhas reproduzidas

| Falha | Causa observada | Verificação após a correção |
| --- | --- | --- |
| Menu de ferramentas cortado | Grade fixa de seis colunas excedia a janela de 1100 px; o menu começava em `x = -300,7` | Teste E2E confirma limites dentro da janela |
| Prévia indisponível após selecionar PDF | PDF.js transferia o `ArrayBuffer` ao worker e as próximas renderizações recebiam um buffer destacado (`DataCloneError`) | Miniatura JPEG real para PDF de 1 e de 47 páginas |
| “Adicionar mais arquivos” sem ação | O `input[type=file]` deixava de existir ao entrar na tela de trabalho | Teste E2E abre o seletor e adiciona o segundo PDF |
| Saída desktop dependente de link `blob:` | A tela não tinha caminho nativo de salvamento verificável | Diálogo nativo gravou PDF de duas páginas; arquivo lido de volta |
| Comparação tinha segunda exportação direta por DOM | Botão `.diff` contornava o executor e o port da plataforma | Botão encaminhado ao executor comum; E2E e app instalado chegaram à tela de resultado |
| MSI e NSIS geravam duas instalações | O pipeline publicava dois instaladores independentes | Inno Setup único: instalação e atualização locais com um registro e um atalho |
| Terminal abria junto e controlava a vida do app | `main.rs` gerava PE com subsistema 3 (console) | Build e instalação agora têm subsistema 2 (GUI); abertura pelo atalho criou o app sem novo Windows Terminal |
| Perfis de compressão exibidos sem efeito | A UI passava `extreme`, `recommended` ou `less`, mas o engine web ignorava a opção e o adapter desktop fixava o nível em 1 | Os três perfis agora controlam qualidade e dimensão de imagens elegíveis; teste E2E confirma tamanhos progressivos e texto selecionável |
| Ícone azul divergente da marca | Cabeçalho e recursos Windows usavam um N azul enquanto a marca NexoHub é preta e vermelha | Cabeçalho, favicon e ícone extraído do executável Windows usam o mesmo N branco e vermelho sobre fundo escuro |

## Evidência por ferramenta

| Ferramenta | Web: saída conferida | Tauri sem instalador: artifact conferido |
| --- | --- | --- |
| Organizar PDF | Exclusão de página resultou em PDF de 1 página | PDF de 2 páginas no projeto temporário; salvamento nativo e leitura do arquivo |
| Juntar PDF | Dois PDFs de 1 página resultaram em PDF de 2 páginas | Dois PDFs de 2 páginas resultaram em PDF de 4 páginas |
| Dividir PDF | Seleção da segunda página resultou em PDF de 1 página, largura 300 | Mesmo resultado persistido: 1 página, largura 300 |
| Rotacionar PDF | Página baixada com rotação de 90° | Artifact persistido com rotação de 90° |
| Comprimir PDF | Três perfis reduziram imagem JPEG incorporada em ordem progressiva e preservaram texto selecionável | O fluxo Tauri anterior persistiu PDF válido; os novos perfis foram testados no core Rust com JPEG e RGB/Flate, original imutável e recusa de PDF assinado |
| Comparar textos | Relatório baixado contém adição e remoção | Relatório persistido contém adição e remoção |

O teste automatizado `pnpm test:e2e` cobriu 23 fluxos web e passou. O executável Tauri foi gerado
com `tauri build --no-bundle`; a inspeção da janela real foi feita por CDP com PDFs e textos sintéticos.
O projeto temporário usado foi `%TEMP%/NexoHub-QA-2026-09-25/NexoHub.nexohub`.

## Gates executados e limites

- `pnpm check`, `pnpm test`, `cargo fmt --all --check`, `cargo clippy --workspace --all-targets
  --locked -- -D warnings`, `cargo test --workspace --locked` e `pnpm release:verify` passaram.
- `pnpm build:windows` gerou `NexoHub_0.1.0-alpha.1_x64-setup.exe` por Inno Setup 6.7.3.
  O build inclui bootstrapper WebView2 da Microsoft com assinatura Authenticode verificada.
- Instalação e atualização silenciosas locais saíram com código 0. Há um registro de desinstalação,
  um atalho no menu Iniciar e nenhum atalho de desktop criado por padrão. O hash SHA-256 do
  executável instalado coincide com o gerado no build. O app instalado abriu sem terminal ativo;
  a paleta de comandos abriu e a exportação de comparação chegou à tela de resultado.
- A desinstalação silenciosa removeu executável, atalho e registro; a reinstalação restaurou
  exatamente um de cada. A instalação em Windows limpo, sem WebView2 prévio, ainda não foi exercitada.
  Se o WebView2 estiver ausente, o bootstrapper precisa de internet na instalação. Esse gate
  permanece obrigatório antes de qualquer release pública.
- O build local inclui só o runtime base e o bootstrapper WebView2. O workflow de release obtém
  os sidecars opcionais; as seis ferramentas anunciadas não dependem deles.
- O build Windows verifica o cabeçalho PE e falha caso o executável volte a usar o subsistema de
  console. Após reinstalar, o atalho abriu o processo do app e nenhum processo Windows Terminal novo.
- A compressão por imagens foi validada em PDFs sintéticos com JPEG e RGB/Flate; formatos com
  máscaras, espaços de cor complexos e codificações não suportadas conservam a imagem original.
  Ainda não há benchmark em um conjunto representativo de PDFs reais nem teste da nova versão
  instalada. O ícone preto e vermelho foi extraído e inspecionado do executável atualizado.

Não há declaração de release pronta até concluir esses gates.
