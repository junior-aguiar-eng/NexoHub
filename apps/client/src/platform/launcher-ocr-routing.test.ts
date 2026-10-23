import { PDFDocument } from "pdf-lib";
import { expect, it, vi } from "vitest";
import { performBrowserOcr } from "./browser-ocr";
import { HttpDocumentCorePort } from "./http-document-core";
import { type LauncherToolInput, runLauncherTool } from "./launcher-tool-runner";

vi.mock("./browser-ocr", () => ({ performBrowserOcr: vi.fn() }));

it("OCR web respeita idioma, contraste e saída pesquisável mesmo com core HTTP disponível", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  const file = new File([bytes as BlobPart], "scan.pdf", { type: "application/pdf" });
  vi.mocked(performBrowserOcr).mockResolvedValue({
    text: "Acción judicial",
    lines: [],
    searchablePdfBytes: bytes,
    pages: 1,
    pageResults: [],
    engine: "tesseract.js",
  });
  const port = new HttpDocumentCorePort("https://teste.invalid");
  const invoke = vi.fn(async (command: string) => {
    if (command === "pick_project_folder") return { path: "/tmp/projeto" };
    if (command === "import_document_bytes")
      return { document: { id: "doc" }, artifact: { id: "art" } };
    if (command === "execute_ocr") return { lines: [{ text: "Resultado sem opções" }] };
    return {};
  });
  Object.assign(port, { invoke, persistLauncherResult: undefined });
  const input: LauncherToolInput = {
    files: [file],
    splitMode: "pages",
    splitIntervals: [],
    mergeIntervals: false,
    selectedPages: [],
    pages: [],
    rotateAngle: 0,
    compressionLevel: "recommended",
    firstText: "",
    secondText: "",
    ocrLanguage: "spa",
    ocrEnhanceContrast: false,
    ocrOutputMode: "searchable-pdf",
  };
  const result = await runLauncherTool(port, "pdf-ocr", input);
  expect(performBrowserOcr).toHaveBeenCalledWith(
    file,
    expect.objectContaining({ language: "spa", enhanceContrast: false }),
  );
  expect(result.fileName).toBe("scan_ocr_pesquisavel.pdf");
  expect(result.blob.type).toBe("application/pdf");
  expect(await result.secondaryBlob?.text()).toBe("Acción judicial");
  expect(invoke).not.toHaveBeenCalled();
});

it("não troca silenciosamente PDF pesquisável por TXT quando a camada falha", async () => {
  vi.mocked(performBrowserOcr).mockResolvedValue({
    text: "Texto reconhecido",
    lines: [],
    pages: 1,
    pageResults: [],
    engine: "tesseract.js",
  });
  const port = new HttpDocumentCorePort("https://teste.invalid");
  const input: LauncherToolInput = {
    files: [new File(["scan"], "scan.png", { type: "image/png" })],
    splitMode: "pages",
    splitIntervals: [],
    mergeIntervals: false,
    selectedPages: [],
    pages: [],
    rotateAngle: 0,
    compressionLevel: "recommended",
    firstText: "",
    secondText: "",
    ocrOutputMode: "searchable-pdf",
  };
  await expect(runLauncherTool(port, "pdf-ocr", input)).rejects.toMatchObject({
    code: "EXECUTION_FAILED",
    message: expect.stringMatching(/PDF pesquisável/),
  });
});
