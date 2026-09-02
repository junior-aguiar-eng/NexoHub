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

O alerta Dependabot nº 1 identifica `glib 0.18.5` na cadeia condicional
`tauri -> tauri-runtime-wry -> wry -> webkit2gtk/gtk -> glib`, usada no Linux e em outros alvos
Unix da família BSD. Essa versão é afetada por
[GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g), com correção em
`glib 0.20.0`, mas não é compilada nem executada no alvo Windows atual. O grafo Windows usa
WebView2 e não contém `glib`, e o código do NexoHub não referencia diretamente a API vulnerável
`glib::VariantStrIter`.

Linux está congelado e sem release suportada. A atualização isolada não é compatível: `gtk 0.18.2`
e `webkit2gtk 2.0.2` exigem `glib ^0.18`. A correção sem fork ou vendorização depende da migração
oficial do Wry para GTK4, acompanhada em
[tauri-apps/wry#1474](https://github.com/tauri-apps/wry/issues/1474). A exceção deve ser revista se e
quando o mantenedor decidir expressamente avaliar suporte Linux, ou quando a cadeia oficial do
Tauri mudar. Em 2 de setembro de 2026, o alerta foi dispensado como risco tolerado; essa classificação
não declara a dependência corrigida nem amplia a matriz de plataformas suportadas.

Última revisão: 2 de setembro de 2026.
Próxima revisão obrigatória: até 1º de outubro de 2026, ou antes de qualquer reativação de suporte
Linux/Unix, o que ocorrer primeiro.
