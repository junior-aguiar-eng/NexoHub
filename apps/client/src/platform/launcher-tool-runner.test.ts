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
      pageRotations: undefined,
    });
  });

  it("encaminha ordem de páginas e rotações individuais ao executor nativo em pdf-organize", async () => {
    const port = new BrowserDocumentCorePort();
    const executePdfTool = vi.fn(async () => new Blob(["organizado"], { type: "application/pdf" }));
    Object.assign(port, { executePdfTool });
    const file = await fixture();
    await runLauncherTool(port, "pdf-organize", {
      ...input([file]),
      pages: [
        { originalIndex: 2, rotation: 90, deleted: false },
        { originalIndex: 1, rotation: 180, deleted: false },
        { originalIndex: 3, rotation: 0, deleted: true },
      ],
    });
    expect(executePdfTool).toHaveBeenCalledWith({
      toolId: "pdf-organize",
      file,
      compressionLevel: undefined,
      pageOrder: [2, 1],
      pageRotations: [90, 180],
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

  it("converte imagens em PDF no launcher", async () => {
    const minimalPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const file1 = new File([minimalPng as unknown as BlobPart], "foto1.png", { type: "image/png" });
    const file2 = new File([minimalPng as unknown as BlobPart], "foto2.png", { type: "image/png" });
    const result = await runLauncherTool(
      new BrowserDocumentCorePort(),
      "images-to-pdf",
      input([file1, file2]),
    );
    expect(result.fileName).toBe("foto1_imagens.pdf");
    expect(result.blob.type).toBe("application/pdf");
    const doc = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
  });

  it("converte PDF de 1 página em JPG direto", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    const file = new File([(await pdf.save()) as unknown as BlobPart], "documento.pdf", {
      type: "application/pdf",
    });
    const result = await runLauncherTool(
      new BrowserDocumentCorePort(),
      "pdf-to-jpg",
      input([file]),
    );
    expect(result.fileName).toBe("documento_pagina_1.jpg");
    expect(result.blob.type).toBe("image/jpeg");
  });

  it("converte PDF multipágina em pacote ZIP com imagens JPG", async () => {
    const result = await runLauncherTool(
      new BrowserDocumentCorePort(),
      "pdf-to-jpg",
      input([await fixture()]),
    );
    expect(result.fileName).toBe("contrato_imagens_jpg.zip");
    expect(result.blob.type).toBe("application/zip");
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const archiveText = new TextDecoder("latin1").decode(bytes);
    expect(archiveText).toContain("contrato_pagina_1.jpg");
    expect(archiveText).toContain("contrato_pagina_2.jpg");
  });

  it("executa inserção de marca d'água no PDF gerando artifact com sufixo", async () => {
    const file = await fixture();
    const result = await runLauncherTool(new BrowserDocumentCorePort(), "pdf-watermark", {
      ...input([file]),
      watermarkText: "RASCUNHO",
      watermarkAngle: 45,
      watermarkOpacity: 0.3,
      watermarkColor: "gray",
    });
    expect(result.fileName).toBe("contrato_marca_dagua.pdf");
    expect(result.blob.type).toBe("application/pdf");
    const doc = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
  });

  it("executa inserção de numeração de páginas gerando artifact com sufixo", async () => {
    const file = await fixture();
    const result = await runLauncherTool(new BrowserDocumentCorePort(), "pdf-page-numbers", {
      ...input([file]),
      pageNumbersPosition: "bottom-center",
      pageNumbersFormat: "pageXofY",
      pageNumbersStartPage: 1,
    });
    expect(result.fileName).toBe("contrato_numerado.pdf");
    expect(result.blob.type).toBe("application/pdf");
    const doc = await PDFDocument.load(await result.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
  });
});
