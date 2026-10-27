import { Unzlib } from "fflate";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from "pdf-lib";

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
export interface PdfRepairOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (percent: number) => void;
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

/** O parser do pdf-lib é o único reconstrutor. Regex nunca cria xref/Root a partir de streams. */
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
  const header = new TextDecoder("latin1").decode(rawBytes.subarray(0, 4096));
  const match = /%PDF-\d\.\d(?:\r|\n|\s)/.exec(header);
  if (!match) throw new Error("CORRUPTED_DOCUMENT");
  const bytes = rawBytes.slice(match.index);
  const tail = new TextDecoder("latin1").decode(bytes.subarray(Math.max(0, bytes.length - 2048)));
  try {
    options.onProgress?.(10);
    const source = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
    check();
    const declaredPages = source.catalog.Pages().lookup(PDFName.of("Count"), PDFNumber).asNumber();
    const pages = source.getPages();
    if (!pages.length) throw new Error("CORRUPTED_DOCUMENT");
    if (declaredPages !== pages.length) throw new Error("CORRUPTED_DOCUMENT");
    if (pages.length > PDF_REPAIR_LIMITS.pages) throw new Error("PDF_REPAIR_LIMIT");
    for (const page of pages) {
      const { width, height } = page.getSize();
      if (
        !Number.isFinite(width * height) ||
        width <= 0 ||
        height <= 0 ||
        width * height > PDF_REPAIR_LIMITS.imagePixels
      )
        throw new Error("PDF_REPAIR_LIMIT");
    }
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
    )
      throw new Error("PDF_REPAIR_UNSUPPORTED");
    let decodedTotal = 0;
    for (const [, object] of objects) {
      check();
      const dict =
        object instanceof PDFRawStream
          ? object.dict
          : object instanceof PDFDict
            ? object
            : undefined;
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
        )
          throw new Error("PDF_REPAIR_EXPANSION_LIMIT");
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
      )
        throw new Error("PDF_REPAIR_UNSUPPORTED");
    }
    options.onProgress?.(45);
    check();
    // Salvar o grafo conserva AcroForm, Names/EmbeddedFiles e metadados.
    // Copiar somente páginas descartava essas raízes do catálogo.
    const pdfBytes = await source.save({ useObjectStreams: false, updateFieldAppearances: false });
    check();
    if (pdfBytes.length > PDF_REPAIR_LIMITS.outputBytes) throw new Error("PDF_REPAIR_LIMIT");
    options.onProgress?.(70);
    return {
      pdfBytes,
      report: {
        fixedHeader: match.index > 0,
        fixedEof: !/%%EOF\s*$/.test(tail),
        fixedTrailer: false,
        fixedXref: false,
        recoveredPages: pages.length,
        totalDetectedPages: pages.length,
        originalSize: rawBytes.length,
        repairedSize: pdfBytes.length,
        warnings: [],
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/^(PDF_REPAIR_|OPERACAO_CANCELADA|CORRUPTED_DOCUMENT)/.test(message)) throw error;
    if (/encrypt|password/i.test(message)) throw new Error("SENHA_OBRIGATORIA");
    throw new Error("CORRUPTED_DOCUMENT");
  }
}
