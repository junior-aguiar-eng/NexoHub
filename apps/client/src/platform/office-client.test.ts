import { ToolRunError } from "@nexohub/tool-sdk";
import { describe, expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "./browser-document-core";
import type { DocumentCorePort } from "./document-core";
import {
  buildOfficeOutputFileName,
  convertOfficeWithDocumentCore,
  getOfficeToolMetadata,
  OFFICE_MAX_INPUT_BYTES,
  validateOfficeInputFile,
} from "./office-client";

describe("office-client", () => {
  it("reconhece metadados e extensões corretas das 4 ferramentas Office", () => {
    expect(getOfficeToolMetadata("word-to-pdf")?.outputExtension).toBe("pdf");
    expect(getOfficeToolMetadata("excel-to-pdf")?.supportedExtensions).toEqual([
      "xlsx",
      "xls",
      "ods",
    ]);
    expect(getOfficeToolMetadata("powerpoint-to-pdf")?.desktopOnly).toBe(false);
    expect(getOfficeToolMetadata("pdf-to-powerpoint")?.desktopOnly).toBe(true);
    expect(getOfficeToolMetadata("pdf-to-word")).toBeNull();
  });

  it("rejeita arquivo vazio, extensão incompatível e arquivo acima de 64 MB", () => {
    expect(() => validateOfficeInputFile("word-to-pdf", new File([], "vazio.docx"))).toThrowError(
      ToolRunError,
    );
    expect(() =>
      validateOfficeInputFile("excel-to-pdf", new File(["abc"], "texto.docx")),
    ).toThrowError(/incompatível/);

    const oversized = {
      name: "pesado.docx",
      size: OFFICE_MAX_INPUT_BYTES + 1,
    } as File;
    expect(() => validateOfficeInputFile("word-to-pdf", oversized)).toThrowError(/64 MB/);
  });

  it("invoca convert_office_document no desktop e retorna Blob válido", async () => {
    const pdfBytes = Array.from(new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n"));
    const invoke = vi.fn().mockResolvedValue({
      fileName: "relatorio.pdf",
      mimeType: "application/pdf",
      bytes: pdfBytes,
      outputBytesLen: pdfBytes.length,
      durationMs: 420,
    });
    const port: DocumentCorePort = {
      supportedToolIds: new Set(["word-to-pdf"]),
      invoke,
    };

    const file = new File(["PK\x03\x04dummy"], "relatorio.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const result = await convertOfficeWithDocumentCore(port, "word-to-pdf", file);

    expect(invoke).toHaveBeenCalledWith(
      "convert_office_document",
      expect.objectContaining({
        kind: "word-to-pdf",
        fileName: "relatorio.docx",
      }),
    );
    expect(result.fileName).toBe("relatorio.pdf");
    expect(result.blob.type).toBe("application/pdf");
    expect(result.durationMs).toBe(420);
  });

  it("traduz CAPABILITY_NOT_FOUND para orientação honesta do Superpoder Office", async () => {
    const port = new BrowserDocumentCorePort();
    const file = new File(["PK\x03\x04dummy"], "contrato.docx");
    await expect(convertOfficeWithDocumentCore(port, "word-to-pdf", file)).rejects.toMatchObject({
      code: "TOOL_UNAVAILABLE",
    });
  });

  it("gera nome de saída coerente preservando radical", () => {
    expect(buildOfficeOutputFileName("balanco.2026.xlsx", "pdf")).toBe("balanco.2026.pdf");
    expect(buildOfficeOutputFileName("apresentacao.pdf", "pptx")).toBe("apresentacao.pptx");
  });
});
