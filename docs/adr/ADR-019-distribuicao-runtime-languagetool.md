# ADR-019: Separar instalação e redistribuição do LanguageTool

- **Status:** opção de instalação separada autorizada explicitamente pelo usuário em
  27/10/2026; implementada e validada em Sandbox.
- **Contexto:** o runtime completo está instalado e validado localmente sob ADR-018.
  Fontes e receitas históricas de alguns dados continuam incompletas. A issue upstream
  #12247 está aberta. A reconstrução lexical POS bretã foi demonstrada, mas isso não
  resolve os outros idiomas nem autoriza redistribuição integral por analogia.

## Decisão implementada

O instalador NexoHub deixa de incorporar os binários LanguageTool/Java. Uma tarefa
opcional e explícita do instalador baixa os mesmos arquivos dos fornecedores oficiais,
confere os tamanhos/hashes fixados e instala o runtime localmente. O revisor continua
usando o mesmo executor, protocolo, snapshot e JRE. Nenhum documento é enviado à rede.
O download de 312.224.836 bytes é necessário somente para a instalação inicial desse
runtime; após ela, o processamento permanece local. Sem essa tarefa, o revisor nativo
fica indisponível até instalar o runtime. A instalação local existente é preservada.

Isso retira os binários desse runtime dos artefatos redistribuídos pelo NexoHub; não
constitui declaração de conformidade sobre a distribuição dos fornecedores, nem elimina
a necessidade de avisos/licenças daquilo que o NexoHub efetivamente distribui. A pesquisa
de fontes do pacote completo continua registrada separadamente, sem simular conclusão.

## Arquivos e comportamento validados

- `installer/nexohub.iss`: exclusão específica do runtime LanguageTool, tarefa opcional
  de instalação e indicação do download. Falha da tarefa não pode aparentar sucesso
  do runtime. Sem duplicar registro, atalho ou substituir uma instalação íntegra.
- `scripts/empacotar-inno.mjs` e pipeline de release: impedir incorporação acidental
  desse runtime nos artefatos finais, ainda que ele exista no diretório de build local.
- `scripts/install-languagetool.ps1`, manifesto e recursos de instalação: usar o mesmo
  fluxo de validação, com caminhos apropriados ao aplicativo instalado e download
  compatível com o Windows limpo. Arquivos incompletos ficam fora do destino final.
- Catálogo pt-BR e textos do instalador: explicar escolha, bytes e requisito de rede.
- Testes de pacote, instalação limpa e atualização: conferir ausência dos binários no
  instalador, instalação opcional real por hash, recusa de corrupção/falha e revisão
  autoral instalada. O fluxo precisa ser validado em Sandbox antes de declarar concluído.

## Alternativa

Manter o pacote completo incorporado e continuar a investigação até obter os insumos,
receitas e a decisão de redistribuição. A indisponibilidade dessas provas impede fixar
prazo de fechamento desse caminho. Não modificar a composição do pacote sem decisão:
AGENTS.md exige decisão para mudança relevante de arquitetura/risco, e ADR-018 mantém
a distribuição condicionada. Nenhum push, deploy ou release é autorizado por este ADR.

Evidência: [Instalação opcional do revisor](../quality/INSTALACAO-OPCIONAL-REVISOR.md).
