# Definition of Done do NexoHub 1.0

`v1.0.0` exige evidência reproduzível para todos os itens abaixo. Código presente ou teste unitário
isolado não substitui validação do produto instalado.

| Critério | Estado atual |
| --- | --- |
| Launcher, Quick Tools, Studio e Quick → Studio | Parcial; fluxos web e CLI cobertos por testes, integração nativa do app instalado em certificação |
| Projects, original imutável e Artifact Graph | Implementado no core; validação instalada pendente |
| Nexo Layers e NexoFlow | Implementados; validação instalada pendente |
| Visualização, manipulação e overlay PDF | Parcial; não há certificação completa do produto instalado |
| OCR e PDF → Markdown | Parcial; engine Python/Tesseract operacional, integração produtiva completa em validação |
| Rich Text, Markdown e DOCX básico | Parcial |
| Extração de imagens | Implementado; engine Python, core Rust, Tauri IPC, Tool Registry e UI com download ZIP e galeria de miniaturas |
| Tradução e revisão integradas | Parcial; sidecars e integração instalada pendentes |
| Operações canceláveis e crash recovery | Cobertura no core; validação de produto pendente |
| Testes automatizados | Aprovados e 100% verdes no GitHub Actions (CI, Pipeline Main e testes da CLI) |
| Instalador funcional | Pipeline Main de empacotamento Windows operacional gerando executável (`app-x64.exe`); validação em máquina limpa pendente |
| Documentação e privacidade técnica | Atualizadas e ativas no repositório |
| Auditoria de licenças | Automatizada e 100% aprovada no workflow remoto de Segurança e Licenças |
| Nenhuma função local depende de servidor NexoHub | Atendido pela arquitetura atual |

Conclusão atual: o repositório avança na esteira de integração contínua e build automático, com foco na certificação e estabilização dos fluxos nativos instalados.
