# ADR-007: Modelo de sidecars

- **Status:** aceito
- **Contexto:** algumas engines documentais são externas ao processo Rust.
- **Decisão:** executar apenas sidecars permitidos, com argumentos validados e JSON Lines ou
  JSON-RPC por stdin/stdout; não criar servidor HTTP local.
- **Consequências:** frontend não recebe shell genérico; processo, progresso, cancelamento e falhas
  pertencem ao core nativo.
