# ADR-014: Broker de grants de caminho

- **Status:** aceito
- **Data:** 4 de setembro de 2026

## Contexto

O client React compartilha código entre navegador e Tauri. No desktop, um renderer comprometido
não pode transformar comandos próprios do NexoHub em acesso arbitrário ao perfil do usuário. Os
contratos atuais ainda recebem caminhos absolutos para criar e abrir projetos, importar documentos
e executar operações posteriores sobre um projeto.

O host nativo precisa distinguir uma escolha feita pelo usuário em diálogo confiável de uma string
forjada pelo renderer. Essa autorização não pode ser confundida com a identidade persistida de um
projeto recente nem transferida ao navegador.

## Ameaças consideradas

| Ameaça | Controle exigido |
| --- | --- |
| Renderer envia caminho que nunca foi escolhido | Comando baseado em caminho aceita somente identificador opaco emitido pelo host nativo. |
| Arquivo, diretório ou componente ancestral é symlink ou reparse point | Host rejeita reparse points e resolve a identidade final no momento da concessão e novamente no consumo. |
| Grant é reutilizado em operação incompatível | Grant contém escopo fechado e vínculo opcional com a sessão do projeto; divergência é rejeitada. |
| Grant válido é capturado e repetido | Grants de caminho são de uso único, consumidos atomicamente antes da operação. |
| Grant antigo é usado após mudança de contexto | Grant expira cinco minutos após a emissão e pode ser revogado antes disso. |
| Projeto recente é reaberto após reinício | Persistência nativa guarda identidade confiável e metadados mínimos; a reabertura revalida o caminho sem aceitar autorização fornecida pelo renderer. |
| Renderer troca o caminho entre validação e uso | Host reabre e revalida o objeto no consumo; o core recebe apenas o caminho canônico resultante dessa validação. |

Não é objetivo deste ADR isolar documentos já abertos de código executado na mesma janela
autorizada. O controle limita quais objetos locais podem ingressar no domínio; autorização interna
mais granular entre painéis permanece responsabilidade da Capability Layer.

## Alternativas avaliadas

### Token opaco mantido no processo nativo

O host gera identificador aleatório com pelo menos 128 bits de entropia criptográfica e mantém em
memória o caminho, o escopo, a expiração, o estado de consumo e o vínculo com o projeto. O renderer
recebe apenas o identificador e metadados não sensíveis necessários à interface.

Vantagens: caminho e política não podem ser adulterados pelo renderer; revogação e uso único são
diretos; não há segredo persistido nem formato de autorização durável. Desvantagens: grants deixam
de existir ao encerrar o processo e exigem estado nativo.

### Token autenticado persistível

O host serializaria caminho, escopo e validade em um token autenticado, verificável após reinício.

Vantagens: dispensa tabela de grants em memória e permite continuidade automática. Desvantagens:
cria gestão e rotação de chave local, amplia a superfície de replay, persiste autorização além da
ação que a originou e pode expor caminhos ao renderer mesmo quando o conteúdo é apenas autenticado.
Criptografar o token reduziria a exposição, mas não eliminaria replay nem a complexidade de ciclo
de vida.

## Decisão

Adotar tokens opacos, efêmeros, escopados e resolvidos exclusivamente no processo Tauri. Grants de
caminho nunca são persistidos e não são implementados no adapter browser.

### Escopos mínimos

- `CREATE_PROJECT`: seleção de destino para um novo diretório `.nexohub`;
- `OPEN_PROJECT`: seleção de diretório `.nexohub` existente;
- `IMPORT_DOCUMENT`: seleção de um arquivo existente vinculada a uma sessão de projeto;
- `EXPORT_ARTIFACT`: seleção de destino vinculada a uma sessão de projeto e a um artifact.

Cada grant autoriza exatamente uma operação. No caso de destino ainda inexistente, o host mantém a
identidade canônica do diretório pai e o nome final escolhido; o renderer não pode substituir
nenhum dos dois. Em origem existente, o host mantém a identidade canônica do objeto selecionado.

### Sessão de projeto

Criar ou abrir um projeto consome o grant correspondente e produz também um `ProjectSessionId`
opaco, mantido no processo nativo. Listagem, leitura, importação e transformação recebem essa sessão
em vez de `projectPath`; o host resolve a raiz canônica antes de chamar o Document Core. A sessão é
revogada ao fechar o projeto, a janela ou o processo e não substitui as validações do core.

### Projetos recentes

A lista de recentes pertence ao host nativo. Ela persiste um `RecentProjectId`, a identidade
canônica necessária à reabertura e metadados mínimos de apresentação. Não persiste `PathGrantId` ou
`ProjectSessionId`. Uma reabertura solicitada pelo usuário usa o identificador retornado pelo host,
revalida existência, extensão `.nexohub`, identidade final e ausência de reparse point, e então
emite nova sessão de projeto. Entrada inválida é removida ou marcada indisponível sem revelar o
caminho em erro IPC.

### Validação e consumo

1. O diálogo nativo produz uma seleção; cancelamento não produz grant.
2. O host valida tipo, limites, diretório pai quando aplicável, componentes ancestrais e reparse
   points, e registra o grant em memória.
3. No comando de consumo, o host localiza o grant, verifica estado, prazo, escopo e vínculos.
4. O host marca o grant como consumido de forma atômica antes de realizar I/O adicional.
5. O objeto é reaberto e revalidado; somente então o caminho canônico é passado ao core Rust.
6. O core repete suas invariantes de caminho, domínio, MIME type, limites e imutabilidade.

Falha posterior ao passo 4 não restaura o grant. O usuário deve repetir a seleção, evitando replay
ambíguo depois de uma operação parcialmente iniciada.

### Revogação e expiração

Um comando próprio pode revogar grant ainda não consumido. Todos os grants são revogados ao fechar
a janela ou encerrar o processo. O prazo é medido por relógio monotônico e termina cinco minutos
após a emissão; mudança do relógio civil não estende autorização.

### Erros IPC

Os contratos expõem códigos estáveis e mensagens genéricas, sem caminho, token, conteúdo ou detalhe
do sistema operacional:

- `PATH_GRANT_NOT_FOUND`;
- `PATH_GRANT_EXPIRED`;
- `PATH_GRANT_REVOKED`;
- `PATH_GRANT_ALREADY_CONSUMED`;
- `PATH_GRANT_SCOPE_MISMATCH`;
- `PATH_GRANT_TARGET_INVALID`;
- `PROJECT_SESSION_NOT_FOUND`;
- `PROJECT_SESSION_REVOKED`.

Logs podem registrar somente código, escopo e identificador de correlação não reutilizável. Grants,
sessões e caminhos não são registrados.

## Consequências

- Componentes React e adapters web não recebem nem enviam caminhos locais.
- O host Tauri passa a ser o único broker entre diálogos, sessões e caminhos canônicos.
- O Document Core continua independente de Tauri e recebe caminhos canônicos somente depois da
  resolução nativa, mantendo todas as validações próprias.
- Reabrir recentes continua possível sem transformar identidade persistida em autorização portada
  pelo renderer.
- Reiniciar o aplicativo invalida grants e sessões; somente a identidade de recente pode persistir.
- Contratos IPC baseados em `projectPath` serão substituídos no adapter Tauri, sem alterar as APIs
  internas do core na mesma etapa.

## Gate de implementação

Este ADR precisa ser aceito antes da implementação. O Marco 1 somente termina quando testes
negativos demonstrarem que caminho forjado, grant expirado, revogado, consumido ou com escopo
incompatível não alcança o Document Core, e que projeto recente é revalidado antes de abrir.
