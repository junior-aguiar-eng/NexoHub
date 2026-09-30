import {
  decodePDFRawStream,
  degrees,
  JpegEmbedder,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
} from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configura o worker do PDF.js para renderização de miniaturas
if (typeof window !== "undefined") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch {
    // Fallback silencioso
  }
}

/**
 * Renderiza uma página específica do PDF em alta qualidade retornando um Data URL (JPEG).
 */
export async function renderPdfPageToDataUrl(
  pdfBytes: Uint8Array,
  pageNumber: number = 1,
  scale: number = 0.6,
): Promise<string> {
  const isTestEnv =
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    Boolean(
      typeof globalThis !== "undefined" &&
        (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env
          ?.NODE_ENV === "test",
    );

  if (isTestEnv) {
    return "";
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(),
      useSystemFonts: true,
      standardFontDataUrl: undefined,
    });
    const pdf = await loadingTask.promise;
    const clampedPage = Math.max(1, Math.min(pageNumber, pdf.numPages));
    const page = await pdf.getPage(clampedPage);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    }).promise;

    return canvas.toDataURL("image/jpeg", 0.85);
  } catch (err) {
    console.warn("Falha ao renderizar miniatura com PDF.js:", err);
    return "";
  }
}

/**
 * Retorna o número real de páginas usando pdf-lib.
 */
export async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdfBytes);
  return doc.getPageCount();
}

/**
 * Divide o PDF por intervalos (ex: da página 1 até 47).
 */
export async function splitPdfByInterval(
  pdfBytes: Uint8Array,
  startPage: number,
  endPage: number,
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const total = srcDoc.getPageCount();
  if (
    !Number.isInteger(startPage) ||
    !Number.isInteger(endPage) ||
    startPage < 1 ||
    endPage < startPage ||
    endPage > total
  ) {
    throw new Error("INTERVALO_DE_PAGINAS_INVALIDO");
  }
  const validStart = startPage;
  const validEnd = endPage;

  const newDoc = await PDFDocument.create();
  const pageIndices: number[] = [];
  for (let i = validStart; i <= validEnd; i++) {
    pageIndices.push(i - 1);
  }

  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return await newDoc.save({ useObjectStreams: true });
}

/**
 * Extrai páginas selecionadas individualmente de um PDF.
 */
export async function extractPdfSelectedPages(
  pdfBytes: Uint8Array,
  pageNumbers: number[],
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const total = srcDoc.getPageCount();
  if (
    pageNumbers.length === 0 ||
    pageNumbers.some((p) => !Number.isInteger(p) || p < 1 || p > total)
  ) {
    throw new Error("SELECAO_DE_PAGINAS_INVALIDA");
  }
  const validIndices = pageNumbers.map((p) => p - 1);

  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  return await newDoc.save({ useObjectStreams: true });
}

/**
 * Junta múltiplos PDFs em um único arquivo de saída.
 */
export async function mergePdfDocuments(pdfByteArrays: Uint8Array[]): Promise<Uint8Array> {
  if (pdfByteArrays.length === 0) {
    throw new Error("Nenhum arquivo PDF fornecido para junção.");
  }
  if (pdfByteArrays.length === 1) {
    await PDFDocument.load(pdfByteArrays[0]);
    return pdfByteArrays[0];
  }

  const mergedDoc = await PDFDocument.create();
  for (const [index, bytes] of pdfByteArrays.entries()) {
    try {
      const srcDoc = await PDFDocument.load(bytes);
      const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of copiedPages) {
        mergedDoc.addPage(page);
      }
    } catch {
      throw new Error(`PDF_INVALIDO_NA_POSICAO_${index + 1}`);
    }
  }

  return await mergedDoc.save({ useObjectStreams: true });
}

/**
 * Reorganiza páginas e aplica rotações reais em um PDF.
 */
export async function reorganizePdfDocument(
  pdfBytes: Uint8Array,
  pageOrders: Array<{ originalIndex: number; rotation: number }>,
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const newDoc = await PDFDocument.create();

  const indices = pageOrders.map((p) => p.originalIndex - 1);
  const copiedPages = await newDoc.copyPages(srcDoc, indices);

  for (let i = 0; i < copiedPages.length; i++) {
    const page = copiedPages[i];
    const rot = pageOrders[i].rotation;
    if (rot !== 0) {
      page.setRotation(degrees((page.getRotation().angle + rot) % 360));
    }
    newDoc.addPage(page);
  }

  return await newDoc.save({ useObjectStreams: true });
}

/**
 * Comprime o PDF utilizando streams de objetos e reconstrução de referências.
 */
export async function compressPdfDocument(
  pdfBytes: Uint8Array,
  level: "extreme" | "recommended" | "less" = "recommended",
): Promise<{ bytes: Uint8Array; savedBytes: number; savedPercent: number }> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const profile = {
    less: { quality: 0.84, maxDimension: 3200 },
    recommended: { quality: 0.68, maxDimension: 2200 },
    extreme: { quality: 0.52, maxDimension: 1400 },
  }[level];
  const name = (value: string) => PDFName.of(value);

  for (const [, object] of srcDoc.context.enumerateIndirectObjects()) {
    const dict = object instanceof PDFRawStream ? object.dict : object;
    if (dict instanceof PDFDict && dict.has(name("ByteRange"))) {
      throw new Error("PDF_ASSINADO_NAO_SUPORTADO");
    }
  }

  if (typeof createImageBitmap === "function" && typeof document !== "undefined") {
    for (const [ref, object] of srcDoc.context.enumerateIndirectObjects()) {
      if (!(object instanceof PDFRawStream)) continue;
      const dict = object.dict;
      const subtype = dict.get(name("Subtype"));
      const filter = dict.get(name("Filter"));
      const color = dict.get(name("ColorSpace"));
      const bits = dict.get(name("BitsPerComponent"));
      const width = dict.get(name("Width"));
      const height = dict.get(name("Height"));
      if (
        !(subtype instanceof PDFName) ||
        subtype.asString() !== "/Image" ||
        !(filter instanceof PDFName) ||
        !["/DCTDecode", "/FlateDecode"].includes(filter.asString()) ||
        !(color instanceof PDFName) ||
        color.asString() !== "/DeviceRGB" ||
        !(bits instanceof PDFNumber) ||
        bits.asNumber() !== 8 ||
        !(width instanceof PDFNumber) ||
        !(height instanceof PDFNumber) ||
        dict.has(name("SMask")) ||
        dict.has(name("Mask")) ||
        dict.has(name("Decode")) ||
        dict.has(name("DecodeParms"))
      )
        continue;
      const w = width.asNumber();
      const h = height.asNumber();
      if (
        !Number.isSafeInteger(w) ||
        !Number.isSafeInteger(h) ||
        w < 64 ||
        h < 64 ||
        w * h > 12_000_000 ||
        object.getContentsSize() > 32 * 1024 * 1024
      )
        continue;
      let bitmap: ImageBitmap | undefined;
      try {
        let source: CanvasImageSource;
        if (filter.asString() === "/DCTDecode") {
          const header = await JpegEmbedder.for(Uint8Array.from(object.getContents()));
          if (header.width !== w || header.height !== h || header.colorSpace !== "DeviceRGB")
            continue;
          bitmap = await createImageBitmap(
            new Blob([object.getContents() as BlobPart], { type: "image/jpeg" }),
          );
          if (bitmap.width !== w || bitmap.height !== h) continue;
          source = bitmap;
        } else {
          const expected = w * h * 3;
          const raw = decodePDFRawStream(object).getBytes(expected + 1);
          if (raw.length !== expected) continue;
          const rawCanvas = document.createElement("canvas");
          rawCanvas.width = w;
          rawCanvas.height = h;
          const rawContext = rawCanvas.getContext("2d");
          if (!rawContext) continue;
          const pixels = rawContext.createImageData(w, h);
          for (let src = 0, dest = 0; src < raw.length; src += 3, dest += 4) {
            pixels.data[dest] = raw[src];
            pixels.data[dest + 1] = raw[src + 1];
            pixels.data[dest + 2] = raw[src + 2];
            pixels.data[dest + 3] = 255;
          }
          rawContext.putImageData(pixels, 0, 0);
          source = rawCanvas;
        }
        const ratio = Math.min(1, profile.maxDimension / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(w * ratio));
        canvas.height = Math.max(1, Math.round(h * ratio));
        const context = canvas.getContext("2d");
        if (!context) continue;
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", profile.quality),
        );
        if (!blob || blob.size >= object.getContentsSize()) continue;
        const newDict = dict.clone(srcDoc.context);
        newDict.set(name("Width"), PDFNumber.of(canvas.width));
        newDict.set(name("Height"), PDFNumber.of(canvas.height));
        newDict.set(name("Length"), PDFNumber.of(blob.size));
        newDict.set(name("Filter"), name("DCTDecode"));
        srcDoc.context.assign(
          ref,
          PDFRawStream.of(newDict, new Uint8Array(await blob.arrayBuffer())),
        );
      } catch {
        // Codificações desconhecidas permanecem intactas.
      } finally {
        bitmap?.close();
      }
    }
  }

  const rewritten = await srcDoc.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: 50,
  });
  const compressed = rewritten.length < pdfBytes.length ? rewritten : pdfBytes;

  const originalSize = pdfBytes.length;
  const compressedSize = compressed.length;
  const savedBytes = originalSize - compressedSize;
  const savedPercent = Math.round((savedBytes / originalSize) * 100);

  return {
    bytes: compressed,
    savedBytes,
    savedPercent,
  };
}

/**
 * Rotaciona todas as páginas do PDF em um ângulo determinado (ex: 90, 180, 270).
 */
export async function rotatePdfDocument(
  pdfBytes: Uint8Array,
  rotationAngle: number,
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const total = srcDoc.getPageCount();
  for (let i = 0; i < total; i++) {
    const page = srcDoc.getPage(i);
    const currentAngle = page.getRotation().angle;
    page.setRotation(degrees((currentAngle + rotationAngle) % 360));
  }
  return await srcDoc.save({ useObjectStreams: true });
}
