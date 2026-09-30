import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "./browser-document-core";
import { type LauncherToolInput, runLauncherTool } from "./launcher-tool-runner";

async function fixture(): Promise<File> {
  const pdf = await PDFDocument.create();
  pdf.addPage([200, 200]);
  pdf.addPage([300, 300]);
  return new File([(await pdf.save()) as unknown as BlobPart], "contrato.pdf", {
    type: "application/pdf",
  });
}

function input(files: File[]): LauncherToolInput {
  return {
    files,
    splitMode: "interval",
    splitIntervals: [
      { start: 1, end: 1 },
      { start: 2, end: 2 },
    ],
    mergeIntervals: false,
    selectedPages: [],
    pages: [],
    rotateAngle: 0,
    compressionLevel: "recommended",
    firstText: "",
    secondText: "",
  };
}

describe("Tool Runner do Launcher", () => {
  it("encaminha o perfil de compressão ao executor nativo", async () => {
    const port = new BrowserDocumentCorePort();
    const executePdfTool = vi.fn(async () => new Blob(["resultado"], { type: "application/pdf" }));
    Object.assign(port, { executePdfTool });
    const file = await fixture();
    await runLauncherTool(port, "pdf-compress", { ...input([file]), compressionLevel: "extreme" });
    expect(executePdfTool).toHaveBeenCalledWith({
      toolId: "pdf-compress",
      file,
      compressionLevel: "extreme",
      pageOrder: undefined,
    });
  });
  it("empacota todos os intervalos selecionados em um ZIP", async () => {
    const result = await runLauncherTool(
      new BrowserDocumentCorePort(),
      "pdf-split",
      input([await fixture()]),
    );
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    expect(result.fileName).toBe("contrato_partes.zip");
    expect(result.blob.type).toBe("application/zip");
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const archiveText = new TextDecoder("latin1").decode(bytes);
    expect(archiveText).toContain("contrato_parte_1_1_a_1.pdf");
    expect(archiveText).toContain("contrato_parte_2_2_a_2.pdf");
  });

  it("rejeita seleção de páginas vazia sem artifact", async () => {
    await expect(
      runLauncherTool(new BrowserDocumentCorePort(), "pdf-split", {
        ...input([await fixture()]),
        splitMode: "pages",
      }),
    ).rejects.toThrow();
  });

  it("rejeita ferramenta sem executor", async () => {
    await expect(
      runLauncherTool(new BrowserDocumentCorePort(), "pdf-protect", input([await fixture()])),
    ).rejects.toThrow();
  });

  it("identifica o arquivo inválido na junção", async () => {
    const files = [
      await fixture(),
      new File(["PDF inválido"], "segundo.pdf", { type: "application/pdf" }),
    ];
    await expect(
      runLauncherTool(new BrowserDocumentCorePort(), "pdf-merge", input(files)),
    ).rejects.toThrow("segundo.pdf");
  });

  it("aguarda a persistência desktop antes de devolver o resultado da junção", async () => {
    const port = new BrowserDocumentCorePort();
    const persisted = new Blob(["persistido"], { type: "application/pdf" });
    const persistLauncherResult = vi.fn(async () => persisted);
    Object.assign(port, { persistLauncherResult });
    const files = [await fixture(), await fixture()];
    const result = await runLauncherTool(port, "pdf-merge", input(files));
    expect(persistLauncherResult).toHaveBeenCalledWith(
      expect.objectContaining({ toolId: "pdf-merge", files }),
    );
    expect(result.blob).toBe(persisted);
  });
});
