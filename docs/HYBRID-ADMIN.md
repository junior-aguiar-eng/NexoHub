# Administração do piloto híbrido — preparada, sem ativação

O comando pertence ao servidor e não é exposto pela interface ou por endpoint público. Requer Google Cloud SDK no ambiente de operação e operador autorizado a impersonar a conta de serviço do projeto dedicado ao piloto. A conta precisa das permissões de dados Firestore adequadas nesse projeto; a definição/aplicação da política IAM real continua no gate de provisionamento. Não usar credencial de participante para administração.

## Simulação

A ausência de `--apply` impede consulta de credenciais, execução do gcloud e gravação remota:

```powershell
cargo run -p nexohub-server --bin cloud-admin -- --project demo-nh --service-account operator@demo-nh.iam.gserviceaccount.com invite person@example.invalid
```

Saída: `{"dryRun":true,"operation":"invite","project":"demo-nh"}`. O e-mail e tokens não aparecem na saída/auditoria operacional. O identificador do convite é derivado do e-mail normalizado; o corpo registra participante e prazo, sem senha.

## Aplicação futura

Somente com autorização específica de operação remota e IAM homologado, acrescentar `--apply` como primeiro argumento. O comando usa `gcloud auth print-access-token --impersonate-service-account` internamente, sem pedir token por argumento nem criar arquivo de chave. No Windows chama `gcloud.cmd`, com argumentos restritos e janela oculta. Falha de autenticação/permissão impede operação; não há fallback para outra conta ou projeto.

Operações aceitas:

- `invite EMAIL`: cria convite ou renova convite não consumido, preservando o participante; prazo de sete dias.
- `suspend PARTICIPANT_ID`: impede novas admissões/reservas; preserva saldos e obrigações.
- `resume PARTICIPANT_ID`: reativa vínculo; não remove marco de revogação nem renova saldo.
- `revoke PARTICIPANT_ID`: exige nova autenticação posterior ao marco central, em todos os dispositivos; não altera tarefas já consumidas ou reservas inconclusivas.

IDs de participante têm 32 caracteres hexadecimais, obtidos do cadastro administrativo ou da API autenticada `/me`; não são UID, e-mail ou nome de arquivo. O comando valida correspondência entre conta de serviço e projeto e recusa argumentos inesperados.

O logout da interface afeta somente a sessão desse dispositivo. Revogação central exige o comando administrativo; não representa exclusão da conta Firebase. Não foram executadas aplicações IAM ou essas operações em projeto real nesta entrega.
