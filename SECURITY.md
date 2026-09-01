# Política de segurança

Relate vulnerabilidades de forma privada aos mantenedores, com reprodução mínima, impacto e versão
afetada. Não publique dados ou documentos de terceiros.

O NexoHub ainda está em fase inicial e não possui release suportada. O modelo de segurança é
local-first: nenhum documento deve sair do dispositivo sem ação explícita; a UI não recebe shell ou
filesystem genérico; originals persistentes não são cache.

## Dependências condicionais por plataforma

O alvo desktop produtivo atual é Windows `x86_64-pc-windows-msvc`. Nesse alvo, Tauri/Wry usa
WebView2 e o grafo não contém `glib`. As dependências transitivas diretamente atualizáveis permanecem
fixadas no lockfile em versões corrigidas: `time >= 0.3.47` e `serde_with >= 3.21.0`.

O `Cargo.lock` também resolve `glib 0.18.5` na cadeia GTK3/WebKitGTK usada pelo Tauri/Wry no
Linux. A mesma família condicional pode ser resolvida por outros alvos Unix fora da matriz
produtiva, como FreeBSD; ela não integra o grafo Windows. Essa versão é afetada por
[GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g), mas não é compilada nem
executada no alvo Windows atual. Linux está congelado e sem release suportada. A correção sem fork
ou vendorização depende da migração oficial do Wry para GTK4, acompanhada em
[tauri-apps/wry#1474](https://github.com/tauri-apps/wry/issues/1474). A exceção deve ser revista se e
quando o mantenedor decidir expressamente avaliar suporte Linux, ou quando a cadeia oficial do
Tauri mudar.

Última revisão: 1º de setembro de 2026.
