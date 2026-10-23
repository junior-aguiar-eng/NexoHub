# Unificação visual PDF e Imagem — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar PDF e Imagem no mesmo padrão visual NexoHub e qualificar o motor de imagens.

**Architecture:** Reaproveitar os componentes compartilhados e o `data-zone="pdf|img"`
introduzido no modo Imagem. Separar tema, catálogo e processamento: geometria única,
cores via tokens e operações acessadas pelo executor/port existente.

**Tech Stack:** React 19, TypeScript strict, Tailwind/CSS tokens, SVG, Canvas/Web Workers;
Pica e codecs jSquash sujeitos à avaliação descrita abaixo; Cropper.js se necessário.

**Spec:** `docs/superpowers/specs/2026-10-23-unificar-pdf-imagem-design.md`.

## Global Constraints

- Somente website; sem push, deploy ou mudanças desktop.
- Preservar as correções locais de `3a85420` e as seis ferramentas de imagem de `d738bab`.
- Não copiar textos/ícones do concorrente. Originais imutáveis; sem upload externo.
- Textos via i18n pt-BR, ferramentas via Tool Registry, sem dependências redundantes.
- Medidas e paletas exatas na spec; contraste 4,5:1 para texto e alvos mínimos de 44px.
- Não executar este plano antes da revisão do usuário. Nenhuma alteração funcional nesta entrega.

## Review Focus

1. Trocar modo com arquivos/edições: não perder trabalho silenciosamente (tarefas 1 e 2).
2. Voltar/avançar, recarregar e abrir rota direta: catálogo, tema e marca coerentes (tarefa 2).
3. Remover a busca central: cabeçalho continua encontrando ações/descrições e acessível (tarefa 3).
4. Imagens grandes, EXIF, alpha e GIF animado: saída correta ou limitação clara (tarefa 5).
5. Mobile/tema escuro/movimento reduzido: sem overflow, foco ilegível ou animação insistente (tarefa 6).

## Estado observado em 23/10/2026

A branch local contém `3a85420`; o remoto tem `d738bab`, ainda não integrado nesta análise.
O remoto acrescenta seis painéis: compressão, conversão, recorte, redimensionamento, rotação
e marca d'água. `image-engine.ts` usa Canvas/Web APIs; não acrescenta codecs especializados.
`Header.tsx` oculta os atalhos/menu de PDF no modo Imagem sem equivalente completo;
`NexoHubLogoIcon.tsx` ainda desenha o N. O seletor declara tabs sem implementar navegação
por setas; revisar sua semântica. Existem classes CSS concorrentes e cores locais no JSX.
São observações do código, não uma auditoria concluída de todos os resultados de imagem.

### 1. Consolidar a base sem perder correções

**Arquivos:** `App.tsx`, `DedicatedToolView.tsx`, `data.ts`, `model.ts`, `pt-BR.ts`,
`platform/launcher-tool-runner.ts`, `packages/tool-registry/src/index.ts` e respectivos testes
(nos diretórios existentes de `apps/client/src`).

- [ ] Inspecionar a divergência local/remota e integrar `d738bab` em trabalho isolado,
  resolvendo conflitos por comportamento, sem substituir arquivos inteiros pela versão remota.
- [ ] Manter testes das correções de câmera, HTML, formulários e extração; reproduzir também
  abertura/upload/download das seis ferramentas de imagem antes dos refinamentos.
- [ ] Adicionar teste de troca de modo com trabalho pendente; definir confirmação somente
  quando a navegação realmente descartar conteúdo, preservando a sessão se possível.
- [ ] Executar testes atuais, tipagem e build; registrar baseline de capturas e tamanho dos bundles.
- [ ] Entrega: integração revisável em commit próprio, sem push.

### 2. Tema compartilhado, camaleão e seletor compacto

**Arquivos:** `App.tsx`, `components/NexoHubLogoIcon.tsx`,
`features/launcher/SegmentedZoneToggle.tsx`, `Header.tsx`, `styles.css`,
`components/ParallaxBackground.tsx` e seus testes. Importar SVG B dos estudos aprovados.

**Interfaces:** manter `WorkZone = "pdf" | "img"` e
`NexoHubLogoIcon({ size?, className?, zone? })`; root `data-zone` é a fonte do tema.

- [ ] Testar troca PDF→Imagem→PDF, rota direta, reload e histórico; todos devem concordar
  em ferramentas, menu, marca e cores. Evitar usar preferência salva sobre rota explícita.
- [ ] Substituir desenho N pelo camaleão B com corpo grafite e acento por token; usar o mesmo
  componente no rodapé, sem deixar o PNG antigo nem cores forçadas por classes locais.
- [ ] Centralizar tokens de marca, foco e três névoas no `styles.css`. Manter posições/medidas;
  mapear paletas da spec. Garantir que tema escuro herdado funcione com `data-zone`.
- [ ] Dimensionar o seletor em 44px de altura e 160–184px de largura no desktop. Usar botões
  com `aria-pressed` se forem navegação entre modos; remover semântica tab incompleta.
- [ ] Transição de cor de 250ms, desativada em movimento reduzido; sem animação permanente.
- [ ] Verificar componente, navegação por teclado e capturas dos dois modos; commit separado.

### 3. Catálogo mais alto na tela e busca somente no cabeçalho

**Arquivos:** `Hero.tsx`, `Hero.test.tsx`, `Header.tsx`, `Header.test.tsx`,
`CommandPalette.tsx`, `CommandPalette.test.tsx`, `SuiteNavigation.tsx`, `App.tsx`, `styles.css`.

**Interfaces:** Hero recebe somente `currentZone`; busca usa a paleta existente e recebe
`tools`/categorias do modo ativo. Eliminar props/estado de busca central que ficarem sem uso.

- [ ] Testar busca por “reduzir”, “marca”, nomes sem acento e descrições, Ctrl/⌘K, Escape,
  Enter, foco devolvido e categorias de ambos os modos. Não deixar categorias PDF na Imagem.
- [ ] Remover campo central; manter lupa no cabeçalho abrindo a busca existente. Ampliar
  busca da paleta de título para título+descrição+aliases de ação definidos no catálogo.
- [ ] Preencher atalhos e menu completo do modo Imagem com ferramentas disponíveis, usando
  o mesmo componente/estrutura do PDF; limitar atalhos conforme espaço, sem esconder a busca.
- [ ] Compactar espaços do hero e aproximar filtros/grade; aviso de privacidade junto ao
  fechamento do catálogo. Aplicar gap de 16px, mantendo dimensões de cards e breakpoints da spec.
- [ ] Conferir primeira linha até y=240px em 1440×900 e ausência de regressão em 390px;
  executar testes de navegação e filtros; commit separado.

### 4. Ícones autorais e textos úteis

**Arquivos:** criar `features/launcher/ToolArtwork.tsx`; modificar `ToolCard.tsx`, `data.ts`,
`i18n/pt-BR.ts` e testes de cards/registro; atualizar `docs/DESIGN-SYSTEM.md` após validação.

**Interfaces:** `ToolArtwork({ toolId, zone }: { toolId: string; zone: WorkZone })`;
SVG decorativo `aria-hidden`, área 48×48. Fallback usa o ícone existente até cobrir o catálogo.

- [ ] Criar família própria de ilustrações duotone por ação, com mesma espessura, alinhamento
  e escala; manter cores semânticas por grupo. Não alterar os ícones funcionais dos controles.
- [ ] Revisar cada descrição contra formatos/opções realmente suportados; priorizar verbo,
  benefício e limite útil. Hero PDF: “Seus PDFs, prontos para o próximo passo.”;
  Imagem: “Suas imagens, do jeito que você precisa.” como propostas editoriais.
- [ ] Preservar títulos alinhados e descrições completas; conferir clique/Enter/Espaço,
  upload por arraste, foco e prewarm já existente. Verificar traduções/IDs do registro.
- [ ] Comparar as duas páginas lado a lado; corrigir diferenças de geometria e documentar
  os tokens finais, sem atualizar documentação como se valores não validados já estivessem prontos.
- [ ] Entrega: commit visual/editorial próprio.

### 5. Qualificar processamento de imagens com evidências

**Arquivos:** `platform/image-engine.ts`, `image-engine.test.ts`, `launcher-tool-runner.ts`,
seis `features/launcher/Image*Panel.tsx`, fixtures/E2E, `apps/client/package.json`, lockfile
somente se dependência selecionada; criar worker/adaptador focado quando justificado.

- [ ] Criar fixtures reais/sintéticas: JPEG com orientação EXIF, PNG alpha, WebP, imagem
  corrompida, GIF animado, imagem 48MP e lote de 20 fotos 12MP; medir execução/memória/resposta
  do navegador. Fixtures grandes podem ser geradas em teste, sem inflar o repositório.
- [ ] Verificar bytes decodificados, dimensões, MIME/extensão, alpha, recorte exato, rotação e
  posição da marca. Validar compressão que aumenta tamanho, saída PNG em navegador sem codec
  solicitado e timeout/cancelamento. Não aceitar só testes com Canvas totalmente mockado.
- [ ] Comparar baseline Canvas com candidatos abaixo. Medir tempo frio/quente, bytes WASM,
  tamanho final, detalhes/halos em imagens de teste e responsividade. Registrar limitações de cor.
- [ ] Escolher por operação, fixar versões e revisar licenças inclusive codecs transitivos;
  não instalar todas as opções. Carregar apenas na ferramenta em uso.
- [ ] Executar operações pesadas em worker com cancelamento; iniciar com uma imagem por vez
  no lote, progresso por arquivo e liberação de bitmap/Canvas/ObjectURL ao concluir/sair.
- [ ] Manter saída original quando compressão não trouxer ganho e nenhuma transformação foi
  pedida; explicar resultado. Tratar alpha→JPEG com fundo explícito; rejeitar animação não
  suportada antes de processar, sem congelar silenciosamente no primeiro quadro.
- [ ] Definir limites de pixels/memória a partir das medições, exibir limites reais e impedir
  alocações inviáveis. Se modelo IA for considerado, separar auditoria de pesos/licença e custo.
- [ ] Validar saídas em navegador real, falhas e cancelamento; atualizar inventário/licenças
  e documentação. Entrega funcional separada do refinamento visual.

#### Bibliotecas pesquisadas — recomendação por função

| Função | Candidato | Decisão proposta |
| --- | --- | --- |
| JPEG/WebP/AVIF e otimização PNG | [jSquash](https://github.com/jamsinclair/jSquash), Apache-2.0 no projeto | Preferido para codecs WASM no navegador/worker; escolher pacotes necessários e conferir licenças dos codecs incorporados. |
| Redimensionamento | [Pica](https://github.com/nodeca/pica), MIT | Preferido para comparar com Canvas, worker/WASM; não prometer fidelidade de pré-impressão/HDR: o próprio projeto documenta limitações de gamma/8 bits. |
| Recorte interativo | [Cropper.js](https://github.com/fengyuanchen/cropperjs), MIT | Candidato se melhorar o recorte atual; v2 usa web components. Integrar ao tema, com campos numéricos acessíveis. |
| Rotação/composição/marca | Canvas/Web APIs existentes | Manter quando resultados e desempenho forem satisfatórios. Biblioteca extra não é melhoria por si só. |
| Remoção de fundo | [IMG.LY](https://github.com/imgly/background-removal-js), AGPL-3.0 | Fora da adoção automática: exige decisão explícita de licença; avaliar modelo/qualidade separadamente. |

Essas são recomendações de arquitetura, não um ranking comprovado por benchmark local.
Não adicionar runtime de IA adicional para ferramentas que não o exigem. Não prometer suporte
a RAW/HEIC, SVG remoto ou GIF animado apenas por aparecerem no concorrente.

### 6. Validação conjunta e documentação final

**Arquivos:** testes existentes de `App`, Header, Hero, cards e E2E em `apps/client/e2e`;
`docs/DESIGN-SYSTEM.md`, inventário de dependências aplicável.

- [ ] Capturar PDF e Imagem em 390, 768, 1024, 1440 e 1920px; comparar mesma hierarquia,
  espaço acima da grade, legibilidade, alinhamentos e sem rolagem horizontal.
- [ ] Conferir teclado, foco, contraste, alvos e leitura de rótulos; teste escuro e movimento
  reduzido, carregamento de rota e troca de modo sem perda silenciosa de arquivos.
- [ ] Executar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:web`,
  `pnpm test:e2e:ci` e `pnpm licenses:check` quando houver novas dependências.
- [ ] Rever diff final e documentar resultados/limites, em especial formatos e grandes lotes;
  commits por entrega. Permanecer sem push/deploy até instrução explícita.

## Sequência de entrega

1. Base integrada e sem regressões.
2. Identidade/temas e seletor.
3. Organização do catálogo e busca do cabeçalho.
4. Ilustrações/textos e design system.
5. Melhorias comprovadas do motor de imagem.
6. Validação conjunta. Não condicionar o refinamento visual à entrega de ferramentas de IA.
