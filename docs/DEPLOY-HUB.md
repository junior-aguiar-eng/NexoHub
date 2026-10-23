# Publicação do website em https://nexojuris.ia.br/hub/

## Estado e escopo

O código aceita `NEXOHUB_BASE_PATH=/hub/`; o padrão permanece `/` para o subdomínio e desktop.
O argumento de build do Docker tem o mesmo nome. Não basta configurar uma variável no runtime:
o Vite incorpora a base ao bundle durante o build.

Migração ativada e conferida pelo operador em 23/10/2026. O mapa da raiz é
`forgelex-api-hml-map`, no projeto `project-bbbe1209-c295-4720-867`, e encaminha `/hub/*`
ao serviço `nexohub-hub`. O subdomínio antigo usa outro mapa, `ratione-urlmap`, no projeto
`ratione-nexojuris`, e redireciona para a nova URL. A sessão de preparação não dispõe de
credenciais GCP nem de acesso às APIs Google; as alterações remotas foram executadas no Cloud Shell.

## Desenho aprovado

- Preservar `nexohub` e seu build na raiz durante a validação e o período de transição.
- Publicar um serviço candidato separado, por exemplo `nexohub-hub`, com o build `/hub/`.
- Reutilizar o balanceador: `/hub` → redirecionamento para `/hub/`, com query preservada;
  `/hub/*` → backend NexoHub, reescrevendo o prefixo `/hub/` para `/` no upstream.
- Preservar todas as demais regras, incluindo ForgeLex, HML, `/api`, OAuth e MCP.
- Não alterar DNS, certificados existentes, bancos, processamento ou autenticação do ForgeLex.

O serviço estático existente atende seus arquivos na raiz. Por isso o URL rewrite é obrigatório.
O navegador pede `/hub/assets/...`; o upstream recebe `/assets/...`. Não configurar também
uma segunda remoção de prefixo no serviço. APIs HTTP opcionais usam `/hub/api/v1` quando não há
endpoint explícito configurado, e a mesma regra as encaminha para `/api/v1` no upstream.
O website continua usando processamento no navegador por padrão, sem habilitar o adapter HTTP.

## 1. Inventário somente de leitura

Executar com uma identidade autorizada no Google Cloud, sem copiar credenciais para o repositório:

```bash
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud compute url-maps describe forgelex-api-hml-map \
  --global --project=project-bbbe1209-c295-4720-867 --format=json > url-map-antes.json
gcloud compute url-maps export forgelex-api-hml-map \
  --global --project=project-bbbe1209-c295-4720-867 --destination=url-map-rollback.yaml
```

Conferir a regra de host de `nexojuris.ia.br`, backends, esquema do balanceador (EXTERNAL ou
EXTERNAL_MANAGED), certificados, NEG, projeto e região do Cloud Run NexoHub. Verificar ausência de
uso anterior de `/hub`. Não imprimir segredos nem exportar variáveis de ambiente dos serviços.
Se NexoHub e balanceador estiverem em projetos diferentes, validar a topologia permitida antes de
criar NEG: não supor que um serverless NEG possa apontar para qualquer Cloud Run entre projetos.
Uma opção é publicar o candidato no projeto do balanceador, com imagem e identidades autorizadas.

## 2. Validação e build candidato

Com dependências já instaladas:

```bash
pnpm lint
pnpm typecheck
pnpm test --maxWorkers=2
node --test scripts/deploy/*.test.mjs
NEXOHUB_BASE_PATH=/hub/ pnpm --filter @nexohub/client build
# Em outro terminal: preview com a mesma base; executar apenas a suíte de subpasta.
NEXOHUB_BASE_PATH=/hub/ pnpm --filter @nexohub/client preview --host 127.0.0.1 --port 4173
NEXOHUB_BASE_PATH=/hub/ pnpm --filter @nexohub/client exec playwright test hub-subpath.spec.ts --workers=2
```

Também executar o build e os E2E normais sem `NEXOHUB_BASE_PATH` para provar compatibilidade com `/`.
A suíte `hub-subpath` fica desabilitada no build normal.

`scripts/deploy/cloudbuild-hub.yaml` constrói uma imagem separada com o prefixo correto.
Fornecer `_IMAGE_URI` (repositório de imagens já autorizado) e `_SOURCE_SHA` do código revisado.
Usar imagem por digest para publicar `nexohub-hub`, mínimo de instâncias 0, sem alterar o serviço
`nexohub`. Não reutilizar a tag `latest` de produção. Criar um backend e serverless NEG dedicados,
compatíveis com o projeto/região e o esquema observado no inventário. Verificar ingress e IAM.
Não criar um segundo balanceador, endereço IP ou certificado para esta migração.

O build candidato depende do rewrite para uma navegação completa. Antes de apontar a nova rota,
conferir health check `/api/v1/health`, HTML e recursos diretamente na raiz do candidato
(`/assets/...`, `/standard_fonts/...`, `/dictionaries/...`); o HTML deve referenciar `/hub/...`.
Não tratar um HTTP 200 do fallback HTML como prova de que JS, WASM ou fontes foram servidos:
conferir tipo de conteúdo e bytes. Para validação completa usar o proxy com rewrite ou a nova rota
isolada após validar o mapa. Não mudar o backend padrão para testar o candidato.

## 3. Preparar e revisar o URL map

Usar o selfLink real do novo backend, obtido por `gcloud compute backend-services describe`.
O gerador abaixo trabalha apenas em arquivos e não altera o Google Cloud:

```bash
node scripts/deploy/prepare-hub-url-map.mjs \
  url-map-antes.json '<selfLink-do-backend-NexoHub>' url-map-candidato.json

gcloud compute url-maps validate --source=url-map-candidato.json \
  --global --project=project-bbbe1209-c295-4720-867 --load-balancing-scheme=EXTERNAL_MANAGED
```

Revisar o diff do mapa: somente o host raiz deve ganhar `/hub` e `/hub/*`. O gerador clona o matcher
para não modificar outros hosts que o compartilhem. Recusa conflitos em `/hub`, host sem regra
explícita e `routeRules` avançadas, que exigem adaptação ao mapa real. Preserva o fingerprint;
conferir novamente o inventário antes da importação para evitar sobrescrever alterações concorrentes.
O gerador não prova que o backend existe, que o NEG responde ou que a política do balanceador aceita
o rewrite. A validação real do Google Cloud é obrigatória.

Após validar e revisar o candidato:

```bash
gcloud compute url-maps import forgelex-api-hml-map --source=url-map-candidato.json \
  --global --project=project-bbbe1209-c295-4720-867
```

## 4. Conferência depois da nova rota

- `/hub` redireciona para `/hub/`; `/hub/pdf`, `/hub/img` e URLs diretas das ferramentas abrem e recarregam.
- Histórico, busca do cabeçalho, filtros e downloads funcionam sem escapar para `/pdf` ou `/img` da raiz.
- Fontes, favicons, dicionários, JS, Workers e WASM retornam conteúdo correto sob `/hub/`.
- Executar PDF, edição, comparação e imagem com fixtures sintéticas; revisar não envio de documentos.
- Confirmar funcionamento do site ForgeLex e seus endpoints existentes, login e MCP, sem realizar
  compras ou operações com contas reais para ensaiar a migração.
- Comparar regras e serviços com o inventário anterior; HML e fallback continuam preservados.

A mudança para subpasta compartilha a origem do ForgeLex. Cookies com `Path=/`, localStorage,
IndexedDB e scripts pertencem à mesma origem; subpastas não fornecem isolamento de segurança.
Revisar nomes de chaves, cookies enviados ao backend, CSP e Auth do site principal antes da ativação.
Os cookies e tokens do ForgeLex não são necessários ao processamento local do NexoHub. Não
habilitar autenticação ou APIs remotas no NexoHub como consequência desta publicação.
Preferências e histórico do subdomínio antigo não são transferidos automaticamente à nova origem.

## 5. Redirecionamento antigo e rollback

Somente após validar a nova rota, configurar redirecionamento permanente do host antigo para
`https://nexojuris.ia.br/hub/<caminho-antigo>`, preservando query e evitando prefixo duplicado.
O inventário de 23/10/2026 confirmou que `nexohub.nexojuris.ia.br` usa o balanceador global
`ratione-urlmap` no projeto `ratione-nexojuris` (IP `34.120.34.54`), com matcher exclusivo
`nexohub-matcher`. O mapa HTTP `ratione-http-redirect` já força HTTPS. Não alterar o URL map do
ForgeLex para fazer esse redirecionamento.

O utilitário `scripts/deploy/prepare-legacy-hub-redirect.mjs` cria um candidato restrito a esse
matcher: o prefixo `/hub/` é aplicado a caminhos antigos, query strings são mantidas e caminhos
`/hub` já existentes não recebem o prefixo duas vezes. `scripts/deploy/activate-legacy-hub-redirect.sh`
exporta backup, valida o candidato, confere que o mapa não mudou e só então o importa. O script
confere automaticamente os destinos exatos para `/`, `/pdf` e `/hub/pdf`, preservando query,
e HTTP 200 na raiz e em `/hub/`. Repete somente a conferência por até dez minutos durante a
propagação, sem reaplicar o mapa. Usa Bash e curl, sem depender de `rg` no Cloud Shell.
Não desativar o serviço antigo durante a observação.

Se a publicação nova falhar, restaurar o URL map exportado ou remover exclusivamente as novas regras
após conferir alterações concorrentes. O rollback não exige restauração de banco:

```bash
gcloud compute url-maps import forgelex-api-hml-map --source=url-map-rollback.yaml \
  --global --project=project-bbbe1209-c295-4720-867
```

Verificar a raiz e o subdomínio antigo. Se o redirecionamento antigo já tiver sido ativado,
revertê-lo também. Registrar horários, SHA/digest, revisão candidata, backends e resultado dos
smokes, sem tokens, cookies ou documentos de usuário. Não declarar a migração concluída antes
de observar o endereço público e os fluxos preservados.

## Evidência local — 23/10/2026

Lint e tipagem aprovados; 579 testes unitários e 4 testes do gerador aprovados.
A suíte completa da raiz aprovou 135 E2E, com os 5 testes exclusivos de subpasta desabilitados
nesse modo. O executor dedicado aprovou os 5 E2E de `/hub/` após build real com essa base.
Builds da raiz e da subpasta aprovados; nenhum teste remoto nem alteração de tráfego foi realizado.

## Inventário remoto informado pelo operador — 23/10/2026

O operador confirmou pelo Cloud Shell: URL map `forgelex-api-hml-map`, host raiz com matcher
`prod-root` e backend `forgelex-api-prod-backend`, sem path rules; host HML com matcher
`hml-isolated`; esquema `EXTERNAL_MANAGED`. O NexoHub atual está no projeto `ratione-nexojuris`,
região `southamerica-east1`, revisão `nexohub-00024-b2b`, URL `https://nexohub-moe3oe6lva-rj.a.run.app`.
O export completo e atual continua obrigatório antes de aplicar qualquer alteração.

A documentação oficial de [serverless NEGs](https://docs.cloud.google.com/load-balancing/docs/negs/serverless-neg-concepts)
exige que backend, NEG e Cloud Run estejam no mesmo projeto. A referência entre projetos depende
de uma topologia Shared VPC, que não foi demonstrada. A implementação candidata usa o projeto do
balanceador, sem alterar redes nem o serviço NexoHub existente no projeto Ratione.

Para usar o pacote de fonte revisada fornecido ao operador, extrair em diretório novo e executar
`bash scripts/deploy/prepare-cloudshell-candidate.sh`. O pacote contém `DEPLOY-SHA256SUMS`;
o script verifica a fonte, recusa recursos candidatos preexistentes, salva o mapa anterior,
constrói por ID de conteúdo e publica `nexohub-hub`, um novo NEG e um novo backend.
Usa o repositório Docker `forgelex-prod` somente se ele já existir e for do tipo esperado.
Isso gera cobrança normal de build, armazenamento e eventual execução do candidato; não cria
outro balanceador nem substitui serviços atuais. Falha de permissão ou API interrompe a etapa,
sem habilitar APIs ou conceder permissões automaticamente. Recursos candidatos criados antes de
uma falha podem permanecer; não repetir cegamente nem excluir recursos de produção para retomar.

O script **não importa o URL map**. O health check valida apenas a disponibilidade inicial;
a ativação exige revisar o mapa candidato e testar o fluxo completo depois da nova rota.
A saída final contém diretório de evidências e resultado da validação estática para revisão.

## Ativação observada pelo operador — 23/10/2026

O pacote de fonte `8d157eddd1027469833d576e2ea8e513b076e85b04c6f78504bb3f885debaa4b`
foi construído com sucesso no Cloud Build (ID `7a427eab-522b-4b4c-807e-cbdcbe0edfee`).
O operador publicou `nexohub-hub`, revisão `nexohub-hub-00001-mkk`, no projeto do balanceador.
NEG `nexohub-hub-neg` e backend `nexohub-hub-backend` foram criados e associados.
A validação estática do mapa retornou `loadSucceeded=true` e `testPassed=true`.

O operador aplicou o mapa candidato após conferir igualdade com o snapshot anterior.
O mapa consultado depois da importação contém o matcher `nexohub-root`, com backend padrão
ForgeLex preservado, redirect `/hub` → `/hub/` e rewrite `/hub/*` → `/` para o backend candidato.
A importação concluiu com aviso do gcloud sobre fingerprint; não tratá-la como operação com
proteção atômica de concorrência comprovada. Para futuras alterações, conferir o mecanismo
condicional da API/CLI, além da comparação anterior à importação.

As primeiras consultas retornaram HTTP 404. Sem nova alteração de configuração, consultas
posteriores do Cloud Shell retornaram HTTP 200 em `/hub/` e `/hub/index.html`, com título
`NexoHub`, e em `/hub/api/v1/health`, com JSON `service=nexohub-server`, `status=healthy`.
Os mesmos três endpoints na URL direta do candidato retornaram HTTP 200. Isso é compatível
com propagação da configuração; não há prova isolada da causa do 404 inicial.
O NEG consultado aponta a `cloudRun.service=nexohub-hub`, tipo `SERVERLESS`.

O operador confirmou que o NexoHub funciona no navegador sob `/hub/` e que o site principal
continua funcionando. Os demais endpoints existentes do ForgeLex não foram inventariados
individualmente nesta evidência.

O redirecionamento no matcher antigo foi importado e observado em respostas HTTP 301. O primeiro
prefixo `/hub/` produzia `/hub//` e `/hub//pdf`: em um `defaultUrlRedirect`, o prefixo é acrescentado
ao caminho completo, incluindo a barra inicial. O operador alterou somente o prefixo para `/hub`,
validou (`loadSucceeded=true`, `testPassed=true`) e importou a correção. As exceções `/hub` e
`/hub/*` mantêm o caminho e só trocam o host. Após a correção, a conferência executada pelo
operador confirmou os três redirects 301 com caminhos e query exatos, sem barras duplicadas,
HTTP 200 na raiz, em `/hub/`, `/hub/pdf` e `/hub/api/v1/health`, com título NexoHub nas páginas
do Hub e JSON `status=healthy` na API. O operador também confirmou o catálogo de imagem.
A rede deste executor bloqueou os domínios em uma tentativa de verificação direta (403 do proxy),
o que não estabelece falha do site.

Os helpers locais foram corrigidos para usar `/hub` e conferir os destinos exatos, em vez de
apenas imprimir cabeçalhos. O pacote distribuído anteriormente com prefixo `/hub/` e dependência
de `rg` foi substituído localmente; não executar cópias antigas desse pacote.
O backup `nexohub-legacy-redirect-20261023T213134Z/rollback.yaml` restaura o estado anterior ao
redirecionamento. O backup da etapa `prefix-fix` restaura o redirecionamento com barra dupla.
Nenhuma chamada de teste deve usar documentos ou contas reais. Não desativar o serviço antigo.

## Publicações seguintes pelo GitHub Actions

O workflow `Deploy Cloud Run (Web)` aguarda a CI de um push em `main` e publica a revisão
validada atual, por digest, no serviço existente `nexohub-hub`. O projeto de destino é
`project-bbbe1209-c295-4720-867`, região `southamerica-east1`, repositório Docker `forgelex-prod`.
O build usa `NEXOHUB_BASE_PATH=/hub/`. O workflow não altera URL maps, DNS ou IAM dos serviços.

A autenticação usa `GCP_HUB_SA_KEY` quando disponível, ou `GCP_SA_KEY` como compatibilidade.
A identidade precisa de acesso ao Artifact Registry e de publicação no serviço Cloud Run do
projeto de destino, incluindo uso da identidade de execução existente. O acesso é conferido
antes do build; uma credencial restrita ao projeto antigo não autoriza o novo projeto. Não
copiar chaves para arquivos versionados nem registrar conteúdo de secrets nos logs.

A publicação registra a distribuição anterior do tráfego. `verify-hub-public.py` confere
redirects exatos, raiz, PDF, Imagem e API, repetindo apenas a consulta durante a propagação.
Se a conferência falhar depois do deploy, o workflow restaura a distribuição anterior e
termina com falha; não declara publicação concluída somente porque o comando de deploy passou.
