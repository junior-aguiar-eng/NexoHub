import { unzipSync, zlibSync } from "fflate";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { convertPdfToWord } from "./pdf-to-word-converter";

function createTestPng(width = 32, height = 32): Uint8Array {
  const rows = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    rows[rowStart] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      rows[px] = 43;
      rows[px + 1] = 87;
      rows[px + 2] = 154;
      rows[px + 3] = 255;
    }
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(data.length + 12);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    let crc = 0xffffffff;
    for (const b of out.subarray(4, -4)) {
      crc ^= b;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    view.setUint32(out.length - 4, (crc ^ 0xffffffff) >>> 0);
    return out;
  };
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibSync(rows)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((acc, p) => acc + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

describe("pdf-to-word-converter", () => {
  it("rejeita documento vazio com erro estruturado", async () => {
    await expect(convertPdfToWord(new Uint8Array(0))).rejects.toThrow("DOCUMENTO_VAZIO");
  });

  it("converte PDF com texto simples para documento Word .docx válido", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([600, 400]);

    page.drawText("Relatório Financeiro NexoHub", {
      x: 50,
      y: 350,
      size: 20,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText("Este é um parágrafo de teste gerado para validação do conversor de Word.", {
      x: 50,
      y: 300,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    const result = await convertPdfToWord(pdfBytes);

    expect(result.docxBytes).toBeInstanceOf(Uint8Array);
    expect(result.docxBytes.byteLength).toBeGreaterThan(1000);
    // Assinatura PK do formato ZIP / OpenXML
    expect(result.docxBytes[0]).toBe(0x50);
    expect(result.docxBytes[1]).toBe(0x4b);

    expect(result.report.pageCount).toBe(1);
    expect(result.report.wordCount).toBeGreaterThanOrEqual(10);
    expect(result.report.isScannedWarning).toBe(false);
    expect(result.report.sampleText.length).toBeGreaterThan(0);
    expect(result.report.convertedBytes).toBe(result.docxBytes.byteLength);
  });

  it("converte PDF multipáginas e emite progresso", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Página 1
    const p1 = pdfDoc.addPage([600, 400]);
    p1.drawText("Capítulo 1: Introdução", {
      x: 50,
      y: 350,
      size: 18,
      font: boldFont,
    });
    p1.drawText("Conteúdo da primeira página com fluxo textual estruturado.", {
      x: 50,
      y: 310,
      size: 12,
      font,
    });

    // Página 2
    const p2 = pdfDoc.addPage([600, 400]);
    p2.drawText("Capítulo 2: Conclusão", {
      x: 50,
      y: 350,
      size: 18,
      font: boldFont,
    });
    p2.drawText("Segunda página do documento processada com quebra nativa de página.", {
      x: 50,
      y: 310,
      size: 12,
      font,
    });

    const pdfBytes = await pdfDoc.save();
    const onProgress = vi.fn();

    const result = await convertPdfToWord(pdfBytes, { onProgress });

    expect(result.report.pageCount).toBe(2);
    expect(onProgress).toHaveBeenCalledWith(1, 2);
    expect(onProgress).toHaveBeenCalledWith(2, 2);
    expect(result.report.wordCount).toBeGreaterThan(10);
  });

  it("detecta PDF sem texto vetorial e emite aviso preventivo de digitalização", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    // Apenas desenha retângulos geométricos sem nenhuma camada de texto
    page.drawRectangle({
      x: 50,
      y: 50,
      width: 300,
      height: 300,
      color: rgb(0.8, 0.8, 0.8),
    });

    const pdfBytes = await pdfDoc.save();
    const result = await convertPdfToWord(pdfBytes);

    expect(result.report.pageCount).toBe(1);
    expect(result.report.wordCount).toBe(0);
    expect(result.report.isScannedWarning).toBe(true);
    // Mesmo sem texto vetorial, gera documento docx informando a orientação
    expect(result.docxBytes[0]).toBe(0x50);
    expect(result.docxBytes[1]).toBe(0x4b);
    expect(result.report.tableCount).toBe(0);
    expect(result.report.imageCount).toBe(0);
    expect(result.report.usedOcr).toBe(false);
  });

  it("reconstrói título, tabela 3x3 alinhada por coordenadas e imagem PNG embutida no DOCX", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([600, 800]);

    // Título grande
    page.drawText("Relatório Estruturado", {
      x: 50,
      y: 740,
      size: 22,
      font: boldFont,
      color: rgb(0, 0, 0),
    });

    // Tabela 3x3 alinhada por coordenadas
    const rows = [
      ["Produto", "Qtd", "Valor"],
      ["Notebook", "2", "5000"],
      ["Monitor", "4", "3200"],
    ];
    const colXs = [50, 230, 380];
    rows.forEach((row, rIdx) => {
      const y = 680 - rIdx * 28;
      row.forEach((cell, cIdx) => {
        page.drawText(cell, {
          x: colXs[cIdx],
          y,
          size: 12,
          font: rIdx === 0 ? boldFont : font,
          color: rgb(0, 0, 0),
        });
      });
    });

    // Imagem PNG embutida
    const pngBytes = createTestPng(32, 32);
    const pngImage = await pdfDoc.embedPng(pngBytes);
    page.drawImage(pngImage, {
      x: 50,
      y: 420,
      width: 96,
      height: 96,
    });

    const pdfBytes = await pdfDoc.save();
    const result = await convertPdfToWord(pdfBytes);

    expect(result.report.tableCount).toBeGreaterThanOrEqual(1);
    expect(result.report.imageCount).toBeGreaterThanOrEqual(1);
    expect(result.report.usedOcr).toBe(false);

    const unzipped = unzipSync(result.docxBytes);
    const documentXml = new TextDecoder().decode(unzipped["word/document.xml"]);

    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("<w:drawing>");
    expect(Object.keys(unzipped).some((name) => name.startsWith("word/media/"))).toBe(true);
    expect(documentXml).toContain("Relatório Estruturado");
    expect(documentXml).toContain("Notebook");
    expect(documentXml).toContain("3200");
  });

  it("respeita preserveTables=false e extractImages=false sem emitir tabela nem imagem", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([600, 800]);

    const rows = [
      ["ColA", "ColB"],
      ["Val1", "Val2"],
    ];
    rows.forEach((row, rIdx) => {
      page.drawText(row[0], { x: 50, y: 700 - rIdx * 24, size: 12, font });
      page.drawText(row[1], { x: 250, y: 700 - rIdx * 24, size: 12, font });
    });

    const pngImage = await pdfDoc.embedPng(createTestPng(24, 24));
    page.drawImage(pngImage, { x: 50, y: 500, width: 64, height: 64 });

    const pdfBytes = await pdfDoc.save();
    const result = await convertPdfToWord(pdfBytes, {
      preserveTables: false,
      extractImages: false,
    });

    expect(result.report.tableCount).toBe(0);
    expect(result.report.imageCount).toBe(0);

    const unzipped = unzipSync(result.docxBytes);
    const documentXml = new TextDecoder().decode(unzipped["word/document.xml"]);
    expect(documentXml).not.toContain("<w:tbl>");
    expect(documentXml).not.toContain("<w:drawing>");
  });

  it("preserva ordem de leitura em duas colunas e listas com marcadores", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([600, 800]);

    // Coluna esquerda (x=40..250)
    const leftLines = [
      "Primeiro parágrafo da coluna esquerda com conteúdo.",
      "Segunda linha contínua da coluna esquerda detalhada.",
      "Terceira linha da coluna esquerda explicando o tema.",
      "Quarta linha concluindo a coluna esquerda do texto.",
    ];
    leftLines.forEach((line, idx) => {
      page.drawText(line, { x: 40, y: 720 - idx * 20, size: 11, font });
    });

    // Coluna direita (x=330..540)
    const rightLines = [
      "Início da coluna direita após a leitura completa esquerda.",
      "Continuação da coluna direita com novas informações.",
      "Terceiro trecho da coluna direita em fluxo contínuo.",
      "Encerramento da coluna direita do documento técnico.",
    ];
    rightLines.forEach((line, idx) => {
      page.drawText(line, { x: 330, y: 720 - idx * 20, size: 11, font });
    });

    // Lista com marcadores abaixo das colunas
    page.drawText("• Item inicial da lista", { x: 40, y: 580, size: 11, font });
    page.drawText("• Segundo item da lista", { x: 40, y: 560, size: 11, font });

    const pdfBytes = await pdfDoc.save();
    const result = await convertPdfToWord(pdfBytes);

    const unzipped = unzipSync(result.docxBytes);
    const documentXml = new TextDecoder().decode(unzipped["word/document.xml"]);

    const lastLeftIdx = documentXml.indexOf("Quarta linha concluindo");
    const firstRightIdx = documentXml.indexOf("Início da coluna direita");
    expect(lastLeftIdx).toBeGreaterThan(-1);
    expect(firstRightIdx).toBeGreaterThan(-1);
    expect(lastLeftIdx).toBeLessThan(firstRightIdx);
    expect(documentXml).toContain("<w:numPr>");
  });

  it("executa fallback de OCR local quando documento não possui texto vetorial", async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([400, 400]);
    page.drawRectangle({ x: 40, y: 40, width: 320, height: 320, color: rgb(0.9, 0.9, 0.9) });
    const pdfBytes = await pdfDoc.save();

    const ocrRunner = vi.fn(async () => ({
      text: "Texto recuperado via OCR local.",
      pages: 1,
      lines: [],
      pageResults: [
        {
          pageNumber: 1,
          text: "Texto recuperado via OCR local.",
          width: 400,
          height: 400,
          lines: [{ text: "Texto recuperado via OCR local." }],
        },
      ],
      pageReports: [{ pageNumber: 1, source: "ocr" as const, confidence: 0.94, durationMs: 12 }],
      engine: "tesseract.js-wasm",
    }));

    const resultWithOcr = await convertPdfToWord(pdfBytes, {
      runOcrIfScanned: true,
      ocrRunner,
    });

    expect(ocrRunner).toHaveBeenCalledTimes(1);
    expect(resultWithOcr.report.usedOcr).toBe(true);
    expect(resultWithOcr.report.isScannedWarning).toBe(false);
    expect(resultWithOcr.report.wordCount).toBeGreaterThanOrEqual(5);

    const unzipped = unzipSync(resultWithOcr.docxBytes);
    const documentXml = new TextDecoder().decode(unzipped["word/document.xml"]);
    expect(documentXml).toContain("Texto recuperado via OCR local.");

    // Quando desabilitado explicitamente, não chama OCR e mantém aviso
    const ocrRunnerDisabled = vi.fn();
    const resultWithoutOcr = await convertPdfToWord(pdfBytes, {
      runOcrIfScanned: false,
      ocrRunner: ocrRunnerDisabled,
    });

    expect(ocrRunnerDisabled).not.toHaveBeenCalled();
    expect(resultWithoutOcr.report.usedOcr).toBe(false);
    expect(resultWithoutOcr.report.isScannedWarning).toBe(true);
  });

  it("detecta tabela delimitada por linhas vetoriais e lista numerada", async () => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.addPage([600, 600]);

    // Grade vetorial 2x2: 3 linhas horizontais e 3 linhas verticais
    const xs = [60, 220, 380];
    const ys = [500, 470, 440];
    for (const y of ys) {
      page.drawLine({ start: { x: xs[0], y }, end: { x: xs[2], y }, thickness: 1 });
    }
    for (const x of xs) {
      page.drawLine({ start: { x, y: ys[0] }, end: { x, y: ys[2] }, thickness: 1 });
    }

    page.drawText("Chave", { x: 70, y: 480, size: 11, font });
    page.drawText("Valor", { x: 230, y: 480, size: 11, font });
    page.drawText("Status", { x: 70, y: 450, size: 11, font });
    page.drawText("Ativo", { x: 230, y: 450, size: 11, font });

    page.drawText("1. Primeiro passo", { x: 60, y: 390, size: 11, font });
    page.drawText("2. Segundo passo", { x: 60, y: 370, size: 11, font });

    const pdfBytes = await pdfDoc.save();
    const result = await convertPdfToWord(pdfBytes);

    expect(result.report.tableCount).toBeGreaterThanOrEqual(1);
    const unzipped = unzipSync(result.docxBytes);
    const documentXml = new TextDecoder().decode(unzipped["word/document.xml"]);
    expect(documentXml).toContain("<w:tbl>");
    expect(documentXml).toContain("Chave");
    expect(documentXml).toContain("Ativo");
    expect(documentXml).toContain("Primeiro passo");
    expect(documentXml).toContain("<w:numPr>");
  });
});
