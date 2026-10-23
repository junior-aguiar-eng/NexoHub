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
- **Navegação:** lista de pares alterados, pesquisa no texto e navegação entre todos os pares.
- **Exportação:** relatório PDF com resumo, imagens e trechos das alterações; JSON com o texto
  completo e os resultados, sem incluir as imagens. Caracteres não suportados pela fonte do
  relatório aparecem como `?`; o JSON preserva Unicode. Os trechos do PDF são resumidos.

O alinhamento usa similaridade textual e visual, com inserção/remoção de páginas. É heurístico:
páginas muito parecidas, reordenadas ou profundamente modificadas exigem conferência humana.
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

Testes cobrem PDFs sintéticos reais, alinhamento, geometria, digitalizações, limites, relatório,
cancelamento e descarte de resultados atrasados. E2E Chromium verifica o bundle de produção,
downloads reais, senha, teclado e larguras de 390, 768, 1024 e 1440 px.
