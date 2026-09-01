# ADR-002: Monólito modular

- **Status:** aceito
- **Contexto:** o produto precisa crescer sem custo operacional de arquitetura distribuída.
- **Decisão:** usar monólito modular com ports and adapters e módulos verticais.
- **Consequências:** limites internos são explícitos; microserviços, servidor central e mensageria
  distribuída não fazem parte do MVP.
