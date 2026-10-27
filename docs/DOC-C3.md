# DOC-C3 — paginação HTML local

Execução local em 26/10/2026, base `eba09c8` após commit autorizado do R-C1,
worktree `fix/auditoria-website`. Sem novo commit, push, deploy, atualização de instalador,
runtime remoto ou dependência nova. DOC-C2 permanece fora do escopo.

Plano responsável: [Quatro ferramentas](superpowers/plans/2026-10-23-corrigir-quatro-ferramentas.md#doc-c3--html-fidelidade-dentro-do-escopo-local).

## Comportamento implementado

Tabelas repetem as linhas iniciais de cabeçalho em cada página ocupada pela tabela, inclusive
quando uma linha longa do corpo é dividida. O cabeçalho vem de `thead` ou das linhas iniciais
compostas só por `th`. Cabeçalhos não são fragmentados; se não couberem com uma linha mínima
do corpo, a ferramenta recusa o arquivo e orienta reduzir o texto ou usar página maior.
Tabelas com colunas demais também recebem mensagem própria.

Quebras explícitas inline `break-before/after: page` e `page-break-before/after: always`
são respeitadas nos blocos percorridos pelo conversor (como parágrafos, contêineres, itens
de lista e linhas do corpo de tabelas). Cabeçalhos são mantidos como grupo indivisível.
Quebras nas extremidades ou consecutivas não criam páginas vazias. Não se implementam
paridade de páginas, regras por classe/folha CSS, `break-inside` ou impressão arbitrária.

O PDF continua usando layout documental próprio e texto vetorial selecionável quando
representável pelas fontes padrão. Linhas Unicode fora desse conjunto usam o fallback já
existente do navegador com camada de texto; não se rasteriza a página inteira. A prévia
continua mostrando o HTML original, sem fingir que é a paginação do PDF exportado.
O aviso ao cliente foi simplificado: informa reorganização, ausência de imagens e possíveis
mudanças visuais, sem explicações de programação ou funcionamento interno.

## Segurança e arquitetura preservadas

Parser inerte existente, atributos ativos/URLs removidos, iframe sem permissões e CSP sem
rede mantidos. Não foi necessário alterar `html-local-document.ts`; testes próximos verificam
a preservação de quebras inline e as restrições existentes, e o E2E monitora rede e execução.
Tool Registry, Tool Runner e contrato de download continuam sendo o caminho de execução.
Nenhum html2canvas, html2pdf.js, Chromium sidecar ou serviço foi incorporado.

## Evidências e limites

[Corpus autoral](../apps/client/src/platform/__fixtures__/doc-c3/README.md), teste de extração
por célula nos 96 valores Unicode, linha final e bounds de texto em todas as páginas de saída.
Os E2E anexam os PDFs e métricas das duas execuções por cenário. Capturas cobrem
390/768/1024/1440 px em dois temas com movimento reduzido. O cenário de segurança confere
que a prévia não dispara requests nem executa o script fornecido.

Ambiente: Windows, Ryzen 5 3550H, 32 GB RAM, Node 24.19.0 e Chromium 151.
Tempos incluem interação e download; execução com outros testes no host, sem ranking de
desempenho nem certificação de pico de memória/dispositivos com pouca RAM.

O perfil não equivale a imprimir qualquer site. Imagens, fontes externas, layout CSS,
colspan/rowspan, tabelas aninhadas e fidelidade visual arbitrária não são homologados.
O original permanece preservado; a saída é derivada. Não há homologação do Windows instalado.

Medições do fluxo final em `/hub/`, primeira e segunda conversão na mesma página:

| Entrada | Páginas | Primeira | Segunda | Bytes de saída |
| --- | --- | --- | --- | --- |
| Tabela longa | 5 | 920 ms | 523 ms | 8.540 / 8.542 |
| Tabela larga Unicode | 2 | 1.486 ms | 1.074 ms | 408.976 |
| Quebras de blocos | 3 | 555 ms | 478 ms | 1.594 |
| Quebras de lista | 3 | 583 ms | 482 ms | 1.730 |
| Quebras de tabela | 3 | 560 ms | 453 ms | 1.913 |

Primeira/segunda distinguem aquecimento na mesma sessão, sem reiniciar processo nem limpar
cache do navegador. O ensaio não mede um início frio absoluto. Pequena variação de bytes na
tabela longa decorre da serialização/metadados; conteúdo e páginas foram conferidos em ambas.
[Métricas e SHA-256 dos dez PDFs](evidencias/doc-c3/website.json). PDFs e oito capturas ficam
em `outputs-hub-final/` e `captures-hub-final/` no diretório local de logs ignorado.

Bundle principal `/hub/`: 1.114,72 kB / 306,42 kB gzip informados pelo Vite, contra
1.112,96 kB / 305,80 kB da baseline R-C1 no mesmo perfil: cerca de +1,76 kB / +0,62 kB gzip.
O JSON registra também bytes exatos, SHA-256 e gzip Python nível 9, uma medição diferente
da saída gzip do Vite. Não há recurso adicional de motor/modelo. Permanece o aviso de
chunks acima de 1.000 kB; builds concluíram normalmente.

## Validação

Regressões RED: cabeçalho ausente após a primeira página; quebra inline ignorada; cabeçalho
excessivo aceito; falha genérica no runner; aviso sem indicação clara da ausência de imagens.
Corrigidas com testes GREEN. A revisão única encontrou quebras ignoradas em itens de lista
e linhas de tabela; dois testes separados reproduziram o problema antes da correção e
passaram depois. Foram acrescentadas provas do download para ambas as fronteiras.
Não houve outro achado material. CSS arbitrário, glifos em todos os dispositivos e memória
adversarial não foram certificados pela revisão. Gates finais registrados abaixo.

Logs locais ignorados: `.superpowers/sdd/2026-10-26-doc-c3/`.

| Verificação | Resultado confirmado | Log local |
| --- | --- | --- |
| Formatter, lint e typecheck | Aprovados | `check-final.log` |
| Unitários finais do cliente | 743 aprovados | `unit-client-final.log` |
| Unitários domain / SDK / registry | 44 / 16 / 3 aprovados; total 806 | `unit-domain.log`, `unit-sdk.log`, `unit-registry.log` |
| Suíte E2E completa da raiz | 312 aprovados; cinco exclusivos de subpasta pulados | `e2e-root-full.log` |
| Suíte oficial `/hub/` após a correção da revisão | 223 aprovados | `e2e-hub-full.log` |
| E2E focados finais, raiz e `/hub/` | 30 aprovados em cada base | `e2e-root-final-focused.log`, `e2e-hub-final-focused.log` |
| Builds finais, raiz e `/hub/` | Aprovados | `build-root-final.log`, `build-hub.log` |
| Auditoria de licenças | Aprovada; nenhuma dependência nova | `licenses.log` |

A suíte completa da raiz antecede a correção das quebras em listas/linhas; unitários finais
e suíte oficial `/hub/` usam essa correção. Os 60 E2E focados finais também conferem a gravação
explícita de PDFs/métricas em disco e as capturas com tema aplicado depois da inicialização.

Decisões mantidas: DOC-C3 foi selecionado como próximo complemento local executável,
deixando AVIF condicionado à homologação adicional. Quebras por folhas CSS arbitrárias
continuam fora do perfil; documentos que dependem delas exigem ajustar a origem. Esses
limites evitam ampliar motores/arquitetura e não certificam fidelidade de qualquer site.
