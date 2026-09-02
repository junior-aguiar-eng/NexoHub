# Roadmap

| Fase | Entrega | Estado |
| --- | --- | --- |
| 0 | Monorepo, client compartilhado, Tauri Windows, Rust, Python/uv, qualidade e CI | Concluída localmente |
| 1 | Design system e Launcher sem ferramentas fictícias | Concluída localmente |
| 2 | Document Core e persistência local | Concluída localmente |
| 3 | Tool SDK, Registry, Runner e Capability Layer | Concluída localmente |
| 4 | Quick Tools PDF reais | Em andamento — compressão nativa integrada ao Document Core |
| 5 | Studio sobre o Document Core | Em andamento — shell e porta tipada do Document Core |
| 6 | Nexo Layers, NexoFlow e promoção Quick → Studio | Concluída localmente |
| 7 | Texto e revisões UTF-8 imutáveis | Concluída localmente |
| 8 | Overlay PDF | Concluída localmente |
| 9 | OCR | Concluída localmente |
| 10 | Anchors | Concluída localmente |
| 11 | DOCX | Concluída localmente |
| 12 | Tradução | Concluída localmente |
| 13 | Revisão | Em andamento — LanguageTool pt-BR e persistência integrados |
| 14 | Receitas | Em andamento — DAG visual, presets e runner topológico integrados |
| 15 | Hardening orientado a falhas e métricas | Concluída localmente — limites, recuperação e perfil documentados |
| 16 | Release engineering Windows e publicação web auditável | Planejada |

Cada fase exige seus próprios gates. Commit, publicação e release são decisões separadas.

## Escopo de plataforma

As fases cobrem somente o aplicativo Windows e o client web compartilhado. Linux, Android, iOS e
demais sistemas nativos estão congelados por prazo indeterminado e não integram este roadmap: não
possuem funcionalidades, CI, release, critérios de aceite, prazo, marco ou obrigação de
implementação. A estrutura multiplataforma preservada no Tauri representa apenas possibilidade
técnica. Qualquer avaliação dependerá de decisão futura, discricionária e expressa do mantenedor e
não condicionará o desenvolvimento Windows.
