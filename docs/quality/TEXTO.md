# Q-C0 — comparação e revisão de texto

Etapa local sobre `62cd023`, após o commit autorizado de proteger/desbloquear PDF.
Perfil restrito ao website no Chromium e aos textos sintéticos autorais indicados abaixo.
DOC-C2 continua fora do escopo. Sem novas dependências, integração de motores externos,
push, deploy ou integração na principal. Commit local desta etapa autorizado posteriormente
pelo usuário.

## Referência e resultados

O [corpus autoral](../../apps/client/src/platform/__fixtures__/q-c0-text/corpus.ts), sob
MPL-2.0, fixa fontes e resultados esperados. Não contém documentos de clientes.

| Caso | Critério conferido |
| --- | --- |
| Comparação com emoji, acentos, números, vazios e linhas repetidas | 2 adições, 1 remoção e 6 linhas inalteradas; reconstrução de ambas as fontes, numeração e IDs únicos |
| NFC e NFD | Grafias originais preservadas; equivalência normalizada de palavras, sem interpretar 100% como igualdade de bytes ou de significado |
| Três documentos | Exportação corresponde ao par selecionado; documento 2 vazio não bloqueia 1×3 e texto do documento 2 não vaza para esse relatório |
| TXT baixado | Códigos, valores e conteúdo literal `<script>` preservados; sem execução desse conteúdo |
| Limites | Mais de 10.000 linhas recusadas; edição posterior permite recuperar a comparação |
| Regras e dicionário real | `fasso` → `faço` e `relatóriu` → `relatório`, mantendo emoji e identificadores do corpus |
| Aplicação e download | Texto permanece intacto até aplicação explícita; TXT corresponde ao editor atual, inclusive após edição manual |
| Recusas | Achados obsoletos/desalinhados e motor indisponível não produzem revisão bem-sucedida |

O relatório de comparação usa LF e não reproduz a escolha original CRLF/LF. O teste de
leitura TXT preserva o texto original; o teste de diff confronta as linhas após essa
normalização explícita. Não há avaliação jurídica ou semântica.

## Correções encontradas na avaliação

O teste de workflow falhou primeiro porque o painel exibia 1×3, mas o executor recebia
1×2; também bloqueava a exportação se o documento 2 estivesse vazio. A seleção agora é
compartilhada pelo painel e executor, e o botão valida o documento selecionado.
Na revisão final, o mesmo risco foi identificado no botão inferior: texto apagado podia
recuperar um arquivo da outra coluna. Um novo teste falhou antes de bloquear ambas as ações
e a execução central quando o par selecionado está vazio. Alternar de volta a 1×2 permite
comparar e baixar esse par, sem usar o terceiro documento.

O ensaio com download do dicionário bloqueado mostrou o erro de carregamento junto à
frase que afirmava ausência de problemas ortográficos/gramaticais. O catálogo pt-BR
agora usa a mensagem neutra “Não há sugestões para exibir”. O erro de carregamento
continua visível e não há relatório de sucesso.

## Proveniência do dicionário existente

Os arquivos públicos são idênticos, byte a byte, a `index.aff` e `index.dic` do pacote
instalado `dictionary-pt@4.0.0`, cuja declaração de licença é `(LGPL-3.0 OR MPL-2.0)`.
O cabeçalho aff identifica VERO 3.2 e os créditos de Raimundo Santos Moura (2006–2013).
Não houve download, substituição nem inclusão de dependência nesta etapa. Os hashes
dos arquivos usados estão no [índice](q-c0.json); esta conferência não substitui auditoria
de distribuição ou parecer jurídico sobre licenciamento.

## Validação e limites

- `pnpm check`: formatter/lint e typecheck aprovados.
- `pnpm quality:check`: 7 testes aprovados, incluindo hashes e referências das 35 ferramentas.
- Suíte completa do cliente: 808 testes em 111 arquivos aprovados.
- Suíte de domínio: 44 testes aprovados.
- Após o achado da revisão final: 38 testes pertinentes em 6 arquivos aprovados.
- Builds web na raiz e em `/hub/` aprovados.
- Cinco E2E finais aprovados em cada base, raiz e `/hub/` (10 execuções), incluindo o
  caso derivado da revisão final.

Revisão final única: um achado material no botão inferior, corrigido com regressão
observada antes da mudança e testes pertinentes/E2E aprovados depois. O link duplicado
no roadmap também foi corrigido. Não houve segunda rodada de revisão.

A suíte completa do cliente ocorreu após a correção do par exportado. As mudanças posteriores
do texto pt-BR e da validação do botão inferior foram verificadas por testes pertinentes,
build/typecheck e E2E; não foi repetida toda a suíte após esses ajustes.
O teste de limite usa importação TXT: a tentativa de
preencher 10.001 linhas pela automação excedeu o prazo de 30 segundos e não serve como
evidência de desempenho interativo.

O corpus é pequeno e proposital. Os testes de regras com port simulado são distintos
do ensaio Chromium com Hunspell e o dicionário real. CPF/CNPJ numéricos, valores, URLs,
email e templates estão cobertos; identificadores alfanuméricos arbitrários não estão.
Ausência de sugestões não certifica correção linguística. Grandes documentos interativos,
RAM/tempo por dispositivo, corpus linguístico representativo, qualidade jurídica e app
Windows instalado permanecem sem homologação nesta etapa. Não foi executado E2E integral
nem nova matriz de quatro larguras/teclado/tema; esses gates continuam pendentes para texto.

O índice passa a 33 perfis restritos e 2 regressões (`pdf-compress` e `scan-to-pdf`),
com 24 grupos de corpus. Q-C0 global permanece parcial.
