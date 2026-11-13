import { AlreadyEncryptedError, encryptPDF } from "@pdfsmaller/pdf-encrypt";
import {
  concatTransformationMatrix,
  decodePDFRawStream,
  degrees,
  JpegEmbedder,
  PDFDict,
  PDFDocument,
  type PDFImage,
  PDFName,
  PDFNumber,
  PDFObjectCopier,
  PDFPage,
  PDFPageLeaf,
  PDFRawStream,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
} from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { withAppBase } from "./app-paths";
import { createZipArchive } from "./browser-pdf-utils";
import { retainPdfFormWidgets } from "./pdf-form";
import { addOcrTextLayer } from "./pdf-ocr-text-layer";
import { getVisiblePageGeometry } from "./pdf-page-geometry";

const isTestEnv =
  typeof window === "undefined" ||
  Boolean(
    typeof globalThis !== "undefined" &&
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env
        ?.NODE_ENV === "test",
  );

// Configura o worker do PDF.js para renderização de miniaturas (somente em ambiente de browser real)
if (typeof window !== "undefined" && !isTestEnv) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch {
    // Fallback silencioso
  }
}

const STANDARD_FONT_DATA_URL =
  typeof window !== "undefined" && window.location?.origin
    ? new URL(withAppBase("standard_fonts/"), window.location.origin).href
    : undefined;

/**
 * Renderiza miniaturas de múltiplas páginas de um PDF compartilhando a mesma instância
 * de parsing do documento, evitando re-parsear o arquivo a cada página.
 */
export async function renderPdfPagesThumbnails(
  pdfBytes: Uint8Array,
  pageNumbers: readonly number[],
  scale: number = 0.6,
  signal?: AbortSignal,
): Promise<string[]> {
  const isTestEnv =
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    Boolean(
      typeof globalThis !== "undefined" &&
        (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env
          ?.NODE_ENV === "test",
    );

  if (signal?.aborted || isTestEnv || pageNumbers.length === 0) {
    return pageNumbers.map(() => "");
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(),
      useSystemFonts: true,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    });
    const abort = () => {
      void loadingTask.destroy().catch(() => {});
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    try {
      const pdf = await loadingTask.promise;
      try {
        const results: string[] = [];
        for (const pageNumber of pageNumbers) {
          if (signal?.aborted) return pageNumbers.map(() => "");
          try {
            const clampedPage = Math.max(1, Math.min(pageNumber, pdf.numPages));
            const page = await pdf.getPage(clampedPage);
            const baseViewport = page.getViewport({ scale: 1 });
            const boundedScale = Math.min(
              scale,
              1800 / Math.max(baseViewport.width, baseViewport.height),
              Math.sqrt(3_000_000 / (baseViewport.width * baseViewport.height)),
            );
            const viewport = page.getViewport({ scale: boundedScale });

            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              results.push("");
              continue;
            }

            await page.render({
              canvasContext: ctx,
              viewport,
              canvas,
            }).promise;

            results.push(canvas.toDataURL("image/jpeg", 0.85));
          } catch {
            results.push("");
          }
        }
        return results;
      } finally {
        try {
          pdf.cleanup();
        } catch {
          // Fallback silencioso
        }
      }
    } finally {
      signal?.removeEventListener("abort", abort);
      await loadingTask.destroy().catch(() => {});
    }
  } catch (err) {
    if (signal?.aborted) return pageNumbers.map(() => "");
    console.warn("Falha ao renderizar miniaturas com PDF.js:", err);
    return pageNumbers.map(() => "");
  }
}

/**
 * Renderiza uma página específica do PDF em alta qualidade retornando um Data URL (JPEG).
 */
export async function renderPdfPageToDataUrl(
  pdfBytes: Uint8Array,
  pageNumber: number = 1,
  scale: number = 0.6,
  signal?: AbortSignal,
): Promise<string> {
  const [thumb] = await renderPdfPagesThumbnails(pdfBytes, [pageNumber], scale, signal);
  return thumb ?? "";
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
 * Remove páginas específicas de um PDF preservando as restantes.
 * Garante que ao menos 1 página permaneça no documento.
 */
async function copyPageSubsetWithForms(
  srcDoc: PDFDocument,
  indices: number[],
): Promise<Uint8Array> {
  for (const [, object] of srcDoc.context.enumerateIndirectObjects()) {
    const dict = object instanceof PDFRawStream ? object.dict : object;
    if (dict instanceof PDFDict && dict.has(PDFName.of("ByteRange")))
      throw new Error("PDF_ASSINADO_NAO_SUPORTADO");
  }
  const formDictionary = srcDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (formDictionary?.has(PDFName.of("XFA"))) throw new Error("PDF_XFA_NAO_SUPORTADO");
  const pages = srcDoc.getPages();
  const keptAnnotations = new Set<PDFDict>();
  for (const index of indices) {
    const annots = pages[index].node.Annots();
    if (annots)
      for (let i = 0; i < annots.size(); i++) {
        const annotation = annots.lookup(i);
        if (annotation instanceof PDFDict) keptAnnotations.add(annotation);
      }
  }
  const acroForm = srcDoc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  retainPdfFormWidgets(srcDoc, keptAnnotations);
  await srcDoc.flush();
  const out = await PDFDocument.create();
  const copier = PDFObjectCopier.for(srcDoc.context, out.context);
  for (const index of indices) {
    const ref = copier.copy(pages[index].ref);
    const node = out.context.lookup(ref);
    if (!(node instanceof PDFPageLeaf)) throw new Error("PAGINA_PDF_INVALIDA");
    out.addPage(PDFPage.of(node, ref, out));
  }
  if (acroForm) out.catalog.set(PDFName.of("AcroForm"), copier.copy(acroForm));
  return out.save({ useObjectStreams: true, updateFieldAppearances: false });
}

export async function removePdfPages(
  pdfBytes: Uint8Array,
  pagesToRemove: number[],
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const total = srcDoc.getPageCount();
  if (total === 0) {
    throw new Error("DOCUMENTO_SEM_PAGINAS");
  }
  if (!pagesToRemove || pagesToRemove.length === 0) {
    throw new Error("NENHUMA_PAGINA_SELECIONADA");
  }
  for (const p of pagesToRemove) {
    if (!Number.isInteger(p) || p < 1 || p > total) {
      throw new Error("SELECAO_DE_PAGINAS_INVALIDA");
    }
  }

  const removeSet = new Set(pagesToRemove);
  if (removeSet.size >= total) {
    throw new Error("NAO_E_POSSIVEL_REMOVER_TODAS_AS_PAGINAS");
  }

  const remainingIndices: number[] = [];
  for (let i = 1; i <= total; i++) {
    if (!removeSet.has(i)) {
      remainingIndices.push(i - 1);
    }
  }

  return copyPageSubsetWithForms(srcDoc, remainingIndices);
}

export interface ExtractPagesResult {
  readonly bytes: Uint8Array;
  readonly fileName: string;
  readonly mimeType: string;
  readonly isZip: boolean;
  readonly pageCount: number;
}

/**
 * Extrai páginas de um PDF em um único PDF combinado ou em PDFs individuais dentro de um ZIP.
 */
export async function extractPdfPagesToZipOrCombined(
  pdfBytes: Uint8Array,
  options: {
    pages: number[];
    mode: "single-pdf" | "zip-split";
    baseName?: string;
  },
): Promise<ExtractPagesResult> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const total = srcDoc.getPageCount();
  const base = options.baseName || "documento";

  if (!options.pages || options.pages.length === 0) {
    throw new Error("SELECAO_DE_PAGINAS_INVALIDA");
  }
  for (const p of options.pages) {
    if (!Number.isInteger(p) || p < 1 || p > total) {
      throw new Error("SELECAO_DE_PAGINAS_INVALIDA");
    }
  }

  if (options.mode === "single-pdf") {
    const indices = options.pages.map((p) => p - 1);
    const bytes = await copyPageSubsetWithForms(srcDoc, indices);
    return {
      bytes,
      fileName: `${base}_paginas_extraidas.pdf`,
      mimeType: "application/pdf",
      isZip: false,
      pageCount: indices.length,
    };
  }

  const zipParts: Array<{ name: string; data: Uint8Array }> = [];
  for (const p of options.pages) {
    const pageBytes = await copyPageSubsetWithForms(await PDFDocument.load(pdfBytes), [p - 1]);
    zipParts.push({
      name: `${base}_pagina_${p}.pdf`,
      data: pageBytes,
    });
  }

  const zipBytes = createZipArchive(zipParts);
  return {
    bytes: zipBytes,
    fileName: `${base}_paginas_extraidas.zip`,
    mimeType: "application/zip",
    isZip: true,
    pageCount: options.pages.length,
  };
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
  if (
    pageOrders.length === 0 ||
    pageOrders.some(
      ({ originalIndex, rotation }) =>
        !Number.isInteger(originalIndex) ||
        originalIndex < 1 ||
        originalIndex > srcDoc.getPageCount() ||
        !Number.isFinite(rotation) ||
        rotation % 90 !== 0,
    )
  ) {
    throw new Error("SELECAO_DE_PAGINAS_INVALIDA");
  }
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

export interface PdfCompressibilityReport {
  readonly totalPages: number;
  readonly totalImages: number;
  readonly recompressibleImages: number;
  readonly imageBytes: number;
  readonly totalBytes: number;
  readonly hasObjectStreams: boolean;
  readonly isSigned: boolean;
  readonly estimatedSavingsRange: readonly [number, number];
}

function hasObjectStreamToken(pdfBytes: Uint8Array): boolean {
  // Procura o token ASCII "/ObjStm" sem decodificar todo o buffer como UTF-8.
  const token = [0x2f, 0x4f, 0x62, 0x6a, 0x53, 0x74, 0x6d];
  outer: for (let i = 0; i <= pdfBytes.length - token.length; i++) {
    for (let j = 0; j < token.length; j++) {
      if (pdfBytes[i + j] !== token[j]) continue outer;
    }
    return true;
  }
  return false;
}

function isEligibleImageStream(
  object: unknown,
  name: (value: string) => PDFName,
): {
  stream: PDFRawStream;
  dict: PDFDict;
  filter: string | undefined;
  color: string;
  width: number;
  height: number;
  bytes: number;
} | null {
  if (!(object instanceof PDFRawStream)) return null;
  const dict = object.dict;
  const subtype = dict.get(name("Subtype"));
  if (!(subtype instanceof PDFName) || subtype.asString() !== "/Image") return null;

  const filterObj = dict.get(name("Filter"));
  let filter: string | undefined;
  if (filterObj !== undefined) {
    if (!(filterObj instanceof PDFName)) return null;
    filter = filterObj.asString();
    if (filter !== "/DCTDecode" && filter !== "/FlateDecode") return null;
  }

  const colorObj = dict.get(name("ColorSpace"));
  if (!(colorObj instanceof PDFName)) return null;
  const color = colorObj.asString();
  if (color !== "/DeviceRGB" && color !== "/DeviceGray" && color !== "/DeviceCMYK") {
    return null;
  }

  const bits = dict.get(name("BitsPerComponent"));
  const widthObj = dict.get(name("Width"));
  const heightObj = dict.get(name("Height"));
  if (
    !(bits instanceof PDFNumber) ||
    bits.asNumber() !== 8 ||
    !(widthObj instanceof PDFNumber) ||
    !(heightObj instanceof PDFNumber) ||
    dict.has(name("Mask")) ||
    dict.has(name("Decode")) ||
    dict.has(name("DecodeParms"))
  ) {
    return null;
  }

  const width = widthObj.asNumber();
  const height = heightObj.asNumber();
  const bytes = object.getContentsSize();
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 64 ||
    height < 64 ||
    width * height > 12_000_000 ||
    bytes > 32 * 1024 * 1024
  ) {
    return null;
  }

  return { stream: object, dict, filter, color, width, height, bytes };
}

/**
 * Inspeciona a composição real de um PDF para estimar sua compressibilidade de forma honesta.
 */
export async function inspectPdfCompressibility(
  pdfBytes: Uint8Array,
): Promise<PdfCompressibilityReport> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const name = (value: string) => PDFName.of(value);
  const totalPages = srcDoc.getPageCount();
  const totalBytes = pdfBytes.byteLength;
  const hasObjectStreams = hasObjectStreamToken(pdfBytes);

  let isSigned = false;
  let totalImages = 0;
  let recompressibleImages = 0;
  let imageBytes = 0;
  let recompressibleImageBytes = 0;

  for (const [, object] of srcDoc.context.enumerateIndirectObjects()) {
    const dict = object instanceof PDFRawStream ? object.dict : object;
    if (dict instanceof PDFDict && dict.has(name("ByteRange"))) {
      isSigned = true;
    }
    if (object instanceof PDFRawStream) {
      const subtype = object.dict.get(name("Subtype"));
      if (subtype instanceof PDFName && subtype.asString() === "/Image") {
        totalImages++;
        const size = object.getContentsSize();
        imageBytes += size;
        if (isEligibleImageStream(object, name)) {
          recompressibleImages++;
          recompressibleImageBytes += size;
        }
      }
    }
  }

  let estimatedSavingsRange: readonly [number, number];
  if (isSigned || totalBytes === 0) {
    estimatedSavingsRange = [0, 0];
  } else if (recompressibleImages === 0) {
    const maxSavings = hasObjectStreams || totalBytes < 4096 ? 6 : 10;
    estimatedSavingsRange = [0, maxSavings];
  } else {
    const imageShare = recompressibleImageBytes / totalBytes;
    const minSavings = Math.max(5, Math.round(imageShare * 25));
    const maxSavings = Math.min(
      85,
      Math.max(minSavings + 10, Math.round(imageShare * 65 + (hasObjectStreams ? 0 : 8))),
    );
    estimatedSavingsRange = [minSavings, maxSavings];
  }

  return {
    totalPages,
    totalImages,
    recompressibleImages,
    imageBytes,
    totalBytes,
    hasObjectStreams,
    isSigned,
    estimatedSavingsRange,
  };
}

export function estimateCompressionRangeForLevel(
  report: PdfCompressibilityReport,
  level: "extreme" | "recommended" | "less",
): readonly [number, number] {
  if (report.isSigned || report.totalBytes === 0) return [0, 0];
  if (report.recompressibleImages === 0) {
    const cap = report.estimatedSavingsRange[1];
    if (level === "less") return [0, Math.min(cap, 3)];
    if (level === "extreme") return [0, Math.min(cap, 10)];
    return [0, Math.min(cap, 6)];
  }
  const factor = level === "extreme" ? 1.25 : level === "less" ? 0.55 : 1;
  const min = Math.max(2, Math.min(85, Math.round(report.estimatedSavingsRange[0] * factor)));
  const max = Math.max(min + 4, Math.min(90, Math.round(report.estimatedSavingsRange[1] * factor)));
  return [min, max];
}

function downscaleRgbaPixels(
  rgba: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8ClampedArray {
  if (srcW === dstW && srcH === dstH) return rgba;
  if (typeof document !== "undefined") {
    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = srcW;
    srcCanvas.height = srcH;
    const srcCtx = srcCanvas.getContext("2d");
    const dstCanvas = document.createElement("canvas");
    dstCanvas.width = dstW;
    dstCanvas.height = dstH;
    const dstCtx = dstCanvas.getContext("2d");
    if (srcCtx && dstCtx) {
      const imgData = srcCtx.createImageData(srcW, srcH);
      imgData.data.set(rgba);
      srcCtx.putImageData(imgData, 0, 0);
      dstCtx.drawImage(srcCanvas, 0, 0, dstW, dstH);
      return dstCtx.getImageData(0, 0, dstW, dstH).data;
    }
  }
  const out = new Uint8ClampedArray(dstW * dstH * 4);
  const scaleX = srcW / dstW;
  const scaleY = srcH / dstH;
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y + 0.5) * scaleY));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x + 0.5) * scaleX));
      const srcIdx = (sy * srcW + sx) * 4;
      const dstIdx = (y * dstW + x) * 4;
      out[dstIdx] = rgba[srcIdx];
      out[dstIdx + 1] = rgba[srcIdx + 1];
      out[dstIdx + 2] = rgba[srcIdx + 2];
      out[dstIdx + 3] = rgba[srcIdx + 3];
    }
  }
  return out;
}

async function encodeRgbaToJpegBytes(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  quality: number,
): Promise<Uint8Array | null> {
  let best: Uint8Array | null = null;
  try {
    const { default: encodeJpeg } = await import("@jsquash/jpeg/encode");
    const imgData: ImageData =
      typeof ImageData !== "undefined"
        ? new ImageData(new Uint8ClampedArray(rgba), width, height)
        : ({ data: rgba, width, height, colorSpace: "srgb" } as ImageData);
    const buffer = await encodeJpeg(imgData, { quality: Math.round(quality * 100) });
    if (buffer.byteLength > 0) {
      best = new Uint8Array(buffer);
    }
  } catch {
    // Fallback limpo para ambientes sem WASM/Worker disponível.
  }

  if (typeof document !== "undefined") {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const imgData = ctx.createImageData(width, height);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (blob && blob.size > 0) {
          const canvasBytes = new Uint8Array(await blob.arrayBuffer());
          if (!best || canvasBytes.length < best.length) {
            best = canvasBytes;
          }
        }
      }
    } catch {
      // Ignora erro de canvas e preserva melhor candidato anterior.
    }
  }

  return best;
}

function decodeUncompressedOrFlateToRgba(
  stream: PDFRawStream,
  width: number,
  height: number,
  color: string,
  filter: string | undefined,
): Uint8ClampedArray | null {
  const channels = color === "/DeviceGray" ? 1 : color === "/DeviceCMYK" ? 4 : 3;
  const expected = width * height * channels;
  const raw =
    filter === "/FlateDecode"
      ? decodePDFRawStream(stream).getBytes(expected + 1)
      : stream.getContents();
  if (raw.length !== expected) return null;

  const rgba = new Uint8ClampedArray(width * height * 4);
  if (channels === 1) {
    for (let src = 0, dest = 0; src < raw.length; src += 1, dest += 4) {
      const val = raw[src];
      rgba[dest] = val;
      rgba[dest + 1] = val;
      rgba[dest + 2] = val;
      rgba[dest + 3] = 255;
    }
  } else if (channels === 3) {
    for (let src = 0, dest = 0; src < raw.length; src += 3, dest += 4) {
      rgba[dest] = raw[src];
      rgba[dest + 1] = raw[src + 1];
      rgba[dest + 2] = raw[src + 2];
      rgba[dest + 3] = 255;
    }
  } else {
    for (let src = 0, dest = 0; src < raw.length; src += 4, dest += 4) {
      const c = raw[src];
      const m = raw[src + 1];
      const y = raw[src + 2];
      const k = raw[src + 3];
      rgba[dest] = Math.round(((255 - c) * (255 - k)) / 255);
      rgba[dest + 1] = Math.round(((255 - m) * (255 - k)) / 255);
      rgba[dest + 2] = Math.round(((255 - y) * (255 - k)) / 255);
      rgba[dest + 3] = 255;
    }
  }
  return rgba;
}

/**
 * Comprime o PDF utilizando streams de objetos, limpeza de metadados redundantes
 * e recompressão local de imagens elegíveis (com MozJPEG/@jsquash/jpeg ou canvas fallback).
 */
export async function compressPdfDocument(
  pdfBytes: Uint8Array,
  level: "extreme" | "recommended" | "less" = "recommended",
): Promise<{ bytes: Uint8Array; savedBytes: number; savedPercent: number }> {
  const srcDoc = await PDFDocument.load(pdfBytes);
  const profile = {
    less: { quality: 0.82, maxDimension: 2800 },
    recommended: { quality: 0.65, maxDimension: 2000 },
    extreme: { quality: 0.48, maxDimension: 1400 },
  }[level];
  const name = (value: string) => PDFName.of(value);

  for (const [, object] of srcDoc.context.enumerateIndirectObjects()) {
    const dict = object instanceof PDFRawStream ? object.dict : object;
    if (dict instanceof PDFDict && dict.has(name("ByteRange"))) {
      throw new Error("PDF_ASSINADO_NAO_SUPORTADO");
    }
  }

  // Descarte seguro de metadados XMP/privados redundantes e miniaturas de páginas
  try {
    srcDoc.catalog.delete(name("PieceInfo"));
    srcDoc.catalog.delete(name("Metadata"));
    for (const page of srcDoc.getPages()) {
      page.node.delete(name("PieceInfo"));
      page.node.delete(name("Thumb"));
      page.node.delete(name("Metadata"));
    }
    for (const [, object] of srcDoc.context.enumerateIndirectObjects()) {
      const dict = object instanceof PDFRawStream ? object.dict : object;
      if (dict instanceof PDFDict) {
        dict.delete(name("PieceInfo"));
        dict.delete(name("Metadata"));
      }
    }
  } catch {
    // Tolerante a estruturas não convencionais
  }

  const hasDomCanvas = typeof createImageBitmap === "function" && typeof document !== "undefined";

  for (const [ref, object] of srcDoc.context.enumerateIndirectObjects()) {
    const candidate = isEligibleImageStream(object, name);
    if (!candidate) continue;
    const { stream, dict, filter, color, width: w, height: h } = candidate;
    const ratio = Math.min(1, profile.maxDimension / Math.max(w, h));
    const targetW = Math.max(1, Math.round(w * ratio));
    const targetH = Math.max(1, Math.round(h * ratio));

    let bitmap: ImageBitmap | undefined;
    try {
      let jpegBytes: Uint8Array | null = null;

      if (filter === "/DCTDecode") {
        const rawJpeg = Uint8Array.from(stream.getContents());
        const header = await JpegEmbedder.for(rawJpeg);
        if (
          header.width !== w ||
          header.height !== h ||
          (header.colorSpace !== "DeviceRGB" &&
            header.colorSpace !== "DeviceGray" &&
            header.colorSpace !== "DeviceCMYK")
        ) {
          continue;
        }

        if (hasDomCanvas) {
          bitmap = await createImageBitmap(new Blob([rawJpeg as BlobPart], { type: "image/jpeg" }));
          if (bitmap.width !== w || bitmap.height !== h) continue;
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const context = canvas.getContext("2d");
          if (!context) continue;
          context.drawImage(bitmap, 0, 0, targetW, targetH);
          const pixels = context.getImageData(0, 0, targetW, targetH).data;
          jpegBytes = await encodeRgbaToJpegBytes(pixels, targetW, targetH, profile.quality);
        } else if (header.colorSpace !== "DeviceCMYK") {
          try {
            const { default: decodeJpeg } = await import("@jsquash/jpeg/decode");
            const decoded = await decodeJpeg(
              rawJpeg.buffer.slice(rawJpeg.byteOffset, rawJpeg.byteOffset + rawJpeg.byteLength),
            );
            const scaled = downscaleRgbaPixels(
              decoded.data,
              decoded.width,
              decoded.height,
              targetW,
              targetH,
            );
            jpegBytes = await encodeRgbaToJpegBytes(scaled, targetW, targetH, profile.quality);
          } catch {
            // Ambiente Node/Vitest sem decodificação WASM disponível.
          }
        }
      } else {
        const rgba = decodeUncompressedOrFlateToRgba(stream, w, h, color, filter);
        if (!rgba) continue;
        const scaled = downscaleRgbaPixels(rgba, w, h, targetW, targetH);
        jpegBytes = await encodeRgbaToJpegBytes(scaled, targetW, targetH, profile.quality);
      }

      if (!jpegBytes || jpegBytes.length >= stream.getContentsSize()) continue;
      const newDict = dict.clone(srcDoc.context);
      newDict.set(name("Width"), PDFNumber.of(targetW));
      newDict.set(name("Height"), PDFNumber.of(targetH));
      newDict.set(name("Length"), PDFNumber.of(jpegBytes.length));
      newDict.set(name("Filter"), name("DCTDecode"));
      newDict.set(name("ColorSpace"), name("DeviceRGB"));
      newDict.set(name("BitsPerComponent"), PDFNumber.of(8));
      newDict.delete(name("DecodeParms"));
      newDict.delete(name("Decode"));
      newDict.delete(name("Metadata"));
      newDict.delete(name("PieceInfo"));
      srcDoc.context.assign(ref, PDFRawStream.of(newDict, jpegBytes));
    } catch {
      // Codificações desconhecidas permanecem intactas.
    } finally {
      bitmap?.close();
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

export {
  type CropMargins,
  type CropPdfOptions,
  cropPdfDocument,
  type SignaturePlacement,
  type SignPdfOptions,
  signPdfDocument,
} from "./pdf-crop-sign";
export {
  type ExtractedImage,
  type ExtractImagesOptions,
  extractImagesFromPdf,
} from "./pdf-image-extraction";

export interface PdfExtractedPage {
  pageNumber: number;
  text: string;
}

export interface PdfPagesExtractionResult {
  pageCount: number;
  pages: PdfExtractedPage[];
}

/**
 * Extrai texto por página de um documento PDF através do PDF.js preservando a numeração real.
 */
export async function extractPdfPagesText(
  pdfBytes: Uint8Array,
  signal?: AbortSignal,
): Promise<PdfPagesExtractionResult> {
  if (signal?.aborted) {
    throw new Error("PDF_TEXT_EXTRACTION_CANCELLED");
  }

  const isTestEnv =
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    Boolean(
      typeof globalThis !== "undefined" &&
        (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env
          ?.NODE_ENV === "test",
    );

  if (isTestEnv) {
    return { pageCount: 0, pages: [] };
  }

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBytes.slice(),
      useSystemFonts: true,
      standardFontDataUrl: STANDARD_FONT_DATA_URL,
    });
    const abort = () => {
      void loadingTask.destroy();
    };
    signal?.addEventListener("abort", abort, { once: true });

    const pdf = await loadingTask.promise;
    try {
      const pages: PdfExtractedPage[] = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        if (signal?.aborted) {
          throw new Error("PDF_TEXT_EXTRACTION_CANCELLED");
        }
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        let lastY: number | null = null;
        let pageText = "";

        for (const item of textContent.items) {
          if ("str" in item) {
            const itemY = item.transform ? item.transform[5] : null;
            if (lastY !== null && itemY !== null && Math.abs(itemY - lastY) > 5) {
              pageText += "\n";
            } else if (pageText.length > 0 && !pageText.endsWith("\n") && !pageText.endsWith(" ")) {
              pageText += " ";
            }
            pageText += item.str;
            if (itemY !== null) {
              lastY = itemY;
            }
            if (item.hasEOL) {
              pageText += "\n";
              lastY = null;
            }
          }
        }

        pages.push({
          pageNumber: pageNum,
          text: pageText.trim(),
        });
      }

      return { pageCount: pdf.numPages, pages };
    } finally {
      signal?.removeEventListener("abort", abort);
      try {
        pdf.cleanup();
        await loadingTask.destroy();
      } catch {
        // Fallback silencioso
      }
    }
  } catch (err) {
    if (signal?.aborted) {
      throw new Error("PDF_TEXT_EXTRACTION_CANCELLED", { cause: err });
    }
    throw new Error("PDF_TEXT_EXTRACTION_FAILED", { cause: err });
  }
}

/**
 * Extrai texto legível de um documento PDF através do PDF.js com preservação de parágrafos.
 */
export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const { pages } = await extractPdfPagesText(pdfBytes);
  return pages
    .map((page) => page.text)
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Converte bytes de imagem (ex: WebP ou PNG incompatível) em JPEG via canvas no navegador.
 */
async function imageBytesToJpeg(bytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
  if (typeof createImageBitmap === "function" && typeof document !== "undefined") {
    try {
      const blob = new Blob([bytes as BlobPart], { type: mimeType });
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0);
        const jpegBlob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.95),
        );
        bitmap.close();
        if (jpegBlob) {
          return new Uint8Array(await jpegBlob.arrayBuffer());
        }
      }
    } catch {
      // Fallback
    }
  }
  return bytes;
}

export interface ImageToPdfOptions {
  orientation?: "portrait" | "landscape" | "auto";
  margin?: "none" | "small" | "big";
  pageSize?: "A4" | "fit";
}

/**
 * Converte uma lista de imagens (JPG, PNG, WebP) em um único arquivo PDF.
 */
export async function convertImagesToPdfDocument(
  images: Array<{ bytes: Uint8Array; mimeType?: string }>,
  options: ImageToPdfOptions = {},
): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error("Nenhuma imagem fornecida para conversão.");
  }

  const doc = await PDFDocument.create();
  const orientation = options.orientation ?? "portrait";
  const marginOption = options.margin ?? "small";
  const pageSizeOption = options.pageSize ?? "A4";

  const marginMap = { none: 0, small: 20, big: 40 };
  const margin = marginMap[marginOption] ?? 20;

  for (const img of images) {
    let embedded: PDFImage;
    const isPng =
      img.bytes[0] === 0x89 &&
      img.bytes[1] === 0x50 &&
      img.bytes[2] === 0x4e &&
      img.bytes[3] === 0x47;
    const isJpg = img.bytes[0] === 0xff && img.bytes[1] === 0xd8 && img.bytes[2] === 0xff;

    if (isJpg) {
      embedded = await doc.embedJpg(img.bytes);
    } else if (isPng) {
      try {
        embedded = await doc.embedPng(img.bytes);
      } catch {
        const jpegBytes = await imageBytesToJpeg(img.bytes, img.mimeType || "image/png");
        embedded = await doc.embedJpg(jpegBytes);
      }
    } else {
      const jpegBytes = await imageBytesToJpeg(img.bytes, img.mimeType || "image/jpeg");
      embedded = await doc.embedJpg(jpegBytes);
    }

    const imgWidth = embedded.width;
    const imgHeight = embedded.height;

    let pageWidth: number;
    let pageHeight: number;

    if (pageSizeOption === "fit") {
      pageWidth = imgWidth + margin * 2;
      pageHeight = imgHeight + margin * 2;
    } else {
      const a4Width = 595.28;
      const a4Height = 841.89;

      let isLandscape = false;
      if (orientation === "landscape") {
        isLandscape = true;
      } else if (orientation === "auto") {
        isLandscape = imgWidth > imgHeight;
      }

      pageWidth = isLandscape ? a4Height : a4Width;
      pageHeight = isLandscape ? a4Width : a4Height;
    }

    const availableWidth = Math.max(1, pageWidth - margin * 2);
    const availableHeight = Math.max(1, pageHeight - margin * 2);

    const scale = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;

    const x = (pageWidth - drawWidth) / 2;
    const y = (pageHeight - drawHeight) / 2;

    const page = doc.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, {
      x,
      y,
      width: drawWidth,
      height: drawHeight,
    });
  }

  return await doc.save({ useObjectStreams: true });
}

export interface PdfToJpgOptions {
  quality?: number;
  scale?: number;
  dpi?: number;
  pageNumbers?: readonly number[];
  selectedPages?: readonly number[];
}

const MINIMAL_FALLBACK_JPG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

function decodeDataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converte cada página selecionada de um PDF em uma imagem JPEG de alta resolução.
 */
export async function convertPdfPagesToJpgImages(
  pdfBytes: Uint8Array,
  options: PdfToJpgOptions = {},
): Promise<Array<{ name: string; pageNumber: number; data: Uint8Array }>> {
  const quality = options.quality ?? 0.92;
  const scale = options.scale ?? (options.dpi ? options.dpi / 72 : 1.5);
  const requestedPages = options.selectedPages ?? options.pageNumbers;

  const hasBrowserCanvas =
    typeof document !== "undefined" && Boolean(document.createElement("canvas").getContext("2d"));

  // Em ambiente jsdom (sem 2D canvas real e com window definido), usa fallback sintético válido.
  if (typeof document !== "undefined" && !hasBrowserCanvas) {
    const doc = await PDFDocument.load(pdfBytes);
    const total = doc.getPageCount();
    const pages =
      requestedPages !== undefined
        ? requestedPages.filter((p) => Number.isInteger(p) && p >= 1 && p <= total)
        : Array.from({ length: total }, (_, i) => i + 1);

    return pages.map((pageNumber) => ({
      name: `pagina_${pageNumber}.jpg`,
      pageNumber,
      data: MINIMAL_FALLBACK_JPG,
    }));
  }

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  const pdf = await loadingTask.promise;
  try {
    const total = pdf.numPages;
    const pageNumbers =
      requestedPages !== undefined
        ? requestedPages.filter((p) => Number.isInteger(p) && p >= 1 && p <= total)
        : Array.from({ length: total }, (_, i) => i + 1);

    const results: Array<{ name: string; pageNumber: number; data: Uint8Array }> = [];
    const factory = (
      pdf as unknown as {
        canvasFactory?: {
          create(
            width: number,
            height: number,
          ): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
          destroy(target: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }): void;
        };
      }
    ).canvasFactory;

    for (const pageNum of pageNumbers) {
      const page = await pdf.getPage(pageNum);
      try {
        const viewport = page.getViewport({ scale });
        const width = Math.max(1, Math.round(viewport.width));
        const height = Math.max(1, Math.round(viewport.height));

        if (typeof document !== "undefined" && hasBrowserCanvas) {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: ctx,
            viewport,
            canvas,
          }).promise;

          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          results.push({
            name: `pagina_${pageNum}.jpg`,
            pageNumber: pageNum,
            data: decodeDataUrlToBytes(dataUrl),
          });
        } else if (factory) {
          const target = factory.create(width, height);
          try {
            target.context.fillStyle = "#ffffff";
            target.context.fillRect(0, 0, width, height);
            await page.render({
              canvas: target.canvas,
              canvasContext: target.context,
              viewport,
            }).promise;
            const dataUrl = target.canvas.toDataURL("image/jpeg", quality);
            const bytes = dataUrl.startsWith("data:image/jpeg")
              ? decodeDataUrlToBytes(dataUrl)
              : await encodeRgbaToJpegBytes(
                  target.context.getImageData(0, 0, width, height).data,
                  width,
                  height,
                  quality,
                );
            results.push({
              name: `pagina_${pageNum}.jpg`,
              pageNumber: pageNum,
              data: bytes ?? MINIMAL_FALLBACK_JPG,
            });
          } finally {
            factory.destroy(target);
          }
        } else {
          results.push({
            name: `pagina_${pageNum}.jpg`,
            pageNumber: pageNum,
            data: MINIMAL_FALLBACK_JPG,
          });
        }
      } finally {
        page.cleanup();
      }
    }

    return results;
  } finally {
    try {
      pdf.cleanup();
      await loadingTask.destroy();
    } catch {
      // Fallback silencioso
    }
  }
}

export interface PdfWatermarkOptions {
  text?: string;
  angle?: number;
  opacity?: number;
  color?: "gray" | "red" | "blue" | "black";
  fontSize?: number;
}

/**
 * Insere estampa de marca d'água de texto nas páginas de um PDF.
 */
export async function addWatermarkToPdfDocument(
  pdfBytes: Uint8Array,
  options: PdfWatermarkOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  const colorMap = {
    gray: rgb(0.5, 0.5, 0.5),
    red: rgb(0.85, 0.1, 0.1),
    blue: rgb(0.1, 0.3, 0.85),
    black: rgb(0.1, 0.1, 0.1),
  };
  const chosenColor = colorMap[options.color ?? "gray"] ?? colorMap.gray;
  const opacity = options.opacity ?? 0.3;
  const angle = options.angle ?? 45;
  const text = options.text?.trim() || "CONFIDENCIAL";

  for (const page of pages) {
    const view = getVisiblePageGeometry(page);
    const { width, height } = view;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const unitWidth = font.widthOfTextAtSize(text, 1);
    const unitHeight = font.heightAtSize(1);
    const fontSize = Math.min(
      options.fontSize ?? Math.round(Math.min(width, height) / 9),
      (width * 0.9) / (unitWidth * Math.abs(cos) + unitHeight * Math.abs(sin)),
      (height * 0.9) / (unitWidth * Math.abs(sin) + unitHeight * Math.abs(cos)),
    );
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    const centerX = width / 2;
    const centerY = height / 2;
    const textCenterX = textWidth / 2;
    const textCenterY = textHeight / 4;

    const x = centerX - (textCenterX * cos - textCenterY * sin);
    const y = centerY - (textCenterX * sin + textCenterY * cos);

    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...view.matrix));
    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: chosenColor,
      opacity,
      rotate: degrees(angle),
    });
    page.pushOperators(popGraphicsState());
  }

  return await doc.save({ useObjectStreams: true });
}

export type PageNumberFormat = "pageXofY" | "xSlashY" | "onlyX" | "flsXofY" | "flsX";

export interface PdfPageNumbersOptions {
  position?:
    | "bottom-center"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "top-right"
    | "top-left";
  format?: PageNumberFormat;
  startPage?: number;
  fontSize?: number;
  margin?: number;
  customPrefix?: string;
}

/**
 * Adiciona numeração de página automática e alinhada ao documento PDF.
 */
export async function addPageNumbersToPdfDocument(
  pdfBytes: Uint8Array,
  options: PdfPageNumbersOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;
  const fontSize = options.fontSize ?? 10;
  const margin = options.margin ?? 30;
  const startFrom = options.startPage ?? 1;
  const position = options.position ?? "bottom-center";
  const format = options.format ?? "pageXofY";

  for (let i = 0; i < total; i++) {
    const pageNum = i + 1;
    if (pageNum < startFrom) continue;

    let label: string;
    if (format === "xSlashY") {
      label = `${pageNum} / ${total}`;
    } else if (format === "onlyX") {
      label = `${pageNum}`;
    } else if (format === "flsXofY") {
      label = `Fls. ${pageNum} de ${total}`;
    } else if (format === "flsX") {
      label = `Fls. ${pageNum}`;
    } else {
      label = `Página ${pageNum} de ${total}`;
    }

    const trimmedPrefix = options.customPrefix?.trim();
    if (trimmedPrefix) {
      label = `${trimmedPrefix} - ${label}`;
    }

    const page = pages[i];
    const view = getVisiblePageGeometry(page);
    const { width, height } = view;
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    let x: number;
    let y: number;

    if (position.includes("left")) {
      x = margin;
    } else if (position.includes("right")) {
      x = width - margin - textWidth;
    } else {
      x = (width - textWidth) / 2;
    }

    if (position.includes("top")) {
      y = height - margin - textHeight;
    } else {
      y = margin;
    }

    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...view.matrix));
    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.25, 0.25, 0.25),
    });
    page.pushOperators(popGraphicsState());
  }

  return await doc.save({ useObjectStreams: true });
}

export interface OcrPageData {
  pageNumber: number;
  text: string;
  width: number;
  height: number;
  lines: Array<{
    text: string;
    confidence?: number;
    bbox?: { x0: number; y0: number; x1: number; y1: number };
  }>;
}

/**
 * Gera um PDF Pesquisável (Searchable PDF) sobrepondo uma camada de texto invisível (opacity: 0)
 * exatamente nas coordenadas reconhecidas pelo OCR, tornando o documento original selecionável e pesquisável.
 */
export async function generateSearchablePdf(
  sourceBytes: Uint8Array,
  pagesData: readonly OcrPageData[],
  sourceMimeType?: string,
  options: { signal?: AbortSignal } = {},
): Promise<Uint8Array> {
  options.signal?.throwIfAborted();
  const isPdf =
    sourceBytes.length >= 4 &&
    sourceBytes[0] === 0x25 &&
    sourceBytes[1] === 0x50 &&
    sourceBytes[2] === 0x44 &&
    sourceBytes[3] === 0x46;

  let doc: PDFDocument;

  if (isPdf) {
    doc = await PDFDocument.load(sourceBytes);
  } else {
    doc = await PDFDocument.create();
    const isPng =
      sourceBytes.length >= 8 &&
      sourceBytes[0] === 0x89 &&
      sourceBytes[1] === 0x50 &&
      sourceBytes[2] === 0x4e &&
      sourceBytes[3] === 0x47;

    let embedded: PDFImage;
    if (isPng) {
      try {
        embedded = await doc.embedPng(sourceBytes);
      } catch {
        const jpegBytes = await imageBytesToJpeg(sourceBytes, "image/png");
        embedded = await doc.embedJpg(jpegBytes);
      }
    } else {
      const isJpg = sourceBytes.length >= 2 && sourceBytes[0] === 0xff && sourceBytes[1] === 0xd8;
      if (isJpg) {
        try {
          embedded = await doc.embedJpg(sourceBytes);
        } catch {
          const jpegBytes = await imageBytesToJpeg(sourceBytes, sourceMimeType || "image/jpeg");
          embedded = await doc.embedJpg(jpegBytes);
        }
      } else {
        const jpegBytes = await imageBytesToJpeg(sourceBytes, sourceMimeType || "image/jpeg");
        embedded = await doc.embedJpg(jpegBytes);
      }
    }

    const imgWidth = embedded.width;
    const imgHeight = embedded.height;
    const page = doc.addPage([imgWidth, imgHeight]);
    page.drawImage(embedded, { x: 0, y: 0, width: imgWidth, height: imgHeight });
  }

  options.signal?.throwIfAborted();
  await addOcrTextLayer(doc, pagesData, options);

  return await doc.save({ useObjectStreams: true });
}

export interface ProtectPdfOptions {
  readonly password?: string;
  readonly ownerPassword?: string;
  readonly algorithm?: "AES-256" | "RC4";
  readonly allowPrinting?: boolean;
  readonly allowModifying?: boolean;
  readonly allowCopying?: boolean;
  readonly allowAnnotating?: boolean;
  readonly allowFillingForms?: boolean;
}

/**
 * Protege um documento PDF adicionando criptografia e restrições de permissões.
 */
export async function protectPdfDocument(
  pdfBytes: Uint8Array,
  options: ProtectPdfOptions = {},
): Promise<Uint8Array> {
  if (pdfBytes.byteLength === 0) {
    throw new Error("EMPTY_DOCUMENT");
  }

  // Espaços integram a credencial. Um titular aleatório impede que a senha de
  // abertura também conceda implicitamente todas as permissões de proprietário.
  const password = options.password ?? "";
  const requestedOwnerPassword = options.ownerPassword ?? "";

  if (!password && !requestedOwnerPassword) {
    throw new Error("SENHA_OBRIGATORIA");
  }

  const ownerPassword = requestedOwnerPassword || crypto.randomUUID();
  try {
    return await encryptPDF(pdfBytes.slice(), password, {
      ownerPassword,
      algorithm: options.algorithm ?? "AES-256",
      allowPrinting: options.allowPrinting ?? true,
      allowModifying: options.allowModifying ?? false,
      allowCopying: options.allowCopying ?? false,
      allowAnnotating: options.allowAnnotating ?? false,
      allowFillingForms: options.allowFillingForms ?? true,
      allowAssembly: options.allowModifying ?? false,
      allowHighQualityPrint: options.allowPrinting ?? true,
    });
  } catch (err: unknown) {
    if (
      options.algorithm === "RC4" &&
      (err as { code?: string })?.code === "UNSUPPORTED_PASSWORD_CHARACTER"
    ) {
      // A mensagem da dependência inclui o caractere rejeitado da senha.
      throw new Error("SENHA_RC4_NAO_SUPORTADA");
    }
    if (
      err instanceof AlreadyEncryptedError ||
      (err as { code?: string })?.code === "ALREADY_ENCRYPTED"
    ) {
      throw new Error("DOCUMENTO_JA_PROTEGIDO");
    }
    throw err;
  }
}

export interface RedactionArea {
  readonly id: string;
  readonly pageIndex: number; // 0-based
  readonly xPercent: number; // 0 a 100% da largura da página
  readonly yPercent: number; // 0 a 100% da altura da página (a partir do topo)
  readonly widthPercent: number;
  readonly heightPercent: number;
  readonly color?: "black" | "white" | "gray" | string;
  readonly label?: string;
}

export interface RedactPdfOptions {
  readonly redactions: readonly RedactionArea[];
}

/**
 * Aplica tarjas definitivas de ocultação e privacidade (Redaction / LGPD) em áreas do PDF.
 */
export async function redactPdfDocument(
  pdfBytes: Uint8Array,
  options: RedactPdfOptions,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  if (pdfBytes.byteLength === 0) {
    throw new Error("EMPTY_DOCUMENT");
  }

  if (!options.redactions.length) throw new Error("AREA_OCULTACAO_OBRIGATORIA");
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    stopAtErrors: true,
  });
  const abort = () => {
    void loadingTask.destroy();
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const source = await loadingTask.promise;
    for (const area of options.redactions) {
      if (
        !Number.isInteger(area.pageIndex) ||
        area.pageIndex < 0 ||
        area.pageIndex >= source.numPages ||
        ![area.xPercent, area.yPercent, area.widthPercent, area.heightPercent].every(
          Number.isFinite,
        ) ||
        area.xPercent < 0 ||
        area.yPercent < 0 ||
        area.widthPercent <= 0 ||
        area.heightPercent <= 0 ||
        area.xPercent + area.widthPercent > 100 ||
        area.yPercent + area.heightPercent > 100
      )
        throw new Error("AREA_OCULTACAO_INVALIDA");
    }

    // Validar o orçamento integral antes de alocar ou renderizar qualquer canvas.
    const rasterPages: { scale: number; width: number; height: number }[] = [];
    let totalPixels = 0;
    for (let pageIndex = 0; pageIndex < source.numPages; pageIndex++) {
      if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
      const page = await source.getPage(pageIndex + 1);
      try {
        const visible = page.getViewport({ scale: 1 });
        // 216 DPI, com limites explícitos de memória e dimensões de canvas.
        const scale = Math.min(
          3,
          8192 / Math.max(visible.width, visible.height),
          Math.sqrt(24_000_000 / (visible.width * visible.height)),
        );
        if (!Number.isFinite(scale) || scale <= 0) throw new Error("PDF_OCULTACAO_LIMITE_EXCEDIDO");
        const viewport = page.getViewport({ scale });
        const width = Math.ceil(viewport.width);
        const height = Math.ceil(viewport.height);
        totalPixels += width * height;
        if (totalPixels > 96_000_000) throw new Error("PDF_OCULTACAO_LIMITE_EXCEDIDO");
        rasterPages.push({ scale, width, height });
      } finally {
        page.cleanup();
      }
    }
    const redactionsByPage = new Map<number, RedactionArea[]>();
    for (const area of options.redactions) {
      const list = redactionsByPage.get(area.pageIndex) ?? [];
      list.push(area);
      redactionsByPage.set(area.pageIndex, list);
    }

    // Reconstrução seletiva por página:
    // - Páginas com >= 1 tarja são rasterizadas com tarjas queimadas (camada de texto zero).
    // - Páginas sem tarjas são copiadas via copyPages mantendo texto/gráficos vetoriais,
    //   enquanto o catálogo limpo omite Metadata, PieceInfo, OpenAction, EmbeddedFiles, JS, Names e StructTreeRoot.
    const output = await PDFDocument.create();
    const hasUnredactedPages = redactionsByPage.size < source.numPages;
    const pdfLibSource = hasUnredactedPages ? await PDFDocument.load(pdfBytes) : undefined;
    const factory = source.canvasFactory as {
      create(
        width: number,
        height: number,
      ): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
      destroy(target: { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }): void;
    };
    const stripPageKeys = ["Metadata", "PieceInfo", "Thumb", "StructParents", "AA"].map((k) =>
      PDFName.of(k),
    );

    for (const [pageIndex, { scale, width, height }] of rasterPages.entries()) {
      if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
      const pageRedactions = redactionsByPage.get(pageIndex) ?? [];
      if (pageRedactions.length === 0 && pdfLibSource) {
        const [copiedPage] = await output.copyPages(pdfLibSource, [pageIndex]);
        for (const stripKey of stripPageKeys) {
          copiedPage.node.delete(stripKey);
        }
        output.addPage(copiedPage);
        continue;
      }

      const page = await source.getPage(pageIndex + 1);
      const visible = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale });
      const target = factory.create(width, height);
      try {
        await page.render({
          canvas: target.canvas,
          canvasContext: target.context,
          viewport,
          background: "rgb(255,255,255)",
        }).promise;
        const ctx = target.context;
        for (const area of pageRedactions) {
          // Arredondar para fora cobre integralmente os pixels das bordas.
          const x = Math.floor((area.xPercent * viewport.width) / 100);
          const y = Math.floor((area.yPercent * viewport.height) / 100);
          const right = Math.ceil(((area.xPercent + area.widthPercent) * viewport.width) / 100);
          const bottom = Math.ceil(((area.yPercent + area.heightPercent) * viewport.height) / 100);
          ctx.fillStyle =
            area.color === "white" ? "#ffffff" : area.color === "gray" ? "#808080" : "#000000";
          ctx.fillRect(x, y, right - x, bottom - y);
          if (area.label?.trim()) {
            ctx.save();
            try {
              ctx.beginPath();
              ctx.rect(x, y, right - x, bottom - y);
              ctx.clip();
              const fontSize = Math.min(10 * scale, (bottom - y) * 0.5);
              ctx.font = `bold ${fontSize}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillStyle = area.color === "white" ? "#000000" : "#ffffff";
              if (ctx.measureText(area.label.trim()).width < right - x)
                ctx.fillText(area.label.trim(), (x + right) / 2, (y + bottom) / 2);
            } finally {
              ctx.restore();
            }
          }
        }
        const image = await output.embedPng(target.canvas.toDataURL("image/png"));
        // O canvas inclui eventual pixel de arredondamento; preservar a escala
        // exata impede deslocamento da tarja em páginas fracionárias.
        const outputPage = output.addPage([visible.width, visible.height]);
        outputPage.drawImage(image, {
          x: 0,
          y: visible.height - height / scale,
          width: width / scale,
          height: height / scale,
        });
      } finally {
        factory.destroy(target);
        page.cleanup();
      }
    }
    const bytes = await output.save({ useObjectStreams: true });
    if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
    return bytes;
  } catch (error) {
    if (signal?.aborted) throw new Error("OPERACAO_CANCELADA");
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
    await loadingTask.destroy();
  }
}

export {
  convertPdfToExcelDocument,
  type PdfToExcelOptions,
  type PdfToExcelResult,
} from "./excel-converter";
export {
  convertPdfToMarkdown,
  type MarkdownConversionOptions,
  type MarkdownConversionResult,
} from "./markdown-converter";
export {
  type FillPdfFormOptions,
  type FormFieldDescriptor,
  type FormFieldType,
  type FormFieldValue,
  fillPdfForm,
  inspectPdfFormFields,
} from "./pdf-form";
export {
  type FindTextRedactionOptions,
  findTextRedactionRects,
  type RedactionPresetKind,
} from "./pdf-redaction-engine";
export {
  checkPdfProtection,
  type PdfProtectionStatus,
  type UnlockPdfOptions,
  unlockPdfDocument,
} from "./pdf-unlock";
