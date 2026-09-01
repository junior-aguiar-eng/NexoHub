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
