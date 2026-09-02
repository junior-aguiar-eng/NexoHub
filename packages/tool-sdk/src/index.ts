export type ToolSurface = "quick" | "studio";
export type ToolExecutorKind = "browser" | "native" | "python";

export interface ToolManifest {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly category: string;
  readonly surfaces: readonly ToolSurface[];
  readonly accepts: readonly string[];
  readonly produces: readonly string[];
  readonly capabilities: readonly string[];
  readonly executor: ToolExecutorKind;
}

export type CapabilityState = { readonly available: boolean; readonly reason?: string };
export interface CapabilityProvider {
  get(capability: string): CapabilityState;
}

export type ToolAvailability =
  | { readonly available: true }
  | {
      readonly available: false;
      readonly missingCapabilities: readonly string[];
      readonly reasons: readonly string[];
    };

export type ToolRunErrorCode =
  | "TOOL_NOT_FOUND"
  | "TOOL_UNAVAILABLE"
  | "EXECUTOR_NOT_FOUND"
  | "INVALID_INPUT"
  | "EXECUTION_FAILED"
  | "TIMEOUT"
  | "CANCELLED";

export class ToolRunError extends Error {
  constructor(
    readonly code: ToolRunErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = "ToolRunError";
  }
}

export type ToolRunRequest = {
  readonly toolId: string;
  readonly input: unknown;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly signal?: AbortSignal;
};

export type ToolRunResult = {
  readonly artifacts: readonly unknown[];
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export interface ToolExecutor {
  readonly kind: ToolExecutorKind;
  execute(request: ToolRunRequest, manifest: ToolManifest): Promise<ToolRunResult>;
}

export type ToolValidator = (request: ToolRunRequest) => void;

export class ToolRegistry {
  readonly #manifests = new Map<string, ToolManifest>();
  readonly #validators = new Map<string, ToolValidator>();

  register(manifest: ToolManifest, validator?: ToolValidator): void {
    validateManifest(manifest);
    if (this.#manifests.has(manifest.id))
      throw new Error(`Ferramenta já registrada: ${manifest.id}`);
    this.#manifests.set(manifest.id, freezeManifest(manifest));
    if (validator) this.#validators.set(manifest.id, validator);
  }

  get(id: string): ToolManifest | undefined {
    return this.#manifests.get(id);
  }

  list(surface?: ToolSurface): readonly ToolManifest[] {
    return [...this.#manifests.values()].filter(
      (manifest) => surface === undefined || manifest.surfaces.includes(surface),
    );
  }

  validator(id: string): ToolValidator | undefined {
    return this.#validators.get(id);
  }
}

export class StaticCapabilityProvider implements CapabilityProvider {
  constructor(readonly states: Readonly<Record<string, CapabilityState>>) {}

  get(capability: string): CapabilityState {
    return (
      this.states[capability] ?? {
        available: false,
        reason: `Capacidade não declarada: ${capability}`,
      }
    );
  }
}

export function resolveToolAvailability(
  manifest: ToolManifest,
  capabilities: CapabilityProvider,
): ToolAvailability {
  const unavailable = manifest.capabilities
    .map((capability) => ({ capability, state: capabilities.get(capability) }))
    .filter(({ state }) => !state.available);
  if (unavailable.length === 0) return { available: true };
  return {
    available: false,
    missingCapabilities: unavailable.map(({ capability }) => capability),
    reasons: unavailable.map(
      ({ capability, state }) => state.reason ?? `Capacidade indisponível: ${capability}`,
    ),
  };
}

export class ToolRunner {
  readonly #executors: ReadonlyMap<ToolExecutorKind, ToolExecutor>;
  readonly #metrics?: import("./metrics").ToolMetricsSink;
  readonly #defaultTimeoutMs?: number;
  readonly #now: () => number;

  constructor(
    readonly registry: ToolRegistry,
    readonly capabilities: CapabilityProvider,
    executors: readonly ToolExecutor[],
    options: {
      readonly metrics?: import("./metrics").ToolMetricsSink;
      readonly defaultTimeoutMs?: number;
      readonly now?: () => number;
    } = {},
  ) {
    this.#executors = new Map(executors.map((executor) => [executor.kind, executor]));
    this.#metrics = options.metrics;
    this.#defaultTimeoutMs = options.defaultTimeoutMs;
    this.#now = options.now ?? Date.now;
  }

  availability(toolId: string): ToolAvailability {
    const manifest = this.registry.get(toolId);
    if (!manifest) {
      return {
        available: false,
        missingCapabilities: [],
        reasons: [`Ferramenta não registrada: ${toolId}`],
      };
    }
    const availability = resolveToolAvailability(manifest, this.capabilities);
    if (!availability.available) return availability;
    return this.#executors.has(manifest.executor)
      ? { available: true }
      : {
          available: false,
          missingCapabilities: [],
          reasons: [`Executor não configurado: ${manifest.executor}`],
        };
  }

  async run(request: ToolRunRequest): Promise<ToolRunResult> {
    const startedAt = this.#now();
    const manifest = this.registry.get(request.toolId);
    try {
      const result = await this.#execute(request, manifest);
      this.#recordMetric(request.toolId, manifest?.executor ?? "unknown", startedAt, {
        outcome: "SUCCEEDED",
        artifactCount: result.artifacts.length,
      });
      return result;
    } catch (error) {
      const normalized =
        error instanceof ToolRunError
          ? error
          : new ToolRunError("EXECUTION_FAILED", "Falha ao executar a ferramenta.");
      this.#recordMetric(request.toolId, manifest?.executor ?? "unknown", startedAt, {
        outcome:
          normalized.code === "CANCELLED"
            ? "CANCELLED"
            : normalized.code === "TIMEOUT"
              ? "TIMED_OUT"
              : "FAILED",
        artifactCount: 0,
        errorCode: normalized.code,
      });
      throw normalized;
    }
  }

  async #execute(
    request: ToolRunRequest,
    manifest: ToolManifest | undefined,
  ): Promise<ToolRunResult> {
    if (!manifest) throw new ToolRunError("TOOL_NOT_FOUND", "Ferramenta não registrada.");
    if (request.signal?.aborted) throw new ToolRunError("CANCELLED", "Execução cancelada.");
    const availability = resolveToolAvailability(manifest, this.capabilities);
    if (!availability.available) {
      throw new ToolRunError(
        "TOOL_UNAVAILABLE",
        "Ferramenta indisponível nesta plataforma.",
        availability,
      );
    }
    try {
      this.registry.validator(manifest.id)?.(request);
    } catch (error) {
      throw new ToolRunError(
        "INVALID_INPUT",
        error instanceof Error ? error.message : "Entrada inválida.",
      );
    }
    const executor = this.#executors.get(manifest.executor);
    if (!executor) throw new ToolRunError("EXECUTOR_NOT_FOUND", "Executor não configurado.");
    try {
      return await executeWithTimeout(executor, request, manifest, this.#defaultTimeoutMs);
    } catch (error) {
      if (
        request.signal?.aborted ||
        (error instanceof ToolRunError && error.code === "CANCELLED")
      ) {
        throw new ToolRunError("CANCELLED", "Execução cancelada.");
      }
      if (error instanceof ToolRunError) throw error;
      throw new ToolRunError("EXECUTION_FAILED", "Falha ao executar a ferramenta.");
    }
  }

  #recordMetric(
    toolId: string,
    executor: ToolExecutorKind | "unknown",
    startedAt: number,
    result: Pick<import("./metrics").ToolRunMetric, "outcome" | "artifactCount" | "errorCode">,
  ): void {
    try {
      this.#metrics?.record({
        toolId,
        executor,
        durationMs: Math.max(0, this.#now() - startedAt),
        recordedAt: this.#now(),
        ...result,
      });
    } catch {
      // Métricas são diagnósticas e nunca alteram o resultado documental.
    }
  }
}

export * from "./metrics";
export * from "./RecipeRunner";

async function executeWithTimeout(
  executor: ToolExecutor,
  request: ToolRunRequest,
  manifest: ToolManifest,
  timeoutMs: number | undefined,
): Promise<ToolRunResult> {
  const controller = new AbortController();
  const relayCancellation = () => controller.abort();
  request.signal?.addEventListener("abort", relayCancellation, { once: true });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let rejectCancellation: (() => void) | undefined;
  try {
    const competing: Promise<ToolRunResult>[] = [
      executor.execute({ ...request, signal: controller.signal }, manifest),
    ];
    if (timeoutMs !== undefined && timeoutMs > 0) {
      competing.push(
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            reject(new ToolRunError("TIMEOUT", "A ferramenta excedeu o tempo limite de execução."));
            controller.abort();
          }, timeoutMs);
        }),
      );
    }
    if (request.signal) {
      competing.push(
        new Promise<never>((_, reject) => {
          rejectCancellation = () => reject(new ToolRunError("CANCELLED", "Execução cancelada."));
          request.signal?.addEventListener("abort", rejectCancellation, { once: true });
        }),
      );
    }
    return await Promise.race(competing);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    request.signal?.removeEventListener("abort", relayCancellation);
    if (rejectCancellation) request.signal?.removeEventListener("abort", rejectCancellation);
  }
}

function validateManifest(manifest: ToolManifest): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id))
    throw new Error(`Identificador inválido: ${manifest.id}`);
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version))
    throw new Error(`Versão inválida: ${manifest.version}`);
  if (manifest.name.trim() === "" || manifest.category.trim() === "")
    throw new Error("Nome e categoria são obrigatórios.");
  if (manifest.surfaces.length === 0) throw new Error("A ferramenta deve declarar uma superfície.");
}

function freezeManifest(manifest: ToolManifest): ToolManifest {
  return Object.freeze({
    ...manifest,
    surfaces: Object.freeze([...manifest.surfaces]),
    accepts: Object.freeze([...manifest.accepts]),
    produces: Object.freeze([...manifest.produces]),
    capabilities: Object.freeze([...manifest.capabilities]),
  });
}

export const toolSdkBoundary = "@nexohub/tool-sdk" as const;
