# ADR-006: Capability Layer

- **Status:** aceito
- **Contexto:** navegador e desktop oferecem engines e permissões diferentes.
- **Decisão:** componentes consultam capacidades abstratas e a plataforma escolhe o adapter.
- **Consequências:** não há detecção de sistema operacional na UI; indisponibilidade é antecipada e
  explicada.
