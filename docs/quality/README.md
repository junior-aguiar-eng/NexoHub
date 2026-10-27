# Q-C0 — índice local de evidências

Consolidação inicial de 27/10/2026 sobre a base `a9f3385`, complementada pelo
[fechamento técnico](Q-C0-FECHAMENTO.md). O índice cobre as 35 ferramentas ativas
do Tool Registry. DOC-C2 continua fora
do escopo; Camelot, Docling, qpdf, OpenCV e AVIF não passam a integrar o aplicativo.

## O que o gate demonstra

`pnpm quality:check` valida o [índice JSON](q-c0.json) contra `coreToolManifests`, exige
origem/licença, expectativas, recusas e casos não medidos, verifica existência das referências
e SHA-256 dos artefatos de corpus. Rejeita registros duplicados, ferramentas ausentes/planejadas,
campos desconhecidos e caminhos fora do repositório. O teste de integração também resolve os
caminhos reais para recusar links simbólicos externos. O checker é usado por testes;
não está exportado pelo pacote nem importado pelo aplicativo.

Há 25 grupos de corpus. Os rótulos `file`, `generator` e `manifest` identificam **quais bytes
foram hasheados**: arquivo fixo, código gerador/teste ou manifesto de uma medição anterior.
Hash de gerador não identifica o PDF/imagem que ele produzirá; hash de manifesto não verifica
novamente as fotos externas ou os resultados nele registrados. Os downloads externos não são
feitos por este gate. A origem e as licenças específicas permanecem nos documentos vinculados.

Integridade dos metadados não prova que uma saída é correta. O gate não executa motores nem
reproduz benchmarks anteriores. Certificação de licenças, medição de memória e homologação
do app instalado dependem de avaliações separadas.
Expectativas textuais são limites documentados, não assertions executadas pelo checker.

## Cobertura por ferramenta

**35 perfis restritos.** Perfil restrito
significa que há uma entrega específica com corpus e limites documentados; não é um selo de
homologação integral. Regressão identifica cobertura existente, que pode incluir testes com port simulado.
Esses testes de encaminhamento não demonstram fidelidade da saída. A fatia de
[PDF básico](PDF-BASICO.md) acrescenta conferência de conteúdo para quatro ferramentas.
Expectativas, recusas, casos não medidos e links de testes/documentos estão em cada registro JSON.

| Ferramenta | Evidência registrada | Grupos de corpus |
| --- | --- | --- |
| `pdf-edit` | Perfil restrito | `editor` |
| `pdf-compare` | Perfil restrito | `comparison` |
| `pdf-organize` | Perfil restrito | `pdf-static` |
| `pdf-merge` | Perfil restrito | `pdf-static` |
| `pdf-split` | Perfil restrito | `pdf-static` |
| `pdf-rotate` | Perfil restrito | `pdf-static` |
| `pdf-crop` | Perfil restrito | `pdf-static`, `pdf-overlay` |
| `pdf-compress` | Perfil restrito | `pdf-basic`, `compression-scan` |
| `pdf-repair` | Perfil restrito | `repair` |
| `images-to-pdf` | Perfil restrito | `pdf-raster`, `image-basic` |
| `pdf-to-jpg` | Perfil restrito | `pdf-raster`, `pdf-basic` |
| `pdf-watermark` | Perfil restrito | `pdf-static`, `pdf-overlay` |
| `pdf-page-numbers` | Perfil restrito | `pdf-static`, `pdf-overlay` |
| `pdf-ocr` | Perfil restrito | `ocr` |
| `pdf-protect` | Perfil restrito | `pdf-access`, `security` |
| `pdf-extract-images` | Perfil restrito | `pdf-raster`, `pdf-images` |
| `text-compare` | Perfil restrito | `text-compare`, `text-static` |
| `text-review` | Perfil restrito | `review`, `text-static` |
| `text-translate` | Perfil restrito | `translation` |
| `pdf-to-markdown` | Perfil restrito | `markdown` |
| `pdf-sign` | Perfil restrito | `pdf-static`, `pdf-overlay` |
| `pdf-form-fill` | Perfil restrito | `form` |
| `pdf-unlock` | Perfil restrito | `pdf-access`, `unlock` |
| `pdf-redact` | Perfil restrito | `security` |
| `pdf-to-excel` | Perfil restrito | `excel` |
| `pdf-remove-pages` | Perfil restrito | `subset` |
| `pdf-extract-pages` | Perfil restrito | `subset` |
| `html-to-pdf` | Perfil restrito | `html` |
| `scan-to-pdf` | Perfil restrito | `scan`, `compression-scan` |
| `image-compress` | Perfil restrito | `image-basic`, `image-photo` |
| `image-resize` | Perfil restrito | `image-basic`, `image-photo` |
| `image-crop` | Perfil restrito | `image-basic`, `image-photo` |
| `image-convert` | Perfil restrito | `image-basic`, `image-photo` |
| `image-rotate` | Perfil restrito | `image-basic`, `image-photo` |
| `image-watermark` | Perfil restrito | `image-basic`, `image-photo` |

## Teste de resultado e pendências

| Tipo | Evidência exigida para a operação, além deste índice |
| --- | --- |
| Imagens | Dimensões, pixels/alpha, recorte e EXIF; fotografias exigem comparação visual e métricas com a referência |
| PDF | Reabertura, páginas, texto/objetos, geometria, campos e regiões conforme a operação; download confrontado com a fonte |
| Excel | Células, zeros, vazios e estrutura contra a referência, sem confundir tabela detectada com tabela correta |
| OCR | CER/WER com normalização explícita e corpus representativo; confiança do motor não é probabilidade de acerto |
| Markdown | Ordem/estrutura confrontada com a fonte e edição/revisão documentada por página |
| Tradução/revisão/comparação | Referências textuais, preservação de identificadores e avaliação linguística; sem garantia jurídica ou semântica universal |

O [fechamento técnico Q-C0](Q-C0-FECHAMENTO.md) reúne a matriz de corpus, testes de
resultado, auditorias e medições locais, incluindo Windows Sandbox limpo de 4 GB.
O alcance continua sendo os **35 perfis restritos**: documentos arbitrários, todos os
dispositivos e certificação do NexoHub 1.0 não estão demonstrados. A foto privada de livro
falhou no OCR e não foi incorporada ao perfil aprovado. Nenhum percentual heurístico vira
probabilidade de correção. O ADR-019 exclui LanguageTool/Java do instalador e oferece instalação opcional por download oficial; as fontes do pacote completo continuam na issue #12247.

A auditoria `pnpm licenses:check` avalia o inventário e as famílias de licença configuradas.
Ela não substitui revisão de wrappers, WASM/binários, fontes/modelos, avisos de distribuição,
manutenção/advisories nem comprova atualização do arquivo de avisos gerado na raiz.

## Manutenção

Ao mudar corpus, teste gerador ou manifesto, revisar também expectativas e limites do registro;
recalcular SHA-256 sobre os bytes locais (LF para texto, conforme `.gitattributes`). Um hash
divergente deve provocar revisão, não ser atualizado automaticamente para ocultar regressão.
Executar os testes de resultado da ferramenta afetada e depois `pnpm quality:check` e `pnpm check`.
Ferramenta nova exige registro próprio; retirar um registro não pode silenciar uma ferramenta ativa.
Não adicionar fixture externa sem origem/licença demonstrada. Os testes do gate são executados
também pela suíte normal do pacote `@nexohub/tool-registry`.

## Validação da consolidação inicial

- `pnpm quality:check`: 7 testes aprovados, incluindo o índice real das 35 ferramentas.
- Suíte completa do Tool Registry com dois workers: 10 testes aprovados.
- `pnpm check`: formatter/lint e typecheck dos pacotes e cliente aprovados.
- `pnpm licenses:check`: inventário aprovado dentro do alcance descrito acima.

Não foram repetidos os benchmarks anteriores nem executados E2E, build ou instalação Windows:
esta fatia altera documentação e um gate de testes, sem código do aplicativo ou dependências.

A evolução das operações básicas PDF, após a consolidação inicial, está em [PDF-BASICO.md](PDF-BASICO.md).

A fatia seguinte documenta [recorte e sobreposições PDF](PDF-GEOMETRIA.md), com quatro perfis restritos adicionais.

A evolução de [conversão e extração raster](PDF-RASTER.md) acrescenta três perfis restritos com pixels/alpha/ZIP conferidos.

A fatia de [proteger/desbloquear PDF](PDF-ACESSO.md) acrescenta dois perfis restritos com documentos cifrados, campos e anexos conferidos.

A avaliação de [comparação e revisão de texto](TEXTO.md) acrescenta dois perfis restritos e corrige o par exportado e a mensagem de ausência de sugestões.

A avaliação de [compressão e scanner](COMPRESSAO-SCANNER.md) acrescentou os dois perfis restritos restantes. Naquela etapa, Q-C0 global permanecia parcial.

A complementação da interface do scanner registra teclado, quatro larguras e temas na raiz
e em `/hub/`, incluindo pixels do download e erro recuperável. Mantém 35 perfis/25 corpora;
os ensaios físicos e de Windows instalado posteriores estão no relatório de fechamento.
