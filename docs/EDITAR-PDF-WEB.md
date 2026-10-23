# Editar PDF no website

A ferramenta `pdf-edit`, em `/editar-pdf`, permite adicionar elementos e substituir texto
existente no próprio conteúdo do PDF. Os arquivos são processados no navegador, sem upload.
Cada revisão parte do original imutável e de um snapshot de comandos. A exportação gera outro PDF.

## Recursos

- Miniaturas, página central, ferramentas e propriedades contextuais; painéis recolhíveis.
- Texto novo com fontes locais disponíveis, variações de estilo, tamanho, cor e alinhamento.
- Imagens PNG/JPEG, retângulos, elipses, linhas e desenho livre.
- Mover/redimensionar elementos adicionados por ponteiro ou propriedades numéricas; duplicar,
  excluir e ordenar elementos. A caixa acompanha o gesto; a revisão é renderizada ao concluí-lo.
- Selecionar objetos de texto existentes e substituir ou excluir seu conteúdo de verdade.
- Desfazer/refazer com histórico de até 50 etapas; miniaturas regeneradas ao percorrer histórico.
- Zoom de 50% a 200%, ajuste à largura e navegação entre páginas.
- Aviso de alterações não salvas ao sair pela interface, navegação interna ou fechamento da aba.
- Preservação da última revisão válida e do texto digitado quando uma operação falha.

## Texto existente e limites de fontes

A unidade é o objeto textual seguro reconhecido pelo motor. Não há redistribuição automática de
parágrafos entre objetos, colunas ou páginas. Texto maior que a caixa original é recusado; é
possível reduzir o tamanho visual da fonte ou ajustar a redação. Objetos inclinados, recortados
fora da área visível ou com modos de renderização incompatíveis não são anunciados como editáveis.
Formulários mantêm valores e aparência; seus campos continuam na ferramenta Preencher formulário.

Fontes padrão conhecidas admitem o conjunto latino suportado. Para outras fontes, a preservação
é conservadora: a edição utiliza caracteres já observados com aquela fonte no documento.
Um glifo novo não demonstrado exige escolher explicitamente outra fonte. O motor não toma uma
largura de glifo positiva como prova de suporte Unicode, pois a fonte pode retornar `.notdef`.
O conteúdo serializado é reaberto e o worker confere o texto na região editada usando PDF.js,
um leitor independente. Uma falha de verificação recusa a revisão em vez de produzir texto errado.

A troca explícita de fonte pode alterar a aparência. Fontes disponíveis: Helvetica, suas variantes
negrito/itálico, Times-Roman e Courier. Texto novo usa caracteres latinos, com acentos portugueses.
Em objetos com transparência ou recorte especial, mudanças que recriariam o objeto (fonte/tamanho)
são bloqueadas; a substituição no próprio objeto mantém suas propriedades gráficas.

Digitalizações, texto convertido em curvas e objetos sem mapeamento seguro não admitem edição
textual direta. Não há OCR com reconstrução nesta entrega. A ferramenta não simula edição cobrindo
palavras com branco e não é um mecanismo de ocultação segura. PDFs criptografados devem ser
previamente desbloqueados. Editar um documento assinado pode invalidar sua assinatura digital.

## Limites técnicos

- Arquivo de até 20 MiB, 30 páginas e 3.000 objetos no conjunto das páginas.
- Até 200 elementos/substituições por revisão e 4.000 caracteres por elemento textual.
- Imagem de até 10 MiB e 8 milhões de pixels; até 12 milhões de pixels de imagens por revisão.
- Texto novo entre 6 e 120 pt. Tamanho existente utiliza a transformação visual da fonte.
- Prévia com até 1.400 pixels no maior lado e escala máxima de 2; miniaturas de até 150 pixels.
- Dimensão de página até 14.400 pt e exportação até 80 MiB. Operação cancelável, com timeout de 60 s.
- História mantida em memória durante a sessão; sem persistência entre visitas nem colaboração.

## Implementação e dependência

`PdfEditorEngine` encapsula PDFium e libera documentos, páginas, fontes internas, bitmaps, objetos
não anexados e buffers alocados. O worker é encerrado ao terminar, falhar ou cancelar. Respostas
antigas são descartadas por geração da sessão. Prévias e bytes derivam da mesma revisão.
Coordenadas usam transformação afim pelos extremos da página, evitando quantização de vetores de
1 pt. O recorte e as rotações são considerados tanto na seleção quanto na gravação.

Dependência fixa: `@embedpdf/pdfium@2.15.1`, sem dependências npm de runtime, cerca de 7,6 MB
no pacote descompactado. O WASM é asset local carregado sob demanda; a suíte completa EmbedPDF
não foi instalada. A licença do wrapper é MIT; o pacote distribui avisos BSD/Apache no arquivo
`LICENSE.pdfium`. Cópias acompanham o website em `public/licenses`; o inventário gerado registra
sua versão. A licença efetivamente distribuída prevalece sobre descrições simplificadas do README.

Integração: Tool Registry, capacidades web, executor compartilhado e catálogo. Sem homologação de
edição desktop. Não houve commit, push ou deploy como parte da instalação/implementação.

## Verificação

Testes reais cobrem fontes padrão e fonte incorporada em subconjunto (fixture sintética), glifos
incompatíveis, remoção e substituição de texto, fonte escalada por matriz, transparência, campos de
formulário, posições em recortes e rotações, imagens/formas e limites. A verificação independente
recusa texto errado ou correspondência localizada fora da região editada. E2E exercita o bundle de
produção, downloads lidos por PDF.js, cancelamento, recuperação de erro e quatro larguras.

Validação final desta entrega: 508 testes unitários e 86 E2E aprovados; lint/tipagem, build web e
inventário de 645 componentes aprovados. Capturas em 390/768/1024/1440 px conferidas. A revisão
independente identificou cinco defeitos de integridade/interação; todos receberam testes de
regressão e foram corrigidos antes da validação final. O WASM emitido tem 4,65 MB (2,16 MB gzip).
