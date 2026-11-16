# Produto

O NexoHub é um hub de ferramentas práticas para PDFs e documentos, 100% gratuito, local-first,
Windows-first e com client web suportado. Sem complexidade, burocracia ou termos jurídicos:
o foco é a produtividade direta ao estilo iLovePDF, com a segurança e privacidade do processamento
offline no computador do usuário.

## Versão disponível

Versão 0.2.6 sincronizada e validada em 16/11/2026 (último instalador publicado no GitHub Releases: Windows 0.2.4 de 30/10/2026); website em [nexojuris.ia.br/hub/](https://nexojuris.ia.br/hub/). Instalação, atualização e casos de tradução instalada foram conferidos na validação publicada anterior; o [relatório de release](RELEASE-VALIDATION.md) delimita as evidências. OCR, tradução, resumo com IA local e revisão/suíte Office opcionais podem exigir recursos baixados sob demanda no primeiro uso. A disponibilidade offline depende dos recursos locais.

## Evolução opcional em implementação

O [ADR-020](adr/ADR-020-nuvem-opcional-cotas.md) registra a estrutura híbrida aprovada para 300 participantes. O uso local continua gratuito e não exige login; entrar é opcional na mesma conta da web e do Windows. Identidade Google/link de e-mail, conta/saldo e cotas persistentes estão integrados ao projeto Firebase dedicado. A [homologação de identidade real](evidencias/hybrid/IDENTIDADE-REAL-2026-10-30.md) distingue configuração, entrada real e publicação. A política de processamento documental remoto permanece desativada; esta integração não homologa OCR/Office nem ativa motores pagos.

## Conta de usuário

O acesso é apresentado como **Conta**, com **Entrar na sua conta**, **Continuar com Google**
e **Continuar com e-mail**. Após a autenticação, **Minha conta** identifica a pessoa por
seu e-mail e oferece **Sair**. A conta não depende da disponibilidade de saldo ou de motores.
O login não expõe arquitetura, ambientes de execução, estados de implantação ou avisos sobre
a obrigatoriedade de entrar. Informações de processamento e consumo pertencem à operação
documental correspondente, quando disponível, e não à apresentação da conta.
O nome e a foto do Google, quando existem, aparecem apenas neste aparelho e não são guardados
pelo NexoHub. O acesso à nuvem continua por convite individual (ADR-020); entrar com uma conta
Google sem convite identifica a pessoa, mas não libera recursos em nuvem.

## Plataformas

- **Windows desktop:** alvo produtivo principal. O aplicativo usa Tauri v2, Rust e WebView2,
  com processamento local.
- **Web:** alvo suportado pelo mesmo client React 19/TypeScript, executando transformações
  documentais com suporte local em memória e sem upload de arquivos para servidores externos.
- **Linux, Android e iOS:** alvos congelados por prazo indeterminado.

## Experiência do Produto

- **Hub de Ferramentas (Home):** modo PDF/texto com seis grupos e modo Imagem com seis ferramentas:
  - **Organizar PDF:** organizar, juntar, dividir, rotacionar, recortar, numerar, remover e extrair páginas.
  - **Editar e comparar PDF:** editar conteúdo compatível (incluindo edição inline no palco), comparar documentos e preencher formulários.
  - **Otimizar PDF:** comprimir e reparar dentro dos perfis suportados.
  - **Converter PDF:** imagem, JPG, extração de imagens, Markdown, Excel, Word, PDF/A (`PDF/A-1b` e `PDF/A-2b`), Suíte Office (`Word`, `Excel` e `PowerPoint` ↔ `PDF`), HTML e digitalização com câmera/imagens locais.
  - **Texto e OCR:** reconhecer, comparar, revisar, traduzir texto (preservando nomes explícitos) e resumir PDF com IA local (`Qwen2.5 0.5B Instruct`) com citações verificadas por página.
  - **Segurança:** marca d’água, proteção, ocultação, rubrica visual e desbloqueio com senha conhecida.
  - **Modo Imagem:** comprimir, redimensionar, recortar, converter, girar e aplicar marca d’água.

  *Critério estrito de vitrine:* Somente são anunciadas e disponibilizadas ferramentas com executor funcional ativo e testado (**42 ferramentas implementadas** no catálogo: `38` no navegador offline, `41` na Web com adapter HTTP / nuvem híbrida e `42` no Desktop Windows). Ferramentas que dependem de Superpoder Desktop instalável (`office.suite`) são filtradas por superfície via `@/platform/tool-availability.ts`, sem cartões `"Em breve"` nem rotas simuladas. Confira os limites de cada perfil no [Catálogo de Ferramentas](CATALOGO-FERRAMENTAS.md).

- **Tela Dedicada por Ferramenta (`DedicatedToolView`):** experiência sem fricção ao estilo iLovePDF:
  1. O usuário clica na ferramenta desejada.
  2. Acessa uma tela focada com botão amplo de seleção/arraste de arquivo PDF ou texto.
  3. Ajusta as opções efetivamente usadas pelo executor.
  4. Executa a tarefa localmente (na memória do navegador ou no core Rust) e salva ou baixa um novo arquivo resultante, conforme a plataforma.

## Garantias do produto

- **Gratuito & Livre:** sem cobranças nem filas artificiais; os engines aplicam limites técnicos
  documentados de tamanho e páginas;
- **Privacidade total (Local-first):** arquivos são processados diretamente na máquina do usuário;
- **Originais preservados:** as operações produzem novos arquivos derivados, sem sobrescrever o original;
- **Indisponibilidade transparente:** requisitos de sidecars opcionais (como OCR ou corretor) são
  gerenciados de forma explícita pelo fluxo de capacidades locais e pela instalação opcional do runtime.

Contas obrigatórias, billing, telemetria invasiva, jargões jurídicos e mesas de edição excessivamente
complexas estão fora do escopo do produto.

## Direção em avaliação — 25/10/2026

Todos os recursos já implementados permanecem gratuitos, inclusive o editor PDF atual.
O usuário propôs avaliar um módulo futuro de edição avançada pago, composto por capacidades
novas. Não há autorização para transferir recursos atuais para uma oferta paga. Preços,
contas, licenciamento e cobrança ainda não estão definidos nem implementados; as garantias
atuais acima continuam descrevendo o produto disponível.

O usuário confirmou a direção de mesas modernas que ocupem a janela, com documentos em rolagem
interna e ferramentas/ação principal acessíveis sem percorrer uma página longa. Essa organização
preserva logo, marca e identidade, e cada ferramenta mantém sua própria mesa. A modernização
visual contempla as ferramentas gratuitas. Detalhes na
[proposta de mesas](superpowers/specs/2026-10-24-padrao-mesas-ferramentas-design.md).

## Idioma

O idioma canônico do NexoHub é português brasileiro (`pt-BR`).

O editor web adiciona elementos e modifica objetos textuais compatíveis localmente, com
verificação do conteúdo exportado. Escopo e limites: [EDITAR-PDF-WEB.md](EDITAR-PDF-WEB.md).
