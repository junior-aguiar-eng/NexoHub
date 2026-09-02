# Definition of Done do NexoHub 1.0

`v1.0.0` exige evidência reproduzível para todos os itens abaixo. Código presente ou teste unitário
isolado não substitui validação do produto instalado.

| Critério | Estado atual |
| --- | --- |
| Launcher, Quick Tools, Studio e Quick → Studio | Parcial; fluxos web cobertos, integração nativa ainda deve ser certificada |
| Projects, original imutável e Artifact Graph | Implementado no core; validação instalada pendente |
| Nexo Layers e NexoFlow | Implementados; validação instalada pendente |
| Visualização, manipulação e overlay PDF | Parcial; não há certificação completa do produto instalado |
| OCR e PDF → Markdown | Parcial; engine existe, integração produtiva completa não certificada |
| Rich Text, Markdown e DOCX básico | Parcial |
| Extração de imagens | Sem evidência de conclusão |
| Tradução e revisão integradas | Parcial; sidecars e integração instalada pendentes |
| Operações canceláveis e crash recovery | Cobertura no core; validação de produto pendente |
| Testes automatizados | Presentes; CI de release ainda precisa ficar verde no GitHub |
| Instalador funcional | Pipeline preparado; instalação em máquina limpa pendente |
| Documentação e privacidade técnica | Presentes, sujeitas à revisão de release |
| Auditoria de licenças | Automatizada; gate remoto pendente |
| Nenhuma função local depende de servidor NexoHub | Atendido pela arquitetura atual |

Conclusão atual: o repositório não está autorizado a produzir `v1.0.0` nem release candidate.
