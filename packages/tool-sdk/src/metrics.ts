import type { ToolExecutorKind, ToolRunErrorCode } from "./index";

export type ToolRunOutcome = "SUCCEEDED" | "FAILED" | "CANCELLED" | "TIMED_OUT";

export interface ToolRunMetric {
  readonly toolId: string;
  readonly executor: ToolExecutorKind | "unknown";
  readonly outcome: ToolRunOutcome;
  readonly durationMs: number;
  readonly artifactCount: number;
  readonly errorCode?: ToolRunErrorCode;
  readonly recordedAt: number;
}

export interface ToolMetricsSink {
  record(metric: ToolRunMetric): void;
}

export interface ToolMetricsSummary {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly timedOut: number;
  readonly averageDurationMs: number;
}

export class InMemoryToolMetrics implements ToolMetricsSink {
  readonly #metrics: ToolRunMetric[] = [];

  record(metric: ToolRunMetric): void {
    this.#metrics.push(Object.freeze({ ...metric }));
  }

  list(): readonly ToolRunMetric[] {
    return Object.freeze([...this.#metrics]);
  }

  summary(): ToolMetricsSummary {
    const total = this.#metrics.length;
    return {
      total,
      succeeded: this.#metrics.filter((metric) => metric.outcome === "SUCCEEDED").length,
      failed: this.#metrics.filter((metric) => metric.outcome === "FAILED").length,
      cancelled: this.#metrics.filter((metric) => metric.outcome === "CANCELLED").length,
      timedOut: this.#metrics.filter((metric) => metric.outcome === "TIMED_OUT").length,
      averageDurationMs:
        total === 0 ? 0 : this.#metrics.reduce((sum, metric) => sum + metric.durationMs, 0) / total,
    };
  }
}
