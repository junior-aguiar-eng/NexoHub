# ADR-017: Resumo documental e PDF Intelligence estritamente local

- **Status:** Proposto
- **Contexto:**
  O catálogo visual do NexoHub prevê a ferramenta **Resumir com IA** (`pdf-summarize`) na seção de PDF Intelligence.
  Entretanto, a promessa central do NexoHub é:
  > *"Privacidade total: Seus arquivos nunca saem deste dispositivo."*
  
  A maioria das ferramentas de "Chat com PDF" ou "Resumir PDF" do mercado envia os arquivos de texto para APIs proprietárias em nuvem (OpenAI, Anthropic, Google). A Regra 3 das Regras de Engenharia do NexoHub (`AGENTS.md`) proíbe explicitamente backends remotos, microsserviços ou uploads externos sem decisão arquitetural explícita.
  Qualquer envio de texto de documentos de clientes para provedores terceiros comprometeria a garantia de segurança e sigilo profissional essencial ao projeto.

- **Alternativas Avaliadas:**
  1. **Integração com API Cloud Externa (ex: Gemini API / OpenAI):**
     - *Vantagens:* Qualidade linguística elevada e sem consumo de recursos da máquina cliente.
     - *Desvantagens:* **Violação direta da garantia de privacidade local-first.** Exige chaves de API, cobrança ou infraestrutura em nuvem, transformando o produto em intermediário de dados sensíveis. Rejeitada.
  2. **Modelos de Linguagem Locais Pequenos (SLM) via WebGPU / ONNX Runtime:**
     - *Vantagens:* 100% de privacidade garantida; execução no hardware do usuário (NPU, GPU ou CPU via WebAssembly com threads SIMD); alinhado ao modelo adotado com sucesso na tradução offline (Transformers.js).
     - *Desvantagens:* Exige download de pesos quantizados (Q4_K_M ou INT4, entre 1 GB e 2 GB, ex: SmolLM2 1.7B, Gemma-2 2B ou Phi-3.5 Mini) e suporte de hardware compatível.

- **Decisão Proposta:**
  1. A ferramenta **Resumir com IA** será implementada **exclusivamente via inferência local** no dispositivo, sem qualquer chamada remota.
  2. A ferramenta permanece pendente no catálogo até a criação do runner de SLMs locais locais via WebGPU e superpoder desktop sob demanda (similar aos modelos NLLB de tradução).
  3. A interface deve informar com transparência o tamanho do download do modelo local antes de iniciar o primeiro uso e garantir cancelamento e liberação de memória em caso de desistência.

- **Consequências:**
  - Garantia inegociável de que dados de processos, contratos e demonstrativos financeiros nunca saem da máquina do usuário.
  - O produto não assume custos de hospedagem de IA nem expõe o usuário a paywalls ou termos de serviço de terceiros.
