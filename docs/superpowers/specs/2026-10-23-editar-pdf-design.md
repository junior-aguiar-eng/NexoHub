# Editar PDF — proposta para o website

Estado: aprovada pelo usuário com “vamos instalar o editor. pode começar”.

## Intenção e escopo solicitado

Criar um editor visual com qualidade de interação e exportação comparável à referência
iLovePDF, mantendo a identidade NexoHub e o processamento local. O usuário confirmou que deseja
tanto adicionar elementos quanto alterar texto já existente. Não foi validada paridade funcional
com a versão atual do serviço de referência; qualidade equivalente é uma meta de aceitação,
não um resultado já demonstrado.

Website apenas. Sem push, deploy ou commit desta proposta sem nova solicitação.
Não enviar arquivos a serviços externos nem modificar os bytes originais.

## Abordagens e recomendação técnica

1. PDF.js + pdf-lib: aproveita a base atual para textos novos, imagens e formas, mas não atende
   edição real de texto original; insuficiente para o escopo solicitado.
2. PDFium em WebAssembly, encapsulado em adapter local: expõe APIs reais para objetos de texto.
   Recomendação do implementador, condicionada à prova técnica descrita abaixo. Requer novas
   dependências auditadas e trabalho próprio de interação, fontes, layout e histórico.
3. SDK comercial de edição: alternativa caso a prova local falhe; exige avaliação de licença,
   custo e operação sem upload. Não contratado nem autorizado como dependência deste projeto.

A escolha recomendada é a segunda. A API disponível comprova a possibilidade de alterar objetos,
mas não demonstra preservação de layout em PDFs arbitrários.

## Fase inicial obrigatória: provar edição real

Avaliar uma versão fixa de `@embedpdf/pdfium` em ambiente de teste isolado antes de integrar o
editor ao catálogo. A versão 2.15.1 consultada no npm declara MIT, inclui LICENSE MIT e expõe
`FPDFText_SetText`, `FPDFText_GetTextObject`, `FPDFPageObj_NewTextObj` e geração de conteúdo.
O pacote tem aproximadamente 7,6 MB descompactado; isso não equivale ao download comprimido.
Auditar também licenças dos binários, fontes e componentes incorporados, manutenção, segurança
e execução com a política de conteúdo do website. Não importar a suíte inteira automaticamente.

Comprovar em Chromium no build de produção e com extração independente por PDF.js:

- Substituir texto original e salvar; o trecho antigo não pode permanecer como conteúdo oculto
  no objeto substituído. Não alegar eliminação forense de cópias existentes em outras estruturas.
- Preservar partes não editadas, páginas, imagens, dimensões, CropBox e rotações de 0/90/180/270°.
- Testar caracteres portugueses, fontes padrão e fontes incorporadas com subconjuntos.
- Verificar novo texto maior/menor, ausência de glifos e objetos textuais fragmentados.
- Confirmar correspondência visual entre prévia e exportação e ausência de rasterização geral.
- Verificar cancelamento, descarte de sessão e limpeza de memória do motor.

Se falhar um caso básico, não publicar edição original como pronta. Documentar a falha e rever
o motor; adicionar elementos isoladamente não atende ao pedido completo do usuário.

## Comportamento do editor proposto

### Inspiração visual fornecida pelo usuário

A captura enviada após a proposta orienta a organização da área de trabalho: faixa de ferramentas
no topo, miniaturas de páginas à esquerda, documento central com rolagem e propriedades contextuais
à direita. Ações de texto e elementos novos devem ser distinguíveis; fonte, tamanho, estilo,
alinhamento e cor aparecem conforme a seleção. Desfazer/refazer e salvar devem ter posição estável
e estados explícitos. Navegação, número de página, zoom e ajuste à largura ficam em uma barra
compacta que não encobre a área editada nem os controles de seleção.

Adotar a identidade NexoHub, com coral nas ações principais, superfícies neutras e seleção de
alto contraste. Não reproduzir marca, selos premium ou controles sem implementação. Os controles
de formulários visíveis na referência não ampliam o escopo definido abaixo. Em telas menores,
miniaturas e propriedades ficam em painéis recolhíveis, mantendo espaço útil para o documento.
A captura é referência de experiência, não comprovação das capacidades internas do serviço.

Upload seguido de uma área de trabalho com miniaturas, página central, ferramentas e propriedades
contextuais. Recursos: texto novo, imagem PNG/JPEG, retângulo, elipse, linha e desenho livre;
selecionar, mover, redimensionar, duplicar, excluir e ordenar os elementos adicionados.
Texto novo admite tamanho, cor, família disponível, negrito/itálico quando suportados e alinhamento.
Quebra de linha e medidas usam a mesma fonte e regras da exportação.

O modo de texto existente permite selecionar objetos reconhecidos e substituir seu texto de
verdade. A unidade inicial é o objeto/bloco seguro identificado pelo motor, sem prometer reflow
de parágrafos entre blocos, colunas ou páginas. Preservar a fonte original quando ela puder
representar o texto novo. Se faltar glifo, oferecer substituição explícita por fonte local
licenciada; sem troca silenciosa. Mostrar impacto na prévia. Impedir confirmação que produza
corte ou sobreposição detectável, oferecendo ajuste do texto, tamanho ou caixa.

Objetos sem mapeamento de texto seguro, conteúdo vetorizado ou digitalizações não serão
apresentados como texto editável. Explicar a limitação e permitir adicionar novos elementos.
OCR com reconstrução automática fica fora desta entrega. Formulários permanecem na ferramenta
existente; não tratar widgets como texto comum. PDFs com senha devem ser desbloqueados antes.
Avisar que modificar PDF assinado compromete a validade da assinatura original.

Histórico único de desfazer/refazer para as duas modalidades, uma etapa por gesto concluído;
atalhos de teclado sem interceptar digitação em campos. Zoom, ajuste à largura, navegação e
edição por propriedades numéricas como alternativa a arrastar. Foco visível e controles de 44 px.
Sem apresentar pintura branca sobre palavras como alteração do texto original ou ocultação segura.

## Integração e integridade

Nova ferramenta `pdf-edit`, rota `/editar-pdf`, manifesto e capacidades web. Adapter dedicado
encapsula PDFium e seus recursos em worker; componentes não chamam APIs nativas diretamente.
Carregamento sob demanda, assets locais versionados, nenhum CDN obrigatório.

Manter original imutável e um estado de edição tipado com identificadores estáveis por sessão,
referências de página/objeto e coordenadas no espaço PDF. Mapear explicitamente viewport,
rotação e recorte. Exportar um novo PDF através do motor validado; evitar alternar motores de
gravação sem testes de preservação. O worker produz prévias da mesma revisão exportável.
Histórico deve reconstruir a sessão a partir do original e comandos quando undo nativo não existir.
Troca de arquivo, saída e nova execução invalidam respostas anteriores e liberam recursos.
Avisar antes de descartar alterações e manter a sessão em caso de erro de exportação.

## Validação e decisões deixadas ao implementador

Testes reais para alterações de texto, glifos, imagens e formas; posições nas páginas recortadas e
rotacionadas; preservação de páginas não alteradas; undo/redo; troca de arquivo; exportação após
falha; memória e limites. E2E de upload, edição das duas modalidades, teclado e download real.
Capturas e ausência de overflow em 390/768/1024/1440 px. Lint, tipagem, testes existentes, build
web e inventário de licenças devem passar antes de publicação.

Definir limites de bytes, páginas, objetos e memória com base na prova técnica, reportando recusa
explícita em vez de descarte de conteúdo. Os valores finais devem estar documentados antes de
habilitar a ferramenta. Estado persistente entre visitas, colaboração, edição de conteúdo de
imagens originais, suporte a todos os alfabetos e desktop não fazem parte desta entrega.

## Fontes verificadas na investigação

- https://pdfium.googlesource.com/pdfium/+/refs/heads/main/public/fpdf_edit.h
- https://www.npmjs.com/package/@embedpdf/pdfium/v/2.15.1
- LICENSE e declarações TypeScript do tarball npm da versão 2.15.1.
- https://github.com/Hopding/pdf-lib#limitations

A página do editor iLovePDF não pôde ser inspecionada nesta sessão por bloqueio de rede HTTP 403.
