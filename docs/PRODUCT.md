# Produto

O NexoHub é uma estação documental open source, local-first, Windows-first e com client web
suportado. Um documento entra uma vez e pode atravessar criação, importação, leitura,
transformação, revisão e exportação sem reenvio ou reprocessamento desnecessário.

## Plataformas

- **Windows desktop:** alvo produtivo atual. O aplicativo usa Tauri, Rust e WebView2 e recebe os
  gates nativos de desenvolvimento, teste e build.
- **Web:** alvo suportado pelo mesmo client React/TypeScript, limitado às capacidades disponíveis
  no navegador.
- **Linux, Android e iOS:** alvos congelados por prazo indeterminado. Não recebem desenvolvimento,
  validação, release, prazo, marco nem promessa de compatibilidade.
- **Demais sistemas nativos:** congelados por prazo indeterminado e fora do produto, da matriz de
  validação e do roadmap.

O congelamento não remove a estrutura multiplataforma do Tauri, mas sua preservação representa
somente possibilidade técnica: não expressa intenção, promessa, planejamento ou obrigação de
suporte. Qualquer avaliação de outro sistema dependerá de decisão futura, discricionária e expressa
do mantenedor, sem condicionar o desenvolvimento Windows.

## Superfícies

- **Launcher:** entrada orientada à tarefa, com Quick Tools reais e acesso a projetos.
- **Studio:** workspace orientado ao documento, com árvore, abas, viewer, inspector, Nexo Layers e
  NexoFlow.

## Garantias do produto

- originals são imutáveis;
- transformações geram artifacts derivados rastreáveis;
- funções locais permanecem disponíveis offline;
- upload externo exige ação explícita;
- Quick Tools e Studio compartilham domínio e executores;
- indisponibilidade deve ser explícita, nunca simulada.

Contas, billing, cloud obrigatória, colaboração simultânea, marketplace, funcionalidades mobile,
LLM obrigatório, RAG e recursos jurídicos estão fora do escopo anterior ao 1.0.

## Idioma

O idioma canônico do NexoHub é português brasileiro (`pt-BR`). Documentação, decisões
arquiteturais, mensagens e experiência inicial são concebidas em pt-BR. Outros idiomas serão
adicionados por catálogos de internacionalização versionados, sem duplicar componentes ou criar
fluxos funcionais divergentes.
