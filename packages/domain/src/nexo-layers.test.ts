import { describe, expect, it } from "vitest";
import { asArtifactId, asDocumentId, asOverlayId, projectNexoLayers } from "./index";

describe("Nexo Layers", () => {
  it("projeta originals, derivados e overlays sem alterar as fontes", () => {
    const documentId = asDocumentId("document-1");
    const layers = projectNexoLayers(
      [
        {
          id: asArtifactId("original"),
          documentId,
          kind: "ORIGINAL",
          mimeType: "application/pdf",
          hash: "a".repeat(64),
          size: 10,
          storagePath: "blobs/aa/original",
          createdAt: 1,
        },
      ],
      [
        {
          id: asOverlayId("overlay-1"),
          artifactId: asArtifactId("original"),
          kind: "annotation",
          data: {},
          createdAt: 2,
        },
      ],
    );

    expect(layers.items.map(({ kind }) => kind)).toEqual(["ORIGINAL", "OVERLAY"]);
    expect(layers.toggle(layers.items[1]?.id ?? "").items[1]?.visible).toBe(false);
    expect(layers.items[1]?.visible).toBe(true);
  });
});
