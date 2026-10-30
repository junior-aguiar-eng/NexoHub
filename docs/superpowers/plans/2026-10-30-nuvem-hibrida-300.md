# Plano de implementação — nuvem opcional para 300 participantes

> **Para execução por agentes:** usar `superpowers:executing-plans` ou, se o usuário escolher delegação, `superpowers:subagent-driven-development`. Executar tarefa por tarefa e manter os checkboxes como registro de execução.

**Objetivo:** preservar uso local gratuito e sem login, adicionando processamento remoto optativo com contas, cotas individuais, reservas transacionais e orçamento de referência US$ 100/mês.

**Arquitetura:** cliente/Tool Registry atuais + novos Platform Ports; monólito Axum reutilizado, autenticação gerenciada e ledger Firestore compartilhado. Fila durável e arquivos privados temporários; operação híbrida em projeto GCP dedicado para não bloquear o site ao desligar a nuvem.

**Tecnologias propostas:** React/TypeScript strict, Rust/Axum, Identity Platform/Firebase Authentication, Firestore Standard, Cloud Storage, Cloud Tasks, Document AI OCR, Translation NMT e LibreOffice isolado.

**Especificação:** [proposta de design](../specs/2026-10-30-nuvem-hibrida-300-design.md).

**Estado:** aprovado pelo usuário em 30/10/2026; implementação local iniciada em `codex/hibrido-300`, base `44b4cd2`. Tarefa 1 implementada e verificada; demais tarefas pendentes. Aprovação do plano não é publicação, provisionamento remoto ou transmissão de documentos.

## Restrições globais

- Até 300 participantes admitidos no piloto, por convite; uso local sem conta e sem franquia mensal artificial.
- Google e e-mail confirmado escolhidos pelo usuário. Proposta: Google e link por e-mail, sem senha do NexoHub.
- Orçamento incremental USD, antes de créditos/impostos: US$ 60 tarefas/inspeções + US$ 15 operação + US$ 25 margem. Saldo individual conjunto US$ 0,20/mês.
- Tetos por ferramenta: OCR 50 páginas/mês, tradução 5.000 caracteres/mês, Office→PDF 10 arquivos/mês, sempre sujeitos ao saldo conjunto e ao pool global.
- Limites exatos de arquivo, tempo, concorrência, mês e retenção são os das seções 4–7 da especificação; não aumentar para fazer um teste passar.
- Toda chamada paga requer identidade verificada, consentimento e reserva transacional. Nenhum fallback automático para a nuvem.
- Não anunciar teto absoluto de fatura Google de US$ 100: gate de aceitação obrigatório para as limitações descritas no design.
- UI via Platform Ports, catálogo pt-BR e executor compartilhado. Não criar um catálogo cloud separado nem usar componentes para chamar Google/Firestore.
- Dados autorais sintéticos nos testes. Fotografias/documentos privados só saem da máquina mediante autorização específica.
- Dependências e versões devem passar pelo ADR-008 antes de instalar. Não adotar SDK pago, GPU ou servidor sempre ativo.
- Design/plano aprovados pelo usuário em 30/10/2026. Cada commit e publicação depende de solicitação explícita; não fazer commits automáticos sugeridos por workflows genéricos.

## Foco da revisão

1. Duas instâncias disputando o último saldo: uma única reserva vence; tarefa 3 cobre o teste.
2. Google/e-mail/Windows no mesmo participante e conta recriada: nenhuma franquia extra; tarefa 2 cobre o teste.
3. Worker interrompido após chamada ao provedor: não repetir nem devolver reserva sem prova; tarefa 5 cobre o teste.
4. Arquivo/opções alterados após confirmação e metadados falsos: recusar sem executar motor pago; tarefas 4 e 7 cobrem os testes.
5. Virada mensal, preço atualizado e rotas legadas: não usar saldo novo com autorização antiga nem contornar autenticação; tarefas 3 e 6 cobrem os testes.

## Mapa dos arquivos propostos

Arquivos novos abaixo são propostas; os caminhos existentes foram examinados nesta base. Ajuste de nome exige atualizar este plano e seus testes, sem reorganizar módulos não relacionados.

| Área | Arquivos | Responsabilidade |
| --- | --- | --- |
| Decisão arquitetural | `docs/adr/ADR-020-nuvem-opcional-cotas.md` (novo), ADR-015/016, PRODUCT, ARCHITECTURE, PRIVACY, ROADMAP | Escopo optativo, identidade, residência, orçamento e retenção |
| Contratos | `packages/contracts/src/cloud.ts` (novo), `src/index.ts` | Pedidos/respostas de conta, orçamento, saldo e jobs; códigos estruturados |
| Ports do cliente | `apps/client/src/platform/cloud-processing.ts`, `cloud-identity.ts` (novos) | Interfaces sem acesso nativo direto pela UI |
| Adapters | `cloud-http.ts`, `cloud-identity-browser.ts`, `cloud-identity-tauri.ts` (novos no mesmo diretório) | Transporte, login e retorno seguro por plataforma |
| UI | `apps/client/src/features/launcher/CloudProcessingChoice.tsx`, `CloudUsageSummary.tsx` (novos); `DedicatedToolView.tsx`, `App.tsx`, `i18n/pt-BR.ts` | Escolha local/nuvem, confirmação e saldos |
| Executor e registro | `apps/client/src/platform/launcher-tool-runner.ts`, `packages/tool-sdk/src/index.ts`, `packages/tool-registry/src/index.ts` | Encaminhamento explícito por modo e disponibilidade real |
| API | `crates/nexohub-server/src/cloud/mod.rs`, `auth.rs`, `policy.rs`, `pricing.rs`, `ledger.rs`, `firestore.rs`, `quotes.rs`, `jobs.rs`, `storage.rs`, `providers.rs` (novos); `src/lib.rs` | Identidade, transações, orçamento, fila e motores |
| Windows | `apps/desktop/src-tauri/src/cloud_identity.rs` (novo), registro de comandos em `src/lib.rs` e `capabilities` pertinentes | Retorno do navegador e armazenamento protegido de sessão |
| Testes | testes próximos TS; `crates/nexohub-server/tests/cloud_*.rs` (novos), `apps/client/e2e/cloud-hybrid.spec.ts` (novo), suíte Windows existente | Contratos, ledger concorrente, interface e execução real |
| Operação | `scripts/cloud/hybrid-policy.json`, `hybrid-pricing.json`, `provision-hybrid.ps1`, `admit-participant.ps1`, `reconcile-hybrid.ps1` (novos), `.github/workflows/deploy-hybrid.yml` (novo) | Configuração versionada, provisionamento separado e operação administrativa |

## Tarefa 1 — fixar contrato e gates de ativação

**Arquivos:** ADR-020, documentos citados no mapa, `packages/contracts/src/cloud.ts`, `crates/nexohub-server/src/cloud/policy.rs`, `scripts/cloud/hybrid-policy.json`; teste `crates/nexohub-server/tests/cloud_policy.rs`.

**Interfaces produzidas:**

- `CloudTool = "ocr" | "translate-text" | "office-to-pdf"`;
- `CloudUsage` com `used`, `reserved`, `remaining` por unidade e `resetAt`;
- `CloudQuote` com `quoteId`, `expiresAt`, `units`, `maximumUsdMicros`, `policyVersion`, `priceVersion`, `processingLocation`, `requiresUpload`, `requiresConfirmation`;
- `CloudJob` com `jobId`, `state`, `usage`, `expiresAt`, sem caminhos internos ou tokens;
- erros `AUTH_REQUIRED`, `EMAIL_UNVERIFIED`, `PARTICIPANT_NOT_ADMITTED`, `QUOTA_EXCEEDED`, `GLOBAL_BUDGET_EXCEEDED`, `PRICE_UNAVAILABLE`, `QUOTE_EXPIRED`, `INPUT_CHANGED`, `JOB_BUSY`, `RECONCILIATION_REQUIRED`.

- [x] Escrever teste vermelho `policy_matches_design`: exigir 300 lugares, valores monetários 60.000.000/15.000.000/25.000.000 e 200.000 micros por participante; verificar todos os limites da especificação.
- [x] Rodar `cargo test -p nexohub-server --test cloud_policy`; confirmar falha pela política ainda ausente.
- [x] Criar contratos e política tipados; validar schema, inteiros e limites mínimos/máximos no carregamento. Exportar contratos pelo índice existente.
- [x] Registrar ADR-020 como proposto; reconciliar referências conflitantes sem marcar implementação concluída. Registrar propostas técnicas e decisões ainda não aprovadas.
- [x] Reexecutar teste e `pnpm typecheck`; ambos devem passar. Revisar o contrato antes de iniciar consumidores.

## Tarefa 2 — identidade mínima e admissão dos participantes

**Arquivos:** ports/adapters de identidade, `cloud/auth.rs`, `cloud/firestore.rs`, módulo nativo Windows, comando administrativo, testes `cloud_auth.rs`, `cloud-identity.test.ts`.

**Interfaces:** `CloudIdentityPort.signIn(method: "google" | "emailLink"): Promise<void>`, `getIdToken(): Promise<string | null>`, `signOut(): Promise<void>`; servidor `authenticate(headers) -> Result<VerifiedPrincipal, CloudError>` e `admit(principal, invitation) -> Participant`.

- [x] Escrever testes para token falso/expirado/emissor errado/audiência errada, e-mail não confirmado, participante suspenso e 301º participante.
- [ ] Testar token antes válido e depois revogado, mantendo participante ativo: nova reserva deve ser recusada. Diferenciar logout deste dispositivo de revogação de todas as sessões; indisponibilidade da conferência de revogação recusa processamento pago.
- [x] Escrever testes de Google e e-mail vinculados ao mesmo participante, conta excluída/recriada e dois dispositivos compartilhando saldo; exigir ausência de nova franquia.
- [x] Rodar `cargo test -p nexohub-server --test cloud_auth` e os testes TS próximos; verificar vermelho antes de implementar.
- [x] Implementar verificador de tokens com biblioteca mantida/auditada e chaves oficiais em cache; verificar suspensão/admissão e revogação no servidor. Usar mecanismo oficial de revogação/`validSince` comparado a `auth_time`, além de marco central para revogação administrativa; assinatura e expiração não bastam. Nenhum token em logs.
- [ ] Integrar SDK oficial de autenticação somente no adapter browser. No Windows, navegador do sistema e código de retorno único/desafio, 60 s, consumido uma vez; verificar replay, interceptação, estado errado e logout. Nenhum token em URL ou armazenamento desprotegido.
- [ ] Implementar admissão por convite e comando administrativo com IAM; todo vínculo de participante é auditado. Regra de identidade da pessoa depende da lista de convites, não de fingerprint/IP.
- [ ] Testes acima verdes e login manual sintético nas duas plataformas; recusar liberação se o fluxo Windows depender de WebView Google ou de senha manipulada pelo backend próprio.

**Estado em 30/10/2026:** verificador, adapter browser em memória e admissão persistente testados; fluxo nativo Windows, comando administrativo IAM, vinculação na interface e login real permanecem pendentes. Logout do adapter é local; revogação central é conferida no servidor. Evidências: [identidade e reservas](../../evidencias/hybrid/AUTH-RESERVAS-2026-10-30.md).

## Tarefa 3 — saldo, preços e reservas atômicas

**Arquivos:** `pricing.rs`, `ledger.rs`, `firestore.rs`, JSON de preços/política; `tests/cloud_ledger.rs`, `tests/cloud_firestore.rs`.

**Interfaces:** `estimate_max_cost(input, prices, policy) -> CostReservation`; `reserve(principal, request, idempotency_key) -> Reservation`; `settle(reservation_id, evidence) -> Settlement`; `usage(participant_id, period) -> CloudUsage`.

**Dados:** `participants/{id}`, `invitations/{id}`, `periods/{period}`, `periods/{period}/participants/{id}`, `jobs/{jobId}`, `reservations/{id}`, `audit/{eventId}`. Saldo mensal global em `periods/{period}`; reservas/vagas em `pilot/holds` e `participants/{id}/state/holds`, independentes do mês. Não usar contadores fragmentados para decisão financeira sem transação consistente.

- [x] Escrever testes vermelhos: 100 reservas simultâneas disputam pool com apenas US$ 0,01; custo por reserva US$ 0,006; exatamente uma vence. O mesmo vale para saldo individual e slots.
- [x] Testar saldo mensal, renovação, bloqueio nos 15 minutos antes da virada, carry-over conservador de job inconclusivo, pedido repetido, ID reutilizado para outro arquivo e preço com mais de 7 dias. Testar US$ 0,20 = 200.000 micros, sem arredondamento permissivo.
- [x] Rodar `cargo test -p nexohub-server --test cloud_ledger` e confirmar as falhas previstas. Integração exige `FIRESTORE_EMULATOR_HOST` e `-- --include-ignored`.
- [x] Implementar transação que reserva unidades/dólares/vagas juntas; `used + reserved + maximum <= limit`. Persistir despacho pendente no mesmo commit, sem chamar serviços externos no callback transacional.
- [x] Implementar Firestore server-side com precondições/transação e IAM; usar ambiente emulado para concorrência. Testar duas instâncias independentes contra o mesmo emulador.
- [x] Preço máximo inclui timeout/recursos, API, bytes de tráfego e retenção permitidos; não usar média de benchmark para autorizar gasto. Custos de pré-inspeção também são reservados.
- [x] Reexecutar testes unitários e de integração. Exigir zero saldos negativos e nenhuma duplicação de débito/reserva.

**Estado em 30/10/2026:** tarefa 3 validada em emulador, sem IAM provisionado ou rota de processamento ativada. CAS usa `batchGet` + commit atômico com precondição em todos os documentos lidos. Reservas inconclusivas atravessam a competência; liquidação entre meses e autorização de worker aguardam evidência de faturamento/reconciliador da tarefa 5. O custo da entrada interna do ledger será calculado por orçamento/inspeção, nunca aceito do cliente.

## Tarefa 4 — orçamento, consentimento e upload limitado

**Arquivos:** `quotes.rs`, `storage.rs`, rotas em `cloud/mod.rs`, contratos e `tests/cloud_quotes.rs`/`cloud_storage.rs`.

**Interfaces:**

- `GET /api/v1/cloud/me` e `/usage`;
- `POST /api/v1/cloud/quotes` para orçamento preliminar de metadados, sem documento;
- `POST /api/v1/cloud/quotes/{id}/authorize-upload` somente após confirmação;
- `PUT /api/v1/cloud/quotes/{id}/input` para upload binário autenticado, limitado durante leitura e gravação;
- `POST /api/v1/cloud/quotes/{id}/inspect` para orçamento definitivo vinculado ao objeto;
- `POST /api/v1/cloud/jobs` para confirmar orçamento definitivo e reservar execução.

- [ ] Escrever testes: contagem falsa, MIME divergente, PDF comprimido abusivo, ZIP bomb, mais de 20 MiB/15 páginas no OCR, Unicode multibyte e troca de geração de objeto após orçamento.
- [ ] Rodar `cargo test -p nexohub-server --test cloud_quotes` e `--test cloud_storage`; conferir falhas.
- [ ] Implementar orçamento com versão, validade e máximo; upload binário pela API com limites de tamanho durante leitura, duração, objeto e reserva de armazenamento. Downloads também passam pela API; não fornecer URLs de Storage reutilizáveis que dispensem os contadores. Não aceitar URL arbitrária do cliente ou permitir SSRF.
- [ ] Inspecionar conteúdo em processo limitado antes de chamar API paga; se as unidades mudarem, exigir nova confirmação explícita. Exceder limites recusa, nunca divide ou trunca silenciosamente.
- [ ] Implementar GET de resultado autenticado e contabilizado, até 3 downloads e 90 MiB totais; reservar bytes/número atomicamente antes de cada resposta e testar Range, conexões simultâneas e transferências interrompidas. Cópia para resultado local pelo port de salvamento existente.
- [ ] Confirmar que negação por cota não transmite conteúdo nem chama provedor e que upload abandonado libera objetos e reservas não consumidas de forma segura.

## Tarefa 5 — fila, execução e reconciliação sem cobrança duplicada

**Arquivos:** `jobs.rs`, `providers.rs`, `storage.rs`, `reconcile-hybrid.ps1`; testes `cloud_jobs.rs`, `cloud_providers.rs`.

**Interfaces:** `dispatch_pending()`, `claim(job_id, worker_id) -> ExecutionLease`, `execute(lease) -> ProviderOutcome`, `reconcile(job_id) -> Reconciliation`; rotas privadas de execução e limpeza exigem identidade de serviço, não token de participante.

- [ ] Escrever testes vermelhos: mesma mensagem entregue duas vezes, reinício após envio ao provedor antes de salvar resposta, lease vencido, cancelamento concorrente e status atrasado depois de `settled`.
- [ ] Rodar `cargo test -p nexohub-server --test cloud_jobs`.
- [ ] Implementar máquina de estados da especificação, claim transacional com fencing, outbox de despacho, limite distribuído 2 global/1 por participante e espera até 5 minutos.
- [ ] Se chamada externa estiver possivelmente em andamento, registrar `needs_reconciliation`, manter reserva e vaga e não repetir. Após 10 minutos sem prova, colocar o motor em quarentena; só liberar vaga com evidência de término. Testar que timeout e lease vencido não liberam chamadas sobrepostas. Configurar retries de transporte/fila sem converter entrega repetida em nova operação paga.
- [ ] Implementar cancelamento: antes de chamada externa pode liberar reserva; depois, encerrar acompanhamento/solicitar cancelamento quando suportado, mantendo o custo até confirmar faturamento. Matar subprocessos de conversão ao timeout e aguardar término.
- [ ] Primeiro usar provedores falsos e provas de consumo; só depois habilitar adapters reais OCR/NMT e conversor homologado. Não incluir add-ons de OCR nem tradução de documento com layout por engano.
- [ ] Normalizar OCR para texto/caixas/páginas do contrato existente e reutilizar montagem local de PDF pesquisável; testar saída pesquisável contra texto reconhecido e original imutável. Tradução produz `text/plain`, Office produz novo PDF; salvar pelo fluxo atual, sem entregar JSON de provedor como documento final.
- [ ] Testar upload/job/output órfãos, falha de limpeza e retenção de resultados de 1 hora; limpeza ativa a cada 15 min com lifecycle de 1 dia como proteção adicional. Auditoria sem conteúdo por 90 dias. Documentar separadamente retenção do provedor; manter Document AI online e Translation texto, sem batch/glossários neste piloto.
- [ ] Reexecutar testes com duplicação/restart induzidos; nenhuma chamada paga adicional sem nova reserva.

## Tarefa 6 — fechar caminhos de contorno e controles globais

**Arquivos:** `src/lib.rs`, `cloud/mod.rs`, testes `server_test.rs` e `cloud_routes.rs`; scripts/workflow de operação híbrida.

**Interfaces:** middleware comum `require_cloud_admission`, `BudgetCircuitState`; interruptor operacional `cloudEnabled=false` sem impacto nos motores locais.

- [ ] Escrever testes vermelhos que chamam diretamente `/tools/ocr` e `/invoke/execute_ocr`/tradução sem identidade ou reserva; exigir recusa antes de consumir API/subprocesso. Enumerar todos os comandos de custo, sem permitir bypass por sinônimo ou endpoint legado.
- [ ] Testar orçamento desatualizado, storage/Firestore indisponível, pool esgotado e bloqueio operacional; toda execução paga é recusada e `/health`/site continuam disponíveis no deploy público existente.
- [ ] Implementar política de rotas e CORS com origens explícitas, rate limit, limites de requisição, OIDC do worker e IAM mínimo. Autenticação não basta: conferir propriedade do job/reserva.
- [ ] Preparar scripts de provisionamento em modo simulação por padrão: projeto dedicado, identidade, Firestore, bucket privado e fila. Deploy híbrido somente manual e separado do workflow web atual. Não executar provisionamento nesta tarefa sem autorização.
- [ ] Configurar zero instâncias mínimas, máximo 2 workers, limites de fila e preços/versionamento; alertas 50/70/85/95 e spend cap Cloud Run US$ 20 se disponível na conta. Testar via configuração e simulação de eventos, não gastando até o teto.
- [ ] Implementar bloqueio por pool US$ 60 ou operação US$ 15; fluxo de reconciliação admite apenas correções auditadas. Não desligar billing da conta inteira nem outros produtos.
- [ ] Rodar `cargo test -p nexohub-server --test cloud_routes` e suíte existente; requer zero bypass e nenhuma mudança de comportamento local.

## Tarefa 7 — escolha de modo e saldo na interface

**Arquivos:** novos ports/adapters cloud, `CloudProcessingChoice.tsx`, `CloudUsageSummary.tsx`, telas/executor/registro e i18n; testes próximos e `e2e/cloud-hybrid.spec.ts`.

**Interfaces:** `CloudProcessingPort.getUsage()`, `quote(input)`, `authorizeUpload(quoteId)`, `inspect(quoteId)`, `submit(quoteId, idempotencyKey)`, `getJob(jobId)`, `cancel(jobId)`; tipos compartilhados da tarefa 1. Opção `processingMode: "local" | "cloud"` no request do executor, padrão `local`.

- [ ] Escrever testes de local sem login/rede, nuvem sem conta, saldo parcial, reserva em outro dispositivo, orçamento vencido e troca de arquivo depois de consentir.
- [ ] Rodar os testes próximos pelo Vitest e confirmar vermelho antes dos componentes novos.
- [ ] Implementar escolha explícita, identificação de provedor/localização, unidade estimada/máxima, saldo disponível/reservado/usado e renovação. O botão de envio diz `Enviar e processar na nuvem` via i18n.
- [ ] Adaptar SDK/registry/runner sem duplicar ferramentas; somente oferecer Office cloud quando motor habilitado. Nunca anunciar Office local funcional como consequência do adapter cloud.
- [ ] Tratar confirmação de aumento após inspeção e erros estruturados sem apagar entrada/saída local. Quota global e individual produzem mensagens distintas.
- [ ] Testar teclado, 390/768/1440 px e modo offline; nenhum arquivo sai ao abrir tela, ao falhar motor local ou ao clicar apenas em login.
- [ ] Rodar Vitest, `pnpm check`, `pnpm build:web` e E2E focado na raiz e `/hub/`. Registrar contagens e limitações efetivas.

## Tarefa 8 — provar qualidade e calibrar o orçamento

**Arquivos:** `docs/evidencias/hybrid/` e controladores em `scripts/cloud/`, testes dos adapters reais; nenhum arquivo privado versionado.

**Consome:** identidade, ledger, jobs e UI já testados. **Produz:** manifesto por motor com versão, corpus, métricas, preços, tempos e estado de homologação.

- [ ] Reproduzir OCR/Office/tradução em corpus autoral/licenciado com referência. Medir tempo frio/quente, CPU/RAM, API, bytes e fidelidade dos arquivos exportados.
- [ ] Primeiro executar tudo em emuladores/provedores falsos. Teste real posterior exige autorização de nuvem com suborçamento US$ 5 retirado do pool mensal, sem teto independente que permita gastar US$ 105.
- [ ] OCR: medir CER/WER e marcadores no corpus, confrontar com local; não presumir aprovação da fotografia privada. Tradução: preservar nomes, números e negação, revisão humana de saídas novas.
- [ ] Office: comparar páginas/texto/tabelas/fontes do PDF com referência e revisar isolamento de macros/links/credenciais. Se falhar, manter motor indisponível; pedir decisão antes de trocar runtime.
- [ ] Simular 300 participantes em duas instâncias/emulador: saldo perto de zero, filas cheias, virada mensal e repetição de jobs. Testar limites sem gerar 300 usuários pagos ou gasto real de US$ 100.
- [ ] Atualizar preços conservadores e, se necessário, diminuir cotas ou desabilitar motor. Não elevar pool ou margem sem decisão do usuário.

## Tarefa 9 — piloto e entrega verificável

**Arquivos:** workflows/scripts de liberação, README, PRODUCT/PRIVACY/ROADMAP, evidência `docs/evidencias/hybrid/pilot-validation.json`.

- [ ] Exigir aprovação do ADR/design, região de processamento, retenção e interpretação do teto financeiro antes da ativação.
- [ ] Executar formatter/lint/typecheck, testes JS/Rust/Python pertinentes, builds web raiz e `/hub/`, E2E e testes de invariantes financeiros. Distinguir mocks/emuladores de prova real.
- [ ] Validar no Windows instalado login, modo local offline, confirmação do envio, cancelamento, saldo entre dispositivos e exportação. Instalador/release Windows apenas com autorização específica.
- [ ] Liberar com autorização em etapas 10 → 50 → 300, sem renovar saldo a cada etapa. Conferir custo contabilizado versus billing, latência, falhas e qualidade a cada expansão.
- [ ] Demonstrar bloqueio quando saldo se esgota, mecanismo de desligamento e manutenção do site/local. Registrar teste de rollback e limpeza de resultados.
- [ ] Documentar o estado entregue sem chamar a nuvem de implementada antes da prova. Nenhum commit/push/deploy automático; solicitar essas ações apenas quando houver resultado concreto revisável.

## Decisões propostas e critério de conclusão deste plano

O usuário aprovou o plano e autorizou iniciar a implementação local em 30/10/2026, incluindo as propostas de identidade, piloto fechado, saldo conjunto, distribuição e processamento indicados no desenho. Provisionamento, testes pagos, transmissão de documentos, deploy e release continuam sujeitos às autorizações específicas registradas no plano. Se o requisito for fatura contratualmente incapaz de ultrapassar US$ 100, a ativação fica bloqueada pela limitação do provedor explicitada na especificação.

A conclusão da implementação exigirá evidências de todas as tarefas acima, sem confundir provisionamento, testes locais, testes pagos, deploy e versão Windows instalada.
