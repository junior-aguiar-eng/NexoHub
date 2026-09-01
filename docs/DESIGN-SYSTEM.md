# Nexo Design System

O Nexo Design System define a identidade visual e os contratos de interação compartilhados pelo
Launcher e, futuramente, pelo Studio. Português brasileiro é a fonte de verdade dos textos; os
componentes consomem chaves do catálogo `pt-BR`.

## Fundamentos

- **Cor:** verde profundo como marca e ação, superfícies claras de baixo contraste e dourado apenas
  como acento editorial. Tokens escuros já existem sob `[data-theme="dark"]`.
- **Tipografia:** Plus Jakarta Sans para interface e Playfair Display para acentos editoriais. As
  fontes são empacotadas localmente, sem CDN.
- **Espaçamento:** escala de 4 a 64 px, exposta por `--space-*`.
- **Forma:** raios de 10, 16 e 24 px; o raio cápsula é reservado a navegação, botões e estados.
- **Elevação e vidro:** sombras verdes de baixa opacidade e `backdrop-filter` somente em superfícies
  que representam sobreposição ou persistência espacial.
- **Movimento:** durações rápidas e padrão; `prefers-reduced-motion` elimina deslocamentos e reduz
  transições. Motion também consulta a preferência no React.
- **Camadas:** cabeçalho e diálogos usam tokens explícitos de `z-index`.

Os tokens vivem em `apps/client/src/styles.css`. Variáveis semânticas devem ser preferidas a valores
de cor repetidos nos componentes.

## Componentes e estados

`Button` usa variantes tipadas com CVA. `CommandPalette` usa o Dialog do Base UI para foco preso,
fechamento por Escape e semântica acessível. `SuiteNavigation` implementa setas, Home e End. Cards
de ferramenta são derivados de dados tipados; enquanto não houver executor real, permanecem
informativos, com estado visível **Em breve** e sem handler de execução.

Estados obrigatórios para novos componentes interativos: padrão, hover, foco visível, ativo quando
aplicável e desabilitado. Componentes devem manter alvo mínimo próximo de 44 px, contraste legível e
nome acessível. Textos novos entram primeiro no catálogo `pt-BR`.

## Padrões do Launcher

O Launcher organiza a descoberta em: cabeçalho persistente, navegação de suítes, hero, busca local,
grade de ferramentas, continuidade e chamada do Studio. A lista atual é uma projeção de apresentação
da Fase 1; não substitui o Tool Registry previsto para a Fase 3. Projetos recentes não usam dados
fictícios e exibem estado vazio até existir persistência real.
