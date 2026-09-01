import type { Artifact, Overlay } from "./model";

export type NexoLayerKind = "ORIGINAL" | "DERIVED" | "OVERLAY";

export interface NexoLayer {
  readonly id: string;
  readonly kind: NexoLayerKind;
  readonly ordinal: number;
  readonly visible: boolean;
  readonly sourceId: string;
}

export class NexoLayers {
  readonly #layers: readonly NexoLayer[];

  constructor(layers: readonly NexoLayer[] = []) {
    this.#layers = Object.freeze(layers.map((layer) => Object.freeze({ ...layer })));
  }

  get items(): readonly NexoLayer[] {
    return this.#layers;
  }

  toggle(id: string): NexoLayers {
    return new NexoLayers(
      this.#layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    );
  }
}

export function projectNexoLayers(
  artifacts: readonly Artifact[],
  overlays: readonly Overlay[],
): NexoLayers {
  return new NexoLayers([
    ...artifacts.map((artifact, index) => ({
      id: `artifact:${artifact.id}`,
      kind: artifact.kind === "ORIGINAL" ? ("ORIGINAL" as const) : ("DERIVED" as const),
      ordinal: index + 1,
      visible: true,
      sourceId: artifact.id,
    })),
    ...overlays.map((overlay, index) => ({
      id: `overlay:${overlay.id}`,
      kind: "OVERLAY" as const,
      ordinal: index + 1,
      visible: true,
      sourceId: overlay.id,
    })),
  ]);
}
