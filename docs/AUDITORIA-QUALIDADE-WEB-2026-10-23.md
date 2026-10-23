# Auditoria da qualidade e utilidade das ferramentas web

Data: 23/10/2026. Base: `d9d647e`. Somente website; alterações desta auditoria ainda locais.

## Critério e conclusão

As ferramentas têm utilidade real, mas a presença de um botão, um download ou um teste com engine
simulado não comprova qualidade. Foram usados documentos sintéticos válidos, extração de texto por
PDF.js, inspeção dos arquivos produzidos, renderização comparativa e execução real no Chromium.
Não foram usados documentos de usuários, uploads externos ou novas dependências.

As operações usuais de PDF e a comparação textual passaram nos cenários exercitados. OCR e revisão
são úteis com os motores efetivamente carregados e conferência do resultado. A tradução mantém
um motor neural integrado, mas sua qualidade linguística ainda não foi homologada nesta auditoria.
Não há declaração de qualidade universal para arquivos arbitrários ou de validação do desktop.

## Avaliação por ferramenta

| Ferramenta | Utilidade e evidência | Limite relevante |
| --- | --- | --- |
| Organizar PDF | Reordena, exclui e gira páginas; conteúdo, ordem e geometria conferidos nas saídas e nos testes existentes. | Formulários interativos, marcadores e PDFs complexos não foram homologados como conjunto representativo. |
| Juntar PDF | Produz um documento na ordem selecionada; renderizações das páginas conferidas contra as originais. Arquivo inválido interrompe a operação. | Não implica preservar toda a navegação ou estrutura lógica de documentos complexos. |
| Dividir PDF | Intervalos separados/unificados e seleção de páginas produzem os trechos esperados; modo fixo corrigido. ZIP preserva nomes acentuados. | Miniaturas do painel ainda usam primeira/última página globais em alguns intervalos; a saída foi conferida independentemente da prévia. |
| Rotacionar PDF | Altera orientação sem rasterizar o documento; páginas e conteúdo preservados nos casos testados. | Não equivale a detectar automaticamente a orientação correta de digitalizações. |
| Comprimir PDF | Perfis alteram qualidade/dimensões de imagens elegíveis e preservam texto selecionável. Casos JPEG/RGB-Flate e ausência de redução são exercitados. | A recompressão de imagens é com perdas conforme o perfil; imagens complexas não suportadas permanecem intactas. Nem todo PDF pode encolher. |
| Imagem para PDF | PNG, JPEG e WebP resultam em páginas com proporção e quantidade corretas; opções de tamanho/margem exercitadas. | Fotos com EXIF complexo e conjuntos grandes não receberam benchmark representativo. |
| PDF para JPG | JPEG real com cores conferidas e resolução corrigida para os 150 DPI anunciados; múltiplas páginas são empacotadas em ZIP. | Rasterização transforma texto e vetores em imagem; não preserva seleção de texto. |
| Marca d'água | Estampa respeita CropBox/rotação e reduz a fonte de texto longo para caber na área visível; texto original preservado. | A fonte padrão cobre português/WinAnsi; texto arbitrário em outros alfabetos não foi homologado. |
| Número de páginas | Rótulos na posição visual solicitada, inclusive em páginas recortadas e giradas 0/90/180/270 graus. | Conjunto representativo de formatos extremos e tamanhos muito pequenos não foi homologado. |
| Reconhecer texto | Tesseract real reconheceu duas linhas em inglês; camada pesquisável preservou aparência pixel a pixel. Unicode, caixas e rotações validados separadamente. | Reconhecimento em português/espanhol, manuscritos, ruído e múltiplas colunas ainda precisam de corpus real. Primeiro uso pode exigir obter worker/modelos pela rede. |
| Comparar textos | Diff textual exato e métricas corrigidas para documentos longos; Unicode canônico e erros de limite tratados. | Mede diferenças de palavras/linhas, não equivalência semântica. Limite existente de 10 mil linhas; divergências densas ainda podem exigir tempo quadrático. |
| Revisar texto | Hunspell real recuperado e testado em desenvolvimento e produção; ortografia fora de regras prontas é detectada. Falsos positivos graves corrigidos. | Sugestões exigem julgamento, especialmente em nomes, termos técnicos e frases ambíguas. Ausência de achados não certifica correção linguística integral. |
| Traduzir texto | Segmentação/montagem conservam espaços, pontuação, Unicode e identificadores; resposta vazia falha explicitamente. | Pesos NLLB não foram baixados para benchmark semântico. Avaliar precisão, omissões e fluência antes de recomendar tradução de documentos críticos. |

## Defeitos reproduzidos e corrigidos

- **Revisão corrompia português correto:** “O agente foi” virava “O a gente foi”; “nos faz” virava
  “nós fazemos”; verbos válidos recebiam acentos indevidos. Regras contextuais ficaram mais precisas,
  preservando os casos legítimos cobertos anteriormente e protegendo URLs, emails e placeholders.
- **Motor ortográfico não carregava no navegador:** imports ESM/UMD e pré-bundle impediam inicializar
  Hunspell. O mesmo motor e dicionário foram recuperados, sem substituição por engine mais pesado.
  Falha real agora bloqueia a revisão completa com mensagem legível, em vez de indicar conformidade.
- **Tradução perdia conteúdo antes/depois do modelo:** prefixos de pontuação, espaços e tokens longos
  eram perdidos ou recombinados com espaços artificiais. A segmentação conserva o conteúdo literal;
  marcadores e links protegidos não são enviados como prosa para tradução, inclusive quando excedem
  400 caracteres. Um teste com modelo simulado que altera toda prosa comprova a preservação literal.
- **Comparação inventava divergência total acima de 600 tokens:** 310 palavras iguais e uma alterada
  resultavam em 0% de similaridade. Myers/Hirschberg exatos substituem o fallback aproximado; o caso
  passa a indicar uma palavra removida/adicionada e 99,68%. Não se arredondam alterações de palavras
  para 100%. Erros acima do limite deixam de aparecer como resultado vazio com estatísticas zeradas.
- **Extração de PDF ocultava falhas:** PDF inválido/sem texto selecionável deixava o editor vazio.
  A leitura informa erro ou orienta usar OCR, sem substituir o conteúdo por sucesso vazio.
- **Modo fixo da divisão não produzia seus intervalos imediatamente:** a opção selecionada podia
  executar intervalos antigos e uma junção oculta. Intervalos e estado agora correspondem à opção.
- **ZIP declarava nomes UTF-8 com flags incorretas:** `ação.pdf` saía como `aÃ§Ã£o...` em leitores
  compatíveis. Os dois cabeçalhos passam a declarar UTF-8; conteúdo dos arquivos continua idêntico.
- **PDF para JPG entregava 108 DPI em vez de 150:** escala corrigida de 1,5 para 150/72; uma página
  de 720×360 pontos gera imagem de 1500×750 pixels, com cores conferidas.
- **Estampa e numeração ignoravam rotação e área visível:** páginas giradas recebiam texto lateral;
  recortes podiam ocultar o rótulo. Coordenadas agora usam CropBox efetivo e orientação visual.
- **OCR perdia linhas com símbolos:** um caractere como `№` fazia Helvetica WinAnsi rejeitar a linha
  inteira silenciosamente. A camada invisível usa fonte local incorporada e ToUnicode, preservando
  símbolos, caracteres compostos e Unicode fora da cobertura visual da fonte. Nenhuma fonte nova foi
  adicionada; o asset Liberation já distribuído permite incorporação documental por sua exceção.
- **Seleção OCR desalinhada:** caixas ignoravam largura, rotação e CropBox. A camada acompanha a caixa
  reconhecida; os testes comprovam largura/altura, origem e aparência preservada nos quatro ângulos.
- **OCR multipágina branco dizia sucesso:** cabeçalhos “Página N” mascaravam ausência de reconhecimento.
  A validação ocorre antes deles. O modo pesquisável deixa de trocar silenciosamente PDF por TXT.
- **OCR HTTP ignorava opções e classificava TXT como PDF:** a superfície web usa o worker que atende
  idioma/contraste/PDF pesquisável; a persistência HTTP normaliza o MIME com charset. O executor
  nativo permanece disponível nas portas de core que já o utilizavam.

## Evidência e verificação

- PDFs sintéticos com 1–47 páginas, dimensões variadas, rotação, CropBox, texto e imagens; originais
  permanecem imutáveis e operações produzem novos arquivos.
- Renderizações de dividir/extrair/juntar idênticas às páginas correspondentes nas fixtures; camada
  OCR invisível idêntica à aparência original nos quatro ângulos, inclusive com recorte deslocado.
- OCR real em inglês: “CONTRACT NUMBER 12345” e “The payment is due tomorrow.”, duas linhas e confiança
  de aproximadamente 96% no caso sintético. Isso não é uma taxa geral de acerto do produto.
- Hunspell real: aceita “relatório”, rejeita “relatóriu” e oferece “relatório”; verificado no navegador
  em desenvolvimento e no bundle de produção. Testes de UI em Node delimitam a fronteira do motor;
  o E2E exercita o dicionário real, sem simular reconhecimento ortográfico.
- Comparador: 2.030 casos confrontados com LCS independente e reconstrução das entradas; 10 mil linhas
  com duas alterações processadas em aproximadamente 11 ms no probe local. Não é garantia de tempo
  para divergências densas nem benchmark em hardware de usuários.
- Testes de engine em ambiente sem canvas não foram usados como prova de renderização: os novos E2E
  leem os downloads e conferem dimensões, texto, posição e conteúdo produzido no navegador real.

Comandos de fechamento: `pnpm check`, `pnpm test`, `pnpm build:web` e Playwright sobre o bundle de produção.
A validação de licenças usa o mesmo store pnpm da instalação; nenhuma dependência foi adicionada.

Resultado final: lint e tipagem aprovados; 223 testes unitários e 48 E2E aprovados; build web e
inventário de licenças aprovados. O E2E usou Chromium local com dois workers. A revisão independente
final encontrou a exposição de identificadores longos ao tradutor; o caso foi reproduzido com teste
falhando e corrigido antes desta rodada final. Não foram observadas regressões nos cenários cobertos.

## Próximas validações de qualidade

1. Corpus licenciado de PDFs reais: formulários, fontes, documentos assinados, páginas escaneadas e fotos
   com EXIF, medindo integridade visual, tamanho, tempo e memória.
2. OCR português/espanhol com transcrição de referência e taxas de erro de caracteres/palavras.
3. Tradução com pares revisados por humano, medindo omissões, placeholders e fluência; não aprovar só
   porque o modelo retorna uma string.
4. Prévia da divisão por extremidades reais de cada intervalo; benchmark em documentos grandes.

Essas validações não são releases, deploys ou autorização para uploads de documentos de usuários.
