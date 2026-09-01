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

Regras: UI chama Tool Runner, nunca engines; inputs e parâmetros são validados; operações longas
são canceláveis por `AbortSignal`; sucesso devolve artifacts derivados para persistência pelo domínio;
Quick e Studio reutilizam o mesmo manifesto e executor; indisponibilidade é consultada pela
Capability Layer antes da execução.

Os manifestos das ferramentas planejadas já estão registrados para permitir descoberta e
indisponibilidade explícita. Eles não implementam comportamento documental: os executores reais
começam na Fase 4.

## Fase 4 — executores PDF

`pdf-compress` é o primeiro executor real. Recebe `projectPath`, `documentId`, `artifactId` e
`compressionLevel` entre 1 e 9. A entrada deve ser um artifact `application/pdf` pertencente ao
documento. O resultado contém o artifact derivado e a operação `pdf-compress` persistida no grafo.
PDF inválido retorna `PDF_PROCESSING`; caminhos, IDs e tipos incompatíveis usam os códigos estáveis
do Document Core.

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
