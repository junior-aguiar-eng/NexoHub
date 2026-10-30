# Camaleão B — estudo aprovado

Vetores e prancha da direção orgânica escolhida pelo usuário. A silhueta integra a identidade em produção no website e no aplicativo Windows. Estes arquivos preservam a direção aprovada.

- SVG principal: corpo grafite e crista coral para PDF.
- SVG micro e favicons de 16/32px: simplificações para tamanhos pequenos.
- Versões monocromática e reversa: aplicações em superfícies variadas.
- `proposta-b.png`: apresentação da direção visual.

A aplicação ao website parametriza o acento: coral no modo PDF; azul com detalhe
ciano no modo Imagem. Preservar a silhueta e o corpo grafite. A proposta visual não representa
pesquisa de disponibilidade ou registro de marca.


## Assets usados

O README público usa a versão reversa aprovada no tema escuro e `apps/client/src/assets/nexohub-camaleao.svg` no tema claro, correspondente ao vetor de `apps/desktop/src-tauri/app-icon.svg`. O PNG de apoio e de testes é `apps/client/src/assets/nexohub-camaleao.png`, correspondente ao ícone atual do desktop. O componente `NexoHubLogoIcon` mantém as variações de zona e tema; os favicons ativos são `favicon-pdf.svg` e `favicon-img.svg`.

O monograma antigo e os ícones legados das plataformas congeladas foram removidos da árvore atual. A regressão de identidade é verificada em `apps/client/src/components/branding-assets.test.ts`. Registros históricos de medições podem citar nomes e hashes de arquivos antigos; eles não fornecem assets reutilizáveis.
