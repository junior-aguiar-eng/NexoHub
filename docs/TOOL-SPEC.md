# Especificação de ferramentas

Toda ferramenta será declarada no Tool Registry por manifesto versionado. O contrato mínimo futuro
deve identificar:

```typescript
interface ToolManifest {
  id: string;
  version: string;
  name: string;
  category: string;
  surfaces: Array<"quick" | "studio">;
  accepts: string[];
  produces: string[];
  capabilities: string[];
  executor: "browser" | "native" | "python";
}
```

Regras: UI chama Tool Runner, nunca engines; inputs e parâmetros são validados; operações longas
são canceláveis; sucesso produz novos artifacts e relações input/output; falhas têm códigos
estruturados; Quick e Studio reutilizam o mesmo executor; indisponibilidade é consultada pela
Capability Layer antes da execução.

Esta fundação não registra ferramentas nem implementa comportamento documental.
