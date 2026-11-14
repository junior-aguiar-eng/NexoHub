import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFString,
} from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { withAppBase } from "./app-paths";
import type { OcrPageData } from "./pdf-engine";
import { addOcrTextLayer } from "./pdf-ocr-text-layer";
import { getVisiblePageGeometry } from "./pdf-page-geometry";

export type PdfAConformance = "2b" | "1b";
export type PdfAFontStrategy = "preserve-vector" | "compatibility-raster";

export interface PdfADiagnosticReport {
  readonly pageCount: number;
  readonly isEncrypted: boolean;
  readonly hasDigitalSignature: boolean;
  readonly unembeddedStandardFonts: readonly string[];
  readonly unembeddedCustomFonts: readonly string[];
  readonly hasTransparency: boolean;
  readonly prohibitedActions: readonly string[];
  readonly alreadyHasPdfaXmp: boolean;
  readonly alreadyHasOutputIntent: boolean;
}

export interface PdfAConversionOptions {
  readonly conformance?: PdfAConformance;
  readonly fontStrategy?: PdfAFontStrategy;
  readonly allowDiscardSignatures?: boolean;
  readonly dpi?: number;
  readonly iccProfileBytes?: Uint8Array;
  readonly ocrFontBytes?: Uint8Array;
  readonly signal?: AbortSignal;
  readonly onProgress?: (percent: number) => void;
  readonly pageRasterizer?: (
    bytes: Uint8Array,
    pageNumbers: readonly number[],
    dpi: number,
    signal?: AbortSignal,
  ) => Promise<readonly Uint8Array[]>;
  readonly pageTextExtractor?: (
    bytes: Uint8Array,
    pageNumbers: readonly number[],
    signal?: AbortSignal,
  ) => Promise<readonly OcrPageData[]>;
}

export interface PdfAConversionReport {
  readonly conformance: PdfAConformance;
  readonly pageCount: number;
  readonly vectorPages: number;
  readonly reconstructedPages: number;
  readonly embeddedIccProfile: boolean;
  readonly wroteXmpMetadata: boolean;
  readonly removedActionsCount: number;
  readonly warnings: readonly string[];
}

export interface PdfAConversionResult {
  readonly pdfBytes: Uint8Array;
  readonly report: PdfAConversionReport;
}

export interface PdfAStructureCheck {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export const PDFA_LIMITS = {
  inputBytes: 80 * 1024 * 1024,
  timeoutMs: 120_000,
} as const;

const STANDARD_14_FONT_NAMES = new Set([
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
  "Symbol",
  "ZapfDingbats",
]);

const PROHIBITED_CATALOG_OR_PAGE_KEYS = [
  "JS",
  "JavaScript",
  "OpenAction",
  "AA",
  "Launch",
  "Sound",
  "Movie",
  "RichMedia",
  "3D",
] as const;

const PROHIBITED_ANNOTATION_SUBTYPES = new Set([
  "/Sound",
  "/Movie",
  "/FileAttachment",
  "/Screen",
  "/3D",
  "/RichMedia",
]);

function normalizeFontBaseName(raw: string | undefined): string {
  if (!raw) return "UnknownFont";
  const cleaned = raw.startsWith("/") ? raw.slice(1) : raw;
  const plusIndex = cleaned.indexOf("+");
  return plusIndex > 0 ? cleaned.slice(plusIndex + 1) : cleaned;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatPdfIsoDate(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(0, 19)}Z`;
}

function lookupRawStream(doc: PDFDocument, ref: unknown): PDFRawStream | undefined {
  if (!ref) return undefined;
  const resolved = ref instanceof PDFRef ? doc.context.lookup(ref) : ref;
  return resolved instanceof PDFRawStream ? resolved : undefined;
}

function hasFontFileInDescriptor(doc: PDFDocument, descriptor: PDFDict): boolean {
  return (
    descriptor.has(PDFName.of("FontFile")) ||
    descriptor.has(PDFName.of("FontFile2")) ||
    descriptor.has(PDFName.of("FontFile3")) ||
    Boolean(lookupRawStream(doc, descriptor.get(PDFName.of("FontFile")))) ||
    Boolean(lookupRawStream(doc, descriptor.get(PDFName.of("FontFile2")))) ||
    Boolean(lookupRawStream(doc, descriptor.get(PDFName.of("FontFile3"))))
  );
}

function inspectFontDictionary(
  doc: PDFDocument,
  fontDict: PDFDict,
): { embedded: boolean; name: string; isStandard: boolean } {
  const subtype = fontDict.lookupMaybe(PDFName.of("Subtype"), PDFName)?.toString() ?? "";
  const rawName = fontDict.lookupMaybe(PDFName.of("BaseFont"), PDFName)?.toString();
  const baseName = normalizeFontBaseName(rawName);
  const isStandard = STANDARD_14_FONT_NAMES.has(baseName);

  if (subtype === "/Type3") {
    return { embedded: fontDict.has(PDFName.of("CharProcs")), name: baseName, isStandard: false };
  }

  if (subtype === "/Type0") {
    const descendants = fontDict.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray);
    if (!descendants || descendants.size() === 0) {
      return { embedded: false, name: baseName, isStandard };
    }
    for (let i = 0; i < descendants.size(); i++) {
      const descFont = descendants.lookupMaybe(i, PDFDict);
      if (!descFont) return { embedded: false, name: baseName, isStandard };
      const descriptor = descFont.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
      if (!descriptor || !hasFontFileInDescriptor(doc, descriptor)) {
        return { embedded: false, name: baseName, isStandard };
      }
    }
    return { embedded: true, name: baseName, isStandard };
  }

  const descriptor = fontDict.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict);
  if (descriptor && hasFontFileInDescriptor(doc, descriptor)) {
    return { embedded: true, name: baseName, isStandard };
  }
  return { embedded: false, name: baseName, isStandard };
}

function collectDictionaryFonts(
  doc: PDFDocument,
  resources: PDFDict | undefined,
  visitedXObjects: Set<PDFDict>,
): { standard: string[]; custom: string[] } {
  const standard: string[] = [];
  const custom: string[] = [];
  if (!resources) return { standard, custom };

  const fontsDict = resources.lookupMaybe(PDFName.of("Font"), PDFDict);
  if (fontsDict) {
    for (const key of fontsDict.keys()) {
      const fontDict = fontsDict.lookupMaybe(key, PDFDict);
      if (!fontDict) continue;
      const result = inspectFontDictionary(doc, fontDict);
      if (!result.embedded) {
        if (result.isStandard) standard.push(result.name);
        else custom.push(result.name);
      }
    }
  }

  const xObjectDict = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (xObjectDict) {
    for (const key of xObjectDict.keys()) {
      const xobj = doc.context.lookup(xObjectDict.get(key));
      const dict =
        xobj instanceof PDFRawStream ? xobj.dict : xobj instanceof PDFDict ? xobj : undefined;
      if (!dict || visitedXObjects.has(dict)) continue;
      if (dict.lookupMaybe(PDFName.of("Subtype"), PDFName)?.toString() === "/Form") {
        visitedXObjects.add(dict);
        const nested = collectDictionaryFonts(
          doc,
          dict.lookupMaybe(PDFName.of("Resources"), PDFDict),
          visitedXObjects,
        );
        standard.push(...nested.standard);
        custom.push(...nested.custom);
      }
    }
  }

  return { standard, custom };
}

function pageHasTransparency(
  doc: PDFDocument,
  resources: PDFDict | undefined,
  pageDict: PDFDict,
): boolean {
  const pageGroup = pageDict.lookupMaybe(PDFName.of("Group"), PDFDict);
  if (pageGroup?.lookupMaybe(PDFName.of("S"), PDFName)?.toString() === "/Transparency") {
    return true;
  }
  if (!resources) return false;

  const extGState = resources.lookupMaybe(PDFName.of("ExtGState"), PDFDict);
  if (extGState) {
    for (const key of extGState.keys()) {
      const gs = extGState.lookupMaybe(key, PDFDict);
      if (!gs) continue;
      const caLower = gs.lookupMaybe(PDFName.of("ca"), PDFNumber)?.asNumber();
      const caUpper = gs.lookupMaybe(PDFName.of("CA"), PDFNumber)?.asNumber();
      const bm = gs.lookupMaybe(PDFName.of("BM"), PDFName)?.toString();
      if (
        (typeof caLower === "number" && caLower < 1) ||
        (typeof caUpper === "number" && caUpper < 1) ||
        (bm && bm !== "/Normal" && bm !== "/Compatible") ||
        gs.has(PDFName.of("SMask"))
      ) {
        return true;
      }
    }
  }

  const xObject = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
  if (xObject) {
    for (const key of xObject.keys()) {
      const obj = doc.context.lookup(xObject.get(key));
      if (obj instanceof PDFRawStream) {
        if (obj.dict.has(PDFName.of("SMask"))) return true;
        const group = obj.dict.lookupMaybe(PDFName.of("Group"), PDFDict);
        if (group?.lookupMaybe(PDFName.of("S"), PDFName)?.toString() === "/Transparency") {
          return true;
        }
      }
    }
  }
  return false;
}

function validateIccProfileBytes(bytes: Uint8Array): void {
  if (bytes.byteLength < 128) {
    throw new Error("PDFA_INVALID_ICC_PROFILE");
  }
  const declaredSize =
    ((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);
  const sig = String.fromCharCode(bytes[36] ?? 0, bytes[37] ?? 0, bytes[38] ?? 0, bytes[39] ?? 0);
  if (sig !== "acsp" || declaredSize !== bytes.byteLength) {
    throw new Error("PDFA_INVALID_ICC_PROFILE");
  }
}

async function resolveDefaultIccProfile(signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(`${import.meta.env.BASE_URL}icc/sRGB-v2-micro.icc`, { signal });
  if (!response.ok) throw new Error("PDFA_ICC_UNAVAILABLE");
  const bytes = new Uint8Array(await response.arrayBuffer());
  validateIccProfileBytes(bytes);
  return bytes;
}

async function computeFileIdHex(seedBytes: Uint8Array): Promise<string> {
  const sample = seedBytes.subarray(0, Math.min(seedBytes.length, 4096));
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", sample as unknown as BufferSource);
    return Array.from(new Uint8Array(digest).subarray(0, 16))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }
  let acc = 0x811c9dc5;
  for (const byte of sample) {
    acc ^= byte;
    acc = Math.imul(acc, 0x01000193) >>> 0;
  }
  return acc.toString(16).padStart(8, "0").repeat(4);
}

export function buildPdfaXmpMetadata(params: {
  readonly conformance: PdfAConformance;
  readonly title?: string;
  readonly author?: string;
  readonly subject?: string;
  readonly creator?: string;
  readonly producer: string;
  readonly createDate: Date;
  readonly modDate: Date;
}): Uint8Array {
  const part = params.conformance === "1b" ? "1" : "2";
  const createIso = formatPdfIsoDate(params.createDate);
  const modIso = formatPdfIsoDate(params.modDate);
  const titleBlock = params.title
    ? `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(params.title)}</rdf:li></rdf:Alt></dc:title>`
    : "";
  const creatorBlock = params.author
    ? `<dc:creator><rdf:Seq><rdf:li>${escapeXml(params.author)}</rdf:li></rdf:Seq></dc:creator>`
    : "";
  const descBlock = params.subject
    ? `<dc:description><rdf:Alt><rdf:li xml:lang="x-default">${escapeXml(params.subject)}</rdf:li></rdf:Alt></dc:description>`
    : "";
  const creatorTool = params.creator ?? "NexoHub PDF/A Engine";

  const xml = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"
      xmlns:dc="http://purl.org/dc/elements/1.1/"
      xmlns:xmp="http://ns.adobe.com/xap/1.0/"
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdfaid:part>${part}</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
      ${titleBlock}
      ${creatorBlock}
      ${descBlock}
      <xmp:CreatorTool>${escapeXml(creatorTool)}</xmp:CreatorTool>
      <xmp:CreateDate>${createIso}</xmp:CreateDate>
      <xmp:ModifyDate>${modIso}</xmp:ModifyDate>
      <pdf:Producer>${escapeXml(params.producer)}</pdf:Producer>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  return new TextEncoder().encode(xml);
}

function walkPdfDictionaries(
  doc: PDFDocument,
  root: unknown,
  visited: Set<unknown>,
  onDict: (dict: PDFDict) => void,
): void {
  if (!root || visited.has(root)) return;
  const resolved = root instanceof PDFRef ? doc.context.lookup(root) : root;
  if (!resolved || visited.has(resolved)) return;
  visited.add(root);
  visited.add(resolved);

  if (resolved instanceof PDFDict) {
    onDict(resolved);
    for (const key of resolved.keys()) {
      walkPdfDictionaries(doc, resolved.get(key), visited, onDict);
    }
  } else if (resolved instanceof PDFRawStream) {
    onDict(resolved.dict);
    for (const key of resolved.dict.keys()) {
      walkPdfDictionaries(doc, resolved.dict.get(key), visited, onDict);
    }
  } else if (resolved instanceof PDFArray) {
    for (let i = 0; i < resolved.size(); i++) {
      walkPdfDictionaries(doc, resolved.get(i), visited, onDict);
    }
  }
}

function sanitizeDictionaryActions(dict: PDFDict): number {
  let removed = 0;
  for (const keyName of PROHIBITED_CATALOG_OR_PAGE_KEYS) {
    const key = PDFName.of(keyName);
    if (dict.has(key)) {
      dict.delete(key);
      removed += 1;
    }
  }
  const action = dict.lookupMaybe(PDFName.of("A"), PDFDict);
  if (action) {
    const sub = action.lookupMaybe(PDFName.of("S"), PDFName)?.toString();
    if (
      sub &&
      ["/JavaScript", "/Launch", "/Sound", "/Movie", "/RichMedia", "/GoTo3DView"].includes(sub)
    ) {
      dict.delete(PDFName.of("A"));
      removed += 1;
    }
  }
  return removed;
}

function sanitizePdfObjectsForPdfa(
  doc: PDFDocument,
  conformance: PdfAConformance,
  allowDiscardSignatures: boolean,
): number {
  let removed = 0;
  removed += sanitizeDictionaryActions(doc.catalog);

  const names = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  if (names) {
    for (const forbidden of ["JavaScript", "EmbeddedFiles"]) {
      const key = PDFName.of(forbidden);
      if (names.has(key)) {
        names.delete(key);
        removed += 1;
      }
    }
  }

  if (allowDiscardSignatures) {
    if (doc.catalog.has(PDFName.of("SigMock"))) {
      doc.catalog.delete(PDFName.of("SigMock"));
      removed += 1;
    }
    const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
    if (acroForm?.has(PDFName.of("SigFlags"))) {
      acroForm.delete(PDFName.of("SigFlags"));
      removed += 1;
    }
  }

  for (const page of doc.getPages()) {
    removed += sanitizeDictionaryActions(page.node);
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (annots) {
      const keptRefs: unknown[] = [];
      for (let i = 0; i < annots.size(); i++) {
        const refOrDict = annots.get(i);
        const annotDict = doc.context.lookupMaybe(refOrDict, PDFDict);
        if (!annotDict) continue;
        const subtype = annotDict.lookupMaybe(PDFName.of("Subtype"), PDFName)?.toString() ?? "";
        if (PROHIBITED_ANNOTATION_SUBTYPES.has(subtype)) {
          removed += 1;
          continue;
        }
        removed += sanitizeDictionaryActions(annotDict);
        if (
          allowDiscardSignatures &&
          annotDict.lookupMaybe(PDFName.of("FT"), PDFName)?.toString() === "/Sig"
        ) {
          removed += 1;
          continue;
        }
        // Em PDF/A, anotações visíveis precisam de Print bit (4) ligado e sem Hidden/NoView (2/32)
        const currentFlags = annotDict.lookupMaybe(PDFName.of("F"), PDFNumber)?.asNumber() ?? 0;
        const normalizedFlags = (currentFlags & ~(2 | 32 | 128)) | 4;
        annotDict.set(PDFName.of("F"), PDFNumber.of(normalizedFlags));
        keptRefs.push(refOrDict);
      }
      if (keptRefs.length === 0) {
        page.node.delete(PDFName.of("Annots"));
      } else if (keptRefs.length < annots.size()) {
        const nextArr = doc.context.obj([]);
        for (const item of keptRefs) {
          if (item instanceof PDFRef || item instanceof PDFDict) {
            nextArr.push(item);
          }
        }
        page.node.set(PDFName.of("Annots"), nextArr);
      }
    }

    if (conformance === "2b" && !page.node.has(PDFName.of("Group"))) {
      page.node.set(
        PDFName.of("Group"),
        doc.context.obj({
          Type: "Group",
          S: "Transparency",
          CS: "DeviceRGB",
          I: true,
        }),
      );
    } else if (conformance === "1b" && page.node.has(PDFName.of("Group"))) {
      page.node.delete(PDFName.of("Group"));
    }
  }

  const visitedSanitize = new Set<unknown>();
  const sanitizeDict = (dict: PDFDict) => {
    removed += sanitizeDictionaryActions(dict);
    if (conformance === "1b") {
      if (dict.has(PDFName.of("SMask"))) {
        dict.delete(PDFName.of("SMask"));
        removed += 1;
      }
      const group = dict.lookupMaybe(PDFName.of("Group"), PDFDict);
      if (group?.lookupMaybe(PDFName.of("S"), PDFName)?.toString() === "/Transparency") {
        dict.delete(PDFName.of("Group"));
        removed += 1;
      }
    }
    if (allowDiscardSignatures) {
      if (dict.has(PDFName.of("ByteRange"))) {
        dict.delete(PDFName.of("ByteRange"));
        removed += 1;
      }
      if (dict.lookupMaybe(PDFName.of("FT"), PDFName)?.toString() === "/Sig") {
        dict.delete(PDFName.of("FT"));
        removed += 1;
      }
    }
  };
  walkPdfDictionaries(doc, doc.catalog, visitedSanitize, sanitizeDict);
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    walkPdfDictionaries(doc, object, visitedSanitize, sanitizeDict);
  }
  return removed;
}

async function defaultBrowserRasterizer(
  pdfBytes: Uint8Array,
  pageNumbers: readonly number[],
  dpi: number,
  signal?: AbortSignal,
): Promise<Uint8Array[]> {
  const hasOffscreen = typeof OffscreenCanvas !== "undefined";
  const hasDom = typeof document !== "undefined";
  if (!hasOffscreen && !hasDom) {
    throw new Error("PDFA_RASTERIZER_UNAVAILABLE");
  }
  const origin = globalThis.location?.origin;
  const standardFontDataUrl =
    origin && origin !== "null" ? new URL(withAppBase("standard_fonts/"), origin).href : undefined;
  const task = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl,
  });
  const abortHandler = () => {
    void task.destroy().catch(() => {});
  };
  signal?.addEventListener("abort", abortHandler, { once: true });
  try {
    const pdf = await task.promise;
    try {
      const scale = Math.max(1, Math.min(3, dpi / 72));
      const outputs: Uint8Array[] = [];
      for (const pageNumber of pageNumbers) {
        signal?.throwIfAborted();
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const boundedScale = Math.min(
          scale,
          2800 / Math.max(baseViewport.width, baseViewport.height),
        );
        const viewport = page.getViewport({ scale: boundedScale });
        const width = Math.max(1, Math.round(viewport.width));
        const height = Math.max(1, Math.round(viewport.height));
        if (hasOffscreen) {
          const canvas = new OffscreenCanvas(width, height);
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) throw new Error("PDFA_CANVAS_UNAVAILABLE");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          await page.render({
            canvasContext: ctx as unknown as CanvasRenderingContext2D,
            viewport,
            canvas: null,
          }).promise;
          const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
          outputs.push(new Uint8Array(await blob.arrayBuffer()));
        } else {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) throw new Error("PDFA_CANVAS_UNAVAILABLE");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
          await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/jpeg", 0.92),
          );
          if (!blob) throw new Error("PDFA_JPEG_ENCODE_FAILED");
          outputs.push(new Uint8Array(await blob.arrayBuffer()));
        }
      }
      return outputs;
    } finally {
      await task.destroy().catch(() => {});
    }
  } finally {
    signal?.removeEventListener("abort", abortHandler);
  }
}

async function defaultTextExtractor(
  pdfBytes: Uint8Array,
  pageNumbers: readonly number[],
  signal?: AbortSignal,
): Promise<OcrPageData[]> {
  const origin = globalThis.location?.origin;
  const standardFontDataUrl =
    origin && origin !== "null" ? new URL(withAppBase("standard_fonts/"), origin).href : undefined;
  const task = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl,
  });
  try {
    const pdf = await task.promise;
    try {
      const results: OcrPageData[] = [];
      for (const pageNumber of pageNumbers) {
        signal?.throwIfAborted();
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();
        const lineBuckets = new Map<
          number,
          { text: string; minX: number; maxX: number; minY: number; maxY: number }
        >();

        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const x = item.transform[4] ?? 0;
          const pdfY = item.transform[5] ?? 0;
          const h = Math.max(
            8,
            Math.hypot(item.transform[2] ?? 0, item.transform[3] ?? 11) || item.height || 11,
          );
          const w = Math.max(2, item.width || item.str.length * (h * 0.5));
          const topY = Math.max(0, viewport.height - (pdfY + h));
          const bucketKey = Math.round(topY / 4) * 4;
          const prev = lineBuckets.get(bucketKey);
          if (!prev) {
            lineBuckets.set(bucketKey, {
              text: item.str,
              minX: Math.max(0, x),
              maxX: Math.min(viewport.width, x + w),
              minY: Math.max(0, topY),
              maxY: Math.min(viewport.height, topY + h),
            });
          } else {
            prev.text = `${prev.text} ${item.str}`;
            prev.minX = Math.min(prev.minX, Math.max(0, x));
            prev.maxX = Math.max(prev.maxX, Math.min(viewport.width, x + w));
            prev.minY = Math.min(prev.minY, Math.max(0, topY));
            prev.maxY = Math.max(prev.maxY, Math.min(viewport.height, topY + h));
          }
        }

        const lines = [...lineBuckets.values()]
          .filter(
            (entry) => entry.maxX > entry.minX && entry.maxY > entry.minY && entry.text.trim(),
          )
          .map((entry) => ({
            text: entry.text.trim(),
            bbox: { x0: entry.minX, y0: entry.minY, x1: entry.maxX, y1: entry.maxY },
          }));
        results.push({
          pageNumber,
          text: lines.map((line) => line.text).join("\n"),
          width: viewport.width,
          height: viewport.height,
          lines,
        });
      }
      return results;
    } finally {
      await task.destroy().catch(() => {});
    }
  } catch {
    return [];
  }
}

export async function inspectPdfForPdfa(pdfBytes: Uint8Array): Promise<PdfADiagnosticReport> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new Error("PDFA_INVALID_INPUT");
  }

  if (doc.isEncrypted) {
    return {
      pageCount: 0,
      isEncrypted: true,
      hasDigitalSignature: false,
      unembeddedStandardFonts: [],
      unembeddedCustomFonts: [],
      hasTransparency: false,
      prohibitedActions: [],
      alreadyHasPdfaXmp: false,
      alreadyHasOutputIntent: false,
    };
  }

  const unembeddedStandard = new Set<string>();
  const unembeddedCustom = new Set<string>();
  const prohibited = new Set<string>();
  let hasTransparency = false;
  let hasDigitalSignature = false;

  const acroForm = doc.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  if (acroForm) {
    const sigFlags = acroForm.lookupMaybe(PDFName.of("SigFlags"), PDFNumber)?.asNumber() ?? 0;
    if (sigFlags > 0) hasDigitalSignature = true;
  }

  const visitedDicts = new Set<unknown>();
  const inspectDict = (dict: PDFDict) => {
    if (dict.has(PDFName.of("ByteRange"))) hasDigitalSignature = true;
    if (dict.lookupMaybe(PDFName.of("FT"), PDFName)?.toString() === "/Sig") {
      hasDigitalSignature = true;
    }
    for (const keyName of PROHIBITED_CATALOG_OR_PAGE_KEYS) {
      if (dict.has(PDFName.of(keyName))) prohibited.add(`/${keyName}`);
    }
  };

  walkPdfDictionaries(doc, doc.catalog, visitedDicts, inspectDict);
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    walkPdfDictionaries(doc, obj, visitedDicts, inspectDict);
  }
  const names = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  if (names?.has(PDFName.of("JavaScript"))) prohibited.add("/JavaScript");
  if (names?.has(PDFName.of("EmbeddedFiles"))) prohibited.add("/EmbeddedFiles");

  const visitedXObjects = new Set<PDFDict>();
  for (const page of doc.getPages()) {
    const resources = page.node.Resources();
    const { standard, custom } = collectDictionaryFonts(doc, resources, visitedXObjects);
    for (const s of standard) unembeddedStandard.add(s);
    for (const c of custom) unembeddedCustom.add(c);
    if (pageHasTransparency(doc, resources, page.node)) {
      hasTransparency = true;
    }
  }

  let alreadyHasPdfaXmp = false;
  const metadataRef = doc.catalog.get(PDFName.of("Metadata"));
  const metadataStream = lookupRawStream(doc, metadataRef);
  if (metadataStream) {
    try {
      const xml = new TextDecoder().decode(
        metadataStream.dict.has(PDFName.of("Filter"))
          ? decodePDFRawStream(metadataStream).decode()
          : metadataStream.contents,
      );
      alreadyHasPdfaXmp = xml.includes("pdfaid:part");
    } catch {
      alreadyHasPdfaXmp = false;
    }
  }

  const outputIntents = doc.catalog.lookupMaybe(PDFName.of("OutputIntents"), PDFArray);
  const alreadyHasOutputIntent = Boolean(outputIntents && outputIntents.size() > 0);

  return {
    pageCount: doc.getPageCount(),
    isEncrypted: false,
    hasDigitalSignature,
    unembeddedStandardFonts: [...unembeddedStandard],
    unembeddedCustomFonts: [...unembeddedCustom],
    hasTransparency,
    prohibitedActions: [...prohibited],
    alreadyHasPdfaXmp,
    alreadyHasOutputIntent,
  };
}

export async function verifyPdfaStructure(
  pdfBytes: Uint8Array,
  conformance: PdfAConformance = "2b",
): Promise<PdfAStructureCheck> {
  const issues: string[] = [];
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return { valid: false, issues: ["Não foi possível abrir o PDF gerado para verificação."] };
  }

  if (doc.isEncrypted) issues.push("PDF/A não permite criptografia.");

  const intents = doc.catalog.lookupMaybe(PDFName.of("OutputIntents"), PDFArray);
  // ISO 19005-1 e ISO 19005-2 determinam sempre /S /GTS_PDFA1 no OutputIntent do PDF/A.
  const expectedSubtype = "/GTS_PDFA1";
  if (!intents || intents.size() === 0) {
    issues.push("Ausência de OutputIntents no catálogo.");
  } else {
    const first = intents.lookupMaybe(0, PDFDict);
    const sub = first?.get(PDFName.of("S"))?.toString();
    if (sub !== expectedSubtype) {
      issues.push(`OutputIntent com subtipo incompatível: ${sub ?? "ausente"}.`);
    }
    const iccRef = first?.get(PDFName.of("DestOutputProfile"));
    const iccStream = lookupRawStream(doc, iccRef);
    if (!iccStream) {
      issues.push("Perfil ICC DestOutputProfile ausente.");
    } else {
      try {
        const raw = iccStream.dict.has(PDFName.of("Filter"))
          ? decodePDFRawStream(iccStream).decode()
          : iccStream.contents;
        validateIccProfileBytes(raw);
      } catch {
        issues.push("Stream de perfil ICC inválido.");
      }
    }
  }

  const metaRef = doc.catalog.get(PDFName.of("Metadata"));
  const metaStream = lookupRawStream(doc, metaRef);
  if (!metaStream) {
    issues.push("Pacote XMP /Metadata ausente.");
  } else {
    const xml = new TextDecoder().decode(metaStream.contents);
    const expectedPart = conformance === "1b" ? "1" : "2";
    if (!xml.includes(`<pdfaid:part>${expectedPart}</pdfaid:part>`)) {
      issues.push("Metadado XMP sem declaração pdfaid:part esperada.");
    }
    if (!xml.includes("<pdfaid:conformance>B</pdfaid:conformance>")) {
      issues.push("Metadado XMP sem declaração pdfaid:conformance B.");
    }
  }

  const trailerId = doc.context.trailerInfo.ID;
  if (!(trailerId instanceof PDFArray) || trailerId.size() < 2) {
    issues.push("Trailer /ID ausente.");
  }

  const diag = await inspectPdfForPdfa(pdfBytes);
  if (diag.unembeddedStandardFonts.length > 0 || diag.unembeddedCustomFonts.length > 0) {
    issues.push(
      `Fontes sem incorporação encontradas: ${[
        ...diag.unembeddedStandardFonts,
        ...diag.unembeddedCustomFonts,
      ].join(", ")}.`,
    );
  }
  if (diag.prohibitedActions.length > 0) {
    issues.push(`Ações proibidas remanescentes: ${diag.prohibitedActions.join(", ")}.`);
  }
  if (conformance === "1b" && diag.hasTransparency) {
    issues.push("Transparência encontrada em perfil PDF/A-1b.");
  }

  return { valid: issues.length === 0, issues };
}

export async function convertPdfToPdfA(
  pdfBytes: Uint8Array,
  options: PdfAConversionOptions = {},
): Promise<PdfAConversionResult> {
  options.signal?.throwIfAborted();
  const conformance: PdfAConformance = options.conformance ?? "2b";
  const fontStrategy: PdfAFontStrategy = options.fontStrategy ?? "preserve-vector";
  const dpi = options.dpi ?? 200;

  options.onProgress?.(5);
  const iccBytes = options.iccProfileBytes ?? (await resolveDefaultIccProfile(options.signal));
  validateIccProfileBytes(iccBytes);
  options.signal?.throwIfAborted();

  let sourceDoc: PDFDocument;
  try {
    sourceDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    throw new Error("PDFA_INVALID_INPUT");
  }
  if (sourceDoc.isEncrypted) {
    throw new Error("PDFA_ENCRYPTED_REFUSED");
  }

  const initialDiag = await inspectPdfForPdfa(pdfBytes);
  if (initialDiag.hasDigitalSignature && !options.allowDiscardSignatures) {
    throw new Error("PDFA_SIGNED_REFUSED");
  }

  options.onProgress?.(20);
  const pageCount = sourceDoc.getPageCount();
  const visitedXObjects = new Set<PDFDict>();
  const pagesToReconstruct: number[] = [];

  for (let i = 0; i < pageCount; i++) {
    options.signal?.throwIfAborted();
    const page = sourceDoc.getPage(i);
    const resources = page.node.Resources();
    const fonts = collectDictionaryFonts(sourceDoc, resources, visitedXObjects);
    const pageHasUnembedded = fonts.standard.length > 0 || fonts.custom.length > 0;
    const hasAlpha = pageHasTransparency(sourceDoc, resources, page.node);
    const requiresFlatten =
      fontStrategy === "compatibility-raster" ||
      pageHasUnembedded ||
      (conformance === "1b" && hasAlpha);
    if (requiresFlatten) {
      pagesToReconstruct.push(i + 1);
    }
  }

  const output = await PDFDocument.create();
  const title = sourceDoc.getTitle();
  const author = sourceDoc.getAuthor();
  const subject = sourceDoc.getSubject();
  const creator = sourceDoc.getCreator() || "NexoHub";
  const producer = "NexoHub PDF/A Local Converter";
  const now = new Date();
  const createDate = sourceDoc.getCreationDate() ?? now;

  if (title) output.setTitle(title);
  if (author) output.setAuthor(author);
  if (subject) output.setSubject(subject);
  output.setCreator(creator);
  output.setProducer(producer);
  output.setCreationDate(createDate);
  output.setModificationDate(now);

  const warnings: string[] = [];
  const rasterPageSet = new Set(pagesToReconstruct);
  let rasterImages: readonly Uint8Array[] = [];
  let ocrTextPages: readonly OcrPageData[] = [];

  if (pagesToReconstruct.length > 0) {
    options.onProgress?.(35);
    const rasterizer = options.pageRasterizer ?? defaultBrowserRasterizer;
    rasterImages = await rasterizer(pdfBytes, pagesToReconstruct, dpi, options.signal);
    if (rasterImages.length !== pagesToReconstruct.length) {
      throw new Error("PDFA_RASTERIZER_COUNT_MISMATCH");
    }
    const textExtractor = options.pageTextExtractor ?? defaultTextExtractor;
    ocrTextPages = await textExtractor(pdfBytes, pagesToReconstruct, options.signal);
    warnings.push(
      `${pagesToReconstruct.length} página(s) foram reconstruídas em camada visual + texto pesquisável para assegurar conformidade de fontes/cores ISO 19005.`,
    );
  }

  options.onProgress?.(60);
  const ocrDataForReconstructed: OcrPageData[] = [];
  let rasterCursor = 0;
  for (let i = 0; i < pageCount; i++) {
    options.signal?.throwIfAborted();
    const pageNum = i + 1;
    if (!rasterPageSet.has(pageNum)) {
      const [copied] = await output.copyPages(sourceDoc, [i]);
      output.addPage(copied);
      continue;
    }

    const srcPage = sourceDoc.getPage(i);
    const geometry = getVisiblePageGeometry(srcPage);
    const outPage = output.addPage([geometry.width, geometry.height]);
    const imgBytes = rasterImages[rasterCursor++];
    if (!imgBytes) throw new Error("PDFA_RASTERIZER_MISSING_IMAGE");

    const isPng = imgBytes[0] === 0x89 && imgBytes[1] === 0x50;
    const embeddedImage = isPng ? await output.embedPng(imgBytes) : await output.embedJpg(imgBytes);
    await embeddedImage.embed();
    outPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: geometry.width,
      height: geometry.height,
    });

    const extracted = ocrTextPages.find((entry) => entry.pageNumber === pageNum);
    if (extracted && extracted.lines.length > 0) {
      ocrDataForReconstructed.push({
        ...extracted,
        pageNumber: pageNum,
      });
    }
  }

  if (ocrDataForReconstructed.length > 0) {
    await addOcrTextLayer(output, ocrDataForReconstructed, {
      preserveDrawingOrder: true,
      signal: options.signal,
      fontBytes: options.ocrFontBytes,
    });
  }

  options.onProgress?.(80);
  const removedActionsCount = sanitizePdfObjectsForPdfa(
    output,
    conformance,
    Boolean(options.allowDiscardSignatures),
  );

  const iccStream = output.context.flateStream(iccBytes, {
    N: 3,
    Alternate: PDFName.of("DeviceRGB"),
  });
  const iccRef = output.context.register(iccStream);
  const intentSubtype = PDFName.of("GTS_PDFA1");
  const intentDict = output.context.obj({
    Type: PDFName.of("OutputIntent"),
    S: intentSubtype,
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    RegistryName: PDFString.of("http://www.color.org"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    DestOutputProfile: iccRef,
  });
  output.catalog.set(PDFName.of("OutputIntents"), output.context.obj([intentDict]));

  const xmpBytes = buildPdfaXmpMetadata({
    conformance,
    title,
    author,
    subject,
    creator,
    producer,
    createDate,
    modDate: now,
  });
  const xmpRef = output.context.register(
    PDFRawStream.of(
      output.context.obj({
        Type: "Metadata",
        Subtype: "XML",
        Length: xmpBytes.length,
      }),
      xmpBytes,
    ),
  );
  output.catalog.set(PDFName.of("Metadata"), xmpRef);

  const idHex = await computeFileIdHex(pdfBytes);
  output.context.trailerInfo.ID = output.context.obj([
    PDFHexString.of(idHex),
    PDFHexString.of(idHex),
  ]);

  options.onProgress?.(92);
  const savedBytes = await output.save({ useObjectStreams: conformance === "2b" });
  const check = await verifyPdfaStructure(savedBytes, conformance);
  if (!check.valid) {
    throw new Error(`PDFA_VERIFICATION_FAILED: ${check.issues.join("; ")}`);
  }

  options.onProgress?.(100);
  return {
    pdfBytes: savedBytes,
    report: {
      conformance,
      pageCount,
      vectorPages: pageCount - pagesToReconstruct.length,
      reconstructedPages: pagesToReconstruct.length,
      embeddedIccProfile: true,
      wroteXmpMetadata: true,
      removedActionsCount: Math.max(removedActionsCount, initialDiag.prohibitedActions.length),
      warnings,
    },
  };
}
