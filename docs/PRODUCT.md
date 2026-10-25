# Produto

O NexoHub é um hub de ferramentas práticas para PDFs e documentos, 100% gratuito, local-first,
Windows-first e com client web suportado. Sem complexidade, burocracia ou termos jurídicos:
o foco é a produtividade direta ao estilo iLovePDF, com a segurança e privacidade do processamento
offline no computador do usuário.

## Plataformas

- **Windows desktop:** alvo produtivo principal. O aplicativo usa Tauri v2, Rust e WebView2,
  com processamento local.
- **Web:** alvo suportado pelo mesmo client React 19/TypeScript, executando transformações
  documentais com suporte local em memória e sem upload de arquivos para servidores externos.
- **Linux, Android e iOS:** alvos congelados por prazo indeterminado.

## Experiência do Produto

- **Hub de Ferramentas (Home):** catálogo de ferramentas práticas organizado em 5 categorias ergonômicas:
  - **Organizar PDF:** Organizar páginas, Juntar múltiplos PDFs, Dividir intervalos, Rotacionar páginas e Numeração automática de páginas.
  - **Otimizar PDF:** Comprimir PDF com perfis reais de compactação estrutural e imagens.
  - **Converter PDF:** Imagens (JPG/PNG/WebP) para PDF e PDF para imagens JPG de alta resolução (ZIP).
  - **Texto e OCR:** Reconhecimento óptico de caracteres (OCR) local, Comparação semântica de textos, Revisão ortográfica/morfológica contextual e Tradução rápida offline.
  - **Segurança:** Inserção de Marca d'água com carimbo textual configurável.
  
  *Critério estrito de vitrine:* Somente são anunciadas e disponibilizadas ferramentas com executor funcional ativo e testado (35 ferramentas ativas no catálogo web deste checkout; a homologação instalada do desktop permanece separada). Ferramentas planejadas dependentes de novos motores ou ADRs (como conversores Office complexos e PDF/A) são documentadas no [Catálogo de Ferramentas](CATALOGO-FERRAMENTAS.md) e permanecem desativadas da vitrine até sua homologação completa.

- **Tela Dedicada por Ferramenta (`DedicatedToolView`):** experiência sem fricção ao estilo iLovePDF:
  1. O usuário clica na ferramenta desejada.
  2. Acessa uma tela focada com botão amplo de seleção/arraste de arquivo PDF ou texto.
  3. Ajusta as opções efetivamente usadas pelo executor.
  4. Executa a tarefa localmente (na memória do navegador ou no core Rust) e baixa o arquivo resultante instantaneamente.

## Garantias do produto

- **Gratuito & Livre:** sem cobranças nem filas artificiais; os engines aplicam limites técnicos
  documentados de tamanho e páginas;
- **Privacidade total (Local-first):** arquivos são processados diretamente na máquina do usuário;
- **Originais preservados:** as operações produzem novos arquivos derivados, sem sobrescrever o original;
- **Indisponibilidade transparente:** requisitos de sidecars opcionais (como OCR ou corretor) são
  gerenciados de forma explícita através de Superpoderes locais.

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
