# Tradução no website

O perfil browser é `Xenova/m2m100_418M` q8, revisão
`9c374f0b7aca709787cea97b047bfbbd1559d177`, para pt/en/es, com Transformers.js e WASM.
O conteúdo é processado em worker no navegador. Não há upload do texto ao Hugging Face:
a rede fornece somente arquivos do motor/modelo. O caminho nativo do ADR-011 permanece separado.

## Licenças e proveniência

O [modelo-base Facebook M2M100](https://huggingface.co/facebook/m2m100_418M/blob/55c2e61bbf05dfb8d7abccdc3fae6fc8512fd636/README.md)
declara MIT. A [conversão Xenova](https://huggingface.co/Xenova/m2m100_418M/blob/9c374f0b7aca709787cea97b047bfbbd1559d177/README.md)
identifica esse modelo-base, mas não declara uma licença própria. A seleção utiliza a licença
permissiva do modelo original e sua proveniência; não atribui MIT ao exportador por ausência de
metadados. Preserve a atribuição e o texto MIT em redistribuições. Não há pesos no Git ou pacote.

O [NLLB original](https://huggingface.co/facebook/nllb-200-distilled-600M/blob/f8d333a098d19b4fd9a8b18f94170487ad3f821d/README.md)
e sua [conversão ONNX](https://huggingface.co/Xenova/nllb-200-distilled-600M/blob/261c31d1a5732c67cdd16d80e8d6088507c7ccea/README.md)
declaram CC-BY-NC-4.0. Foram excluídos da seleção comercial; nenhum peso NLLB foi baixado no TR-C1.
A licença do Transformers.js é independente e não altera a licença dos pesos.
Fontes, revisões e comparação estão em [TR-C1](TR-C1-VALIDACAO.md) e
[manifesto de fontes](evidencias/tr-c1/modelos.json).

## Carregamento e execução

- Um worker atende uma tradução por vez e reutiliza o modelo após sucesso. O perfil medido usa
  WASM; WebGPU não é selecionado por mera detecção de adaptador e precisa de ensaio próprio.
- Os pesos somam 631.984.548 bytes, aproximadamente 603 MiB, além de tokenizer e runtime.
  O primeiro uso precisa de rede. CacheStorage é oportunista: quota, modo privado e política do
  navegador podem impedir persistência. A interface não promete disponibilidade offline universal.
- A revisão fixa alcança pesos e os dois JSONs do tokenizer. O carregador explícito evita a
  descoberta em `main` do AutoTokenizer 4.x, que falhava offline mesmo com recursos fixados no cache.
- O progresso separa download, inicialização e tradução. Bytes agregam arquivos observados;
  o percentual reserva espaço para os dois pesos. JSONs não representam download concluído.
- Downloads sem receber dados por 60 segundos falham com mensagem recuperável. Cada bloco
  renova o prazo. Falhas de rede liberam nova tentativa sem trocar dispositivo automaticamente.
- Cancelar encerra o worker, inclusive durante download ou inferência. Alterar entrada/idiomas,
  trocar de ferramenta ou sair da tela invalida a operação; mensagens antigas são descartadas.
  O runtime também rejeita cancelamento ocorrido durante a última inferência.
- Cada sentença recebe inferência separada, preservando espaços, quebras, URLs, e-mails e
  placeholders literalmente. Sentenças maiores que 400 caracteres ainda são divididas em palavras.
  A segmentação reduz contexto entre frases; não garante completude semântica.
- Identidade (idioma igual, entrada vazia ou apenas literais) retorna motor `identity`, sem carregar
  modelo. Tradução efetiva retorna `transformers.js-m2m100`.
- A exportação `.txt` usa o texto atualmente exibido, inclusive edições do usuário.

## Qualidade e limites

O ensaio real comparou M2M100 e dois OPUS-MT ONNX no mesmo corpus autoral pt/en/es. O M2M100
alterou nomes próprios e, na segmentação anterior por parágrafo, omitiu sentenças. A repetição
com segmentação por sentença e os resultados completos constam do relatório TR-C1. Não há
certificação de fidelidade para documentos jurídicos. Em 29/10/2026, o usuário aprovou 30 comparações do corpus em [revisão documentada](INVESTIGACAO-OCR-TRADUCAO-2026-10-29.md); nomes literais continuaram alterados em cinco desses casos. A aprovação não assegura fidelidade fora dessa amostra nem equivale a certificação jurídica.
A mesa informa somente que é necessário fazer um download no primeiro uso. Modelo, licença,
memória, cache e limites de qualidade ficam na documentação técnica, conforme orientação do usuário.
O original deve ser consultado antes de usar ou exportar a tradução.

Testes unitários cobrem cache fixado, fila, cancelamento tardio, descarte de mensagens antigas,
timeout e progresso. E2E com rede retida/interrompida verificam a interface, não qualidade neural.
O ensaio de cache usou pesos reais, SHA-256 e bloqueio do Hugging Face em worker novo.
Máquinas de baixa RAM, outros navegadores e WebGPU permanecem fora da homologação desse ensaio. A execução no aplicativo Windows 0.2.3 foi posteriormente validada nos casos descritos em [Validação de release](RELEASE-VALIDATION.md).


## Nomes informados pelo usuário — 29/10/2026

O motor browser aceita uma lista explícita em “Nomes a preservar”, um nome por linha. A correspondência considera maiúsculas, acentos e espaços, com limites de palavra Unicode; nomes sobrepostos priorizam o mais longo. Os trechos correspondentes são copiados literalmente e não são enviados ao modelo. Nomes ausentes da lista não recebem essa garantia. O mesmo nome repetido é preservado em cada ocorrência. O texto ao redor é traduzido em segmentos menores, o que pode reduzir contexto e exige revisão. Alterar a lista cancela a tradução corrente e invalida o resultado anterior. O campo é exibido para o motor browser, utilizado pelo aplicativo Windows distribuído; o caminho nativo CTranslate2 é separado. O campo integra a release Windows 0.2.3 e o website publicado. A versão instalada foi verificada com tradução real e nome preservado.


## Cache depois de reiniciar o Windows app

O ensaio de 29/10/2026 no aplicativo instalado 0.2.2 confirmou reutilização dos recursos em três processos do mesmo perfil: primeira carga com rede, reabertura com zero requisições ao modelo e outra reabertura com WebView2 offline, também sem requisições ao modelo. A tradução efetiva terminou nas três fases. Método e limitações estão em [Persistência da tradução no Windows](TRADUCAO-CACHE-WINDOWS-2026-10-29.md). Limpeza do cache, troca de perfil ou revisão do modelo podem exigir novo download.


A validação posterior da 0.2.3 também executou tradução com nome preservado após reiniciar o processo, com WebView2 offline e zero requisições ao modelo. O resultado e as limitações constam da [evidência da release](evidencias/releases/windows-0.2.3.json). Isso complementa, sem substituir, o ensaio histórico da 0.2.2.
