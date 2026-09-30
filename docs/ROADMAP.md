# Roadmap

| Fase | Entrega | Estado |
| --- | --- | --- |
| 0 | Monorepo, client compartilhado, Tauri Windows, Rust, Python/uv, qualidade e CI | Concluída |
| 1 | Design system e Launcher sem ferramentas fictícias | Concluída |
| 2 | Document Core e persistência local | Concluída |
| 3 | Tool SDK, Registry, Runner e Capability Layer | Parcial — infraestrutura implementada; tela dedicada ainda não encaminha todas as operações pelo Tool Runner |
| 4 | Quick Tools PDF reais | Parcial — compressão e organização usam artifacts no Document Core web e nativo; as demais ferramentas da tela dedicada ainda não registram artifacts nativos |
| 5 | Studio sobre o Document Core | Concluída — mesa de trabalho adaptativa, árvore documental, âncoras e histórico SQLite integrados |
| 6 | Nexo Layers, NexoFlow e promoção Quick → Studio | Concluída |
| 7 | Texto e revisões UTF-8 imutáveis | Concluída |
| 8 | Overlay PDF | Concluída |
| 9 | OCR | Parcial — engine nativo presente; fluxo de PDF na tela dedicada ainda não validado, oculto na web |
| 10 | Anchors | Concluída |
| 11 | DOCX | Parcial — engine presente; conversores da tela dedicada sem executor integrado |
| 12 | Tradução | Parcial — engine presente; integração e modelo instalado na tela dedicada ainda não demonstrados |
| 13 | Revisão | Parcial — engine presente; integração com a tela dedicada ainda não demonstrada |
| 14 | Receitas | Concluída — DAG visual, presets, runner topológico e executores do Studio integrados |
| 15 | Hardening orientado a falhas e métricas | Concluída — limites, recuperação e perfil documentados |
| 16 | Release engineering Windows e publicação auditável | Parcial — pipelines de CI, segurança e empacotamento definidos; validação do aplicativo instalado em máquina limpa pendente |

Cada fase exige seus próprios gates. Commit, publicação e release são decisões separadas.

## Escopo de plataforma

As fases cobrem somente o aplicativo Windows e o client web compartilhado. Linux, Android, iOS e
demais sistemas nativos estão congelados por prazo indeterminado e não integram este roadmap: não
possuem funcionalidades, CI, release, critérios de aceite, prazo, marco ou obrigação de
implementação. A estrutura multiplataforma preservada no Tauri representa apenas possibilidade
técnica. Qualquer avaliação dependerá de decisão futura, discricionária e expressa do mantenedor e
não condicionará o desenvolvimento Windows.
