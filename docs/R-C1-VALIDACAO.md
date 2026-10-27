# R-C1 — avaliação de qpdf e reparo conservador

Execução local de 26/10/2026, worktree `fix/auditoria-website`, base `bc3317b` limpa.
DOC-C2 fora do escopo. Sem commit, push, deploy, runtime nativo novo ou upload de documentos.

## Avaliação antes da implementação

O [qpdf oficial](https://github.com/qpdf/qpdf/releases/tag/v12.4.2) consultado está em 12.4.2,
com licença [Apache-2.0 e avisos próprios](https://github.com/qpdf/qpdf/blob/v12.4.2/NOTICE.md).
O repositório está ativo e não arquivado. A consulta à página de advisories do projeto não
encontrou avisos publicados; isso não certifica ausência de vulnerabilidades no motor, wrappers
ou bibliotecas incorporadas. A análise separou o core, o wrapper e o binário efetivamente publicado.

| Pacote avaliado | Publicação | Licença declarada | WASM distribuído | Limite encontrado |
| --- | --- | --- | --- | --- |
| `@neslinesli93/qpdf-wasm@0.3.0` | 27/06/2025 | ISC no wrapper | 1.334.286 bytes; `--version` confirma qpdf 12.2.0 | Tarball sem aviso qpdf/zlib/jpeg; falha em três casos recuperáveis no core nativo |
| `@jspawn/qpdf-wasm@0.0.2` | 26/07/2022 | Apache-2.0 | 1.274.647 bytes | Distribuição antiga; não escolhida para ensaio de integração |
| `@lipoe/browser-qpdf@0.3.1` | 08/10/2026 | Apache-2.0 | 1.244.062 bytes | Tarball omite `build-info.json` e `THIRD-PARTY-NOTICES`, apesar da documentação referenciá-los |

As fontes upstream do [wrapper CLI](https://github.com/neslinesli93/qpdf-wasm) e do
[wrapper de imagens](https://github.com/lipoe/browser-qpdf) foram consultadas separadamente.
O segundo anuncia qpdf 12.4.2 no Dockerfile; essa declaração não comprova que o WASM publicado
foi gerado com a mesma revisão. Não se atribuiu a maturidade do core C++ ao wrapper.
Os hashes por arquivo, integridade npm, licenças, datas e snapshots de manutenção estão em
[packages.json](evidencias/r-c1/packages.json) e nos arquivos `*-repository.json` dessa pasta.

O CLI WASM 0.3.0 foi executado realmente em Node e Chromium, com um módulo novo por caso.
Na prova browser, os arquivos foram servidos apenas em loopback para o ensaio. Nenhum arquivo
foi enviado a serviço externo. Essa porta não é adicionada ao aplicativo nem fica ativa após o teste.

Resultado no corpus de oito entradas: íntegro, prefixo e EOF ausente produziram saída; sem
startxref, apontador incorreto e sem xref/trailer retornaram código 2 sem saída, assim como os
dois controles irrecuperáveis. A diferença foi reproduzida no navegador, não deduzida do Node.
O core nativo qpdf 12.3.2, via pikepdf 10.5.1 isolado, recuperou as seis entradas com conteúdo
ainda legível e recusou os dois controles. Essa prova não foi usada como autorização para instalar
qpdf nativo ou enviar documentos para outro runtime.

**Decisão:** nenhum pacote qpdf entrou no app. O wrapper CLI avaliado não provou recuperação
adequada para esta fatia e o conjunto de avisos/proveniência do binário não fechou os gates de
redistribuição. Isso não significa que todo build WASM ou o core qpdf sejam inadequados.
Um build próprio auditado permanece uma avaliação futura, sem fallback oculto nesta entrega.

## Corpus e comparação

[Corpus versionado](../apps/client/src/platform/__fixtures__/r-c1/README.md), autoral MPL-2.0,
com PDFs fixos, gerador e manifesto SHA-256. Dados fictícios; datas fixas. Duas páginas textuais,
CropBox, campo `nome=Maria Silva`, anexo `nota.txt`, título/autor em Unicode e um stream válido
com delimitadores falsos de objeto/catalog/trailer. Esses bytes não devem virar objetos PDF.

Comparação congelada na baseline de `bc3317b`, CLI WASM 12.2.0 e perfil R-C1: **24 extrações**,
mesmas entradas, Node 24.19.0/Windows e máquina Ryzen 5 3550H/32 GB RAM.
O corpo do anexo e o grafo não foram avaliados por hash do PDF apenas: campos, anexos, metadados,
geometria e páginas foram inspecionados. Originais permaneceram com o mesmo SHA-256 em todas as chamadas.

| Perfil | Saídas aceitas | Tempo observado por caso | RSS observado máximo do processo |
| --- | --- | --- | --- |
| Baseline | 6/8, com perda de formulário, anexo e metadados | 3,76–33,23 ms | 165.974.016 bytes |
| qpdf 12.2.0 WASM em Node | 3/8 | 14,39–370,83 ms | 165.965.824 bytes |
| R-C1 | 5/8, com preservação nos casos aceitos | 0,32–13,97 ms | 165.974.016 bytes |

Tempos exploratórios incluem inicialização e leitura pelo avaliador; a primeira chamada qpdf
inclui compilação WASM. RSS é observado antes/depois, no mesmo processo com Vite e leitores;
não é pico amostrado, custo exclusivo do motor nem mínimo de RAM necessário. O ensaio não
justifica ranking universal de velocidade. A execução browser isolada do qpdf levou 37–62 ms
por caso neste ambiente; não equivale a medição do fluxo completo da interface.

Dados completos: [matriz](evidencias/r-c1/quality.csv), [comparação Node](evidencias/r-c1/comparison.json),
[qpdf no navegador](evidencias/r-c1/browser-comparison.json),
[controle nativo](evidencias/r-c1/native-comparison.json) e
[reabertura independente](evidencias/r-c1/independent-reader.json).

### Por que o perfil atual aceita cinco e não seis entradas

Na entrada sem xref/trailer, as páginas, o formulário e o anexo ainda são legíveis, mas a
associação do dicionário Info é destruída. O parser pode abrir o PDF e omitir esses metadados.
O R-C1 detecta essa ambiguidade e recusa a saída; não adivinha a qual objeto associar o catálogo
nem entrega o arquivo com perda silenciosa. Truncamento físico e texto não PDF também falham.
A baseline aceitava seis entradas copiando somente páginas, mas perdia as raízes documentais.

O perfil não faz recuperação parcial página a página. Divergência entre a contagem declarada
e as páginas recuperadas, erro de verificação ou associação ambígua invalida a operação inteira.
Isso reduz a aceitação de certos arquivos em favor da preservação dos dados reconhecidos.
Páginas ou metadados fisicamente ausentes não podem ser inferidos pelo número de páginas detectadas.

## Implementação

- O parser do pdf-lib permanece, mas saiu a reconstrução regex de objetos/xref/Root, que podia
  confundir conteúdo de streams com estrutura. Não se inventa cabeçalho para texto contendo `obj`.
- O grafo carregado é serializado com `updateMetadata:false` e sem atualizar aparências de campos.
  AcroForm, EmbeddedFiles, metadados associados, CropBox e rotação permanecem; nenhuma assinatura
  digital é invalidada silenciosamente, pois documentos com ByteRange são recusados.
- Relatório mantém seu contrato; flags xref/trailer ficam falsas quando não há prova do reparo
  específico. Header/EOF são informados somente pela evidência correspondente. Não há diagnóstico
  percentual de correção nem garantia universal de recuperação.
- Tool Runner usa adapter browser e worker proprietário. Transferência somente de cópia; timeout,
  cancelamento, erro e sucesso encerram o worker. Mensagens tardias não publicam download/histórico.
- Saída reaberta em PDF.js antes do sucesso: todas as páginas, operadores, texto, anotações,
  anexos e metadados. O avaliador pikepdf/qpdf independente também reabriu as cinco saídas e
  conferiu conteúdo do anexo, campos, título e geometria. Seus hashes precisam coincidir com a matriz.
- Mesa exibe a prévia do resultado baixável e permite consultar o original nas opções. Nova saída
  reinicia na prévia reparada; um erro ao renderizar impede o download. Cancelar continua acessível
  durante a execução. Janelas baixas mantêm a área de documento sem o controle adicional no cabeçalho.
- A interface recebe somente avisos e ações úteis ao cliente, via catálogo PT-BR; nenhuma exposição
  de qpdf, bibliotecas, compilação, memória ou detalhes do worker foi acrescentada.

## Limites explícitos

16 MiB de entrada, 32 MiB de saída, 250 páginas, 25.000 objetos, 8 MiB por stream descomprimido,
64 MiB acumulados para streams sem filtro/Flate e 16 milhões de pixels por imagem/página.
Filtro desconhecido ou cadeia de filtros composta é recusado. O prazo máximo do worker é 30 s.
É exigido cabeçalho PDF válido nos primeiros 4.096 bytes; arquivos sem esse sinal são recusados.
O limite de entrada é aplicado **antes** de `File.arrayBuffer()` no runner e na prévia inicial.

O orçamento de streams/objetos é conferido depois que o parser carrega o arquivo. Um object stream
pode alocar memória antes dessa conferência; imagens comprimidas não equivalem ao total Flate.
Os limites de entrada e tempo reduzem a exposição, mas **não são um limite rígido de heap** nem
certificam proteção universal contra todo documento adversarial. Não se declara sandbox de memória.
Esse limite permanece um custo conhecido de manter o parser atual sem adotar um build qpdf próprio.
O reparo não é sanitização de conteúdo ativo: conserva o grafo reconhecido, inclusive anexos.

## Reprodução

```powershell
python scripts/avaliar-r-c1-fontes.py
node scripts/avaliar-r-c1.mjs
node scripts/avaliar-r-c1-browser.mjs
uv run --no-project --with pikepdf==10.5.1 --python 3.12 scripts/avaliar-r-c1-nativo.py
uv run --no-project --with pikepdf==10.5.1 --python 3.12 scripts/validar-r-c1.py
```

Os pacotes e WASM são baixados somente para `.superpowers/sdd/2026-10-26-r-c1/`, ignorado.
Versões npm fixas e integridade do tarball verificadas antes de ler o arquivo. Não há extração
de paths arbitrários do tarball; os nomes são achatados. Nenhum binário ou dependência entra
no package.json, lockfile ou build do aplicativo. Os controladores de medição não integram o app.

## Revisão e validação local

Revisão independente única de engine, adapter, worker, verificador e UI apontou a leitura
integral antes do limite no Tool Runner. Corrigida com regressão RED→GREEN, incluindo a mesma
proteção na prévia inicial. Outras regressões reproduziram perda de campo/anexo, erro genérico
para `objetos`, falta de limite e cancelamento, contagem divergente, perda de Info órfão e
manutenção indevida da seleção da prévia original. Suíte integral após os ajustes registrada abaixo.

A inspeção visual detectou a legenda do resultado com nome/tamanho do original. Uma regressão
reproduziu o erro; o painel agora identifica o arquivo exibido e alterna corretamente os dados
ao consultar o original. Capturas finais em 390/768/1024/1366/1440 px, dois temas e janelas
baixas foram geradas. Em 390×320 a página inteira permanece pequena pelo enquadramento
existente; os controles continuam acessíveis. Não se declara legibilidade do texto nessa altura.

| Verificação executada | Resultado | Log em `.superpowers/sdd/2026-10-26-r-c1/` |
| --- | --- | --- |
| `pnpm check` | Formatter, lint e typecheck aprovados | `check-final.log` |
| Unitários do cliente após a correção da legenda | 735 aprovados | `unit-client-final.log` |
| Unitários domain / SDK / registry | 44 / 16 / 3 aprovados; total 798 com cliente | `unit-domain.log`, `unit-sdk.log`, `unit-registry.log` |
| E2E completos da raiz | 300 aprovados; cinco exclusivos de subpasta pulados | `e2e-root-full.log` |
| E2E oficiais `/hub/` | 193 aprovados | `e2e-hub-full.log` |
| Builds raiz e `/hub/` após a legenda | Aprovados | `build-root-final.log`, `build-hub-final.log` |
| E2E focados após a legenda, raiz e `/hub/` | 19 aprovados em cada base | `e2e-caption-root.log`, `e2e-caption-hub.log` |
| Licenças de dependências | Aprovadas; nenhuma dependência do app adicionada | `licenses.log` |
| Ruff 0.16.5 e compilação dos scripts Python | Aprovados | `python-lint-final.log`; compilação confirmada na execução local |
| Leitor independente pikepdf 10.5.1 | Cinco saídas conferidas | `docs/evidencias/r-c1/independent-reader.json` |

As suítes E2E completas antecedem somente a correção da legenda; os 38 E2E focados e os
735 unitários do cliente usam o estado final dessa correção. Capturas e hashes finais ficam
em `captures-hub-final/` e `capture-metrics.json` no mesmo diretório de logs ignorado.
O worker de reparo observado no build mede 920.639 bytes (gzip: 327.806), além do parser
PDF.js já adotado. Isso não é o tamanho total do app. Nenhum WASM qpdf entrou no build.
Os builds conservam o aviso de chunks acima de 1.000 kB; isso não impede sua conclusão.

Não homologados: todo PDF danificado, equivalência universal ao qpdf nativo, sandbox rígida
de RAM, dispositivos com pouca memória e aplicativo Windows instalado. DOC-C2 não foi iniciado.
