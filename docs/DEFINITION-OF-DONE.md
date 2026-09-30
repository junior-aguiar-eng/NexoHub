# Definition of Done do NexoHub 1.0

`v1.0.0` exige evidência reproduzível para todos os itens abaixo. Código presente ou teste unitário
isolado não substitui validação do produto instalado.

| Critério | Estado atual |
| --- | --- |
| Launcher, Quick Tools, Studio e Quick → Studio | Parcial; catálogo web filtrado por executor, integração de todas as telas dedicadas ao Tool Runner e ao core nativo pendente |
| Projects, original imutável e Artifact Graph | Implementado no core; validação instalada pendente |
| Nexo Layers e NexoFlow | Implementados; validação instalada pendente |
| Visualização, manipulação e overlay PDF | Parcial; não há certificação completa do produto instalado |
| OCR e PDF → Markdown | Parcial; engine Python/Tesseract operacional, integração produtiva completa em validação |
| Rich Text, Markdown e DOCX básico | Parcial |
| Extração de imagens | Parcial; engine Python, core Rust e Tauri IPC presentes, mas a tela dedicada não usa esse fluxo nativo e a ferramenta não é anunciada como executável |
| Tradução e revisão integradas | Parcial; sidecars e integração instalada pendentes |
| Operações canceláveis e crash recovery | Cobertura no core; validação de produto pendente |
| Testes automatizados | Gates locais e CI devem ser avaliados por branch/commit; testes unitários e web não certificam o app instalado |
| Instalador funcional | Inno Setup gerado, instalado e atualizado na máquina de desenvolvimento sem duplicar registro ou atalho; validação em máquina limpa pendente |
| Documentação e privacidade técnica | Atualizadas e ativas no repositório |
| Auditoria de licenças | Automatizada e 100% aprovada no workflow remoto de Segurança e Licenças |
| Nenhuma função local depende de servidor NexoHub | Atendido pela arquitetura atual |

Conclusão atual: o repositório avança na esteira de integração contínua e build automático, com foco na certificação e estabilização dos fluxos nativos instalados.
