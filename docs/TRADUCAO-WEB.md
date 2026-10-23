# Tradução no website

O website mantém o modelo `Xenova/nllb-200-distilled-600M` em q8 com Transformers.js.
O conteúdo é traduzido no navegador; o executor web não tenta `translate_text` no backend
antes de iniciar o motor local. O caminho nativo permanece separado.

## Carregamento e execução

- O motor e a inferência executam em um worker dedicado, carregado sob demanda.
- Um worker atende uma tradução por vez e reutiliza o modelo após sucesso.
- O primeiro uso pode exigir download grande dos recursos do modelo. O cache do navegador
  é reutilizado quando disponível; sua permanência depende do navegador.
- A disponibilidade de WebGPU é verificada antes da inicialização. Sem adaptador, usa WASM.
  Falhas de rede não disparam uma segunda tentativa com outro dispositivo.
- O progresso separa download, inicialização e tradução. Os bytes agregam os arquivos observados;
  o percentual reserva espaço para os pesos, sem tratar o tokenizer como download completo.
- Downloads sem receber dados por 60 segundos falham com mensagem recuperável. Cada bloco recebido
  renova o prazo, permitindo conexões lentas que continuam transferindo dados.
- Cancelar encerra o worker ativo, inclusive durante download ou inferência. Uma nova tentativa
  cria outro worker. Alterar entrada ou idiomas, trocar de ferramenta ou sair da tela também
  invalida o trabalho anterior; resultados atrasados não substituem o texto atual.
- A exportação `.txt` usa o texto traduzido atualmente exibido, incluindo edições do usuário.

## Validação e limites

Testes unitários cobrem fila, cancelamento, descarte de mensagens antigas, timeout de rede,
progresso, fallback de dispositivo e reinicialização após falhas. Os testes de navegador usam
o worker real com requisições de modelo interrompidas ou retidas para verificar responsividade,
cancelamento e nova tentativa sem baixar pesos.

Esta validação não mede velocidade de inferência neural, qualidade semântica ou consumo real de
memória do modelo. Isolar o carregamento mantém a interface responsiva, mas não elimina o custo
do primeiro download nem o tempo de inicialização em dispositivos com poucos recursos.
