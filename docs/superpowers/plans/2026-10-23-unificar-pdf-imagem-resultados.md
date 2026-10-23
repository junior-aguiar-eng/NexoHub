# Unificação PDF/Imagem — resultado

Plano aprovado: `2026-10-23-unificar-pdf-imagem.md`. Implementação mantida na branch `work`,
sem push/deploy. O modo remoto `d738bab` foi integrado preservando as correções `3a85420`.

## Entregas

- Mesmo catálogo e navegação em PDF/Imagem; tokens, névoas e camaleão acompanham o modo.
- Seletor compacto, busca apenas no cabeçalho, ícones próprios e textos revisados.
- Cards mantêm tamanho/legibilidade, grade com gap16px. Após feedback do usuário, pílulas têm
  24px visuais de respiro até os cards; meta da primeira linha ajustada de240 para264px.
- Mesas de imagem maiores; seis operações reais em worker, lote ZIP, progresso e cancelamento.
- Sem bytes simulados em falhas; MIME real, orientação EXIF, alpha, limites e PNG sem perdas.
- Revisão independente encontrou quatro P2; todos reproduzidos em testes que falharam antes
  das correções e passaram depois: rotação0°, tema escuro, perda de sessão PDF na troca de modo
  e histórico da rota raiz. Corrigida também corrida cancelar/reiniciar, com teste RED→GREEN.

## Verificação

- `pnpm lint`: aprovado, 255 arquivos.
- `pnpm typecheck`: aprovado em todos os pacotes aplicáveis.
- `pnpm test --maxWorkers=2`: 568 testes aprovados (507 client, 44 domain, 16 SDK, 1 registry).
- `pnpm --filter @nexohub/client build`: aprovado; aviso existente de chunks acima de1000kB.
- E2E completos Chromium: 134 aprovados; após ajuste final de espaçamento, 15 testes visuais
  pertinentes reexecutados e aprovados.
- Capturas PDF/Imagem em390/768/1024/1440/1920px: sem rolagem horizontal e colunas esperadas.
- `pnpm audit --prod`: nenhuma vulnerabilidade encontrada.
- Licenças JavaScript inventariadas e avisos distribuídos. `licenses:check` global permanece
  indisponível nesta máquina porque Cargo não está instalado; não foi declarado aprovado.

O run inicial de unitários em paralelo aos E2E excedeu o timeout de15s em
`pdf-security.test.ts: recusa ocultação sem áreas e documento que ultrapassa o limite de memória`.
A suíte inteira passou em seguida com dois workers, sem alterar ou afrouxar esse teste.
Playwright nesta máquina usa `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.
Os comandos pnpm usam `pnpm_config_store_dir=/workspace/.cache/pnpm/store` nesta workspace.

## Decisões e limites

- Execução inline na branch de trabalho existente, sem novo checkout; registro manual do ledger
  porque os scripts auxiliares da skill cloud não existem como executáveis locais. Não altera
  a publicação, mas o isolamento depende de não haver edições concorrentes na mesma workspace.
- Cropper.js não adicionado: recorte numérico/proporções atual preservado. Não foi entregue
  um novo editor de imagens ou recorte por arraste; evitar dependência duplicada conserva o bundle.
- Guard genérico PDF/HTML/texto cobre troca de modo; editor mantém sua proteção específica;
  imagens protegem também navegação entre ferramentas. Navegação PDF dentro do mesmo modo
  mantém comportamento anterior e ainda pode descartar sessão ao escolher outra ferramenta.
- Limites conservadores24MP/64MiB e lote20/128MiB evitam alocações ilimitadas, mas reduzem a
  resolução máxima aceita. JPEG/WebP ainda precisam de decode para validar dimensões.
- Benchmarks são locais e sintéticos: codecs especializados oferecem controle, mas custam
  mais CPU; não certificam toda fotografia, perfil ICC/HDR, Safari/Firefox ou celular.
- Auditoria de licenças multilíngue limitada pela ausência de Cargo; avaliação web documentada
  separadamente. Limitações de execução não foram tratadas como aprovação jurídica geral.

Detalhes do motor, medições e fontes: `docs/IMAGE-WEB-QUALITY.md`.
Não houve findings menores adiados na revisão independente.
