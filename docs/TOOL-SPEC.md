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
