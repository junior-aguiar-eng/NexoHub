# Identidade real — configuração e homologação

## Escopo autorizado

Projeto dedicado `nexohub-piloto-300`, Firebase Authentication, Firestore privado em
`southamerica-east1`, Google e link por e-mail, mesma identidade no Windows e na web.
Login permanece opcional para uso local. Em 30/10/2026 o usuário autorizou vincular a
conta de faturamento existente para identidade e infraestrutura, após a recusa do Google
ao configurar TTL sem faturamento. Motores documentais remotos continuam desativados.

## Configuração aplicada

- Google e link de e-mail habilitados, uma conta por endereço de e-mail.
- Aplicativo web Firebase registrado; configuração pública compartilhada por web e core
  nativo em `scripts/cloud/firebase-public.json`. Não contém credencial administrativa.
- Domínios de produção e da revisão de homologação autorizados.
- Conta runtime `nexohub-identity` com papel específico no projeto dedicado:
  leitura de usuários Firebase e leitura/escrita das entidades Firestore. Sem permissões
  de IAM ou de motores documentais. Nenhuma chave privada foi criada para essa conta.
- Conta administrativa separada `nexohub-admin`, invocada com impersonação IAM pelo
  operador autorizado. A CLI continua em simulação por padrão; somente `--apply` grava.
- Códigos Windows recebem campo de expiração Firestore para TTL, além da validade lógica
  e consumo único. Ao consumir, o envelope cifrado é apagado do payload imediatamente.

## Código integrado

Cliente carrega SDK somente ao usar a conta. A sessão web é restrita à aba e pode ser
recuperada ao reabrir o painel. O servidor constrói os serviços reais somente com
`NEXOHUB_IDENTITY_ENABLED=true` e `NEXOHUB_FIREBASE_PROJECT=nexohub-piloto-300`.
Configuração inválida aborta inicialização; identidade desativada preserva as rotas locais.
O perfil Windows de homologação é fixado em compilação por `NEXOHUB_IDENTITY_PREVIEW=true`;
o padrão é a origem pública. IPC não permite alterar a origem.

O mesmo serviço serve `/hub/` diretamente na revisão de homologação e mantém o caminho
sem prefixo usado pelo balanceador público. O workflow público preserva as permissões
restritas e configuração de identidade em publicações futuras.

## Histórico inicial da investigação

Compilação/verificação de tipos do servidor e do cliente realizadas. O aplicativo Windows
de homologação foi compilado e aberto com o painel de conta corrigido. A revisão de
homologação foi publicada sem tráfego de produção. O envio real do link por e-mail foi
aceito pelo provedor; o consumo desse link ainda não foi confirmado. A tentativa Google
retornou `auth/popup-closed-by-user`, sem comprovação de sessão: esse código informa o
encerramento da janela, mas não identifica quem ou o que a encerrou. O controle do
navegador também apresentou timeouts durante a seleção da conta.

O diagnóstico registra somente códigos padronizados `auth/...`, sem mensagens ou objetos
do SDK que possam conter dados pessoais ou credenciais. A entrada real, igualdade de participante
entre plataformas, consumo do link, reabertura/logout e publicação ainda não estão
certificados por este registro. Não confundir a ativação dos provedores com login homologado.
As evidências locais são mantidas em `target/qa/hybrid-300/`, sem tokens versionados.

## Evidências atuais — conta e domínio

O nome público dos projetos Google Cloud/Firebase e os remetentes dos quatro modelos
foram alterados para NexoHub, com idioma padrão pt-BR. O ID interno do projeto não foi
recriado. O remetente verificado `noreply@acesso.nexojuris.ia.br` está ativo; o usuário
confirmou o recebimento do link e o Firebase vinculou o método de e-mail à mesma conta
Google. Os registros SPF/DKIM do subdomínio foram adicionados sem alterar o e-mail do
domínio principal. `conta.nexojuris.ia.br` responde por HTTPS com o handler oficial.

A falha posterior à autenticação foi reproduzida: o Google retornava sucesso, mas
`/cloud/me` respondia 503. Uma verificação na revisão sem tráfego de produção isolou
`identity_account_lookup` com HTTP 403 e `SERVICE_DISABLED`; metadados, leitura do
Firestore e chaves públicas retornavam 200. Habilitar `identitytoolkit.googleapis.com`
no projeto que hospeda o servidor resolveu essa falha. As duas sessões web (Google e
link de e-mail) passaram a exibir Minha conta e o mesmo endereço confirmado.

A hipótese de falta de `datastore.databases.get` foi descartada: a implementação usa
operações condicionais, não BeginTransaction. A permissão adicionada durante a investigação
foi removida, preservando o papel restrito original. A revisão diagnóstica temporária foi substituída pela revisão `nexohub-hub-00020-yuy`, sem o comando de diagnóstico.

Verificações locais posteriores: 20 testes direcionados do cliente aprovados;
formatter, lint e tipos aprovados (dois avisos preexistentes em fixtures); 11 testes
de autenticação, rotas desativadas e política do servidor aprovados. Quatro testes
que exigem emulador Firestore não foram executados nessa rodada.

O aplicativo Windows de homologação concluiu o login Google, exibiu a mesma conta e
restaurou a sessão depois de fechar e reabrir o processo. A saída da conta também foi
conferida. A nova tentativa Google pelo Edge foi concluída pelo usuário e confirmada
visualmente no aplicativo; a sessão persistiu também após recompilar e reabrir.

O fluxo de e-mail nativo foi validado com a mensagem real das 21:58 UTC: entrega na
caixa de entrada, clique no link, confirmação do endereço no Edge e retorno à mesma
conta no Windows. Consulta administrativa confirmou um único cadastro verificado com
os métodos Google e e-mail vinculados. A interface nativa não pede mais o endereço
antes de abrir o navegador, eliminando a solicitação duplicada anterior ao envio.
Isso não representa atualização do instalador público.

A compilação Windows de verificação usou `NEXOHUB_IDENTITY_PREVIEW=true` e
`cargo build -p nexohub-desktop --features tauri/custom-protocol`, após o build web
com base `/`. A compilação direta sem esse recurso aponta ao servidor de desenvolvimento
e não serve para esta homologação. Screenshots locais: `conta-windows-edge-reaberta.png`
e `conta-windows-email.png`, sob `target/qa/hybrid-300/`.

O domínio de autenticação foi associado ao aplicativo web Firebase e recebeu uma
versão vazia de configuração para inicializar os recursos reservados oficiais; nenhum
documento foi publicado no Hosting. Os endpoints `/__/auth/handler`, `/__/auth/action`
e `/__/firebase/init.json` respondem. A configuração compartilhada passou a usar
`conta.nexojuris.ia.br`, e uma nova entrada Google na web foi concluída com esse domínio.

Permanece uma recusa do provedor ao alterar o endereço dos links de e-mail:
`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`, tanto no console quanto na API administrativa.
O remetente já é NexoHub, mas o link ainda usa o endereço padrão do projeto. O certificado
do domínio ainda é reportado como `CERT_PROPAGATING`, apesar de o HTTPS funcionar; não
foi demonstrado que essa propagação seja a causa da recusa. Commit, push e promoção
para produção aguardam a resolução das pendências de homologação.

Não houve ativação de OCR, tradução ou Office remotos. As demais tarefas do plano híbrido
continuam pendentes e não são declaradas concluídas por esta integração de identidade.

## Restrição da chave de API web (31/10/2026)

A chave em `scripts/cloud/firebase-public.json` é pública por desenho e é usada em dois lugares:
pelo SDK no navegador e pelo core nativo, que renova a sessão em
`securetoken.googleapis.com/v1/token`. Como o cliente nativo não tem página de origem, uma chave
restrita por referrer recusaria a renovação no Windows. O core passou a enviar o cabeçalho
`Referer` com a origem pública do serviço (`https://nexojuris.ia.br/`, ou a origem de
homologação quando compilado com `NEXOHUB_IDENTITY_PREVIEW=true`), coberto por teste contra
servidor local sem rede.

Restrição a aplicar no Console do Google Cloud (APIs e serviços › Credenciais), **sem efeito
antes da aplicação pelo operador**:

- **Restrição de API:** somente *Identity Toolkit API* e *Token Service API*.
- **Restrição de aplicativo (referrers HTTP):** `https://nexojuris.ia.br/*`,
  `https://conta.nexojuris.ia.br/*` e, enquanto a homologação existir,
  `https://login-hml---nexohub-hub-r4m4ltvj3a-rj.a.run.app/*`.

Validar depois de aplicar: login Google e por e-mail na web, reabertura da sessão web, e no
Windows o login, o fechamento e a reabertura do aplicativo após a expiração do token de acesso,
que é quando a renovação ocorre. Se a renovação nativa for recusada, remover primeiro a restrição
de referrer e manter a de API. Este registro não declara a restrição aplicada nem validada.
