# Comparar PDF no website

A rota `/comparar-pdf` recebe um PDF original e um revisado. Os arquivos permanecem no navegador,
sem envio a servidores e sem modificar os originais. PDF.js extrai texto e renderiza páginas;
o diff textual existente identifica inserções e remoções, e pixelmatch identifica diferenças
visuais. A execução e a geração do relatório ficam em um worker cancelável.

## Uso e interpretação

- **Texto:** alterações no texto extraído, com inserções e remoções destacadas. Não interpreta
  significado jurídico ou semântico e não executa OCR. PDFs sem texto extraível usam o modo visual.
- **Visual:** páginas lado a lado, regiões alteradas, zoom, rolagem sincronizada e sobreposição
  com opacidade ajustável. Páginas ausentes aparecem explicitamente.
- **Navegação:** lista de pares alterados, pesquisa no texto, navegação entre todos os pares e
  saltos à alteração anterior/seguinte do filtro atual. O salto mantém zoom e sincronização,
  identifica as páginas de ambos os lados e leva o foco ao contexto do par.
- **Escala:** ajuste à largura de cada painel ou tamanho da imagem renderizada, com zoom de
  50% a 200%. O centro da rolagem é conservado ao mudar a escala; não acrescenta resolução
  à imagem usada na detecção. Sobreposição exige as duas páginas presentes.
- **Exportação:** relatório PDF com resumo, imagens e trechos das alterações; JSON com o texto
  completo e os resultados, sem incluir as imagens. O PDF incorpora Source Sans 3 local, com
  latim, grego e cirílico. Caracteres fora da cobertura aparecem explicitamente como `[U+XXXX]`,
  sem substituição silenciosa por `?`; o JSON preserva Unicode integral. Nomes e texto alterado
  não são cortados: fluem em folhas de continuação dentro das margens. Imagens e texto completo
  do par ficam em folhas separadas quando necessário.

O alinhamento usa similaridade textual e visual, com inserção/remoção de páginas. É heurístico:
páginas muito parecidas, repetidas, reordenadas ou profundamente modificadas exigem conferência humana.
O alinhamento preserva a ordem e não identifica uma movimentação de página como operação própria.
Os resultados não comprovam autenticidade, plágio ou equivalência semântica.
O resultado textual considera normalização Unicode NFC e espaços normalizados. Mudanças apenas
de aparência podem aparecer exclusivamente em Visual. A presença de texto em um documento não
garante que todas as suas páginas tenham texto extraível.

## Limites explícitos

- Até 64 MiB e 40 páginas por arquivo.
- Até 20 mil caracteres e 4 mil tokens por página; 100 mil caracteres somando os dois documentos.
- Renderização de até 1.200 pixels no maior lado, escala máxima de 1,5 e orçamento acumulado
  de 100 milhões de pixels de trabalho. O processamento recusa arquivos que excedam os limites.
- Pixelmatch usa limiar de 0,1 e ignora diferenças classificadas como antialiasing. As regiões
  são agrupadas em células e indicam áreas aproximadas, não coordenadas exatas de palavras.
- A escala física de cada par é comum, com preenchimento branco, sem esticar as páginas.
  Alterações de dimensões e páginas em branco inseridas/removidas também são sinalizadas,
  mesmo quando a proporção de pixels diferentes é zero.
- PDFs que exigem senha precisam ser desbloqueados antes. Não há comparação certificada,
  validação de assinaturas digitais ou garantia de detectar alterações abaixo da resolução usada.

## Integração

O registry publica `pdf-compare` apenas nas capacidades web habilitadas. `LauncherToolRunner`
retorna `comparison`, o relatório PDF principal e o JSON secundário. A interface dedicada
descarta resultados anteriores ao trocar arquivos, cancelar, sair ou iniciar outra execução.
O proxy encerra o worker ao concluir ou falhar. Não há homologação do desktop nesta entrega.

## Recursos e carregamento de detalhes

A análise continua extraindo e comparando todas as páginas, inclusive as assinaturas visuais
usadas no alinhamento. O worker incorpora imagens no relatório um par por vez e devolve os
resultados sem strings PNG. No modo visual, outra execução do mesmo executor renderiza apenas
as páginas do par solicitado, a partir dos originais e do alinhamento já calculado; não realinha
nem substitui os resultados. Em Texto, não solicita prévias. O cache mantém até dois pares e
4 MiB estimados de strings; o DOM decodifica apenas o par ativo. Troca de arquivo, cancelamento,
mudança de par/modo e saída descartam resultados atrasados e encerram a execução pertinente.

O relatório final ainda retém streams comprimidos necessários à exportação. Os campos `metrics`
no JSON medem renderizações, buffers de pixels do par e caracteres de imagens retidos no resultado;
não medem o heap total, RSS, GPU ou o pico do parser. Os limites anteriores foram mantidos.

Source Sans 3 3.052R (OFL-1.1) e sua licença acompanham o website. `@pdf-lib/fontkit` 1.1.1
(MIT declarado) foi fixado por ser o adaptador de fontes compatível com o pdf-lib existente;
o fork tem baixa cadência de publicações e recebe somente a fonte local conhecida nesta integração.
Não interpreta fontes enviadas pelo usuário. A auditoria de produção não encontrou vulnerabilidades
conhecidas em 24/10/2026; isso não garante ausência de falhas. Proveniência e hash:
`apps/client/public/fonts/pdf-comparison/NOTICE.md`.

Testes cobrem PDFs sintéticos reais, alinhamento, geometria, digitalizações, limites, relatório,
cancelamento e descarte de resultados atrasados. E2E Chromium verifica o bundle de produção,
downloads reais, senha, teclado e larguras de 390, 768, 1024 e 1440 px.
