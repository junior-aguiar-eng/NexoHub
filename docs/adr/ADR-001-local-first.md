# ADR-001: Local-first

- **Status:** aceito
- **Contexto:** documentos podem ser sensíveis e funções essenciais não devem depender de rede.
- **Decisão:** processamento e persistência essenciais executam localmente; tráfego externo exige
  ação explícita e indicação clara.
- **Consequências:** adapters cloud são opcionais; funcionamento offline e privacidade integram os
  critérios de aceite.
