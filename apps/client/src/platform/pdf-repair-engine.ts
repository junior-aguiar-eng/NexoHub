import type { WrappedPdfiumModule } from "@embedpdf/pdfium";
import { Unzlib } from "fflate";
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFInvalidObject,
  PDFName,
  PDFNumber,
  type PDFObject,
  PDFPageLeaf,
  PDFPageTree,
  PDFRawStream,
  type PDFRef,
} from "pdf-lib";

export interface PdfRepairReport {
  readonly fixedHeader: boolean;
  readonly fixedEof: boolean;
  readonly fixedTrailer: boolean;
  readonly fixedXref: boolean;
  readonly recoveredPages: number;
  readonly totalDetectedPages: number;
  readonly originalSize: number;
  readonly repairedSize: number;
  readonly warnings: readonly string[];
}

export interface PdfRepairResult {
  readonly pdfBytes: Uint8Array;
  readonly report: PdfRepairReport;
}

export type PdfiumLoader = () => Promise<WrappedPdfiumModule | undefined>;

export interface PdfRepairOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (percent: number) => void;
  readonly loadPdfium?: PdfiumLoader;
}

export const PDF_REPAIR_LIMITS = {
  inputBytes: 16 * 1024 * 1024,
  outputBytes: 32 * 1024 * 1024,
  pages: 250,
  objects: 25_000,
  streamBytes: 8 * 1024 * 1024,
  decodedBytes: 64 * 1024 * 1024,
  imagePixels: 16_000_000,
  timeoutMs: 30_000,
} as const;

interface TailAndXrefInspection {
  readonly fixedEof: boolean;
  readonly fixedTrailer: boolean;
  readonly fixedXref: boolean;
}

const HEADER_SCAN_BYTES = 8192;
const TAIL_SCAN_BYTES = 2048;

function isNonFallbackPolicyError(message: string): boolean {
  return (
    message === "EMPTY_DOCUMENT" ||
    message === "OPERACAO_CANCELADA" ||
    message === "SENHA_OBRIGATORIA" ||
    message === "PDF_REPAIR_LIMIT" ||
    message === "PDF_REPAIR_EXPANSION_LIMIT" ||
    message === "PDF_REPAIR_SIGNED" ||
    message === "PDF_REPAIR_UNSUPPORTED" ||
    /encrypt|password/i.test(message)
  );
}

function isInvalidPdfObject(object: PDFObject): boolean {
  return object instanceof PDFInvalidObject;
}

function inspectStructuralTail(bytes: Uint8Array): TailAndXrefInspection {
  const decoder = new TextDecoder("latin1");
  const tail = decoder.decode(bytes.subarray(Math.max(0, bytes.length - TAIL_SCAN_BYTES)));
  const fixedEof = !/%%EOF\s*$/.test(tail);
  const startxrefMatches = [...tail.matchAll(/startxref\s+(\d+)/g)];
  const lastStartxref = startxrefMatches.at(-1);
  if (!lastStartxref) {
    return {
      fixedEof,
      fixedTrailer: !/\btrailer\b/.test(tail),
      fixedXref: true,
    };
  }

  const xrefOffset = Number(lastStartxref[1]);
  if (!Number.isSafeInteger(xrefOffset) || xrefOffset <= 0 || xrefOffset >= bytes.length) {
    return {
      fixedEof,
      fixedTrailer: !/\btrailer\b/.test(tail),
      fixedXref: true,
    };
  }

  const windowEnd = Math.min(bytes.length, xrefOffset + 65_536);
  const windowText = decoder.decode(bytes.subarray(xrefOffset, windowEnd));
  const trimmedStart = windowText.trimStart();

  if (/^xref(?:\s|$)/.test(trimmedStart)) {
    const hasTrailer = /\btrailer\b/.test(tail) || /\btrailer\b/.test(windowText);
    const fixedXref = !validateXrefSection(bytes, decoder, trimmedStart);
    return {
      fixedEof,
      fixedTrailer: !hasTrailer,
      fixedXref,
    };
  }

  const objMatch = /^(\d+)\s+(\d+)\s+obj\b/.exec(trimmedStart);
  if (objMatch) {
    const isXrefStream = /\/Type\s*\/XRef\b/.test(trimmedStart.slice(0, 512));
    return {
      fixedEof,
      fixedTrailer: false,
      fixedXref: !isXrefStream,
    };
  }

  return {
    fixedEof,
    fixedTrailer: !/\btrailer\b/.test(tail),
    fixedXref: true,
  };
}

function validateXrefSection(bytes: Uint8Array, decoder: TextDecoder, xrefText: string): boolean {
  let cursor = 4; // pula "xref"
  const length = xrefText.length;

  const skipWs = () => {
    while (cursor < length && /\s/.test(xrefText[cursor])) cursor++;
  };
  const nextToken = (): string | undefined => {
    skipWs();
    if (cursor >= length) return undefined;
    const start = cursor;
    while (cursor < length && !/\s/.test(xrefText[cursor])) cursor++;
    return xrefText.slice(start, cursor);
  };

  let inspected = 0;
  while (cursor < length) {
    const first = nextToken();
    if (!first) return false;
    if (first === "trailer") return true;

    const second = nextToken();
    if (!second) return false;

    const startObj = Number(first);
    const count = Number(second);
    if (
      !Number.isInteger(startObj) ||
      !Number.isInteger(count) ||
      startObj < 0 ||
      count < 0 ||
      count > PDF_REPAIR_LIMITS.objects
    ) {
      return false;
    }

    for (let i = 0; i < count; i++) {
      if (++inspected > PDF_REPAIR_LIMITS.objects) return false;
      const offsetTok = nextToken();
      const genTok = nextToken();
      const flagTok = nextToken();
      if (!offsetTok || !genTok || (flagTok !== "n" && flagTok !== "f")) {
        return false;
      }
      const entryOffset = Number(offsetTok);
      const gen = Number(genTok);
      if (!Number.isSafeInteger(entryOffset) || !Number.isInteger(gen) || entryOffset < 0) {
        return false;
      }
      if (flagTok === "n") {
        if (entryOffset <= 0 || entryOffset >= bytes.length) return false;
        const snippet = decoder
          .decode(bytes.subarray(entryOffset, Math.min(bytes.length, entryOffset + 48)))
          .trimStart();
        const header = /^(\d+)\s+\d+\s+obj\b/.exec(snippet);
        if (!header || Number(header[1]) !== startObj + i) {
          return false;
        }
      }
    }
  }

  return false;
}

function reconcilePageTree(
  tree: PDFPageTree,
  context: PDFDocument["context"],
  visited: Set<PDFDict>,
): { count: number; droppedKids: number; fixedCounts: boolean } {
  const kids = tree.lookupMaybe(PDFName.of("Kids"), PDFArray);
  if (!kids) {
    return { count: 0, droppedKids: 0, fixedCounts: false };
  }

  let totalCount = 0;
  let droppedKids = 0;
  let fixedCounts = false;

  for (let i = kids.size() - 1; i >= 0; i--) {
    const kidRef = kids.get(i);
    const resolved = context.lookup(kidRef);
    if (resolved instanceof PDFPageTree) {
      if (visited.has(resolved)) {
        kids.remove(i);
        droppedKids += 1;
        fixedCounts = true;
        continue;
      }
      visited.add(resolved);
      const sub = reconcilePageTree(resolved, context, visited);
      droppedKids += sub.droppedKids;
      if (sub.fixedCounts) fixedCounts = true;
      if (sub.count === 0) {
        kids.remove(i);
        fixedCounts = true;
      } else {
        totalCount += sub.count;
      }
    } else if (resolved instanceof PDFPageLeaf) {
      totalCount += 1;
    } else {
      kids.remove(i);
      droppedKids += 1;
      fixedCounts = true;
    }
  }

  const prevCount = tree.lookupMaybe(PDFName.of("Count"), PDFNumber)?.asNumber();
  if (prevCount !== totalCount) {
    tree.set(PDFName.of("Count"), context.obj(totalCount));
    fixedCounts = true;
  }

  return { count: totalCount, droppedKids, fixedCounts };
}

async function repairLayer1PdfLib(
  rawBytes: Uint8Array,
  bytes: Uint8Array,
  fixedHeader: boolean,
  tailInfo: TailAndXrefInspection,
  options: PdfRepairOptions,
  check: () => void,
): Promise<PdfRepairResult> {
  options.onProgress?.(10);
  const source = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    updateMetadata: false,
    throwOnInvalidObject: false,
  });
  check();
  if (source.isEncrypted) throw new Error("SENHA_OBRIGATORIA");

  if (!source.catalog) throw new Error("CORRUPTED_DOCUMENT");
  const pagesRoot = source.catalog.Pages();
  if (!(pagesRoot instanceof PDFPageTree)) throw new Error("CORRUPTED_DOCUMENT");

  const objects = source.context.enumerateIndirectObjects();
  if (objects.length > PDF_REPAIR_LIMITS.objects) throw new Error("PDF_REPAIR_LIMIT");

  // Um trailer perdido pode deixar o dicionário Info órfão. Não adivinhar sua associação.
  if (
    !source.context.trailerInfo.Info &&
    objects.some(
      ([, object]) =>
        object instanceof PDFDict &&
        !object.has(PDFName.of("Type")) &&
        !object.has(PDFName.of("Subtype")) &&
        ["Author", "Producer", "Creator", "CreationDate", "ModDate"].some((key) =>
          object.has(PDFName.of(key)),
        ),
    )
  ) {
    throw new Error("PDF_REPAIR_UNSUPPORTED");
  }

  const invalidRefs: PDFRef[] = [];
  for (const [ref, object] of objects) {
    if (isInvalidPdfObject(object)) {
      invalidRefs.push(ref);
    }
  }
  for (const ref of invalidRefs) {
    source.context.delete(ref);
  }

  const declaredPages = pagesRoot.lookupMaybe(PDFName.of("Count"), PDFNumber)?.asNumber();
  const visited = new Set<PDFDict>([pagesRoot]);
  const treeResult = reconcilePageTree(pagesRoot, source.context, visited);

  const pages = source.getPages();
  if (!pages.length) throw new Error("CORRUPTED_DOCUMENT");
  if (pages.length > PDF_REPAIR_LIMITS.pages) throw new Error("PDF_REPAIR_LIMIT");

  for (const page of pages) {
    const { width, height } = page.getSize();
    if (
      !Number.isFinite(width * height) ||
      width <= 0 ||
      height <= 0 ||
      width * height > PDF_REPAIR_LIMITS.imagePixels
    ) {
      throw new Error("PDF_REPAIR_LIMIT");
    }
  }

  let decodedTotal = 0;
  for (const [, object] of source.context.enumerateIndirectObjects()) {
    check();
    const dict =
      object instanceof PDFRawStream ? object.dict : object instanceof PDFDict ? object : undefined;
    if (dict?.has(PDFName.of("ByteRange"))) throw new Error("PDF_REPAIR_SIGNED");
    if (!(object instanceof PDFRawStream)) continue;
    const width = dict?.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber() ?? 0;
    const height = dict?.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber() ?? 0;
    if (width * height > PDF_REPAIR_LIMITS.imagePixels) throw new Error("PDF_REPAIR_LIMIT");
    let filter = object.dict.lookup(PDFName.of("Filter"));
    if (filter instanceof PDFArray) {
      if (filter.size() !== 1) throw new Error("PDF_REPAIR_UNSUPPORTED");
      filter = filter.lookup(0);
    }
    let decoded = 0;
    const consume = (chunk: Uint8Array) => {
      decoded += chunk.length;
      decodedTotal += chunk.length;
      if (
        decoded > PDF_REPAIR_LIMITS.streamBytes ||
        decodedTotal > PDF_REPAIR_LIMITS.decodedBytes
      ) {
        throw new Error("PDF_REPAIR_EXPANSION_LIMIT");
      }
    };
    if (!filter) consume(object.contents);
    else if (filter instanceof PDFName && ["/FlateDecode", "/Fl"].includes(filter.toString())) {
      const inflater = new Unzlib(consume);
      for (let offset = 0; offset < object.contents.length; offset += 1024) {
        inflater.push(
          object.contents.subarray(offset, offset + 1024),
          offset + 1024 >= object.contents.length,
        );
        check();
      }
    } else if (
      !(filter instanceof PDFName) ||
      !["/DCTDecode", "/DCT", "/JPXDecode", "/CCITTFaxDecode", "/JBIG2Decode"].includes(
        filter.toString(),
      )
    ) {
      throw new Error("PDF_REPAIR_UNSUPPORTED");
    }
  }

  options.onProgress?.(45);
  check();

  // Salvar o grafo conserva AcroForm, Names/EmbeddedFiles e metadados.
  const pdfBytes = await source.save({ useObjectStreams: false, updateFieldAppearances: false });
  check();
  if (pdfBytes.length > PDF_REPAIR_LIMITS.outputBytes) throw new Error("PDF_REPAIR_LIMIT");
  options.onProgress?.(70);

  const warnings: string[] = [];
  if (invalidRefs.length > 0) {
    warnings.push(
      `${invalidRefs.length} objeto(s) indireto(s) inválido(s) foram descartado(s) durante a reconstrução.`,
    );
  }
  if (treeResult.droppedKids > 0) {
    warnings.push(
      `Recuperação parcial: ${treeResult.droppedKids} referência(s) de página corrompida(s) não puderam ser recuperadas.`,
    );
  } else if (declaredPages === undefined) {
    warnings.push(`Contagem /Count ausente em /Pages foi corrigida para ${pages.length}.`);
  } else if (declaredPages !== pages.length) {
    warnings.push(
      `Contagem declarada em /Pages (/Count ${declaredPages}) divergia das ${pages.length} página(s) válida(s) e foi corrigida.`,
    );
  }

  const totalDetectedPages =
    treeResult.droppedKids > 0
      ? Math.max(
          pages.length + treeResult.droppedKids,
          declaredPages !== undefined && declaredPages <= PDF_REPAIR_LIMITS.pages
            ? declaredPages
            : pages.length + treeResult.droppedKids,
        )
      : pages.length;

  return {
    pdfBytes,
    report: {
      fixedHeader,
      fixedEof: tailInfo.fixedEof,
      fixedTrailer: tailInfo.fixedTrailer,
      fixedXref: tailInfo.fixedXref || treeResult.fixedCounts || invalidRefs.length > 0,
      recoveredPages: pages.length,
      totalDetectedPages,
      originalSize: rawBytes.length,
      repairedSize: pdfBytes.length,
      warnings,
    },
  };
}

async function validateReserializedOutput(
  outputBytes: Uint8Array,
  pdfium: WrappedPdfiumModule,
): Promise<number> {
  try {
    const reloaded = await PDFDocument.load(outputBytes, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
    const count = reloaded.getPageCount();
    if (count > 0) return count;
  } catch {
    // Valida com o próprio PDFium caso pdf-lib não consiga ler algum recurso avançado.
  }

  const m = pdfium.pdfium;
  const memory = () => (m as unknown as { HEAPU8: Uint8Array }).HEAPU8;
  const ptr = m.wasmExports.malloc(outputBytes.length);
  if (!ptr) throw new Error("CORRUPTED_DOCUMENT");
  let reopened = 0;
  try {
    memory().set(outputBytes, ptr);
    reopened = pdfium.FPDF_LoadMemDocument(ptr, outputBytes.length, "");
    if (!reopened) throw new Error("CORRUPTED_DOCUMENT");
    const count = pdfium.FPDF_GetPageCount(reopened);
    if (count <= 0) throw new Error("CORRUPTED_DOCUMENT");
    return count;
  } finally {
    if (reopened) pdfium.FPDF_CloseDocument(reopened);
    m.wasmExports.free(ptr);
  }
}

async function repairLayer2Pdfium(
  rawBytes: Uint8Array,
  bytes: Uint8Array,
  fixedHeader: boolean,
  tailInfo: TailAndXrefInspection,
  options: PdfRepairOptions,
  check: () => void,
): Promise<PdfRepairResult> {
  check();
  const pdfium = await options.loadPdfium?.();
  if (!pdfium) throw new Error("CORRUPTED_DOCUMENT");
  check();
  options.onProgress?.(55);

  const m = pdfium.pdfium;
  const memory = () => (m as unknown as { HEAPU8: Uint8Array }).HEAPU8;
  const allocations: number[] = [];
  const alloc = (size: number) => {
    const ptr = m.wasmExports.malloc(Math.max(1, size));
    if (!ptr) throw new Error("CORRUPTED_DOCUMENT");
    allocations.push(ptr);
    return ptr;
  };

  let doc = 0;
  let destDoc = 0;
  let writer = 0;
  let outputBytes: Uint8Array;
  let detectedPages = 0;
  const warnings: string[] = [];

  try {
    const inputPtr = alloc(bytes.length);
    memory().set(bytes, inputPtr);
    doc = pdfium.FPDF_LoadMemDocument(inputPtr, bytes.length, "");
    if (!doc) {
      if (pdfium.FPDF_GetLastError() === 4) throw new Error("SENHA_OBRIGATORIA");
      throw new Error("CORRUPTED_DOCUMENT");
    }
    if (pdfium.EPDF_IsEncrypted(doc)) throw new Error("SENHA_OBRIGATORIA");
    if (pdfium.FPDF_GetSignatureCount(doc) > 0) throw new Error("PDF_REPAIR_SIGNED");

    detectedPages = pdfium.FPDF_GetPageCount(doc);
    if (detectedPages <= 0) throw new Error("CORRUPTED_DOCUMENT");
    if (detectedPages > PDF_REPAIR_LIMITS.pages) throw new Error("PDF_REPAIR_LIMIT");

    const validPageIndices: number[] = [];
    for (let i = 0; i < detectedPages; i++) {
      check();
      const page = pdfium.FPDF_LoadPage(doc, i);
      if (!page) {
        warnings.push(`Página ${i + 1} não pôde ser carregada e foi omitida da recuperação.`);
        continue;
      }
      try {
        const width = pdfium.FPDF_GetPageWidth(page);
        const height = pdfium.FPDF_GetPageHeight(page);
        if (!Number.isFinite(width * height) || width <= 0 || height <= 0) {
          warnings.push(`Página ${i + 1} possui dimensões inválidas e foi omitida.`);
          continue;
        }
        if (width * height > PDF_REPAIR_LIMITS.imagePixels) {
          throw new Error("PDF_REPAIR_LIMIT");
        }
        validPageIndices.push(i);
      } finally {
        pdfium.FPDF_ClosePage(page);
      }
    }

    if (validPageIndices.length === 0) throw new Error("CORRUPTED_DOCUMENT");

    writer = pdfium.PDFiumExt_OpenFileWriter();
    if (!writer) throw new Error("CORRUPTED_DOCUMENT");

    let saved = false;
    if (validPageIndices.length === detectedPages) {
      saved = pdfium.FPDF_SaveAsCopy(doc, writer, 2);
    }
    if (!saved) {
      destDoc = pdfium.FPDF_CreateNewDocument();
      if (!destDoc) throw new Error("CORRUPTED_DOCUMENT");
      const indicesPtr = alloc(validPageIndices.length * 4);
      for (let i = 0; i < validPageIndices.length; i++) {
        m.setValue(indicesPtr + i * 4, validPageIndices[i], "i32");
      }
      if (!pdfium.FPDF_ImportPagesByIndex(destDoc, doc, indicesPtr, validPageIndices.length, 0)) {
        throw new Error("CORRUPTED_DOCUMENT");
      }
      if (!pdfium.FPDF_SaveAsCopy(destDoc, writer, 2)) {
        throw new Error("CORRUPTED_DOCUMENT");
      }
    }

    const outputSize = pdfium.PDFiumExt_GetFileWriterSize(writer);
    if (outputSize <= 0) throw new Error("CORRUPTED_DOCUMENT");
    if (outputSize > PDF_REPAIR_LIMITS.outputBytes) throw new Error("PDF_REPAIR_LIMIT");

    const outPtr = alloc(outputSize);
    if (!pdfium.PDFiumExt_GetFileWriterData(writer, outPtr, outputSize)) {
      throw new Error("CORRUPTED_DOCUMENT");
    }
    outputBytes = memory().slice(outPtr, outPtr + outputSize);
  } finally {
    if (writer) pdfium.PDFiumExt_CloseFileWriter(writer);
    if (destDoc) pdfium.FPDF_CloseDocument(destDoc);
    if (doc) pdfium.FPDF_CloseDocument(doc);
    for (const ptr of allocations) m.wasmExports.free(ptr);
  }

  check();
  const recoveredPages = await validateReserializedOutput(outputBytes, pdfium);
  options.onProgress?.(80);

  const totalDetectedPages = Math.max(detectedPages, recoveredPages);
  if (recoveredPages < totalDetectedPages && warnings.length === 0) {
    warnings.push(
      `Recuperação parcial: ${recoveredPages} de ${totalDetectedPages} páginas puderam ser preservadas.`,
    );
  }
  warnings.push("Tabela xref e objetos indiretos reconstruídos via recuperação profunda.");

  return {
    pdfBytes: outputBytes,
    report: {
      fixedHeader,
      fixedEof: tailInfo.fixedEof,
      fixedTrailer: true,
      fixedXref: true,
      recoveredPages,
      totalDetectedPages,
      originalSize: rawBytes.length,
      repairedSize: outputBytes.length,
      warnings,
    },
  };
}

/**
 * Pipeline em 2 camadas para reparo de PDF:
 * Camada 1: reconstrução estrutural tolerante via pdf-lib.
 * Camada 2: recuperação profunda de xref e objetos via @embedpdf/pdfium (FPDF_SaveAsCopy).
 */
function rethrowIfPolicyError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (!isNonFallbackPolicyError(message)) return;
  if (/encrypt|password/i.test(message) && message !== "SENHA_OBRIGATORIA") {
    throw new Error("SENHA_OBRIGATORIA");
  }
  throw err;
}

/**
 * Repairs damaged PDFs in two layers: fast tolerant `pdf-lib` reconciliation
 * first, falling back to deep `@embedpdf/pdfium` reconstruction when needed.
 */
export async function repairPdfDocument(
  rawBytes: Uint8Array,
  options: PdfRepairOptions = {},
): Promise<PdfRepairResult> {
  const check = () => {
    if (options.signal?.aborted) throw new Error("OPERACAO_CANCELADA");
  };
  check();
  if (!rawBytes.length) throw new Error("EMPTY_DOCUMENT");
  if (rawBytes.length > PDF_REPAIR_LIMITS.inputBytes) throw new Error("PDF_REPAIR_LIMIT");

  const header = new TextDecoder("latin1").decode(rawBytes.subarray(0, HEADER_SCAN_BYTES));
  const match = /%PDF-\d\.\d(?:\r|\n|\s)/.exec(header);
  if (!match) throw new Error("CORRUPTED_DOCUMENT");

  const bytes = rawBytes.slice(match.index);
  const fixedHeader = match.index > 0;
  const tailInfo = inspectStructuralTail(bytes);

  try {
    return await repairLayer1PdfLib(rawBytes, bytes, fixedHeader, tailInfo, options, check);
  } catch (layer1Error) {
    rethrowIfPolicyError(layer1Error);
    try {
      return await repairLayer2Pdfium(rawBytes, bytes, fixedHeader, tailInfo, options, check);
    } catch (layer2Error) {
      rethrowIfPolicyError(layer2Error);
      throw new Error("CORRUPTED_DOCUMENT");
    }
  }
}
