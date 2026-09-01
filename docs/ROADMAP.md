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
| 8 | Overlay PDF | Planejada |
| 9 | OCR | Planejada |
| 10 | Anchors | Planejada |
| 11 | DOCX | Planejada |
| 12 | Tradução | Planejada |
| 13 | Revisão | Planejada |
| 14 | Receitas | Planejada |
| 15 | Hardening orientado a falhas e métricas | Planejada |
| 16 | Release engineering Windows e publicação web auditável | Planejada |

Cada fase exige seus próprios gates. Commit, publicação e release são decisões separadas.

## Escopo de plataforma

As fases cobrem somente o aplicativo Windows e o client web compartilhado. Linux, Android, iOS e
demais sistemas nativos estão congelados por prazo indeterminado e não integram este roadmap: não
possuem funcionalidades, CI, release, critérios de aceite, prazo, marco ou obrigação de
implementação. A estrutura multiplataforma preservada no Tauri representa apenas possibilidade
técnica. Qualquer avaliação dependerá de decisão futura, discricionária e expressa do mantenedor e
não condicionará o desenvolvimento Windows.
