# Editor PDF — capacidade real e referência de edição avançada

**Data:** 24/10/2026. **Estado:** diagnóstico de código e documentação pública; não é implementação.
**Checkout:** worktree `nexohub-editor-compatibilidade`, branch `fix/auditoria-website`, HEAD `23df4cc`.
O diagnóstico não pressupõe que alterações locais tenham sido publicadas.

## Fontes e alcance

- NexoHub: `pdf-editor-types.ts`, `PdfEditorPanel.tsx`, `pdf-editor-engine.ts` e
  [EDITAR-PDF-WEB.md](EDITAR-PDF-WEB.md). O contrato distingue substituições do conteúdo existente
  de elementos adicionados. Foram lidos contratos, comandos e validações; não foi feita uma nova
  homologação completa de exportação nesta análise.
- Referência indicada pelo usuário: [Editar PDF do iLovePDF](https://www.ilovepdf.com/pt/editar-pdf).
- O fornecedor descreve sua ampliação em
  [Meet the new advanced PDF editor](https://www.ilovepdf.com/blog/new-advanced-pdf-editing-ilovepdf),
  publicado em 27/02/2026. Esses recursos são **declarados pelo fornecedor**; não foram certificados
  por testes nossos com PDFs reais, conta Premium ou matriz de navegadores.
- As capturas enviadas demonstram a organização visual e os controles apresentados. Não provam
  fidelidade de exportação, cobertura de fontes nem equivalência entre motores.

## O que é limitação da maquete

A maquete é um estudo de layout estático com troca entre exemplos. Não abre, edita ou exporta PDFs;
os botões de operação estão desabilitados. Não usa o motor real do editor e não demonstra a sua
capacidade. O seletor de exemplos é exclusivo desse arquivo, não uma futura função de produto.
Logo e marca devem vir dos componentes originais; não são objeto de redesign.

## O que é limitação do código atual

| Capacidade | NexoHub observado no código | Referência pública / consequência |
| --- | --- | --- |
| Substituir ou excluir texto existente | Implementado para objetos reconhecidos como compatíveis, com verificação independente da saída | A página de referência também anuncia edição direta de conteúdo existente |
| Mover texto já existente | O contrato `EditorReplacement` não tem posição; movimentação é oferecida aos elementos adicionados | A página do fornecedor anuncia mover texto existente; há lacuna funcional |
| Estilizar texto existente | Tamanho e fonte alternativa limitada; sem parâmetros de cor, alinhamento ou formatação por trecho na substituição | O fornecedor declara fonte, tamanho, cor, formatação e links; cobertura atual menor |
| Texto novo, imagens, formas e desenho | Implementados; elementos novos podem ser movidos, redimensionados e ordenados | Existe sobreposição de funcionalidades, sem demonstrar equivalência de qualidade |
| Imagens já presentes no original | Não expostas como elementos editáveis no contrato da revisão | Edição/manipulação de conteúdo original precisa de investigação e implementação próprias |
| Criar campos interativos | Não implementado no editor; preencher campos existentes é outra ferramenta | O fornecedor declara criação de campos de texto, checkbox, rádio, lista e assinatura |
| Links, bookmarks e anexos internos | Sem comandos no editor atual | Recursos declarados no editor avançado da referência |
| Anotações PDF estruturadas | Há formas/desenho no conteúdo da página, não um modelo completo de comentários e marcações nativas | O fornecedor descreve várias modalidades de anotação; desenho visual não comprova equivalência |
| Revisar propriedades de certificados | Sem capacidade no editor atual | Recurso anunciado pelo fornecedor; não confundir com assinatura gráfica |
| Redistribuir parágrafos, colunas e páginas | Não implementado; substituição deve caber na caixa original e não aceita nova linha | Não presumir reflow geral na referência: o próprio fornecedor distingue edição pontual de reestruturação extensa |

O texto original só é editável dentro do perfil seguro reconhecido. Objetos inclinados ou com
recorte/modos incompatíveis podem ficar somente para leitura. Fontes incorporadas usam repertório
observado; novo glifo pode exigir uma fonte alternativa. Digitalizações e texto em curvas não
recebem OCR/reconstrução automática. Limites atuais: 20 MiB, 30 páginas e 3.000 objetos.

**Conclusão técnica:** nosso editor faz edição real, mas tem escopo conservador e menor que o
conjunto avançado anunciado pela referência. ED-C1/ED-C2 validaram esse escopo e seu desempenho;
não foram uma entrega de paridade funcional com iLovePDF. Um shell visual melhor não muda isso.

## Duas frentes separadas

**Direção comercial proposta em 25/10/2026:** conservar todos os recursos atuais gratuitos e
avaliar capacidades novas de edição avançada para uma oferta paga. O editor atual não passa
a exigir pagamento. O escopo do módulo futuro e o modelo de cobrança ainda não estão definidos;
a hipótese não autoriza instalar autenticação, pagamentos ou bloqueios de acesso.

1. **Organização visual:** implementar apenas depois de aprovada a proposta de mesas, preservando
   a identidade do NexoHub e as ferramentas independentes. Não acrescentar botões de recursos
   ausentes como se fossem implementados.
2. **Evolução do editor:** definir os recursos prioritários, verificar suporte/licenças do motor e
   produzir plano próprio. Mover/estilizar conteúdo original, maior cobertura de fontes, anotações
   estruturadas e criação de campos são trabalhos de domínio e exportação, não ajustes de CSS.

Para cada capacidade futura, exigir prova técnica local com entrada conhecida, original imutável,
reabertura independente, verificação textual/visual da saída, histórico e cancelamento. Só então
habilitar seus controles. Esta análise não autoriza instalar SDKs, mudar motores, reunir ferramentas,
criar serviço/upload externo ou executar commit, push e deploy.
