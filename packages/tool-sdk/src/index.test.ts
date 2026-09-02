import { describe, expect, it, vi } from "vitest";
import {
  StaticCapabilityProvider,
  type ToolExecutor,
  type ToolManifest,
  ToolRegistry,
  ToolRunner,
} from "./index";

const manifest: ToolManifest = {
  id: "pdf-organize",
  version: "1.0.0",
  name: "Organizar PDF",
  category: "pdf",
  surfaces: ["quick", "studio"],
  accepts: ["application/pdf"],
  produces: ["application/pdf"],
  capabilities: ["documents.read", "documents.write"],
  executor: "native",
};

describe("Tool Registry", () => {
  it("registra manifestos válidos e impede IDs duplicados", () => {
    const registry = new ToolRegistry();
    registry.register(manifest);
    expect(registry.list("quick")).toEqual([manifest]);
    expect(() => registry.register(manifest)).toThrow("Ferramenta já registrada");
  });

  it("rejeita manifestos sem versão semântica", () => {
    const registry = new ToolRegistry();
    expect(() => registry.register({ ...manifest, version: "1" })).toThrow("Versão inválida");
  });
});

describe("Tool Runner", () => {
  it("valida, resolve capacidade e delega ao executor declarado", async () => {
    const registry = new ToolRegistry();
    registry.register(manifest, ({ input }) => {
      if (typeof input !== "string") throw new Error("Arquivo obrigatório.");
    });
    const execute = vi.fn(async () => ({ artifacts: [{ id: "derived" }] }));
    const executor: ToolExecutor = { kind: "native", execute };
    const runner = new ToolRunner(
      registry,
      new StaticCapabilityProvider({
        "documents.read": { available: true },
        "documents.write": { available: true },
      }),
      [executor],
    );

    await expect(runner.run({ toolId: manifest.id, input: "original.pdf" })).resolves.toEqual({
      artifacts: [{ id: "derived" }],
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("bloqueia antes do executor quando falta capacidade", async () => {
    const registry = new ToolRegistry();
    registry.register(manifest);
    const execute = vi.fn(async () => ({ artifacts: [] }));
    const runner = new ToolRunner(
      registry,
      new StaticCapabilityProvider({
        "documents.read": { available: true },
        "documents.write": { available: false, reason: "Somente leitura no navegador." },
      }),
      [{ kind: "native", execute }],
    );

    await expect(runner.run({ toolId: manifest.id, input: "original.pdf" })).rejects.toMatchObject({
      code: "TOOL_UNAVAILABLE",
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("normaliza entrada inválida e cancelamento em erros estruturados", async () => {
    const registry = new ToolRegistry();
    registry.register(manifest, () => {
      throw new Error("Entrada incompatível.");
    });
    const runner = new ToolRunner(
      registry,
      new StaticCapabilityProvider({
        "documents.read": { available: true },
        "documents.write": { available: true },
      }),
      [],
    );

    await expect(runner.run({ toolId: manifest.id, input: null })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      runner.run({ toolId: manifest.id, input: "original.pdf", signal: controller.signal }),
    ).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("interrompe a espera quando uma execução ativa é cancelada", async () => {
    const registry = new ToolRegistry();
    registry.register(manifest);
    const execute = vi.fn(() => new Promise<never>(() => undefined));
    const runner = new ToolRunner(
      registry,
      new StaticCapabilityProvider({
        "documents.read": { available: true },
        "documents.write": { available: true },
      }),
      [{ kind: "native", execute }],
    );
    const controller = new AbortController();
    const running = runner.run({
      toolId: manifest.id,
      input: "original.pdf",
      signal: controller.signal,
    });

    controller.abort();

    await expect(running).rejects.toMatchObject({ code: "CANCELLED" });
  });

  it("não inicia o executor quando a validação cancela a requisição", async () => {
    const controller = new AbortController();
    const registry = new ToolRegistry();
    registry.register(manifest, () => controller.abort());
    const execute = vi.fn(async () => ({ artifacts: [{ id: "derivado-tardio" }] }));
    const runner = new ToolRunner(
      registry,
      new StaticCapabilityProvider({
        "documents.read": { available: true },
        "documents.write": { available: true },
      }),
      [{ kind: "native", execute }],
    );

    await expect(
      runner.run({ toolId: manifest.id, input: "original.pdf", signal: controller.signal }),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(execute).not.toHaveBeenCalled();
  });

  it("aplica timeout mesmo quando o executor não responde ao abort signal", async () => {
    vi.useFakeTimers();
    try {
      const registry = new ToolRegistry();
      registry.register(manifest);
      const runner = new ToolRunner(
        registry,
        new StaticCapabilityProvider({
          "documents.read": { available: true },
          "documents.write": { available: true },
        }),
        [{ kind: "native", execute: () => new Promise<never>(() => undefined) }],
        { defaultTimeoutMs: 100 },
      );
      const running = runner.run({ toolId: manifest.id, input: "original.pdf" });
      const expectation = expect(running).rejects.toMatchObject({ code: "TIMEOUT" });

      await vi.advanceTimersByTimeAsync(100);

      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });
});
