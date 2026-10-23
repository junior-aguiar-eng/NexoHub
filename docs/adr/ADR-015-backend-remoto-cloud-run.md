# ADR-015 — Backend remoto e execução no Cloud Run

## Contexto

O NexoHub foi concebido como um produto estritamente local-first (ADR-001, AGENTS.md Regra 3 e PRIVACY.md), em que o processamento documental ocorre primariamente no dispositivo do usuário e sem dependência de nuvem.

Contudo, para suportar a distribuição Web sem exigir a instalação de sidecars locais (Python/OCR/DOCX) ou capacidade de hardware específica, foi introduzido o crate `nexohub-server` com deploy automatizado no Google Cloud Run. Na implementação inicial, esse servidor operava sem autenticação, com CORS aberto, concedendo grants nativos arbitrários a caminhos do host através do `grant_broker` (anulando o ADR-014), vazando diretórios temporários na memória `tmpfs` do Cloud Run e bloqueando o runtime assíncrono Tokio com computação síncrona pesada.

Para manter a conformidade com as regras de governança do projeto e garantir a segurança do ambiente, é necessária uma decisão arquitetural explícita definindo o escopo, as fronteiras de segurança e as garantias do backend remoto.

## Decisão

Formalizar a arquitetura do **Backend Remoto Stateless (`nexohub-server`)** para o serviço Web no Google Cloud Run com as seguintes restrições inegociáveis:

1. **Sandboxing Estrito e Neutralização de LFI:**
   - O servidor web **nunca** concede grants nativos a caminhos arbitrários enviados pelo cliente HTTP (`grant_broker::grant_path` não pode ser invocado com parâmetros livres do request).
   - O comando `import_document` (que lê arquivos do disco local do host) é **desabilitado** no servidor web, retornando `ErrorCode::PermissionDenied`. Toda ingestão remota deve utilizar exclusivamente `import_document_bytes` via upload direto de payload.
   - Todo projeto ou sessão alocada no servidor deve residir obrigatoriamente sob um diretório temporário isolado e validado (`/tmp/nexohub-sessions/<session-id>`). Qualquer tentativa de acessar ou criar caminhos fora desse escopo é rejeitada.

2. **Gestão e Limpeza de Sessões (Prevenção de Esgotamento de Memória):**
   - Eliminação de `std::mem::forget` em diretórios temporários.
   - Rotinas de expiração e limpeza automática (reaper) para sessões inativas ou concluídas, evitando que o `tmpfs` em memória do Cloud Run atinja o limite da instância.
   - Limite máximo de tamanho por requisição (50 MiB) e rejeição imediata de arquivos maliciosos ou desproporcionais.

3. **Runtime Não-Bloqueante (Offload para Threadpool):**
   - Handlers do Axum não devem executar operações síncronas pesadas (parsing e compressão de PDF via `lopdf`, I/O SQLite, OCR e chamadas a subprocessos) diretamente nas threads do reator Tokio.
   - Toda invocação de comandos do `nexohub-core` em contexto HTTP deve ser despachada via `tokio::task::spawn_blocking`, preservando a capacidade de resposta da API para conexões concorrentes.

4. **Container e Dependências de Produção (Dockerfile Reprodutível):**
   - Fixação estrita da versão do gerenciador de pacotes (`pnpm@11.19.0`) no Dockerfile, eliminando `@latest`.
   - Inclusão do interpretador Python 3, runtime isolado e dependências dos sidecars (`engines/python`) na imagem final Debian do Cloud Run, viabilizando o processamento real de OCR, DOCX e tradução.
   - Remoção de pacotes inoperantes ou desacoplados do pipeline nativo.

5. **Observabilidade e Configuração:**
   - O binário do servidor deve inicializar o `tracing_subscriber` com suporte a `tracing_subscriber::EnvFilter`, respeitando a variável de ambiente `RUST_LOG` definida no deploy.

6. **Princípio de Minimização de Dados e Privacidade:**
   - As requisições executadas no Cloud Run são estritamente efêmeras (stateless): após o encerramento da resposta ou expiração da sessão, todos os artifacts gerados são purgados do storage temporário da instância.

### Acesso às sessões HTTP

`pick_project_folder` aloca o projeto sob `nexohub-sessions` no diretório temporário do sistema
e devolve uma credencial aleatória no cabeçalho `X-NexoHub-Session`, separada do caminho público.
O adapter HTTP conserva a credencial somente em memória e a envia como `Authorization: Bearer`
nas próximas chamadas. A seleção é reutilizada pelo adapter, inclusive em chamadas concorrentes.

Qualquer comando com `projectPath`, incluindo contextos opcionais, exige uma credencial válida
vinculada exatamente ao caminho canônico alocado. Caminhos de outra sessão, diretórios arbitrários,
travessias e links simbólicos que saiam desse projeto são recusados antes do despacho ao core.
Somente a alocação interna concede acesso pelo broker; abrir ou criar um projeto nunca concede
permissões a partir de um caminho informado no payload.

O registro de sessões pertence à instância do servidor. Após 30 minutos de inatividade, a próxima
alocação ou autorização remove as entradas expiradas e seus diretórios, preservando requisições
que ainda estejam em andamento. Reiniciar ou trocar a instância invalida as credenciais, exigindo
uma nova sessão. As rotas stateless continuam operando em diretórios temporários próprios, com
remoção ao término da requisição.

Se o servidor recusar a credencial do próprio projeto, o adapter descarta a sessão em memória
para permitir nova alocação na próxima seleção. A operação recusada continua sendo apresentada
como erro e não é repetida automaticamente com identificadores de uma sessão anterior.

## Consequências

- O `ADR-001` permanece válido como o padrão arquitetural primordial do produto (desktop offline), enquanto este ADR delimita o backend remoto como um adapter de suporte restrito à Web;
- A superfície de ataque de leitura arbitrária de arquivos (LFI/Path Traversal) no Cloud Run é integralmente eliminada;
- Instâncias do Cloud Run não sofrem pane por exaustão de memória sob requisições sucessivas;
- O throughput do servidor é preservado mesmo sob carga mista de I/O e processamento PDF;
- A imagem Docker torna-se reprodutível, auditável e funcionalmente completa.
