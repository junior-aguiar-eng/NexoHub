import { describe, expect, it } from "vitest";
import { DomainError, NexoFlow, promoteQuickTool } from "./index";

describe("NexoFlow", () => {
  it("promove uma Quick Tool para um rascunho reutilizável no Studio", () => {
    const flow = promoteQuickTool("pdf-compress");
    expect(flow.snapshot.source).toBe("QUICK");
    expect(flow.snapshot.status).toBe("DRAFT");
    expect(flow.snapshot.steps[0]?.toolId).toBe("pdf-compress");
    expect(Object.isFrozen(flow.snapshot.steps)).toBe(true);
  });

  it("aceita dependências anteriores e rejeita referências quebradas", () => {
    const flow = promoteQuickTool("pdf-organize").withStep({
      id: "step-2",
      toolId: "pdf-compress",
      status: "PENDING",
      parameters: {},
      dependsOn: ["step-1"],
    });
    expect(flow.snapshot.steps).toHaveLength(2);
    expect(
      () =>
        new NexoFlow({
          id: "invalid",
          source: "STUDIO",
          status: "DRAFT",
          steps: [
            {
              id: "step-2",
              toolId: "pdf-compress",
              status: "PENDING",
              parameters: {},
              dependsOn: ["missing"],
            },
          ],
        }),
    ).toThrow(DomainError);
  });
});
