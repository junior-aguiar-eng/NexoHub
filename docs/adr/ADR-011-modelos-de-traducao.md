# ADR-011: Modelos locais de tradução

- **Status:** aceito
- **Contexto:** tradução offline precisa atender máquinas comuns e estações com mais memória sem
  incluir pesos volumosos no repositório ou ocultar licenças de modelos.
- **Decisão:** oferecer MADLAD-400-3B-MT quantizado em INT8 como perfil avançado opcional e OPUS-MT
  TC Big como perfil leve. Modelos são instalados separadamente sob a raiz controlada pelo runtime.
  Cada instalação declara idiomas, licença, artifact, SHA-256 e tokenizer em
  `nexohub-model.json`. O adapter aceita SentencePiece compartilhado no padrão T5 e pares
  SentencePiece. Nenhum peso é versionado no Git.
- **Consequências:** o runtime verifica integridade, compatibilidade linguística e licença antes da
  inferência. MADLAD recebe o prefixo de destino e EOS exigidos pelo padrão T5; modelos OPUS-MT
  podem declarar prefixos específicos. Ausência de modelo mantém a ferramenta indisponível sem
  fallback de rede.


## Complemento TR-C1 — navegador (26/10/2026)

O perfil web usa M2M100 418M q8 em WASM, revisão imutável, em worker dedicado.
A escolha não altera os perfis nativos acima. NLLB foi excluído do perfil web por
CC-BY-NC-4.0. O modelo-base M2M100 declara MIT; a conversão ONNX Xenova declara sua origem,
sem licença própria adicional. Atribuição, fontes, hashes, comparação real e limites estão em
[TRADUCAO-WEB](../TRADUCAO-WEB.md) e [TR-C1](../TR-C1-VALIDACAO.md).

OPUS-MT en-ROMANCE apresentou idioma/prefixo incorreto no runtime atual e o perfil ROMANCE-en
não cobre as seis direções. Nenhum deles foi integrado. A seleção WASM corresponde ao caminho
medido; WebGPU requer validação própria. Cache é oportunista e não garante operação offline em
qualquer navegador. Preservação de nomes e fidelidade semântica continuam exigindo revisão.
