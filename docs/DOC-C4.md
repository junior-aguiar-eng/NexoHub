# DOC-C4 — preservar campos em subconjuntos de páginas

Execução local de 26/10/2026 na base `aa2d874`, após commit autorizado do DOC-C3 e árvore
limpa, no worktree `fix/auditoria-website`. Sem novo commit, push, deploy, atualização
instalada, dependência nova ou mudança arquitetural. DOC-C2 permanece fora do escopo.

Plano responsável: [Quatro ferramentas](superpowers/plans/2026-10-23-corrigir-quatro-ferramentas.md#doc-c4--remover-e-extrair-páginas-preservação-e-uso-em-documentos-grandes).

## Alterações demonstradas

A remoção de widgets não removia as opções correspondentes do rádio. Além de manter uma
opção de página descartada, o índice antigo podia trocar o nome da seleção sobrevivente.
O helper `retainPdfFormWidgets` agora conserva as opções dos widgets mantidos, limpa a
seleção cuja alternativa foi removida e preserva seleção/valores/aparências sobreviventes.
Campos exclusivos das páginas descartadas saem do formulário; o subconjunto é salvo sem
regenerar as aparências. PDF combinado e cada PDF do ZIP usam o mesmo caminho de preservação.

A grade descartava resultados tardios, mas não passava cancelamento à renderização ativa
das páginas sob demanda. Agora a sessão recebe AbortSignal, cancela ao sair/trocar arquivo
ou ferramenta, reinicia a cadeia e impede publicação de resultados antigos. O batch inicial
de até 48 páginas e o carregamento lazy posterior foram preservados. Não foi reimplementada
a correção de miniaturas além da página 48.

Documentos com ByteRange ou XFA são recusados antes da cópia: este caminho não preserva
assinatura digital nem formulário dinâmico. A detecção é estrutural; não verifica validade
criptográfica. A interface apresenta orientação simples, sem expor o marcador técnico.

## Corpus e critérios

[Corpus autoral](../apps/client/src/platform/__fixtures__/doc-c4/README.md): campos em páginas
mantidas/descartadas, hierarquia, campo compartilhado, checkbox, rádio entre páginas,
CropBox/rotação e Parent herdado. Remoção, seleção descontínua, ordem solicitada e ZIP
conferidos. Os bytes de entrada permanecem iguais; novas saídas não precisam ter o mesmo hash.
Os E2E reabrem o download com PDF.js e conferem texto, geometria e valores textuais; os
unitários conferem também campos/opções e referências dos widgets.

O cancelamento ativo é provado pelo teste de unidade que observa o sinal abortado e nenhuma
leitura/render subsequente da fila. O E2E usa render real, confirma miniatura carregada,
exercita troca de arquivo/saída e confere ausência de novas renderizações depois de sair.
A instrumentação experimental de Worker da primeira rodada não representava corretamente
o ciclo do parser e foi retirada. Seu contador não é usado como prova de encerramento.
Um seletor ZIP também foi corrigido para corresponder ao catálogo real; as assertions de
preservação do download permaneceram.

## Medição e decisão sobre a grade

No ensaio inicial de 500 páginas textuais, a mesa ficou disponível em 3,25–3,49 s, incluindo
navegação/carga do aplicativo, parsing e criação dos controles. O intervalo até duas RAFs
após a entrada foi 81–99 ms neste host; havia 40–57 renders concluídos e 4.686–6.626 nós DOM
no ponto observado. A seleção global, Space/Enter e a exportação funcionaram sem renderizar
as 500 páginas. Os downloads tiveram três páginas extraídas ou 497 páginas restantes.

**Decisão:** manter a grade atual sem virtualização neste incremento, pois a medição não
demonstrou necessidade de trocar a estrutura. O custo é conservar milhares de nós no DOM;
dispositivos lentos/com pouca RAM podem exigir outra intervenção. Não se ampliaram limites.
Capturas com miniaturas carregadas cobrem 390/768/1024/1440 px, dois temas e movimento reduzido.

Ambiente: Windows, Ryzen 5 3550H, 32 GB RAM, Node 24.19.0 e Chromium 151. Testes concorrentes
no host; tempos exploratórios, sem promessa universal. As amostras CDP distinguem heap JS,
embedder e backing storage antes da importação, na seleção e depois de outra carga/saída.
Não houve coleta de lixo forçada: isso não mede pico, RAM total nem comprova vazamento ou
liberação imediata de toda a memória. PDFs pesados com imagens e dispositivos menores
continuam sem homologação.

Na rodada oficial final de `/hub/`, sem a suíte unitária concorrente, foram observados:

| Ferramenta | Mesa disponível, fluxo completo | Entrada até duas RAFs | Renders no ponto de seleção | Nós DOM | Páginas exportadas |
| --- | --- | --- | --- | --- | --- |
| Remover | 1.441 ms | 67,6 ms | 35 | 6.676 | 497 |
| Extrair | 1.791 ms | 74,5 ms | 36 | 4.686 | 3 |

Não se atribui a diferença de tempo somente ao código: carga do host e aquecimento variam
entre rodadas. [Métricas completas, heap e hashes dos artefatos](evidencias/doc-c4/website.json).
No diretório local ignorado, `outputs-hub-final/` contém as saídas e `captures-hub-final/`
as 16 capturas. O hash identifica o arquivo medido; não substitui as conferências de conteúdo.

Bundle principal `/hub/`: 1.115,76 kB / 306,59 kB gzip no Vite, contra 1.114,72 kB /
306,42 kB na baseline DOC-C3 do mesmo perfil: aproximadamente +1,04 kB / +0,17 kB gzip.
O JSON inclui bytes exatos e gzip Python nível 9, medição distinta do gzip informado pelo
Vite. Sem novo motor/modelo/recurso baixável. Mantido o aviso existente de chunks acima
de 1.000 kB; o build foi concluído.

## Validação e revisão

Regressões RED→GREEN: opções/seleção de rádio em páginas descartadas e mantidas; sinal de
cancelamento da fila; controles de recusa ByteRange/XFA; mensagem simples para formulário
incompatível. 65 unitários focados e 21 E2E focados aprovados antes das suítes gerais.
Revisão independente única não encontrou achado material. Não certificou formulários
malformados/arbitrários, dispositivos menores, validade criptográfica ou Windows instalado.
O código final passou nos gates abaixo. Capturas iniciais ainda tinham parte das miniaturas
carregando; a rodada focada final aguardou as seis primeiras imagens antes de capturar,
sem alterar o motor ou relaxar as verificações de download e preservação.

Logs locais ignorados: `.superpowers/sdd/2026-10-26-doc-c4/`.

| Verificação | Resultado confirmado | Log local |
| --- | --- | --- |
| Formatter, lint e typecheck | Aprovados | `check-final.log` |
| Unitários do cliente | 751 aprovados | `unit-client-full.log` |
| Unitários domain / SDK / registry | 44 / 16 / 3 aprovados; total 814 | `unit-domain.log`, `unit-sdk.log`, `unit-registry.log` |
| Suíte E2E completa da raiz | 335 aprovados; cinco exclusivos da subpasta pulados | `e2e-root-full.log` |
| Suíte oficial `/hub/` | 244 aprovados | `e2e-hub-full.log` |
| Matriz final de capturas `/hub/` | 16 aprovados | `e2e-captures-final.log` |
| Builds raiz e `/hub/` | Aprovados | `build-root.log`, `build-hub.log` |
| Auditoria de licenças | Aprovada; dependências inalteradas | `licenses.log` |

O ensaio grande usa extração combinada e remoção; ZIP é conferido no corpus com campos,
sem benchmark de exportação de centenas de PDFs individuais. Esse custo não foi homologado.

DOC-C4 entregue localmente, sem commit. DOC-C2 não iniciado; Windows instalado permanece
fora desta homologação. Nenhum push, deploy ou integração de Camelot/Docling foi realizado.
