import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { BrowserDocumentCorePort } from "./browser-document-core";
import { type LauncherToolInput, runLauncherTool } from "./launcher-tool-runner";

async function input(): Promise<LauncherToolInput> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([200, 200]);
  const jpeg = await readFile("src/platform/fixtures/extraction-red-2x1.jpg");
  page.drawImage(await pdf.embedJpg(new Uint8Array(jpeg)), { x: 0, y: 0, width: 200, height: 100 });
  return {
    files: [new File([(await pdf.save()) as BlobPart], "imagens.pdf", { type: "application/pdf" })],
    splitMode: "interval",
    splitIntervals: [],
    mergeIntervals: false,
    selectedPages: [],
    pages: [],
    rotateAngle: 0,
    compressionLevel: "recommended",
    firstText: "",
    secondText: "",
    ignoreSmallImages: false,
  };
}

describe("seleções da extração no executor real", () => {
  it("extrai todas as páginas quando o escopo é todas, apesar da seleção vazia", async () => {
    const result = await runLauncherTool(new BrowserDocumentCorePort(), "pdf-extract-images", {
      ...(await input()),
      extractImageScope: "all",
      extractImagePages: [],
    });
    expect(result.blob.type).toBe("image/jpeg");
    expect(result.extractedImages).toHaveLength(1);
  });
  it("não exporta todas as imagens quando a seleção de imagens está vazia", async () => {
    await expect(
      runLauncherTool(new BrowserDocumentCorePort(), "pdf-extract-images", {
        ...(await input()),
        selectedImageIds: [],
      }),
    ).rejects.toThrow("Selecione ao menos uma imagem");
  });
  it("rejeita escopo de páginas selecionadas sem páginas", async () => {
    await expect(
      runLauncherTool(new BrowserDocumentCorePort(), "pdf-extract-images", {
        ...(await input()),
        extractImageScope: "selected",
        extractImagePages: [],
      }),
    ).rejects.toThrow("Selecione páginas válidas");
  });
});
