# Especificação de ferramentas

Toda ferramenta é declarada no Tool Registry por manifesto versionado. O contrato mínimo identifica:

```typescript
interface ToolManifest {
  id: string;
  version: string;
  name: string;
  category: string;
  surfaces: Array<"quick" | "studio">;
  accepts: string[];
  produces: string[];
  capabilities: string[];
  executor: "browser" | "native" | "python";
}
```

O pacote `@nexohub/tool-sdk` fornece os contratos e as implementações comuns de `ToolRegistry`,
`ToolRunner`, `CapabilityProvider` e erros estruturados. O pacote `@nexohub/tool-registry` mantém o
catálogo canônico do produto. Launcher, Studio e futuras superfícies devem projetar esse catálogo,
adicionando apenas metadados de apresentação, como ícones e chaves de internacionalização.

O `ToolRunner` resolve a disponibilidade antes de validar e delegar ao executor `browser`, `native`
ou `python`. Capacidades ausentes bloqueiam a execução com `TOOL_UNAVAILABLE`; entrada inválida,
executor ausente, cancelamento e falha de engine também possuem códigos estáveis. Adapters concretos
fornecem um `CapabilityProvider` sem detecção de sistema operacional nos componentes.

### Semântica de executor (preferencial vs. fallback)

O campo `executor` no manifesto declara o motor preferencial/ótimo da operação:
- `native`: motor nativo compilado (Rust/Tauri) para alto desempenho e streaming de buffers. No client web puro (onde não há runtime de SO local), ferramentas como `pdf-compress`, `pdf-organize`, `pdf-merge`, `pdf-split` e `pdf-rotate` possuem fallback transparente para o motor WebAssembly/client-side (`pdf-engine.ts`), preservando paridade funcional sem conexões remotas.
- `browser`: motor local-first executado diretamente no contexto do navegador (WebAssembly/Web Workers/Canvas), como recorte, assinatura, OCR offline (Tesseract.js), tradução neural (Transformers.js) e edição.
- `python`: sidecars locais voltados a processamentos especializados de texto/DOCX.

Regras: UI chama Tool Runner, nunca engines; inputs e parâmetros são validados; operações longas
são canceláveis por `AbortSignal`; sucesso devolve artifacts derivados para persistência pelo domínio;
Quick e Studio reutilizam o mesmo manifesto e executor; indisponibilidade é consultada pela
Capability Layer antes da execução.

Os manifestos das ferramentas descrevem entradas, saídas, parâmetros e capacidades exigidas. No
catálogo ativo, ferramentas sem executor funcional implementado (como as conversões Office complexas
`word-to-pdf` e `pdf-to-word`) permanecem rebaixadas para `plannedToolManifests` até a conclusão dos
respectivos ADRs. A ferramenta `text-translate` possui contrato estrito de saída em `text/plain`,
restando a preservação de layout em PDF traduzido como evolução planejada futura.

As seis novas operações web são recorte visual, assinatura visual, extração de imagens,
preenchimento AcroForm, desbloqueio e PDF para Markdown. A assinatura não é criptográfica;
o recorte não elimina definitivamente o conteúdo ocultado. Limites e provas estão na
[auditoria das novas ferramentas](AUDITORIA-NOVAS-FERRAMENTAS-WEB-2026-10-23.md).

## Executores Documentais PDF

- **`pdf-compress`**: Recebe o PDF e aplica perfis de compressão estrutural e reencodagem de imagens
  (baixa, recomendada e extrema). O core Rust e o navegador preservam o original caso a recompressão
  não reduza o tamanho. PDFs com assinatura digital são preservados intactos.
- **`pdf-organize`**: Permite reordenar, girar e excluir páginas visualmente. Gera um novo artifact PDF
  com as páginas preservadas na sequência definida.
- **`pdf-merge`**: Combina dois ou mais arquivos PDF em uma única saída consolidada.
- **`pdf-split`**: Extrai páginas selecionadas ou intervalos definidos (`start-end`), gerando arquivos
  individuais ou múltiplos artifacts.
- **`pdf-rotate`**: Aplica rotação uniforme ou específica de 90°, 180° ou 270° nas páginas.
- **`images-to-pdf`**: Converte e consolida sequências de imagens JPG, PNG ou WebP em um novo documento PDF
  com orientação e margens configuráveis.
- **`pdf-to-jpg`**: Renderiza cada página do documento PDF em imagens JPG de alta resolução, empacotadas
  em arquivo ZIP para download ou exportação.
- **`pdf-watermark`**: Aplica carimbo textual personalizado com controle de ângulo, opacidade, cor e escala.
- **`pdf-page-numbers`**: Insere numeração tipográfica com formatações variadas (`Página X de Y`, `X/Y`, `X`)
  em posições pré-definidas no cabeçalho ou rodapé.

### Formulários PDF — DOC-C1

`pdf-form-fill` suporta campos AcroForm de texto, checkbox, rádio, dropdown e listas com
seleção múltipla. A inspeção informa as páginas 1-based de todos os widgets de cada campo,
resolvendo as anotações da página e a referência `/P`; widgets repetidos não duplicam o destino.
Campos somente leitura conservam os valores originais. A navegação e o zoom não alteram valores.

A prévia usa `fillPdfForm` e renderiza a revisão atual pelo PDF.js, com debounce de 300ms e
uma página por vez. Cada revisão privada associa origem por identidade de `File`, valores e
achatamento. O download reutiliza os mesmos bytes validados; revisões de outro arquivo ou opções
são rejeitadas. Digitação, mudança de página, arquivo ou achatamento descartam a imagem obsoleta.
A preparação atômica do pdf-lib termina em memória e seu resultado é descartado se cancelado;
a renderização PDF.js é interrompida. As prévias usam Data URLs, sem criar Object URLs extras.
URLs de download mantêm a revogação existente ao trocar resultado ou sair.

A saída editável preserva campos, widgets e seleções. Achatar incorpora as aparências à página
e remove campos e referências de widgets; links e outras anotações independentes permanecem.
O original não é alterado. PDF sem campos conserva a visualização do original, identificada como
tal, e não oferece uma operação fictícia de preenchimento. Arquivos incompatíveis e PDFs inválidos
informam erro e permitem escolher outro arquivo.

Textos editados usam a fonte padrão existente (WinAnsi): acentos portugueses precompostos foram
verificados. Caracteres incompatíveis geram erro explícito e bloqueiam prévia/exportação, sem
substituição ou perda silenciosa. Não há homologação de fontes arbitrárias/Unicode completo.
XFA e documentos assinados são recusados; falhas de aparência ou de achatamento, inclusive
o caso de widget malformado coberto, são expostas. Não são convertidas em sucesso vazio.

Cobertura: `pdf-form.test.ts`, `useFormPreview.test.ts`, `FormFillPdfPanel.test.tsx`,
`DedicatedToolView.test.tsx`, `launcher-tool-runner.test.ts` e `e2e/form-preview.spec.ts`, mais
as regressões existentes das mesas. Corpus sintético versionado no E2E, três páginas/seis campos,
sem documentos pessoais ou assets de terceiros; SHA-256 do caso padrão:
`d2982f4fdd30e89021cfbf3432a31c7f57669a92e839cab27bdb0844bcdf53f2` (7.939 bytes).
Cada execução anexa o hash do corpus usado. Casos com fontes arbitrárias, arquivos grandes e
outros dispositivos permanecem sem medição/homologação.

## Fase 7 — texto

`create_text_revision` recebe `projectPath`, `documentId`, `artifactId` e conteúdo UTF-8. O artifact
de entrada deve ser `text/plain` ou `text/markdown` e pertencer ao documento. Cada salvamento cria
um artifact derivado e uma operação `text-edit`; o blob original nunca é regravado. A revisão é
limitada a 16 MiB e a interface não oferece persistência enquanto não houver contexto documental.

## Fase 8 — overlay PDF

`create_pdf_overlay` persiste destaques, notas ou desenhos associados a um artifact PDF. A posição
usa página iniciada em 1 e retângulo normalizado (`x`, `y`, `width`, `height`) contido em `[0, 1]`.
`list_pdf_overlays` recupera as camadas na ordem de criação. Nenhum dos comandos altera o blob PDF
ou cria aparência materializada dentro dele.

## Fase 9 — OCR

O sidecar aceita uma requisição JSON Lines `ocr` com `mimeType` e `contentBase64`. São suportados
PNG, JPEG, TIFF, WebP e PDF. A resposta contém texto consolidado e linhas com página, confiança e
retângulo normalizado. Erros de protocolo, entrada e inferência usam `INVALID_REQUEST`,
`INVALID_INPUT` e `OCR_FAILED`. Nenhum conteúdo é enviado à rede.

## Fase 10 — anchors

`create_anchor` aceita seletor discriminado `TEXT_RANGE`, `PDF_REGION` ou `OCR_LINE` e uma citação
opcional. Intervalos exigem `start < end`; regiões usam página iniciada em 1 e geometria normalizada;
linhas OCR usam página e índice base zero. O seletor precisa ser compatível com o MIME type do
artifact. `list_anchors` recupera os anchors na ordem de criação.

## Fase 11 — DOCX

O sidecar aceita `docx.inspect` com `contentBase64` e devolve parágrafos com estilo, tabelas e título.
`docx.create` recebe título opcional, parágrafos com estilos permitidos e tabelas retangulares; o
resultado contém um novo DOCX em Base64, MIME type e tamanho. Nenhum método recebe caminhos ou
reescreve o original. Entradas inválidas retornam `INVALID_INPUT`; falhas internas, `DOCX_FAILED`.

## Fase 12 — tradução

`translate` recebe `text`, `sourceLanguage`, `targetLanguage` e `modelId`. Idiomas usam códigos BCP
47 simples; origem e destino precisam ser distintos. O sidecar segmenta até 1.000.000 de caracteres,
protege placeholders e executa somente um modelo CTranslate2 instalado na raiz configurada. O
resultado contém texto, par linguístico, modelo e quantidade de segmentos. Modelo ausente,
incompatível ou que viole placeholders retorna `TRANSLATION_UNAVAILABLE`; não existe fallback de
rede. A saída é conteúdo para novo artifact, nunca atualização do original.

O manifesto de instalação do modelo declara `sourceLanguages`, `targetLanguages`, `license`,
`artifact`, `sha256` e `tokenizer`. Os tipos aceitos são `t5-shared`, para MADLAD com token de destino
e EOS, e `sentencepiece-pair`, para OPUS-MT TC Big. O hash do artifact é verificado antes de carregar
o modelo. Pesos, tokenizers e licenças permanecem externos ao Git.

## Fase 13 — revisão

`review_text` recebe texto de até 4 MiB e executa o LanguageTool Community exclusivamente em `pt-BR`
pelo runtime Java local. A resposta contém versão, regra, tipo, mensagem, offsets UTF-16 e sugestões.
Ausência, hash divergente ou licença incompleta retorna `REVIEW_UNAVAILABLE`; falha de execução ou
resposta inválida retorna `REVIEW_PROCESSING`.

Aplicar achados modifica somente o rascunho e invalida o relatório anterior. `create_text_revision`
persiste o resultado como artifact derivado; revisões posteriores usam o artifact recém-criado como
entrada. O snapshot `6.9-SNAPSHOT-20260901` e o Temurin JRE `21.0.12.1+1-LTS` são externos ao Git e
fixados em `runtime/languagetool-community.json` por URL, tamanho, SHA-256 e licença.

## Fase 14 — receitas NexoFlow

Uma Recipe salva um grafo acíclico de ferramentas, dependências, posições e parâmetros. A execução faz preflight
de todas as etapas no Tool Registry e na Capability Layer, incluindo a presença do executor, antes
de iniciar. Os artifacts produzidos por uma etapa alimentam seus nós dependentes e permanecem inspecionáveis
no snapshot de progresso.

Falha intermediária interrompe a sequência sem descartar resultados anteriores. Cancelamento usa o
`AbortSignal` encaminhado ao `ToolRunner`. Cada ferramenta continua persistindo sua própria operação
e seus artifacts no Operation Graph; a receita não cria um caminho alternativo de execução.


### Complementação SEC-C1: Ocultar PDF

`RedactPdfOptions` conserva as áreas percentuais no espaço visual do CropBox/rotação e o
original imutável. `redactionPreserve` é opção separada do executor, padrão falso; não há
fallback automático. O modo imagem mantém a remoção por reconstrução de pixels e suas perdas.
O modo de preservação usa PDFium 2.15.1 em worker cancelável e é restrito a fontes padrão,
imagens opacas simples e Form XObjects/links/campos homologados. Atingir link/widget ou usar
recursos fora do perfil recusa a operação antes de disponibilizar um artifact. Metadados do
documento e marcadores são descartados; conteúdo externo, inclusive campos e links aceitos,
é preservado. Limites, recusas e corpus constam na
[auditoria de segurança](AUDITORIA-PROTECAO-TARJA-EXCEL-WEB-2026-10-23.md#complementação-sec-c1--24102026).

Retângulos sobre o original são apenas marcações. Após gerar, a revisão renderiza o Blob do
próprio download, sem usar o original em caso de falha. Voltar às tarjas conserva opções e
elimina o resultado anterior. Alterar arquivo/áreas/modo ou sair cancela a operação; respostas
obsoletas não produzem download. Nenhuma detecção automática ou eliminação global de todas as
ocorrências de um texto é prometida.
