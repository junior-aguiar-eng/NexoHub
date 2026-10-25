# Padrão de mesas de ferramentas — proposta separada

**Estado:** direção visual confirmada pelo usuário em 25/10/2026; não implementada no produto.
Os detalhes de migração e seu plano de execução continuam pendentes.
**Origem:** observação do usuário em 24/10/2026 sobre o aproveitamento da janela e a consistência
das mesas do iLovePDF. O usuário escolheu definir um padrão global em etapa separada do CMP-C1.
**Referência:** organização espacial das capturas fornecidas; não copiar marca, ícones ou prometer
funcionalidades do concorrente. Preservar identidade, cores, tipografia e arquitetura do NexoHub.
**Exemplo navegável:** [Mesa proposta](../mockups/2026-10-24-mesa-ferramentas.html).
O exemplo é uma simulação visual, sem processamento, arquivos reais ou exportação.

## Correções de escopo confirmadas pelo usuário

- **Identidade original obrigatória:** preservar o logo existente (`NexoHubLogoIcon`), o nome,
  a marca, as cores por zona, a tipografia, o catálogo e o caráter visual do site. Não redesenhar
  ou substituir a marca. O primeiro mockup omitiu o ícone e simplificou o wordmark indevidamente;
  isso não representa uma proposta de mudança da identidade.
- **Mesas independentes:** cada ferramenta mantém sua rota, entrada, estado, opções e operação.
  `/editar-pdf` e `/comparar-pdf`, por exemplo, continuam ferramentas distintas. O seletor de
  exemplos existe somente para demonstrar as famílias num único arquivo, fora do cabeçalho
  simulado do produto. Ele não será incorporado ao site como uma mesa universal.
- **Padrão compartilhado de organização:** compartilhar posições e componentes de apresentação
  não significa reunir funções e motores numa ferramenta só.
- **Capacidade separada da aparência:** botões e controles desenhados na maquete são ilustrativos.
  Não comprovam recursos no motor. A adoção do layout não encerra as lacunas de edição avançada.
  O [diagnóstico do editor](../../EDITOR-PDF-CAPACIDADES-2026-10-24.md) registra o que existe,
  o que é limitado e o que precisa de desenvolvimento próprio.

## Problema observado

Com arquivo carregado, títulos promocionais, grandes seletores, margens e várias barras verticais
continuam ocupando o fluxo. A página cresce; documento, opções e ação principal se separam.
Altura maior do canvas isolado não resolve: é o conjunto da mesa que deve caber na janela.
O comparador atual exemplifica o problema, mas a correção proposta é transversal.

## Regra principal

**O aplicativo não rola como página durante o trabalho. Documento e listas rolam dentro de seus
painéis; ferramentas e ação principal permanecem visíveis.**

Em 25/10/2026 o usuário confirmou essa mesa moderna como o modelo pretendido para as ferramentas.
Não basta aproximar as cores ou aumentar o canvas: identificar e acionar ferramentas não deve
depender de percorrer uma página longa. A direção mantém as restrições de identidade e de mesas
independentes descritas acima.

- Um shell de trabalho ocupa a altura útil da janela (`100dvh`, com fallback adequado).
- Cabeçalho global compacto, barra contextual única e área restante flexível (`min-height: 0`).
- Cabeçalho promocional, rodapé institucional e upload de grandes dimensões saem da mesa ativa.
  A seleção inicial pode ser acolhedora, mas a transição ao trabalho deve ocupar a janela.
- Uma ação principal fixa no rodapé do painel de opções; rótulo descreve a operação/saída.
- Nada fica escondido sob barras flutuantes sobre o documento por padrão.
- Opções extensas usam grupos/abas e rolagem interna; não exigem descer a página para reencontrar
  o botão principal. Acessibilidade e legibilidade prevalecem sobre comprimir todos os campos.

## Geometria proposta no desktop

| Região | Regra proposta | Papel |
| --- | --- | --- |
| Cabeçalho global | 56–64 px; uma linha | Marca, voltar/trocar ferramenta e navegação discreta |
| Barra contextual | 48–56 px; uma região | Comandos da ferramenta e estado do documento |
| Navegação lateral esquerda | 120–180 px, recolhível e opcional | Páginas, arquivos ou camadas |
| Documento/mesa central | Todo o espaço restante; maior prioridade de área | PDF, imagem, texto ou grade |
| Painel de opções à direita | 300–340 px; pode ser recolhido | Parâmetros da ferramenta e revisão |
| Rodapé do painel de opções | 76–88 px dentro do painel | Estado relevante e ação principal |

As medidas são proposta de design, não tokens aprovados nem valores aplicados ao produto.
Na janela 1366×768, a meta é ao menos 600 px úteis de documento, sem rolagem do body.
Não tornar os dois documentos minúsculos para manter três colunas de controles.

## Uma estrutura, quatro famílias

| Família e exemplos existentes | Centro | Esquerda | Direita |
| --- | --- | --- | --- |
| PDF/imagem individual: editar, recortar, assinar, ocultar, formulário | Documento predominante | Miniaturas opcionais | Propriedades contextuais da seleção |
| Comparação | Dois documentos ou dois textos alinhados | Omitida por padrão | Modos, busca, alterações e relatório |
| Páginas/lotes: organizar, juntar, dividir, converter/comprimir imagens | Grade ou prévia ativa | Arquivos/páginas quando útil | Opções do lote e resumo real da saída |
| Texto/conversão: OCR, revisão, tradução, Markdown/Excel/HTML | Texto, tabela ou prévia pertinente | Entrada/seções opcionais | Opções, progresso e saída |

Consistência é conservar posições, foco e comportamento; não obrigar um corretor textual a imitar
um editor PDF. Nem toda ferramenta precisa de três colunas, miniaturas ou uma prévia fictícia.

## Estado e comportamento

1. **Entrada:** seleção/arraste integrado à área útil. Em comparação, cada lado pode receber seu
   arquivo sem bloquear a visualização do outro. Tipo, limite e erro ficam junto da entrada.
2. **Trabalho:** nome e troca do arquivo ficam compactos. Comandos, zoom e navegação têm uma
   posição estável. Propriedades dependem da seleção; não há dois controles da mesma função.
3. **Processamento:** progresso e cancelamento permanecem visíveis; documento e opções não saltam
   de lugar. Não apresentar exportação anterior como se fosse o novo resultado.
4. **Revisão/resultado:** prévia corresponde à saída; baixar permanece visível. Trocar arquivo ou
   sair continua respeitando o controle de alterações pendentes e cancelamento dos workers.
5. **Erro:** explicação junto do contexto, sem ocupar a mesa inteira nem destruir o estado válido.

Zoom/navegação podem ficar numa barra inferior **dentro da região do documento**, com altura
reservada, sem cobrir texto. No comparador, um controle do par preserva a semântica dos dois lados.

## Tablet, celular, teclado e temas

- 1024 px: recolher miniaturas antes de reduzir o documento; opções podem virar painel alternável.
- 390/768 px: abas Documento/Opções com altura limitada à janela; ação principal continua acessível.
  Comparação permite alternar original/revisado ou sobreposição, sem miniaturas ilegíveis lado a lado.
- Em pouca altura ou zoom de acessibilidade, cada painel pode rolar internamente. Nenhum controle
  deve se tornar inalcançável por `overflow:hidden` nem exigir redução do texto para caber.
- Tab, Shift+Tab, Escape e foco após navegação previsíveis; nome acessível em botões de ícone.
- Alvos de pelo menos 44 px, contraste AA e movimento reduzido. Corrigir os problemas existentes
  de contraste ao migrar o shell; não perpetuar título escuro sobre fundo escuro.
- Preservar tema claro/escuro usando os tokens do produto e contrastes próprios de cada superfície.

## Integração e fronteiras

Reaproveitar `DedicatedToolView`, os painéis, Tool Registry, executores, ports e mecanismos de
cancelamento. Um shell visual compartilhado deve receber slots para barra, navegação, conteúdo,
opções e ação; não deve conhecer PDF.js, Canvas, filesystem, SQLite, workers ou regras de domínio.
Os painéis continuam donos de seu estado e de suas revisões, evitando uma refatoração ampla do motor.
Não modificar catálogo, landing page, pipeline documental, dependências ou distribuição desktop
por consequência automática dessa mudança visual. Novos textos de produto passam pelo catálogo pt-BR.

## Gratuidade e possibilidade de edição avançada paga

Em 25/10/2026 o usuário propôs manter **todos os recursos já implementados gratuitos** e avaliar
um futuro editor avançado para usuários pagos. Essa hipótese comercial não altera a gratuidade
das capacidades atuais nem transforma a modernização das mesas em recurso pago.

O editor atual, inclusive suas substituições reais de texto, adições, histórico e demais recursos
já entregues, permanece na oferta gratuita. Uma eventual oferta paga deve acrescentar capacidades
novas, com escopo definido a partir do diagnóstico do editor, sem reclassificar recursos existentes.

O padrão de mesa é comum às ferramentas gratuitas e a qualquer módulo avançado futuro; cada uma
continua independente. A definição de novas capacidades, preços, autenticação, direitos de acesso,
licenciamento e cobrança exige decisões próprias. Não foi autorizada nem implementada uma camada
de pagamentos ou um bloqueio de recursos nesta etapa.

## Aceite proposto para futura implementação

- Com arquivos carregados, `scrollHeight` do body não excede a altura útil nas larguras-alvo.
- Cabeçalho, comandos e ação principal mantêm posição durante rolagem do documento e das opções.
- Seleção da página/par, zoom, sincronização e opções sobrevivem às transições pertinentes.
- Nenhum overflow horizontal da janela, texto sobreposto, controle coberto ou foco perdido.
- Exportações preservam o comportamento atual e correspondem à revisão mostrada.
- Cancelar, substituir e sair encerram processamento e descartam respostas atrasadas.
- Conferir 1366×768, 1440×900, 1024×768, 768 e 390 px, teclado, temas e movimento reduzido;
  acrescentar zoom do navegador de 200% e janelas de pouca altura.

## Implantação proposta, sujeita a aprovação

1. Elaborar o plano canônico de implementação a partir da direção visual já confirmada; conferir
   os detalhes de migração antes de alterar o produto.
2. Implementar o shell compartilhado e migrar **Comparar PDF** como piloto, sem mudar o motor.
3. Migrar editor PDF e uma ferramenta simples de PDF, verificando contratos e regressões.
4. Migrar lotes/imagens e ferramentas textuais por família, com paridade funcional por ferramenta.
5. Remover estilos duplicados apenas nos módulos migrados; encerrar após a matriz de aceite.

Esta definição não autoriza implementação global, commit, push, merge ou deploy. O CMP-C1 continua
com sua validação própria e não será apresentado como adoção deste novo shell.

**Autorização posterior — 25/10/2026:** o usuário autorizou a refatoração visual das mesas,
preservando o roteiro funcional e adiando edição avançada e cobrança. A execução e suas
evidências estão no [plano das mesas](../plans/2026-10-25-refatorar-mesas.md), sem autorização
de commit, push, merge ou deploy.
