# Identidade e reservas persistentes — 30/10/2026

Branch `codex/hibrido-300`, worktree isolado. Base de contratos/política no commit `dc3f81f`. Autorização atual: commit e continuidade da implementação; sem push, deploy ou ativação da nuvem.

## Implementação

- Adapter oficial Firebase browser, inicialização sob demanda, sessão somente em memória, Google e link de e-mail confirmado. Não importa nem inicializa o SDK no fluxo local. Nenhum token é gravado em URL, logs ou localStorage.
- Verificador servidor RS256 com audiência/emissor do projeto, expiração, datas, provedor, e-mail confirmado, chaves públicas em cache e consulta de conta/revogação por `validSince`/`auth_time`. Falha de conferência recusa acesso. Identidade validada não pode ser reutilizada após expiração.
- Convite e vínculo persistentes por UID; limite de 300 admitidos, suspensão e marco central de revogação. Renovação de convite não consumido preserva o participante. Admissão concorrente não pode substituir vínculo para obter nova franquia. Auditoria sem conteúdo documental.
- Ledger servidor com inteiros em micro-USD, saldo individual conjunto de 200.000 micros e pool de tarefas de 60.000.000 micros. Reserva dinheiro, unidades e vagas numa gravação atômica; persiste intenção de despacho. Chave repetida não duplica reserva; mesma chave com arquivo/unidades/custo diferentes é recusada.
- Firestore REST: leitura de versões e commit com precondições em todos os documentos. Retenta apenas conflito comprovado, nunca resultado de gravação desconhecido. Não há chamada de provedor dentro do callback. Transporte real usa identidade de serviço; testes usam somente emulador local.
- Reservas pendentes ficam fora da competência mensal e conservam dinheiro, unidades e vagas entre meses. Guard de 15 minutos usa America/Los_Angeles/IANA. Estado incerto não devolve saldo nem libera vaga. Cancelamento seguro antes do início e liquidação idempotente com custo confirmado.
- Tabela de preços versionada, recusa dados vencidos/inválidos. Estimativa inclui API, recursos máximos, inicialização, pré-inspeção, upload, download e retenção; não representa consumo médio ou garantia de franquias simultâneas.

## Evidências e reprodução

Emulador Firestore do Google executado localmente em Docker com Java 21; porta somente `127.0.0.1:8189`, projetos `demo-*`, sem autenticação em conta Google. Windows/Java direto falhou no transporte de sockets; a alternativa Docker não altera o aplicativo instalado. Nenhum recurso GCP foi criado.

Com `FIRESTORE_EMULATOR_HOST=127.0.0.1:8189`:

`cargo test -p nexohub-server --locked -- --include-ignored`

37 testes aprovados: 19 da base, 3 de identidade, 2 de armazenamento e 13 de ledger/admissão/preços. Sem testes ignorados nessa execução. Tokens assinados são sintéticos; chave privada efêmera não é salva. O teste de assinatura não substitui login real.

Cobertura inclui 100 clientes independentes disputando US$ 0,01, cada reserva de US$ 0,006: exatamente um vence tanto no pool global quanto no saldo individual; 100 disputam uma vaga de fila: exatamente um vence. Também testa persistência após recriar o serviço, idempotência, suspensão/revogação, UID recriado, 301º participante, limite exato de 200.000 micros, unidades mensais, cancelamento, guarda mensal e carry-over.

RED confirmado antes da implementação de auth/ledger/store/browser. Casos adicionais reproduziram identidade vencida reutilizável, preço inválido aceito, vínculo duplicado (dois participantes para um UID) e convite impossível de renovar. Os testes passaram após corrigir suas causas. A implementação inicial com transação pessimista apresentou timeout sob concorrência; substituída por precondições CAS da API pública, sem reduzir concorrência nem tolerar respostas inesperadas.

Revisão independente somente leitura encontrou as falhas de vínculo e renovação, ambas reproduzidas e corrigidas. Autorização própria de worker foi registrada para a tarefa 5.

A CI recebeu um job específico de emulador, sem credenciais e sem provisionamento. O workflow foi preparado, mas não executado no GitHub nesta etapa, pois não houve push.

## Dependências e verificações

Firebase 13.1.0 (Apache-2.0), jsonwebtoken 11.1.0 (MIT, backend AWS-LC), reqwest 0.13.4 e chrono/chrono-tz (MIT/Apache-2.0). Inventário de transitivas gerado no arquivo de licenças. O pacote completo Firebase informa cerca de 37,7 MB descompactado; apenas módulos de app/auth são importados pelo adapter, atualmente fora do bundle ativo.

A primeira auditoria JS apontou duas vulnerabilidades transitivas em grpc-js trazido pelo SDK. Fixada versão 1.14.7; `pnpm audit --prod` passou sem vulnerabilidades conhecidas. Não foram adicionadas exceções de segurança.

`cargo-deny 0.20.2 check advisories licenses sources` passou. A execução de todos os checks também apontou duas dependências locais por path sem versão já presentes na base (server/desktop → core), tratadas como wildcard pelo check de bans; nenhuma alteração dessas dependências por path foi feita para mascarar o diagnóstico. Política de advisories preexistente preservada.

Verificação final desta etapa: 847 testes cliente em 117 arquivos aprovados (713,34 s, dois workers), incluindo os 5 testes novos do adapter. `pnpm check` aprovado, com dois avisos preexistentes de placeholders na fixture; `cargo fmt --all --check` e Clippy do servidor com `-D warnings` aprovados; build web aprovado com aviso de chunks já existente. Instalação com lockfile congelado e inventário de 919 componentes verificados. Emulador local encerrado após os testes.

A revisão das correções não encontrou novos achados nessas duas mudanças. E2E cloud e login no aplicativo instalado não foram executados: a integração ainda está desligada e o fluxo Windows é gate pendente. A suíte cliente e os testes servidor não equivalem a homologação real de provedor ou do instalador.

## Gates mantidos fechados

Não há rota cloud nem integração do adapter à UI; os motores locais continuam gratuitos e sem login. `cloudEnabled=true` segue recusado. Nenhuma consulta de conta Google real, documento enviado, API paga, migração, push, deploy, release ou alteração do aplicativo instalado.

Tarefa 2 permanece parcial: retorno único/desafio pelo navegador do sistema e armazenamento protegido no Windows, comando administrativo IAM, testes de replay/retorno e login manual nas duas plataformas. A persistência foi demonstrada no emulador; IAM, região, retenção e operação reais ainda não foram homologados.

Tarefas 4–9: orçamento vinculado ao conteúdo inspecionado, consentimento/upload limitado, fila/leases/fencing/reconciliação, proteções de rotas e operação US$ 15, UI/saldo, benchmark e rollout. A liquidação entre meses continua bloqueada sem prova da competência de faturamento. Workers precisarão de autorização própria, independente de token ou vínculo ativo do participante, para concluir/reconciliar execuções; por ora a reserva permanece retida nesses casos.

A tabela de preços expira após sete dias e deve ser revista antes de ativação. O pool do aplicativo não é garantia contratual de teto absoluto da fatura GCP.
