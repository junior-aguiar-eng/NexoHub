# Login Windows, administração IAM e integração — 30/10/2026

Base `b967d9a`, branch `codex/hibrido-300`, worktree isolado. Autorização: implementar e criar commit. Nenhum push, deploy, ativação, provisionamento ou aplicação IAM foi autorizado nesta continuação.

## Entrega de código

- Windows: comandos Tauri de login, token, logout e consultas de conta. Navegador do sistema por URL HTTPS fixa, sem Google no WebView. Listener efêmero em `127.0.0.1`, porta aleatória, estado e verificador por instância. Prazo de 60 segundos e validação estrita de Host, método, caminho, parâmetros e estado.
- Navegador: SDK oficial com sessão em memória. Retorno por e-mail preserva apenas o vínculo público da instância; a entrada web também conclui sem exigir vínculo Windows. Tokens não transitam em URL.
- Passagem ao Windows: RSA-OAEP/SHA-256 para a chave AES-256-GCM; estado/desafio autenticados como dados associados. Firestore armazena somente o envelope cifrado, nunca ID token ou refresh token. Código aleatório tem validade de 60 segundos, vinculação PKCE e consumo único atômico. Até cinco emissões por participante/minuto.
- Sessão Windows: arquivo interno `cloud-session.dpapi` protegido pelo DPAPI do usuário atual, separado dos projetos/documentos. Refresh token permanece no nativo; renovação usa endpoint oficial fixo e transporte HTTPS sem redirecionamento. A validade decodificada localmente serve somente para agendar renovação; a API continua verificando assinatura/revogação a cada requisição. Logout remove apenas essa sessão e invalida salvamento de login concorrente; não revoga outros dispositivos.
- Conta e saldo no Windows passam pelo IPC e HTTP nativo. CSP original foi preservada; o WebView não ganhou permissão de rede externa.
- CLI `cloud-admin`: simulação por padrão; convite, suspensão, reativação e revogação central. Aplicação exige `--apply` e impersonação de conta IAM pertencente ao projeto indicado. Acesso ao Firestore depende das permissões reais da conta, nunca de alegação de administrador no JWT. Alterações/auditoria são atômicas; ator administrativo é pseudonimizado. Nenhuma operação redefine saldos ou cria nova franquia.
- Rotas internas `/api/v1/cloud/status`, `/me`, `/usage`, `/auth/desktop/code` e `/auth/desktop/exchange`: token verificado/admissão, origens explícitas, respostas privadas sem cache e corpos limitados. Rotas de participante não aceitam saldo, UID ou custo do cliente. `create_app` injeta serviços ausentes e devolve indisponibilidade, sem construir credenciais/clientes reais. Health e operações existentes preservados. Endereços públicos usam `/hub/api/v1/cloud`, conforme rewrite de publicação existente; não apontam para a aplicação principal na raiz do domínio.
- Interface integrada: botão de conta opcional no cabeçalho, aviso do uso local gratuito/sem conta, controles de entrada, saldo compartilhado e logout; página de retorno em raiz e `/hub/`. Textos em catálogo pt-BR. SDK/IPC/rede não são inicializados no bootstrap desativado.

## Gates de ativação

`IDENTITY_ENABLED=false` no nativo, `cloudBootstrapConfig.identityEnabled=false` no cliente, `router(None)` no servidor e `cloudEnabled=false` na política. Não há configuração real Firebase, serviços IAM nem provedor de documentos ativados. A chave pública Firebase para renovação nativa permanece vazia nesta etapa. Esses gates não podem ser abertos por parâmetro de componente ou chamada IPC.

Nenhuma conta real foi criada, nenhum login Google real foi feito e nenhum e-mail de autenticação foi enviado. A persistência do Firestore foi provada no emulador local, não em produção. O aplicativo instalado não foi substituído e não foi gerado instalador/release.

## Verificações executadas

- Servidor: 44 testes aprovados com `--include-ignored` e emulador pronto; inclui saldo/cotas existentes, endpoints, admissão e administração, consumo único e 100 instâncias concorrentes disputando o mesmo código (uma entrega). Nenhuma chamada real de identidade/IAM.
- Nativo: 6 testes de integração aprovados — WebCrypto real do Node interoperando com AWS-LC, rejeição em outra instância, DPAPI real com adulteração, reabertura de arquivo protegido/logout, callback inválido e socket loopback real. Teste unitário separado confirma timeout antes de aceitar retorno.
- Cliente: 859 testes aprovados em 121 arquivos, 520,36 s; testes focados de conta, e-mail, envelope e UI também aprovados. Sem alteração dos testes anteriores para ocultar falhas.
- E2E Playwright: oito casos aprovados, quatro na raiz e quatro em `/hub/`, telas de 390/1440 px, teclado/Escape, offline e retorno bloqueado. Nenhuma requisição de identidade/Firestore/API cloud ao abrir o produto ou painel desativado; nenhum documento transmitido.
- Simulação real da CLI retornou `dryRun:true`; não leu token nem chamou Firestore. Probe local de `--version` demonstrou que o launcher Windows exige `gcloud.cmd`, corrigido sem chamar autenticação ou impersonação.
- Formatter/lint/typecheck aprovados, com dois avisos preexistentes de placeholders. Builds web na raiz e `/hub/` aprovados, preservando aviso de chunks. Clippy de todo o workspace com `-D warnings` aprovado. Build Windows de desenvolvimento aprovado; o aviso do linker é informativo. Não é prova de instalador ou de login real.
- Auditorias JS de produção e Rust advisories/licenças/fontes aprovadas; inventário com 919 componentes. Dependências diretas acrescentadas ao core/desktop já estavam no grafo travado; nenhuma nova versão ou licença forte foi introduzida. CSP e arquivos de ambiente preservados.

## Falhas encontradas e correções

RED confirmou os módulos ausentes. Revisão independente encontrou perda do vínculo no e-mail e transporte do WebView incompatível com CSP. Os testes reproduziram a falha de e-mail; foram corrigidos o continue URL, conclusão web e transporte nativo. Conferência posterior do revisor não encontrou novos achados nesses fixes.

A conferência do rewrite existente revelou prefixo público ausente nas novas chamadas; teste vermelho confirmou a divergência e os adapters web/nativo passaram a usar `/hub/api/v1/cloud`. Nenhuma alteração de URL map foi aplicada.

O E2E detectou Escape sem fechar o painel; listener escopado e limpeza dos eventos corrigiram o comportamento. Falha inicial do emulador antes de prontidão não foi contada como defeito do ledger: repetição somente após HTTP 200. O build isolado do core exigiu habilitar `prebuilt-nasm` já usado pelo backend TLS, sem instalar ferramentas no sistema. Ajustes de formatter, tipos e dependências diretas foram realizados antes da validação final.

## Continuidade do plano

Implementação desta continuação preparada e integrada, mantendo ativação proibida. Homologação manual Google/e-mail real no Windows e web, configuração pública/contas IAM e políticas reais continuam gates. A autorização atual não permite realizá-las remotamente.

Orçamento vinculado ao conteúdo, consentimento/upload limitado, workers/fencing/reconciliação, proteção integral das rotas pagas/circuitos globais, interface de escolha por operação e homologação de motores continuam nas tarefas seguintes. Não há nova transformação de documento nem fallback cloud neste commit. Códigos expirados são recusados logicamente; limpeza física/TTL dos envelopes órfãos continua na tarefa de retenção e bloqueia ativação até ser implementada. O limite de emissão não substitui o controle global de operação da tarefa 6.
