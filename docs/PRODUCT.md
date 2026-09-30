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

- **Hub de Ferramentas (Home):** catálogo de ferramentas práticas organizado por categorias.
  Só são anunciadas como executáveis as combinações de ferramenta e plataforma com executor
  disponível; os demais comandos podem existir no core sem aparecer na vitrine.
- **Tela Dedicada por Ferramenta:** experiência sem fricção ao estilo iLovePDF:
  1. O usuário clica na ferramenta desejada.
  2. Acessa uma tela focada com botão amplo de seleção/arraste de arquivo PDF.
  3. Ajusta as opções efetivamente usadas pelo executor.
  4. Executa a tarefa localmente e baixa o arquivo resultante.

## Garantias do produto

- **Gratuito & Livre:** sem cobranças nem filas artificiais; os engines aplicam limites técnicos
  documentados de tamanho e páginas;
- **Privacidade total (Local-first):** arquivos são processados diretamente na máquina do usuário;
- **Originais preservados:** as operações produzem novos arquivos derivados, sem sobrescrever o original;
- **Indisponibilidade transparente:** requisitos de sidecars opcionais (como OCR ou corretor) são
  gerenciados de forma explícita através de Superpoderes locais.

Contas obrigatórias, billing, telemetria invasiva, jargões jurídicos e mesas de edição excessivamente
complexas estão fora do escopo do produto.

## Idioma

O idioma canônico do NexoHub é português brasileiro (`pt-BR`).
