# Publicação do NexoHub em /hub/ — plano de implementação

Objetivo aprovado: servir https://nexojuris.ia.br/hub/ pelo balanceador existente, preservando ForgeLex e o subdomínio atual durante a validação.

Arquitetura: base configurável de build (padrão `/`, candidata `/hub/`); rotas e recursos usam essa base. Uma revisão/serviço candidato separado recebe o build de subpasta. O URL map reescreve `/hub/*` para `/*` no backend candidato; `/hub` redireciona para `/hub/`. Não alterar APIs, dados, processamento ou desktop.

Alternativas: trocar o serviço atual quebraria o subdomínio na raiz; criar outro balanceador acrescentaria infraestrutura desnecessária. Reutilizar o balanceador com backend candidato preserva rollback e a publicação atual.

- [x] Centralizar composição e remoção da base em `apps/client/src/platform/app-paths.ts`, com testes para `/`, `/hub/`, raiz sem barra, recursos e limites de prefixo.
- [x] Adaptar App, favicon, fontes e dicionários; configurar `NEXOHUB_BASE_PATH` no Vite e argumento opcional no Dockerfile, mantendo `/` por padrão.
- [x] Cobrir navegação, recarga direta, histórico, exports de PDF/imagem, fontes e dicionários em build real `/hub/`; executar lint, tipagem, unitários e E2E da raiz.
- [x] Criar gerador offline do URL map com testes: preservar configuração existente, separar host rules compartilhadas, recusar conflito em `/hub` e configurações avançadas não suportadas. Não aplicar automaticamente.
- [x] Registrar inventário, publicação candidata, validação do URL map, troca de tráfego e rollback em runbook. Conferir acesso real antes de executar ações remotas.

Validação de produção: exportar URL map atual; conferir projetos, NEG/backend, certificado e serviço; testar o candidato e validar o mapa antes de importar. Confirmar ForgeLex, Auth, API e MCP fora de `/hub`; só então redirecionar o subdomínio antigo. Nunca encaminhar cookies/Authorization do site principal ao backend NexoHub sem análise.

Limite atual de acesso: ambiente sem gcloud, credenciais GCP ou acesso de rede às APIs Google. Isso impede inventário e ativação remotos nesta sessão; preparar todo o resultado local antes de solicitar acesso.

## Validação local concluída

Lint e tipagem aprovados; 579 testes unitários, 4 testes do gerador de URL map, 135 E2E na raiz e 5 E2E em `/hub/` aprovados. Build aprovado nos dois pontos de montagem. CI ampliada para executar os dois modos.

- [x] Inventário atual e validação do mapa no Google Cloud.
- [x] Publicação candidata, nova rota pública e conferência do site principal pelo operador.
- [x] Redirecionamento do subdomínio antigo após observação, preservando caminhos e query.

A sessão do agente não tem acesso GCP. O operador executou pelo Cloud Shell a publicação candidata e a importação do mapa; evidências registradas em `docs/DEPLOY-HUB.md`. O operador confirmou o website e o site principal; a conferência pública passou para os três redirects 301 exatos, raiz, `/hub/`, `/hub/pdf` e API saudável. O workflow de deploy foi direcionado ao serviço `nexohub-hub`, com build `/hub/`, conferência pública automática e restauração do tráfego em caso de falha.
