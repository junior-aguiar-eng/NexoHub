# Auditoria das seis novas ferramentas web

Data: 23/10/2026. Código novo recebido de `origin/main` até `ac2b877`, integrado localmente em
`14e77be`. A auditoria anterior foi commitada em `06ffcfa`. Nenhum push ou deploy realizado.
As correções descritas abaixo estão no diff local posterior à integração.

## Conclusão sobre utilidade real

As seis ferramentas executam operações úteis nos cenários verificados, mas a implementação recebida
tinha defeitos de resultado e testes que não os detectavam. O caso mais grave era o desbloqueio:
apagar a referência à criptografia não descriptografava o documento. A extração também devolvia
imagens inventadas em ambiente de teste e só tratava alguns JPEGs na execução real.

A auditoria conferiu arquivos produzidos, texto extraído, estrutura PDF, coordenadas e pixels,
além dos controles da interface. Os originais permanecem imutáveis. Não foram usados documentos
de usuários, serviços externos de processamento ou dependências novas. O desktop não foi homologado.

| Ferramenta | Resultado útil comprovado | Limite que permanece |
| --- | --- | --- |
| PDF para Markdown | Extrai texto, listas, títulos por tamanho e tabelas por alinhamento; conserva palavras divididas entre fontes e pontuação Unicode. PDF sem texto orienta usar OCR. | Títulos/tabelas são heurísticos. PDFs com múltiplas colunas, leitura complexa, fórmulas e imagens exigem conferência. Não substitui OCR. |
| Recortar PDF | Margens visuais corretas nos quatro ângulos e CropBox deslocado; páginas escolhidas, texto e vetores preservados. | Ajusta caixas da página, sem apagar definitivamente o conteúdo fora delas. Não serve para ocultar dados de forma irreversível. |
| Assinar PDF | Insere rubrica por desenho/texto/imagem, preserva proporção e mantém nome/data dentro da caixa em páginas giradas/recortadas. | É assinatura visual, sem certificado digital, autenticação ou garantia jurídica automática. Metadados em alfabetos fora de WinAnsi falham explicitamente; imagem permite preservar a rubrica. |
| Extrair imagens | JPEGs compatíveis conservam bytes; imagens Flate, cores Indexed/CMYK, Decode, máscaras e Forms aninhados produzem PNG na resolução nativa, incluindo alpha nos casos verificados. | Extrai recursos XObject, inclusive recursos não desenhados; deduplica por página. Imagens inline e stencils dependentes da cor da página ficam fora. JPEG2000/JBIG2/ICC avançado não foram homologados. |
| Preencher formulário | Texto, checkbox, radio, dropdown editável e lista com múltipla seleção; valores vazios e readonly preservados. Achatamento conferido em PDFs reais. | Requer AcroForm; XFA não é suportado. Encoding incompatível, widgets malformados e falhas de achatamento interrompem a operação. Não produz saída parcial como sucesso. |
| Desbloquear PDF | Descriptografa RC4/AES, conserva texto, formulários editáveis, links, anexos, marcadores, Info/XMP e versão do PDF nas fixtures. | Exige senha de abertura correta quando aplicável. ByteRange e filtros Crypt explícitos são recusados. Usa ponte interna versionada do PDF.js, com regressões obrigatórias após atualização. |

## Correções realizadas

- **Desbloqueio real:** parser/criptografia/writer já existentes no PDF.js substituem a remoção
  isolada de `/Encrypt`. Regravação preserva o grafo de objetos sem rasterizar páginas. Senhas não
  são aparadas; arquivo inválido não aparece como livre; original nunca tem seu buffer transferido.
- **Compatibilidade:** API e worker legacy do PDF.js fornecem seus polyfills oficiais. A ponte
  interna do desbloqueio é carregada sob demanda. A versão existente `6.3.289` foi fixada no manifesto
  e no lockfile, sem alteração da resolução instalada. Detalhes em [PDF-UNLOCK.md](PDF-UNLOCK.md).
- **Extração efetiva:** removido o atalho que inventava imagens. Recursos indiretos, Forms aninhados,
  ciclos, filtros PDFArray, cores e transparência recebem tratamento real. Não se exporta a página
  inteira como se fosse uma imagem embutida. JPEG com Decode/DecodeParms/máscara é convertido quando
  necessário para preservar sua semântica visual.
- **Seleção da extração:** primeira execução descobre imagens; seleção vazia posterior não exporta
  tudo. Escopo “todas” não é confundido com lista vazia. Galeria e download são invalidados ao trocar
  arquivo/opções, e o arquivo selecionado pode ser baixado sem perder o espaço de trabalho.
- **Formulários:** seleção inexistente não vira automaticamente a primeira opção; limpar realmente
  remove seleções; arrays preservam multiseleção; readonly não é alterado. Campo desconhecido,
  tipo/valor inválido ou erro de salvamento não é ignorado silenciosamente. A prévia informa que
  mostra o original, sem prometer representar valores ainda não salvos.
- **Recorte/assinatura:** geometria visual usa CropBox efetivo e rotação. Margens/posições precisam
  ser finitas; seleção inválida não vira “todas as páginas”. Assinatura não é distorcida, nome/data
  cabem na área escolhida e o painel não começa com um nome de pessoa fictício.
- **Desenho e prévias:** ponteiro respeita a escala CSS do canvas; limpeza remove a assinatura;
  geração assíncrona obsoleta é descartada e URLs são liberadas. Páginas intermediárias são
  renderizadas sob demanda, sem reutilizar a primeira página com outro rótulo.
- **Markdown:** não introduz espaços entre fragmentos contíguos de uma palavra; preserva aspas,
  travessões e reticências. PDF sem texto não devolve apenas comentários como resultado bem-sucedido.
- **Fluxos compartilhados:** troca de arquivo limpa resultados antigos; PDF protegido é inspecionado
  antes de tentar contar/renderizar suas páginas; erros de senha, seleção e capacidades têm mensagens
  legíveis. Faixas de páginas são validadas integralmente antes de expandir, evitando descartar apenas
  a parte inválida ou iterar até números maiores que o documento.
- **Legibilidade:** formulários, desbloqueio e Markdown usavam cores de tema escuro sobre superfícies
  semitransparentes claras, com contraste medido abaixo de 4,5:1. Superfícies, bordas e textos usam
  agora os tokens existentes; o ícone âmbar da extração também passou a atender o contraste mínimo.
  Testes existentes do catálogo foram atualizados de 13 para 19 cartões, mantendo suas verificações
  de medidas, alinhamento, foco e contraste.
  A miniatura de Markdown também passou a preservar a proporção da página, sem cortar o conteúdo.

## Evidências e validação

- RED→GREEN com fixtures sintéticas reais para os defeitos descritos. Os testes antigos de extração
  e desbloqueio receberam imagens e criptografia reais em lugar de resultados fabricados ou apenas
  um dicionário `/Encrypt` incompleto.
- Desbloqueio no Chromium: dez variantes; saídas reabertas por pypdf e MuPDF. Texto, campo editável,
  anexo, marcador e XMP conferidos. Renderizações das saídas idênticas, pixel a pixel, aos originais
  autenticados. Inclui object streams/xref streams, atualização incremental, XMP em claro e PDF 2.0.
- Extração no Chromium: quatro imagens decodificáveis, dimensões/pixels nativos e SMask com alpha
  intermediário; JPEG compatível com bytes idênticos. Probes e testes cobrem também Indexed e CMYK.
- Recorte/assinatura: fixtures 0/90/180/270 graus com CropBox deslocado; extração independente de texto
  e renderização com Poppler confirmaram posição, proporção e conteúdo original preservados.
- Interface: upload, execução e download reais nas seis ferramentas; senha incorreta/correta,
  troca de arquivo, seleção vazia e prévia intermediária. Capturas em 390, 768, 1024 e 1440 px.
- Revisão independente adicional: 78 testes focados de engine aprovados e probe CMYK próprio;
  nenhum novo defeito Critical/Important demonstrado nessa revisão.

Resultado final: `pnpm check` aprovado (lint, formato e tipagem); `pnpm test` com **348 testes
aprovados**; `pnpm build:web` aprovado; **63 E2E aprovados** no Chromium sobre o build de produção;
`pnpm licenses:check` aprovado. As capturas cobrem as seis telas nas quatro larguras indicadas.
Não foram observadas regressões nos cenários cobertos. O build avisa sobre o tamanho do chunk
do parser de desbloqueio (cerca de 1,24 MB, 389 KB gzip); ele é separado e carregado sob demanda.

Essas evidências se limitam às fixtures e cenários indicados; não representam uma taxa universal
de acerto nem homologação de todos os arquivos PDF existentes.
