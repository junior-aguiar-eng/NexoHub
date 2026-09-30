# Changelog

Todas as alterações relevantes serão registradas neste arquivo. O projeto usa versionamento
semântico e os canais `alpha`, `beta`, `rc` e estável.

## [0.1.0] - 2026-09-30

### Adicionado

- **Telas Dedicadas por Ferramenta**: Interface interativa de 2 colunas para Organizador de PDF (com grade visual e rotação de miniaturas), Compressor de PDF (com estimativas de redução), Scanner OCR animado, Comparador textual e Corretor gramatical.
- **Integração Studio e Superpoderes**: Acesso unificado a partir do Launcher com suporte à promoção de Quick Tools para fluxos estruturados (`NexoFlow`) e ativação de módulos locais no modal de capacidades.
- **Cobertura Playwright E2E**: Validação de ponta a ponta de 23 cenários canônicos de navegação, transformação documental, persistência imutável e auditoria de linhagem SQLite.
- **Estabilização de Ferramentas Nativas e Web**: Executores de Organizar, Juntar, Dividir, Rotacionar, Comprimir PDF e Comparar Textos integrados ao Tool Runner, com cálculo honesto de compressão e gravação de artifacts derivados.
- **Empacotador Inno Setup Unificado**: Instalador desktop Windows único com verificação de subsistema GUI (sem terminal fantasma) e bootstrapper WebView2 Authenticode.
- **Auditoria multiplataforma de licenças**: Ajuste no `scripts/audit-licenses.mjs` com modo `--check` resiliente a variações de quebra de linha entre ambientes Linux/Windows.
- **Pipelines reproduzíveis**: Cobertura contínua para TypeScript/Node.js, Rust no Windows, Python 3.14 via `uv`, Playwright E2E, Gitleaks e auditoria de licenças.

### Removido

- **Extirpação de microserviço remoto e containers**: Remoção definitiva de `services/engine-api` (FastAPI/Celery/Redis) e `docker-compose.yml`, eliminando riscos de licença AGPLv3 (Ghostscript) e restaurando a garantia de processamento 100% offline.
- **Expurgo do subsistema Supabase Auth**: Desinstalação da dependência `@supabase/supabase-js` e exclusão do módulo `features/account`, eliminando telemetria e contas em nuvem em estrita aderência ao `docs/PRODUCT.md`.

### Corrigido

- **Desacoplamento e conformidade de `DedicatedToolView`**: Canalização da execução de ferramentas estritamente através do `documentCore` canônico, eliminando requisições HTTP e fallbacks com caminhos não concedidos pelo `grant_broker`.
- **Internacionalização canônica pt-BR**: Normalização das saudações na interface sem termos pessoais fixados.
- **Divisão de chunks no Vite**: Configuração de `manualChunks` desacoplando `pdfjs-dist` e `pdf-lib` para carregamento otimizado.
- Compatibilidade de supply-chain com `pnpm 11` via `ignore-scripts=true` no `.npmrc`.
- Atualização da crate `rustls >= 0.23.45` no `Cargo.lock` eliminando advisory de segurança detectado pelo `cargo-deny`.
- Resolução de permissão `pull-requests: read` no Gitleaks do GitHub Actions.
