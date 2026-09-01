# ADR-009: Idioma canônico e internacionalização

- **Status:** aceito
- **Contexto:** o NexoHub nasce para usuários de português brasileiro, mas deve admitir outros
  idiomas sem fragmentar arquitetura, componentes ou comportamento.
- **Decisão:** adotar `pt-BR` como idioma canônico do produto, documentação, ADRs e interface. Textos
  de UI serão resolvidos por chaves e catálogos versionados; traduções adicionais implementarão o
  mesmo contrato. Identificadores técnicos podem permanecer em inglês quando exigidos por convenção
  ou interoperabilidade.
- **Consequências:** componentes não conterão novos textos localizáveis hardcoded; ausência de uma
  tradução recorrerá explicitamente ao catálogo `pt-BR`; internacionalização não traduz nem envia
  documentos do usuário e não cria domínios funcionais paralelos.
