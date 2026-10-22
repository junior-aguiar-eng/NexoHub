# Roadmap

| Fase | Entrega | Estado |
| --- | --- | --- |
| 0 | Monorepo, client compartilhado, Tauri Windows, Rust, Python/uv, qualidade e CI | Concluída |
| 1 | Design system contemporâneo e Launcher ergonômico com parallax dinâmico | Concluída |
| 2 | Document Core e persistência local com blobs BLAKE3 e SQLite | Concluída |
| 3 | Tool SDK, Registry, Runner e Capability Layer unificados | Concluída |
| 4 | Quick Tools PDF reais (Organizar, Juntar, Dividir, Rotacionar, Comprimir, Marca d'água, Numeração, Imagem↔PDF) | Concluída |
| 5 | Studio sobre o Document Core (árvore documental, âncoras e histórico SQLite) | Concluída |
| 6 | Nexo Layers, NexoFlow e promoção Quick → Studio | Concluída |
| 7 | Texto e revisões UTF-8 imutáveis (Comparador semântico de textos) | Concluída |
| 8 | Overlay PDF | Concluída |
| 9 | OCR (Reconhecimento óptico local integrado à tela dedicada e sidecar nativo) | Concluída |
| 10 | Anchors (localizadores independentes para texto, PDF e OCR) | Concluída |
| 11 | DOCX (Inspeção e criação no sidecar Python; conversão complexa de layout em homologação) | Parcial |
| 12 | Tradução (Tradução multilíngue offline integrada ao Tool Runner) | Concluída |
| 13 | Revisão (Corretor contextual e morfológico integrado com achados estruturados) | Concluída |
| 14 | Receitas NexoFlow (DAG visual, presets e runner topológico integrados) | Concluída |
| 15 | Hardening orientado a falhas, limites de segurança e mitigação de vulnerabilidades | Concluída |
| 16 | Release engineering (Instalador Windows Inno Setup Authenticode, CI multi-job e Deploy Cloud Run contínuo) | Concluída |

Cada fase exige seus próprios gates de qualidade, formatação e cobertura de testes. Commit, publicação e release são decisões separadas.

## Escopo de plataforma

As fases cobrem o aplicativo Windows x64 nativo e o client web moderno compartilhado. Linux, Android, iOS e
demais sistemas nativos estão congelados por prazo indeterminado e não integram este roadmap ativo: não
possuem funcionalidades em desenvolvimento, pipelines de release, critérios de aceite ou compromisso de
entrega. A estrutura preservada no repositório representa apenas possibilidade técnica para decisões futuras
do mantenedor.
