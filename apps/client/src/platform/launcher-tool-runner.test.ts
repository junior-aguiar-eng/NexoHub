import { applyReviewFindings, reviewText } from "@nexohub/domain";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "./browser-document-core";
import * as browserReviewer from "./browser-reviewer";
import * as browserTranslator from "./browser-translator";
import { HttpDocumentCorePort } from "./http-document-core";
import * as imageEngine from "./image-engine";
import * as imageProcessing from "./image-processing";
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
  it.each([0, 5])("preserva caracteres ao aplicar inserção HTTP na posição %s", async (offset) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          language: "pt-BR",
          engine: "languagetool-community",
          version: "teste",
          matches: [
            {
              offset,
              length: 0,
              message: "Inserir sinal",
              shortMessage: "Pontuação",
              replacements: [{ value: "." }, { value: "!" }],
              rule: { id: "SINAL", description: "Sinal", issueType: "typographical" },
            },
          ],
        }),
      ),
    );
    const result = await runLauncherTool(
      new HttpDocumentCorePort("https://teste.invalid"),
      "text-review",
      input([new File(["Frase"], "minuta.txt", { type: "text/plain" })]),
    );
    expect(applyReviewFindings("Frase", result.reviewFindings ?? [])).toBe(
      offset === 0 ? ".Frase" : "Frase.",
    );
    const first = result.reviewFindings?.[0];
    if (!first) throw new Error("Sugestão ausente");
    expect(
      applyReviewFindings("Frase", [{ ...first, replacement: first.suggestions?.[1] ?? "" }]),
    ).toBe(offset === 0 ? "!Frase" : "Frase!");
    vi.restoreAllMocks();
  });
  it("transforma observações da revisão HTTP em sugestões aplicáveis", async () => {
    const text = "Eu fasso isso.";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          language: "pt-BR",
          engine: "languagetool-community",
          version: "teste",
          matches: [
            {
              offset: 3,
              length: 5,
              message: "Grafia incorreta",
              shortMessage: "Ortografia",
              replacements: [{ value: "faço" }],
              rule: { id: "GRAFIA", description: "Grafia", issueType: "misspelling" },
            },
          ],
        }),
      ),
    );
    const result = await runLauncherTool(
      new HttpDocumentCorePort("https://teste.invalid"),
      "text-review",
      input([new File([text], "minuta.txt", { type: "text/plain" })]),
    );
    expect(result.reviewFindings).toHaveLength(1);
    expect(applyReviewFindings(text, result.reviewFindings ?? [])).toBe("Eu faço isso.");
    vi.restoreAllMocks();
  });
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
      runLauncherTool(new BrowserDocumentCorePort(), "pdf-to-word", input([await fixture()])),
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

  it("executa OCR gerando texto extraído e artefato de saída", async () => {
    const port = new BrowserDocumentCorePort();
    const invoke = vi.fn(async (cmd: string) => {
      if (cmd === "pick_project_folder") return { path: "/tmp/projeto" };
      if (cmd === "import_document_bytes") {
        return { document: { id: "doc-1" }, artifact: { id: "art-1" } };
      }
      if (cmd === "execute_ocr") {
        return {
          lines: [{ text: "CONTRATO SOCIAL" }, { text: "CLAUSULA 1" }],
        };
      }
      return {};
    });
    Object.assign(port, { invoke, ocrEngine: "core" });
    const file = await fixture();
    const result = await runLauncherTool(port, "pdf-ocr", input([file]));
    expect(result.fileName).toBe("contrato_ocr.txt");
    expect(result.blob.type).toBe("text/plain;charset=utf-8");
    const text = await result.blob.text();
    expect(text).toContain("CONTRATO SOCIAL");
  });

  it("monta o arquivo e encaminha o progresso do motor de tradução", async () => {
    const port = new BrowserDocumentCorePort();
    const progressList: number[] = [];
    const textFile = new File(["This is a legal service agreement."], "agreement.txt", {
      type: "text/plain",
    });
    // O worker e seu carregamento são validados separadamente; aqui conferimos a saída do runner.
    const engine = vi
      .spyOn(browserTranslator, "performBrowserTranslation")
      .mockImplementationOnce(async (_text, options) => {
        options.onProgress?.({ status: "ready", progress: 100 });
        return {
          translatedText: "Este é um contrato de prestação de serviços.",
          sourceLang: "en",
          targetLang: "pt",
          engine: "transformers.js-nllb-200",
        };
      });

    const result = await runLauncherTool(port, "text-translate", {
      ...input([textFile]),
      translationSourceLang: "en",
      translationTargetLang: "pt",
      onTranslationProgress: (info) => progressList.push(info.progress),
    });

    expect(result.fileName).toBe("agreement_en_para_pt.txt");
    expect(result.blob.type).toBe("text/plain;charset=utf-8");
    const translated = await result.blob.text();
    expect(translated).toBe("Este é um contrato de prestação de serviços.");
    expect(progressList.at(-1)).toBe(100);
    engine.mockRestore();
  });

  it("rejeita tradução sem texto de entrada", async () => {
    const port = new BrowserDocumentCorePort();
    await expect(
      runLauncherTool(port, "text-translate", {
        ...input([]),
        firstText: "",
      }),
    ).rejects.toThrow();
  });

  it("executa revisão textual gerando relatório e achados estruturados", async () => {
    const port = new BrowserDocumentCorePort();
    const textFile = new File(["Os prejuízos são vultuosos."], "relatorio.txt", {
      type: "text/plain",
    });

    // O motor real é exercitado em E2E; aqui verificamos a montagem do relatório no runner.
    const review = vi
      .spyOn(browserReviewer, "performBrowserReview")
      .mockResolvedValueOnce(reviewText(await textFile.text()));
    const result = await runLauncherTool(port, "text-review", {
      ...input([textFile]),
    });
    review.mockRestore();

    expect(result.fileName).toBe("relatorio_revisao.txt");
    expect(result.blob.type).toBe("text/plain;charset=utf-8");
    expect(result.reviewFindings).toBeDefined();
    expect(result.reviewFindings?.length).toBeGreaterThan(0);
    const content = await result.blob.text();
    expect(content).toContain("RELATÓRIO DE REVISÃO");
    expect(content).toContain("vultuosos");
  });

  it("rejeita revisão sem texto de entrada", async () => {
    const port = new BrowserDocumentCorePort();
    await expect(
      runLauncherTool(port, "text-review", {
        ...input([]),
        firstText: "",
      }),
    ).rejects.toThrow();
  });

  it("executa preenchimento de formulário PDF gerando documento preenchido", async () => {
    const port = new BrowserDocumentCorePort();
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    const form = doc.getForm();
    const tf = form.createTextField("usuario");
    tf.addToPage(page, { x: 20, y: 20, width: 100, height: 20 });
    const bytes = await doc.save();
    const pdfFile = new File([bytes as unknown as BlobPart], "formulario.pdf", {
      type: "application/pdf",
    });

    const result = await runLauncherTool(port, "pdf-form-fill", {
      ...input([pdfFile]),
      formValues: { usuario: "Maria" },
      formFlatten: false,
    });

    expect(result.fileName).toBe("formulario_preenchido.pdf");
    expect(result.blob.type).toBe("application/pdf");
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("executa desbloqueio de PDF removendo restrições criptográficas", async () => {
    const port = new BrowserDocumentCorePort();
    const { readFileSync } = await import("node:fs");
    const bytes = new Uint8Array(
      readFileSync("src/platform/__fixtures__/pdf-unlock/permissions-only.pdf"),
    );
    const pdfFile = new File([bytes as unknown as BlobPart], "bloqueado.pdf", {
      type: "application/pdf",
    });

    const result = await runLauncherTool(port, "pdf-unlock", {
      ...input([pdfFile]),
      unlockPassword: "",
    });

    expect(result.fileName).toBe("bloqueado_desbloqueado.pdf");
    expect(result.blob.type).toBe("application/pdf");
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("executa proteção de PDF adicionando senha e restrições", async () => {
    const port = new BrowserDocumentCorePort();
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([200, 200]);
    const pdfBytes = await pdfDoc.save();
    const pdfFile = new File([pdfBytes as unknown as BlobPart], "contrato.pdf", {
      type: "application/pdf",
    });

    const result = await runLauncherTool(port, "pdf-protect", {
      ...input([pdfFile]),
      protectPassword: "SenhaSegura123!",
      protectAllowPrinting: true,
      protectAllowCopying: false,
    });

    expect(result.fileName).toBe("contrato_protegido.pdf");
    expect(result.blob.type).toBe("application/pdf");
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("executa ocultação e tarja definitiva (redaction) de PDF", async () => {
    const port = new BrowserDocumentCorePort();
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([200, 200]);
    const pdfBytes = await pdfDoc.save();
    const pdfFile = new File([pdfBytes as unknown as BlobPart], "documento_sensivel.pdf", {
      type: "application/pdf",
    });

    const result = await runLauncherTool(port, "pdf-redact", {
      ...input([pdfFile]),
      redactionAreas: [
        {
          id: "r1",
          pageIndex: 0,
          xPercent: 10,
          yPercent: 10,
          widthPercent: 60,
          heightPercent: 15,
          color: "black",
          label: "[DADOS LGPD]",
        },
      ],
    });

    expect(result.fileName).toBe("documento_sensivel_tarjado.pdf");
    expect(result.blob.type).toBe("application/pdf");
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it("executa conversão de PDF para Excel (.xlsx) e CSV", async () => {
    const port = new BrowserDocumentCorePort();
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    page.drawText("Item        Valor");
    page.drawText("A           10");
    const pdfBytes = await pdfDoc.save();
    const pdfFile = new File([pdfBytes as unknown as BlobPart], "dados.pdf", {
      type: "application/pdf",
    });

    const resultXlsx = await runLauncherTool(port, "pdf-to-excel", {
      ...input([pdfFile]),
      excelOutputFormat: "xlsx",
    });
    expect(resultXlsx.fileName).toBe("dados.xlsx");
    expect(resultXlsx.blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(resultXlsx.blob.size).toBeGreaterThan(0);

    const resultCsv = await runLauncherTool(port, "pdf-to-excel", {
      ...input([pdfFile]),
      excelOutputFormat: "csv",
      excelCsvDelimiter: ";",
    });
    expect(resultCsv.fileName).toBe("dados.csv");
    expect(resultCsv.blob.type).toContain("text/csv");
    expect(resultCsv.blob.size).toBeGreaterThan(0);
  });

  it("executa remoção de páginas com pdf-remove-pages", async () => {
    const port = new BrowserDocumentCorePort();
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([200, 200]);
    pdfDoc.addPage([200, 200]);
    pdfDoc.addPage([200, 200]);
    const pdfFile = new File([(await pdfDoc.save()) as unknown as BlobPart], "relatorio.pdf", {
      type: "application/pdf",
    });

    const result = await runLauncherTool(port, "pdf-remove-pages", {
      ...input([pdfFile]),
      pagesToRemove: [2],
    });

    expect(result.fileName).toBe("relatorio_paginas_removidas.pdf");
    expect(result.blob.type).toBe("application/pdf");
    const doc = await PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()));
    expect(doc.getPageCount()).toBe(2);
  });

  it("executa extração de páginas em PDF e ZIP com pdf-extract-pages", async () => {
    const port = new BrowserDocumentCorePort();
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([200, 200]);
    pdfDoc.addPage([200, 200]);
    pdfDoc.addPage([200, 200]);
    pdfDoc.addPage([200, 200]);
    const pdfFile = new File([(await pdfDoc.save()) as unknown as BlobPart], "apostila.pdf", {
      type: "application/pdf",
    });

    // Modo Single PDF
    const resultPdf = await runLauncherTool(port, "pdf-extract-pages", {
      ...input([pdfFile]),
      pagesToExtract: [1, 3],
      extractPagesMode: "single-pdf",
    });
    expect(resultPdf.fileName).toBe("apostila_paginas_extraidas.pdf");
    const doc = await PDFDocument.load(new Uint8Array(await resultPdf.blob.arrayBuffer()));
    expect(doc.getPageCount()).toBe(2);

    // Modo ZIP
    const resultZip = await runLauncherTool(port, "pdf-extract-pages", {
      ...input([pdfFile]),
      pagesToExtract: [2, 4],
      extractPagesMode: "zip-split",
    });
    expect(resultZip.fileName).toBe("apostila_paginas_extraidas.zip");
    expect(resultZip.blob.type).toBe("application/zip");
  });

  it("executa conversão de HTML para PDF com html-to-pdf", async () => {
    const port = new BrowserDocumentCorePort();
    const result = await runLauncherTool(port, "html-to-pdf", {
      ...input([]),
      htmlContent: "<h1>Documento de Teste</h1><p>Convertido via NexoHub</p>",
      htmlPageSize: "A4",
    });

    expect(result.fileName).toBe("documento.pdf");
    expect(result.blob.type).toBe("application/pdf");
    const doc = await PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()));
    expect(doc.getPageCount()).toBe(1);
  });

  it("executa digitalização para PDF com scan-to-pdf", async () => {
    const port = new BrowserDocumentCorePort();
    const minimalPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const result = await runLauncherTool(port, "scan-to-pdf", {
      ...input([]),
      scannedPages: [
        {
          id: "page-1",
          imageBytes: minimalPng,
          mimeType: "image/png",
          filter: "original",
        },
      ],
      scanPageSize: "A4",
    });

    expect(result.fileName).toBe("documento_digitalizado.pdf");
    expect(result.blob.type).toBe("application/pdf");
    const doc = await PDFDocument.load(new Uint8Array(await result.blob.arrayBuffer()));
    expect(doc.getPageCount()).toBe(1);
  });

  it("recusa todo o lote antes de recortar quando uma imagem não comporta a área", async () => {
    const files = [new File(["a"], "grande.png"), new File(["b"], "pequena.png")];
    const metadata = vi
      .spyOn(imageEngine, "getImageMetadata")
      .mockResolvedValueOnce({ width: 200, height: 200, sizeBytes: 1, mimeType: "image/png" })
      .mockResolvedValueOnce({ width: 50, height: 50, sizeBytes: 1, mimeType: "image/png" });
    const process = vi
      .spyOn(imageProcessing, "processImage")
      .mockResolvedValue(new Blob(["output"], { type: "image/png" }));
    try {
      await expect(
        runLauncherTool(new BrowserDocumentCorePort(), "image-crop", {
          ...input(files),
          imageCropWidth: 100,
          imageCropHeight: 100,
        }),
      ).rejects.toThrow(/2\. pequena.png/);
      expect(process).not.toHaveBeenCalled();
    } finally {
      metadata.mockRestore();
      process.mockRestore();
    }
  });

  it("executa ferramentas de imagem pelo launcher-tool-runner", async () => {
    const port = new BrowserDocumentCorePort();
    const testFile = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      "foto.png",
      {
        type: "image/png",
      },
    );

    const process = vi.spyOn(imageProcessing, "processImage").mockImplementation(
      async (job) =>
        new Blob(["transport-fixture"], {
          type: job.kind === "convert" ? "image/webp" : "image/png",
        }),
    );
    const metadata = vi.spyOn(imageEngine, "getImageMetadata").mockImplementation(async (blob) => ({
      width: 200,
      height: 200,
      sizeBytes: blob instanceof Blob ? blob.size : blob.byteLength,
      mimeType: blob instanceof Blob ? blob.type : "image/png",
    }));
    const generatedMetadata = vi
      .spyOn(imageEngine, "getGeneratedImageMetadata")
      .mockImplementation(async (blob) => ({
        width: 200,
        height: 200,
        sizeBytes: blob.size,
        mimeType: blob.type,
      }));
    // Transporte é isolado aqui; codecs e pixels reais são verificados nos E2E.
    const compRes = await runLauncherTool(port, "image-compress", {
      ...input([testFile]),
      imageCompressionLevel: "recommended",
    });
    expect(compRes.fileName).toContain("foto_comprimido");
    expect(compRes.blob).toBeInstanceOf(Blob);

    // Teste de redimensionamento
    const resizeRes = await runLauncherTool(port, "image-resize", {
      ...input([testFile]),
      imageResizeMode: "percentage",
      imageResizePercentage: 50,
    });
    expect(resizeRes.fileName).toBe("foto_redimensionado.png");

    // Teste de recorte
    const cropRes = await runLauncherTool(port, "image-crop", {
      ...input([testFile]),
      imageCropX: 10,
      imageCropY: 10,
      imageCropWidth: 100,
      imageCropHeight: 100,
    });
    expect(cropRes.fileName).toBe("foto_recortado.png");

    // Teste de conversão
    const convertRes = await runLauncherTool(port, "image-convert", {
      ...input([testFile]),
      imageTargetFormat: "webp",
    });
    expect(convertRes.fileName).toBe("foto.webp");

    // Teste de rotação
    const rotateRes = await runLauncherTool(port, "image-rotate", {
      ...input([testFile]),
      imageRotateAngle: 90,
      imageFlipHorizontal: true,
    });
    expect(rotateRes.fileName).toBe("foto_girado.png");

    // Teste de marca d'água
    const wmRes = await runLauncherTool(port, "image-watermark", {
      ...input([testFile]),
      imageWatermarkType: "text",
      imageWatermarkText: "NexoHub Seguro",
    });
    expect(wmRes.fileName).toBe("foto_marca_dagua.png");
    expect(process).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: "watermark",
        options: expect.objectContaining({ opacity: 0.5 }),
      }),
      undefined,
    );
    const batch = await runLauncherTool(port, "image-rotate", {
      ...input([testFile, testFile]),
      imageRotateAngle: 90,
    });
    expect(batch.blob.type).toBe("application/zip");
    expect(process).toHaveBeenCalledTimes(8);
    process.mockRestore();
    metadata.mockRestore();
    generatedMetadata.mockRestore();
  });
});

it("exporta os bytes da revisão validada e recusa revisão de outro arquivo/valores", async () => {
  const { preparePdfFormRevision, getPdfFormRevisionBytes } = await import("./pdf-form");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 300]);
  pdf.getForm().createTextField("nome").addToPage(page, { x: 20, y: 20, width: 200, height: 30 });
  const bytes = await pdf.save();
  const source = new File([bytes as unknown as BlobPart], "revisao.pdf", {
    type: "application/pdf",
  });
  const values = { nome: "José" };
  const revision = await preparePdfFormRevision(source, { values, flatten: false });
  const result = await runLauncherTool(new BrowserDocumentCorePort(), "pdf-form-fill", {
    ...input([source]),
    formValues: values,
    formFlatten: false,
    formRevision: revision,
  });
  expect(new Uint8Array(await result.blob.arrayBuffer())).toEqual(
    getPdfFormRevisionBytes(revision),
  );
  const other = new File([bytes as unknown as BlobPart], "revisao.pdf", {
    type: "application/pdf",
  });
  for (const mismatch of [
    { files: [other], formValues: values, formFlatten: false },
    { files: [source], formValues: { nome: "Outra" }, formFlatten: false },
    { files: [source], formValues: values, formFlatten: true },
  ]) {
    await expect(
      runLauncherTool(new BrowserDocumentCorePort(), "pdf-form-fill", {
        ...input(mismatch.files),
        ...mismatch,
        formRevision: revision,
      }),
    ).rejects.toThrow(/revisão/i);
  }
});
