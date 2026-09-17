# Roadmap

| Fase | Entrega | Estado |
| --- | --- | --- |
| 0 | Monorepo, client compartilhado, Tauri Windows, Rust, Python/uv, qualidade e CI | Concluída |
| 1 | Design system e Launcher sem ferramentas fictícias | Concluída |
| 2 | Document Core e persistência local | Concluída |
| 3 | Tool SDK, Registry, Runner e Capability Layer | Concluída |
| 4 | Quick Tools PDF reais | Concluída — compressão, organização, mesclagem e extração de imagens integradas ao Document Core |
| 5 | Studio sobre o Document Core | Concluída — mesa de trabalho adaptativa, árvore documental, âncoras e histórico SQLite integrados |
| 6 | Nexo Layers, NexoFlow e promoção Quick → Studio | Concluída |
| 7 | Texto e revisões UTF-8 imutáveis | Concluída |
| 8 | Overlay PDF | Concluída |
| 9 | OCR | Concluída |
| 10 | Anchors | Concluída |
| 11 | DOCX | Concluída |
| 12 | Tradução | Concluída |
| 13 | Revisão | Concluída |
| 14 | Receitas | Concluída — DAG visual, presets, runner topológico e executores do Studio integrados |
| 15 | Hardening orientado a falhas e métricas | Concluída — limites, recuperação e perfil documentados |
| 16 | Release engineering Windows e publicação auditável | Concluída — pipelines de CI, segurança e empacotamento Windows (`app-x64.exe`) 100% operacionais no GitHub Actions |

Cada fase exige seus próprios gates. Commit, publicação e release são decisões separadas.

## Escopo de plataforma

As fases cobrem somente o aplicativo Windows e o client web compartilhado. Linux, Android, iOS e
demais sistemas nativos estão congelados por prazo indeterminado e não integram este roadmap: não
possuem funcionalidades, CI, release, critérios de aceite, prazo, marco ou obrigação de
implementação. A estrutura multiplataforma preservada no Tauri representa apenas possibilidade
técnica. Qualquer avaliação dependerá de decisão futura, discricionária e expressa do mantenedor e
não condicionará o desenvolvimento Windows.
