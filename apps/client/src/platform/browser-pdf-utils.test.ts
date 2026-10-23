import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createZipArchive } from "./browser-pdf-utils";

describe("createZipArchive", () => {
  it("preserva os nomes em português e todos os bytes ao extrair múltiplas partes", () => {
    const files = [
      { name: "ação_parte_1_1_a_2.pdf", data: new Uint8Array([0, 255, 12, 34]) },
      { name: "órgão_página_3.jpg", data: new Uint8Array([254, 0, 8]) },
    ];
    const extracted = unzipSync(createZipArchive(files));
    expect(Object.keys(extracted)).toEqual(files.map((file) => file.name));
    for (const file of files) expect(extracted[file.name]).toEqual(file.data);
  });
});
