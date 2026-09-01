# NexoHub Engineering Rules

1. Leia `docs/PRODUCT.md`, `docs/ARCHITECTURE.md` e o ADR pertinente antes de alterar arquitetura.
2. Não implemente funcionalidade fora do escopo nem refatore módulos não relacionados.
3. Não crie microserviço, backend remoto ou upload externo sem decisão arquitetural explícita.
4. O original importado é imutável; operações documentais produzem novos artifacts.
5. A UI não acessa filesystem, SQLite, shell ou sidecars diretamente. Toda interação nativa passa
   por Platform/Capability Port.
6. Toda ferramenta deve integrar o Tool Registry. Quick Tool e Studio usam o mesmo domínio e
   executor.
7. Verifique licença, manutenção, segurança, tamanho e necessidade antes de adicionar dependência.
   Prefira MIT, Apache-2.0, BSD e MPL-2.0. GPL/AGPL exige decisão explícita.
8. Não registre senha nem conteúdo sensível. Erros IPC devem ter códigos estruturados.
9. TypeScript permanece `strict`; `any` exige justificativa explícita.
10. Toda alteração funcional recebe teste proporcional ao risco. Não mascare nem remova testes para
    fazer a CI passar; prefira fixtures reais sintéticas ou licenciadas.
11. Ao concluir, execute formatter, lint, typecheck e testes aplicáveis e reporte limitações.
12. Não crie commit, PR, merge, release ou deploy sem solicitação explícita.
13. Português brasileiro é o idioma canônico do produto, da documentação, dos ADRs, das mensagens
    voltadas ao usuário e da comunicação do projeto. Novos textos de interface não devem ser
    escritos diretamente nos componentes: use chaves de internacionalização com catálogo `pt-BR`
    como fonte de verdade. Identificadores de código e protocolos podem permanecer em inglês quando
    isso preservar convenções técnicas ou interoperabilidade.
