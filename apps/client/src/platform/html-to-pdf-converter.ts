import {
  beginText,
  endText,
  PDFDocument,
  type PDFFont,
  type PDFPage,
  popGraphicsState,
  pushGraphicsState,
  type RGB,
  rgb,
  StandardFonts,
  setFontAndSize,
  setTextMatrix,
  setTextRenderingMode,
  showText,
  TextRenderingMode,
} from "pdf-lib";
import { parseLocalHtml } from "./html-local-document";
import type { OcrPageData } from "./pdf-engine";
import { addOcrTextLayer } from "./pdf-ocr-text-layer";

export interface HtmlToPdfOptions {
  readonly pageSize?: "A4" | "Letter" | "A3";
  readonly orientation?: "portrait" | "landscape";
  readonly margin?: "none" | "small" | "normal" | "wide";
  readonly includePageNumbers?: boolean;
  readonly baseTitle?: string;
}

export interface HtmlToPdfResult {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly title: string;
}

export interface SanitizedHtmlDocument {
  readonly title: string;
  readonly styleCss: string;
  readonly bodyHtml: string;
  readonly bodyStyle: string;
  readonly bodyClass: string;
  readonly bodyDir: string;
  readonly bodyLang: string;
}

const PAGE_SIZES: Record<"A4" | "Letter" | "A3", [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612.0, 792.0],
  A3: [841.89, 1190.55],
};

const MARGIN_SIZES: Record<"none" | "small" | "normal" | "wide", number> = {
  none: 20,
  small: 30,
  normal: 48,
  wide: 72,
};

const PT_TO_PX = 96 / 72;
const PX_TO_PT = 72 / 96;
const RENDER_SCALE = 2;

const BLOCKED_HTML_TAGS =
  "script, noscript, iframe, object, embed, link, meta, base, frame, frameset, portal, audio, video, source, track";

const BLOCKED_ATTRS = new Set([
  "srcdoc",
  "formaction",
  "action",
  "poster",
  "ping",
  "dynsrc",
  "lowsrc",
  "srcset",
  "data",
]);

const DATA_IMAGE_URL_ATTRS = new Set(["src", "background"]);
const FRAGMENT_ONLY_ATTRS = new Set(["href", "xlink:href"]);

interface TextSegment {
  readonly text: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly color?: RGB;
  readonly fontSize?: number;
  readonly isCode?: boolean;
}

interface BlockElement {
  readonly type:
    | "heading"
    | "paragraph"
    | "list-item"
    | "code-block"
    | "quote"
    | "hr"
    | "table"
    | "page-break";
  readonly level?: number;
  readonly listPrefix?: string;
  readonly segments: TextSegment[];
  readonly tableRows?: Array<Array<{ text: string; isHeader: boolean }>>;
  readonly tableHeaderRows?: number;
  readonly tableBreaks?: Array<{ before: boolean; after: boolean }>;
}

interface MeasuredLineBox {
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

interface VerticalBox {
  readonly top: number;
  readonly bottom: number;
}

interface PageSlice {
  readonly top: number;
  readonly bottom: number;
}

function hasPageBreak(element: HTMLElement, side: "before" | "after"): boolean {
  const inlineValues = [
    element.style.getPropertyValue(`break-${side}`),
    element.style.getPropertyValue(`page-break-${side}`),
  ];
  if (inlineValues.some((value) => value === "page" || value === "always")) {
    return true;
  }
  if (typeof getComputedStyle === "function") {
    try {
      const computed = getComputedStyle(element);
      const breakVal = computed.getPropertyValue(`break-${side}`);
      const legacyVal = computed.getPropertyValue(`page-break-${side}`);
      return [breakVal, legacyVal].some((value) => value === "page" || value === "always");
    } catch {
      return false;
    }
  }
  return false;
}

function parseHexColor(hex: string): RGB | undefined {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return undefined;
  return rgb(
    parseInt(match[1], 16) / 255,
    parseInt(match[2], 16) / 255,
    parseInt(match[3], 16) / 255,
  );
}

function cleanHtmlText(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeSvgDataSnippet(rawUrl: string): string {
  const commaIdx = rawUrl.indexOf(",");
  if (commaIdx < 0) return "";
  const header = rawUrl.slice(0, commaIdx).toLowerCase();
  const payload = rawUrl.slice(commaIdx + 1);
  try {
    if (header.includes(";base64") && typeof atob === "function") {
      return atob(payload.trim());
    }
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function stripControlAndWhitespace(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) continue;
    out += input[i];
  }
  return out;
}

function isSafeDataImageUrl(raw: string): boolean {
  const trimmed = raw.trim();
  const normalized = stripControlAndWhitespace(trimmed);
  if (
    !/^data:image\/(?:png|jpe?g|gif|webp|bmp|avif|ico|tiff|svg\+xml)(?:;[a-z0-9.+-]+=[^;,]+)*(?:;base64)?,/i.test(
      normalized,
    )
  ) {
    return false;
  }
  if (/^data:image\/svg\+xml/i.test(normalized)) {
    const decoded = decodeSvgDataSnippet(trimmed);
    if (/<script\b|javascript:|on[a-z]+\s*=/i.test(decoded)) {
      return false;
    }
  }
  return true;
}

function sanitizeCss(css: string): string {
  return css
    .replace(/@import\b[^;]*(?:;|$)/gi, "")
    .replace(/expression\s*\([^)]*\)/gi, "none")
    .replace(/-moz-binding\s*:[^;]*(?:;|$)/gi, "")
    .replace(/behavior\s*:[^;]*(?:;|$)/gi, "")
    .replace(/url\(\s*(['"]?)([^)]*?)\1\s*\)/gi, (_full, _quote: string, rawUrl: string) => {
      const candidate = rawUrl.trim();
      if (isSafeDataImageUrl(candidate)) {
        return `url("${candidate.replace(/"/g, '\\"')}")`;
      }
      return "none";
    });
}

function sanitizeDomDocument(htmlString: string): {
  sanitized: SanitizedHtmlDocument;
  bodyElement: HTMLElement | null;
} {
  if (typeof DOMParser === "undefined") {
    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(htmlString);
    const title = titleMatch?.[1].trim() ? cleanHtmlText(titleMatch[1]) : "Documento";
    const bodyHtml = htmlString
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
      .replace(
        /<(script|noscript|iframe|object|embed|style|link|meta|base)[^>]*>[\s\S]*?<\/\1>/gi,
        "",
      )
      .replace(/<(link|meta|base|embed)[^>]*\/?>/gi, "")
      .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/javascript\s*:/gi, "");
    return {
      sanitized: {
        title,
        styleCss: "",
        bodyHtml,
        bodyStyle: "",
        bodyClass: "",
        bodyDir: "",
        bodyLang: "",
      },
      bodyElement: null,
    };
  }

  const parsed = new DOMParser().parseFromString(htmlString, "text/html");
  const title =
    cleanHtmlText(parsed.title || parsed.querySelector("title")?.textContent || "") || "Documento";

  parsed.querySelectorAll(BLOCKED_HTML_TAGS).forEach((node) => {
    node.remove();
  });

  const styleChunks: string[] = [];
  parsed.querySelectorAll("style").forEach((styleNode) => {
    const cleaned = sanitizeCss(styleNode.textContent ?? "");
    if (cleaned.trim()) {
      styleChunks.push(cleaned);
    }
    styleNode.remove();
  });
  parsed.querySelectorAll("title").forEach((titleNode) => {
    titleNode.remove();
  });

  const allElements = [
    ...(parsed.body ? [parsed.body] : []),
    ...Array.from(parsed.documentElement?.querySelectorAll("*") ?? []),
  ];
  for (const element of allElements) {
    for (const attribute of Array.from(element.attributes)) {
      const lowerName = attribute.name.toLowerCase();
      if (lowerName.startsWith("on") || BLOCKED_ATTRS.has(lowerName)) {
        element.removeAttribute(attribute.name);
        continue;
      }
      if (lowerName === "style") {
        const cleanedStyle = sanitizeCss(attribute.value);
        if (cleanedStyle.trim()) {
          element.setAttribute(attribute.name, cleanedStyle);
        } else {
          element.removeAttribute(attribute.name);
        }
        continue;
      }
      if (DATA_IMAGE_URL_ATTRS.has(lowerName)) {
        if (!isSafeDataImageUrl(attribute.value)) {
          element.removeAttribute(attribute.name);
        }
        continue;
      }
      if (FRAGMENT_ONLY_ATTRS.has(lowerName)) {
        if (!attribute.value.trim().startsWith("#")) {
          element.removeAttribute(attribute.name);
        }
      }
    }
  }

  const body = parsed.body;
  return {
    sanitized: {
      title,
      styleCss: styleChunks.join("\n"),
      bodyHtml: body?.innerHTML ?? "",
      bodyStyle: body?.getAttribute("style") ?? "",
      bodyClass: body?.getAttribute("class") ?? "",
      bodyDir: body?.getAttribute("dir") ?? "",
      bodyLang: body?.getAttribute("lang") ?? "",
    },
    bodyElement: body,
  };
}

/**
 * Sanitiza HTML para conversão local em PDF removendo scripts, embeds, handlers e URLs externas,
 * preservando CSS local, SVG inline e imagens `data:image/*`.
 */
export function sanitizeHtmlForPdf(htmlContent: string): SanitizedHtmlDocument {
  return sanitizeDomDocument(htmlContent).sanitized;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/\s+/g, "");
  if (typeof atob === "function") {
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  return Uint8Array.from(Buffer.from(clean, "base64"));
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  if (typeof canvas.toDataURL === "function") {
    const dataUrl = canvas.toDataURL("image/png");
    const prefix = "data:image/png;base64,";
    if (dataUrl.startsWith(prefix)) {
      return decodeBase64ToBytes(dataUrl.slice(prefix.length));
    }
  }
  if (typeof canvas.toBlob === "function") {
    const blob = await new Promise<Blob | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 250);
      try {
        canvas.toBlob((result) => {
          clearTimeout(timer);
          resolve(result);
        }, "image/png");
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });
    if (blob && blob.size > 0) {
      return new Uint8Array(await blob.arrayBuffer());
    }
  }
  throw new Error("HTML_CANVAS_EXPORT_UNAVAILABLE");
}

async function waitForEmbeddedImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          const src = img.getAttribute("src");
          if (!src || img.complete) {
            if (typeof img.decode === "function") {
              void img.decode().then(resolve, resolve);
            } else {
              resolve();
            }
            return;
          }
          const timer = setTimeout(resolve, 500);
          const done = () => {
            clearTimeout(timer);
            resolve();
          };
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
        }),
    ),
  );
}

function loadSvgImage(svgMarkup: string): Promise<HTMLImageElement> {
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => {
      reject(new Error("HTML_SVG_RENDER_TIMEOUT"));
    }, 5000);
    img.onload = () => {
      clearTimeout(timer);
      if (typeof img.decode === "function") {
        void img.decode().then(
          () => resolve(img),
          () => resolve(img),
        );
      } else {
        resolve(img);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("HTML_SVG_RENDER_FAILED"));
    };
    img.src = svgDataUrl;
  });
}

function isElementVisible(element: HTMLElement): boolean {
  if (element.closest("style, script, title, template, noscript")) {
    return false;
  }
  if (typeof getComputedStyle === "function") {
    try {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") {
        return false;
      }
    } catch {
      return true;
    }
  }
  return true;
}

function mergeHorizontalLineBoxes(lines: MeasuredLineBox[]): MeasuredLineBox[] {
  if (lines.length <= 1) return lines;
  const sorted = [...lines].sort((a, b) =>
    Math.abs(a.top - b.top) <= 3 ? a.left - b.left : a.top - b.top,
  );
  const merged: MeasuredLineBox[] = [];
  for (const current of sorted) {
    const prev = merged.at(-1);
    if (
      prev &&
      Math.abs(prev.top - current.top) <= 3 &&
      current.left - prev.right <= 24 &&
      current.left >= prev.left - 4
    ) {
      const separator =
        prev.text.endsWith(" ") || current.text.startsWith(" ") || current.left - prev.right <= 1
          ? ""
          : " ";
      merged[merged.length - 1] = {
        text: `${prev.text}${separator}${current.text}`.replace(/\s+/g, " ").trim(),
        left: Math.min(prev.left, current.left),
        top: Math.min(prev.top, current.top),
        right: Math.max(prev.right, current.right),
        bottom: Math.max(prev.bottom, current.bottom),
      };
    } else {
      merged.push(current);
    }
  }
  return merged;
}

function collectDomTextAndLayout(
  renderBody: HTMLElement,
  contentHeightPx: number,
): {
  measuredLines: MeasuredLineBox[];
  unmeasuredTexts: string[];
  explicitBreaks: number[];
  atomicBoxes: VerticalBox[];
  maxBottom: number;
} {
  const bodyRect =
    typeof renderBody.getBoundingClientRect === "function"
      ? renderBody.getBoundingClientRect()
      : ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } as DOMRect);

  const measuredLines: MeasuredLineBox[] = [];
  const unmeasuredTexts: string[] = [];
  let maxBottom = 0;

  if (
    typeof document.createTreeWalker === "function" &&
    typeof document.createRange === "function"
  ) {
    const walker = document.createTreeWalker(renderBody, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    let current = walker.nextNode();
    while (current) {
      const textNode = current as Text;
      current = walker.nextNode();
      const rawText = textNode.nodeValue ?? "";
      const normalized = rawText.replace(/\s+/g, " ").trim();
      if (!normalized) continue;
      const parent = textNode.parentElement;
      if (!parent || !isElementVisible(parent)) continue;

      range.selectNodeContents(textNode);
      const rawRects =
        typeof range.getClientRects === "function"
          ? Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0)
          : [];

      if (rawRects.length === 1) {
        const r = rawRects[0];
        const box: MeasuredLineBox = {
          text: normalized,
          left: r.left - bodyRect.left,
          top: r.top - bodyRect.top,
          right: r.right - bodyRect.left,
          bottom: r.bottom - bodyRect.top,
        };
        measuredLines.push(box);
        if (box.bottom > maxBottom) maxBottom = box.bottom;
        continue;
      }

      if (rawRects.length > 1) {
        const tokenMatches = Array.from(rawText.matchAll(/\S+\s*/g));
        let activeLine: {
          text: string;
          left: number;
          top: number;
          right: number;
          bottom: number;
        } | null = null;
        for (const match of tokenMatches) {
          const start = match.index ?? 0;
          const end = start + match[0].length;
          const tokenText = match[0].replace(/\s+/g, " ").trim();
          if (!tokenText) continue;
          range.setStart(textNode, start);
          range.setEnd(textNode, end);
          const tokenRects = Array.from(range.getClientRects()).filter(
            (rect) => rect.width > 0 && rect.height > 0,
          );
          const tr = tokenRects[0];
          if (!tr) continue;
          const left = tr.left - bodyRect.left;
          const top = tr.top - bodyRect.top;
          const right = tr.right - bodyRect.left;
          const bottom = tr.bottom - bodyRect.top;
          if (activeLine && Math.abs(top - activeLine.top) <= Math.max(3, tr.height * 0.4)) {
            activeLine.text = `${activeLine.text} ${tokenText}`;
            activeLine.left = Math.min(activeLine.left, left);
            activeLine.top = Math.min(activeLine.top, top);
            activeLine.right = Math.max(activeLine.right, right);
            activeLine.bottom = Math.max(activeLine.bottom, bottom);
          } else {
            if (activeLine) {
              measuredLines.push(activeLine);
              if (activeLine.bottom > maxBottom) maxBottom = activeLine.bottom;
            }
            activeLine = { text: tokenText, left, top, right, bottom };
          }
        }
        if (activeLine) {
          measuredLines.push(activeLine);
          if (activeLine.bottom > maxBottom) maxBottom = activeLine.bottom;
        }
        continue;
      }

      // jsdom ou elementos sem getClientRects: tenta getBoundingClientRect do pai ou guarda texto sequencial
      const parentRect =
        typeof parent.getBoundingClientRect === "function" ? parent.getBoundingClientRect() : null;
      if (parentRect && parentRect.width > 0 && parentRect.height > 0) {
        const box: MeasuredLineBox = {
          text: normalized,
          left: parentRect.left - bodyRect.left,
          top: parentRect.top - bodyRect.top,
          right: parentRect.right - bodyRect.left,
          bottom: parentRect.bottom - bodyRect.top,
        };
        measuredLines.push(box);
        if (box.bottom > maxBottom) maxBottom = box.bottom;
      } else {
        unmeasuredTexts.push(normalized);
      }
    }
  }

  const explicitBreaksSet = new Set<number>();
  const atomicBoxes: VerticalBox[] = measuredLines.map((line) => ({
    top: line.top,
    bottom: line.bottom,
  }));

  for (const el of Array.from(renderBody.querySelectorAll("*"))) {
    if (!(el instanceof HTMLElement) && el.namespaceURI !== "http://www.w3.org/2000/svg") {
      continue;
    }
    const rect = typeof el.getBoundingClientRect === "function" ? el.getBoundingClientRect() : null;
    if (!rect || rect.height <= 0) continue;
    const top = rect.top - bodyRect.top;
    const bottom = rect.bottom - bodyRect.top;
    if (bottom > maxBottom) maxBottom = bottom;

    if (el instanceof HTMLElement) {
      if (hasPageBreak(el, "before") && top > 1) {
        explicitBreaksSet.add(top);
      }
      if (hasPageBreak(el, "after") && bottom > 1) {
        explicitBreaksSet.add(bottom);
      }
    }
    const tag = el.tagName.toLowerCase();
    if (
      (tag === "img" || tag === "svg" || tag === "tr" || tag === "hr") &&
      rect.height <= contentHeightPx * 0.65
    ) {
      atomicBoxes.push({ top, bottom });
    }
  }

  const explicitBreaks = Array.from(explicitBreaksSet).sort((a, b) => a - b);
  return {
    measuredLines: mergeHorizontalLineBoxes(measuredLines),
    unmeasuredTexts,
    explicitBreaks,
    atomicBoxes,
    maxBottom,
  };
}

function computePageSlices(
  totalHeight: number,
  contentHeightPx: number,
  explicitBreaks: readonly number[],
  atomicBoxes: readonly VerticalBox[],
): PageSlice[] {
  const slices: PageSlice[] = [];
  let cursor = 0;
  while (cursor < totalHeight - 0.5) {
    const maxBottom = cursor + contentHeightPx;
    const explicitBreak = explicitBreaks.find((y) => y > cursor + 1 && y <= maxBottom);
    if (explicitBreak !== undefined) {
      slices.push({ top: cursor, bottom: explicitBreak });
      cursor = explicitBreak;
      continue;
    }
    if (totalHeight <= maxBottom + 0.5) {
      slices.push({ top: cursor, bottom: totalHeight });
      break;
    }
    let snappedBottom = maxBottom;
    for (const box of atomicBoxes) {
      if (box.top < maxBottom - 0.5 && box.bottom > maxBottom + 0.5 && box.top > cursor + 4) {
        if (box.top < snappedBottom) {
          snappedBottom = box.top;
        }
      }
    }
    if (snappedBottom <= cursor + 1) {
      snappedBottom = maxBottom;
    }
    slices.push({ top: cursor, bottom: snappedBottom });
    cursor = snappedBottom;
  }
  if (slices.length === 0) {
    slices.push({ top: 0, bottom: Math.max(1, Math.min(totalHeight, contentHeightPx)) });
  }
  return slices;
}

function serializeXhtmlBody(renderBody: HTMLElement): string {
  if (typeof XMLSerializer !== "undefined") {
    return new XMLSerializer().serializeToString(renderBody);
  }
  return renderBody.outerHTML;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(max, value));
}

function buildOcrPagesForSlices(
  slices: readonly PageSlice[],
  measuredLines: readonly MeasuredLineBox[],
  unmeasuredTexts: readonly string[],
  pageWidth: number,
  pageHeight: number,
  margin: number,
): OcrPageData[] {
  const printableWidth = pageWidth - margin * 2;
  const pageBuckets: Array<
    Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }>
  > = slices.map(() => []);

  for (const line of measuredLines) {
    const midY = (line.top + line.bottom) / 2;
    let sliceIndex = slices.findIndex((slice) => midY >= slice.top - 1 && midY <= slice.bottom + 1);
    if (sliceIndex < 0) {
      sliceIndex = midY < slices[0].top ? 0 : slices.length - 1;
    }
    const slice = slices[sliceIndex];
    const x0 = clamp(margin + line.left * PX_TO_PT, 0, pageWidth - 1);
    const y0 = clamp(margin + (line.top - slice.top) * PX_TO_PT, 0, pageHeight - 1);
    const x1 = clamp(margin + line.right * PX_TO_PT, x0 + 0.5, pageWidth);
    const y1 = clamp(margin + (line.bottom - slice.top) * PX_TO_PT, y0 + 0.5, pageHeight);
    pageBuckets[sliceIndex].push({
      text: line.text,
      bbox: { x0, y0, x1, y1 },
    });
  }

  if (unmeasuredTexts.length > 0 && pageBuckets.length > 0) {
    const lineHeight = 14;
    let cursorY = margin + 4;
    for (const text of unmeasuredTexts) {
      if (cursorY + lineHeight > pageHeight - margin) {
        cursorY = margin + 4;
      }
      pageBuckets[0].push({
        text,
        bbox: {
          x0: clamp(margin, 0, pageWidth - 1),
          y0: clamp(cursorY, 0, pageHeight - 1),
          x1: clamp(margin + printableWidth, margin + 1, pageWidth),
          y1: clamp(cursorY + 12, cursorY + 0.5, pageHeight),
        },
      });
      cursorY += lineHeight;
    }
  }

  return pageBuckets
    .map((lines, index) => ({
      pageNumber: index + 1,
      text: lines.map((line) => line.text).join("\n"),
      width: pageWidth,
      height: pageHeight,
      lines,
    }))
    .filter((pageData) => pageData.lines.length > 0);
}

function toWinAnsiFallback(text: string, font: PDFFont): string {
  let output = "";
  for (const char of text) {
    try {
      font.encodeText(char);
      output += char;
    } catch {
      const decomposed = char.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
      for (const fallbackChar of decomposed) {
        try {
          font.encodeText(fallbackChar);
          output += fallbackChar;
        } catch {
          output += " ";
        }
      }
    }
  }
  return output.trim();
}

function drawInvisibleFallbackTextLayer(
  pdfDoc: PDFDocument,
  font: PDFFont,
  pagesData: readonly OcrPageData[],
): void {
  const pages = pdfDoc.getPages();
  for (const data of pagesData) {
    const page = pages[data.pageNumber - 1];
    if (!page) continue;
    const fontKey = page.node.newFontDictionary("NexoHtmlText", font.ref);
    for (const line of data.lines) {
      if (!line.bbox || !line.text.trim()) continue;
      const safeText = toWinAnsiFallback(line.text, font);
      if (!safeText) continue;
      const encoded = font.encodeText(safeText);
      const boxHeight = Math.max(4, line.bbox.y1 - line.bbox.y0);
      const boxWidth = Math.max(1, line.bbox.x1 - line.bbox.x0);
      const fontSize = Math.max(6, Math.min(72, boxHeight * 0.85));
      const measuredWidth = Math.max(1, font.widthOfTextAtSize(safeText, fontSize));
      const scaleX = boxWidth / measuredWidth;
      const pdfY = data.height - line.bbox.y1 + boxHeight * 0.15;
      page.pushOperators(
        pushGraphicsState(),
        beginText(),
        setFontAndSize(fontKey, fontSize),
        setTextRenderingMode(TextRenderingMode.Invisible),
        setTextMatrix(scaleX, 0, 0, 1, line.bbox.x0, pdfY),
        showText(encoded),
        endText(),
        popGraphicsState(),
      );
    }
  }
}

function drawPageFooters(
  pdfDoc: PDFDocument,
  fontRegular: PDFFont,
  pageWidth: number,
  margin: number,
  includePageNumbers: boolean | undefined,
): void {
  if (includePageNumbers === false) return;
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  for (let i = 0; i < totalPages; i++) {
    const page = pages[i];
    const footerText = `Página ${i + 1} de ${totalPages}`;
    const footerWidth = fontRegular.widthOfTextAtSize(footerText, 9);
    page.drawText(footerText, {
      x: (pageWidth - footerWidth) / 2,
      y: margin / 2,
      size: 9,
      font: fontRegular,
      color: rgb(0.55, 0.6, 0.68),
    });
  }
}

async function tryRenderHtmlInBrowser(
  htmlContent: string,
  options: HtmlToPdfOptions,
  pageWidth: number,
  pageHeight: number,
  margin: number,
): Promise<HtmlToPdfResult | null> {
  if (
    typeof document === "undefined" ||
    typeof DOMParser === "undefined" ||
    typeof Image === "undefined"
  ) {
    return null;
  }
  const probeCanvas = document.createElement("canvas");
  const probeCtx = probeCanvas.getContext?.("2d");
  if (!probeCtx) {
    return null;
  }

  const printableWidth = pageWidth - margin * 2;
  const printableHeight = pageHeight - margin * 2;
  const contentWidthPx = Math.max(100, Math.round(printableWidth * PT_TO_PX));
  const contentHeightPx = Math.max(100, Math.round(printableHeight * PT_TO_PX));

  const { sanitized, bodyElement } = sanitizeDomDocument(htmlContent);
  if (!bodyElement) {
    return null;
  }
  // Tabelas estruturais exigem repetição de <thead>, validação de altura do cabeçalho
  // (HTML_TABLE_HEADER_TOO_TALL) e quebra determinística de células fornecidas pelo motor vetorial.
  if (bodyElement.querySelector("table")) {
    return null;
  }
  const finalTitle = options.baseTitle || sanitized.title || "Documento";

  const baseCss = [
    ":where(html, body) { margin: 0; padding: 0; box-sizing: border-box; }",
    ":where(body) { width: 100%; background: #ffffff; color: #0f172a; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; }",
    ":where(img, svg) { max-width: 100%; height: auto; }",
  ].join("\n");
  const combinedCss = sanitized.styleCss ? `${baseCss}\n${sanitized.styleCss}` : baseCss;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = [
    "position:fixed",
    "left:-100000px",
    "top:0",
    `width:${contentWidthPx}px`,
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
    "background:#ffffff",
  ].join(";");

  const shadowRoot =
    typeof host.attachShadow === "function" ? host.attachShadow({ mode: "open" }) : host;
  const styleEl = document.createElement("style");
  styleEl.textContent = combinedCss;

  const renderBody = document.createElement("body");
  if (sanitized.bodyStyle) renderBody.setAttribute("style", sanitized.bodyStyle);
  if (sanitized.bodyClass) renderBody.setAttribute("class", sanitized.bodyClass);
  if (sanitized.bodyDir) renderBody.setAttribute("dir", sanitized.bodyDir);
  if (sanitized.bodyLang) renderBody.setAttribute("lang", sanitized.bodyLang);
  for (const child of Array.from(bodyElement.childNodes)) {
    renderBody.appendChild(document.importNode(child, true));
  }

  shadowRoot.appendChild(styleEl);
  shadowRoot.appendChild(renderBody);

  let measuredLines: MeasuredLineBox[] = [];
  let unmeasuredTexts: string[] = [];
  let explicitBreaks: number[] = [];
  let atomicBoxes: VerticalBox[] = [];
  let totalHeight = contentHeightPx;
  let serializedBody = "";

  const parentContainer = document.body || document.documentElement;
  parentContainer.appendChild(host);
  try {
    await waitForEmbeddedImages(renderBody);
    const layout = collectDomTextAndLayout(renderBody, contentHeightPx);
    measuredLines = layout.measuredLines;
    unmeasuredTexts = layout.unmeasuredTexts;
    explicitBreaks = layout.explicitBreaks;
    atomicBoxes = layout.atomicBoxes;

    const bodyBoxHeight =
      typeof renderBody.getBoundingClientRect === "function"
        ? renderBody.getBoundingClientRect().height
        : 0;
    const measuredHeight = Math.max(
      renderBody.scrollHeight || 0,
      bodyBoxHeight || 0,
      layout.maxBottom,
    );
    totalHeight = measuredHeight > 0 ? measuredHeight : contentHeightPx;
    serializedBody = serializeXhtmlBody(renderBody);
  } finally {
    host.remove();
  }

  const slices = computePageSlices(totalHeight, contentHeightPx, explicitBreaks, atomicBoxes);
  const safeCssCdata = combinedCss.replace(/\]\]>/g, "]]]]><![CDATA[>");

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(finalTitle);
  pdfDoc.setProducer("NexoHub Local Engine");
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const slice of slices) {
    const sliceHeightPx = Math.max(1, slice.bottom - slice.top);
    const pixelWidth = Math.max(1, Math.ceil(contentWidthPx * RENDER_SCALE));
    const pixelHeight = Math.max(1, Math.ceil(sliceHeightPx * RENDER_SCALE));
    const svgMarkup = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${pixelHeight}" viewBox="0 0 ${contentWidthPx} ${sliceHeightPx}">`,
      `<foreignObject x="0" y="0" width="${contentWidthPx}" height="${sliceHeightPx}">`,
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${contentWidthPx}px;height:${sliceHeightPx}px;overflow:hidden;background:#ffffff;">`,
      `<style><![CDATA[${safeCssCdata}]]></style>`,
      `<div style="transform:translateY(-${slice.top}px);width:${contentWidthPx}px;">`,
      serializedBody,
      "</div>",
      "</div>",
      "</foreignObject>",
      "</svg>",
    ].join("");

    let pngBytes: Uint8Array;
    try {
      const img = await loadSvgImage(svgMarkup);
      const canvas = document.createElement("canvas");
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return null;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pixelWidth, pixelHeight);
      ctx.drawImage(img, 0, 0, pixelWidth, pixelHeight);
      pngBytes = await canvasToPngBytes(canvas);
    } catch {
      // Caso o ambiente (ex.: jsdom sem suporte a SVG/Canvas) não consiga rasterizar, cai para motor estrutural
      return null;
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const embeddedImage = await pdfDoc.embedPng(pngBytes);
    const sliceHeightPt = Math.min(printableHeight, sliceHeightPx * PX_TO_PT);
    page.drawImage(embeddedImage, {
      x: margin,
      y: pageHeight - margin - sliceHeightPt,
      width: printableWidth,
      height: sliceHeightPt,
    });
  }

  const ocrPages = buildOcrPagesForSlices(
    slices,
    measuredLines,
    unmeasuredTexts,
    pageWidth,
    pageHeight,
    margin,
  );
  if (ocrPages.length > 0) {
    try {
      await addOcrTextLayer(pdfDoc, ocrPages, { preserveDrawingOrder: true });
    } catch {
      // Fallback para ambientes onde a fonte TTF externa não está acessível via fetch (ex.: testes Vitest)
      drawInvisibleFallbackTextLayer(pdfDoc, fontRegular, ocrPages);
    }
  }

  drawPageFooters(pdfDoc, fontRegular, pageWidth, margin, options.includePageNumbers);
  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pdfDoc.getPageCount(),
    title: finalTitle,
  };
}

/**
 * Parser semântico e robusto de HTML para blocos documentais (fallback determinístico).
 * Funciona tanto no navegador (DOMParser) quanto em ambiente de teste/headless.
 */
function parseHtmlBlocks(htmlString: string): { title: string; blocks: BlockElement[] } {
  let title = "Documento";
  const blocks: BlockElement[] = [];

  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(htmlString);
  if (titleMatch?.[1].trim()) {
    title = cleanHtmlText(titleMatch[1]);
  }

  const sanitizedHtml = htmlString
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[^>]*>[\s\S]*?<\/embed>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  if (typeof DOMParser !== "undefined") {
    try {
      const body = parseLocalHtml(sanitizedHtml);
      body.querySelectorAll("style,title").forEach((node) => {
        node.remove();
      });

      function extractSegments(node: Node): TextSegment[] {
        const segs: TextSegment[] = [];
        for (const child of Array.from(node.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            const val = child.textContent || "";
            if (val) segs.push({ text: val });
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as HTMLElement;
            const tag = el.tagName.toLowerCase();
            if (tag === "br") {
              segs.push({ text: "\n" });
              continue;
            }
            const isBold = tag === "b" || tag === "strong";
            const isItalic = tag === "i" || tag === "em";
            const isCode = tag === "code" || tag === "kbd";
            const colorAttr = el.style?.color;
            const customColor = colorAttr ? parseHexColor(colorAttr) : undefined;

            const inner = extractSegments(el);
            for (const s of inner) {
              segs.push({
                text: s.text,
                bold: s.bold || isBold,
                italic: s.italic || isItalic,
                isCode: s.isCode || isCode,
                color: customColor || s.color,
              });
            }
          }
        }
        return segs;
      }

      function processNode(node: Node) {
        const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : undefined;
        const addBreak = () => {
          if (blocks.at(-1)?.type !== "page-break")
            blocks.push({ type: "page-break", segments: [] });
        };
        if (el && hasPageBreak(el, "before")) addBreak();
        processContent(node);
        if (el && hasPageBreak(el, "after")) addBreak();
      }

      function processContent(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent || "").replace(/\s+/g, " ").trim();
          if (text) blocks.push({ type: "paragraph", segments: [{ text }] });
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (/^h[1-6]$/.test(tag)) {
          const level = Number(tag.substring(1));
          const text = cleanHtmlText(el.textContent || "");
          if (text) {
            blocks.push({
              type: "heading",
              level,
              segments: [{ text, bold: true }],
            });
          }
          return;
        }

        if (tag === "hr") {
          blocks.push({ type: "hr", segments: [] });
          return;
        }

        if (tag === "pre") {
          const text = (el.textContent || "").trim();
          if (text) {
            blocks.push({
              type: "code-block",
              segments: [{ text, isCode: true }],
            });
          }
          return;
        }

        if (tag === "blockquote") {
          const text = cleanHtmlText(el.textContent || "");
          if (text) {
            blocks.push({
              type: "quote",
              segments: [{ text, italic: true }],
            });
          }
          return;
        }

        if (tag === "ul" || tag === "ol") {
          const isOrdered = tag === "ol";
          let idx = 1;
          for (const li of Array.from(el.children)) {
            if (li.tagName.toLowerCase() === "li") {
              if (hasPageBreak(li as HTMLElement, "before"))
                blocks.push({ type: "page-break", segments: [] });
              const prefix = isOrdered ? `${idx++}. ` : "• ";
              const segs = extractSegments(li);
              if (segs.length > 0) {
                blocks.push({
                  type: "list-item",
                  listPrefix: prefix,
                  segments: segs,
                });
              }
              if (hasPageBreak(li as HTMLElement, "after"))
                blocks.push({ type: "page-break", segments: [] });
            }
          }
          return;
        }

        if (tag === "table") {
          const rows: Array<Array<{ text: string; isHeader: boolean }>> = [];
          let headerRows = 0;
          const rowBreaks: Array<{ before: boolean; after: boolean }> = [];
          const trElements = Array.from(el.querySelectorAll("tr")).filter(
            (tr) => tr.closest("table") === el,
          );
          for (const tr of trElements) {
            const rowData: Array<{ text: string; isHeader: boolean }> = [];
            for (const cell of Array.from(tr.children)) {
              const cellTag = cell.tagName.toLowerCase();
              if (cellTag === "th" || cellTag === "td") {
                rowData.push({
                  text: cleanHtmlText(cell.textContent || ""),
                  isHeader: cellTag === "th",
                });
              }
            }
            if (rowData.length > 0) {
              if (
                headerRows === rows.length &&
                (tr.parentElement?.tagName === "THEAD" || rowData.every((cell) => cell.isHeader))
              )
                headerRows++;
              rows.push(rowData);
              rowBreaks.push({
                before: hasPageBreak(tr, "before"),
                after: hasPageBreak(tr, "after"),
              });
            }
          }
          if (rows.length > 0) {
            blocks.push({
              type: "table",
              segments: [],
              tableRows: rows,
              tableHeaderRows: headerRows,
              tableBreaks: rowBreaks,
            });
          }
          return;
        }

        if (tag === "p") {
          const segs = extractSegments(el);
          const raw = cleanHtmlText(el.textContent || "");
          if (raw) {
            blocks.push({
              type: "paragraph",
              segments: segs.length > 0 ? segs : [{ text: raw }],
            });
          }
          return;
        }

        for (const child of Array.from(el.childNodes)) {
          processNode(child);
        }
      }

      for (const child of Array.from(body.childNodes)) {
        processNode(child);
      }

      if (blocks.length > 0) {
        return { title, blocks };
      }
    } catch {
      // Fallback para parser por regex
    }
  }

  const blockRegex = /<(h[1-6]|p|blockquote|pre|hr|li)[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
  let match = blockRegex.exec(sanitizedHtml);

  while (match !== null) {
    const rawTag = (match[1] || "hr").toLowerCase();
    const content = match[2] || "";

    if (rawTag === "hr") {
      blocks.push({ type: "hr", segments: [] });
    } else if (/^h[1-6]$/.test(rawTag)) {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "heading",
          level: Number(rawTag.substring(1)),
          segments: [{ text, bold: true }],
        });
      }
    } else if (rawTag === "pre") {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "code-block",
          segments: [{ text, isCode: true }],
        });
      }
    } else if (rawTag === "blockquote") {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "quote",
          segments: [{ text, italic: true }],
        });
      }
    } else if (rawTag === "li") {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "list-item",
          listPrefix: "• ",
          segments: [{ text }],
        });
      }
    } else {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "paragraph",
          segments: [{ text }],
        });
      }
    }
    match = blockRegex.exec(sanitizedHtml);
  }

  if (blocks.length === 0) {
    const plainText = cleanHtmlText(sanitizedHtml.replace(/<[^>]*>/g, " "));
    if (plainText) {
      blocks.push({
        type: "paragraph",
        segments: [{ text: plainText }],
      });
    }
  }

  return { title, blocks };
}

/**
 * Converte código HTML ou documento salvo em arquivo PDF paginado.
 * Em navegadores com DOM/Canvas disponível, renderiza fielmente CSS e imagens locais em alta resolução
 * com camada de texto pesquisável; em ambientes sem renderização DOM/Canvas, usa motor estrutural determinístico.
 */
export async function convertHtmlToPdfDocument(
  htmlContent: string,
  options: HtmlToPdfOptions = {},
): Promise<HtmlToPdfResult> {
  if (!htmlContent?.trim()) {
    throw new Error("HTML_CONTENT_EMPTY");
  }

  const pageSizeName = options.pageSize || "A4";
  const [baseWidth, baseHeight] = PAGE_SIZES[pageSizeName] || PAGE_SIZES.A4;
  const isLandscape = options.orientation === "landscape";
  const pageWidth = isLandscape ? baseHeight : baseWidth;
  const pageHeight = isLandscape ? baseWidth : baseHeight;
  const margin = MARGIN_SIZES[options.margin || "normal"] ?? MARGIN_SIZES.normal;

  const browserRendered = await tryRenderHtmlInBrowser(
    htmlContent,
    options,
    pageWidth,
    pageHeight,
    margin,
  );
  if (browserRendered) {
    return browserRendered;
  }

  const printableWidth = pageWidth - margin * 2;
  const bottomThreshold = margin + 30;

  const { title, blocks } = parseHtmlBlocks(htmlContent);
  const finalTitle = options.baseTitle || title || "Documento";

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(finalTitle);
  pdfDoc.setProducer("NexoHub Local Engine");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  let currentPage: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;
  let pageHasContent = false;
  let pendingBreak = false;

  function newPage() {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    currentY = pageHeight - margin;
    pageHasContent = false;
  }

  function ensurePageSpace(neededHeight: number): PDFPage {
    if (currentY - neededHeight < bottomThreshold) {
      newPage();
    }
    return currentPage;
  }

  function browserFont(font: PDFFont, size: number) {
    return `${font === fontItalic ? "italic " : ""}${font === fontBold ? "bold " : ""}${size}px ${font === fontMono ? "monospace" : "Arial, sans-serif"}`;
  }
  function widthOf(text: string, font: PDFFont, size: number): number {
    try {
      return font.widthOfTextAtSize(text, size);
    } catch {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) throw new Error("HTML_UNICODE_RENDER_UNAVAILABLE");
      ctx.font = browserFont(font, size);
      return ctx.measureText(text).width;
    }
  }
  function wrapText(
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number,
    code = false,
  ): string[] {
    const lines: string[] = [];
    for (const raw of text.split("\n")) {
      let line = "";
      const tokens = code ? Array.from(raw.replace(/\t/g, "    ")) : raw.trim().split(/\s+/);
      for (const token of tokens) {
        const separator = !code && line ? " " : "";
        if (widthOf(line + separator + token, font, size) <= maxWidth) {
          line += separator + token;
          continue;
        }
        if (line) {
          lines.push(line);
          line = "";
        }
        for (const character of Array.from(token)) {
          if (line && widthOf(line + character, font, size) > maxWidth) {
            lines.push(line);
            line = "";
          }
          line += character;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  async function drawLine(text: string, x: number, font: PDFFont, size: number, color: RGB) {
    if (!text) return;
    try {
      font.encodeText(text);
    } catch {
      const width = Math.max(1, widthOf(text, font, size));
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * 3) + 6;
      canvas.height = Math.ceil(size * 2 * 3);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("HTML_UNICODE_RENDER_UNAVAILABLE");
      ctx.scale(3, 3);
      ctx.font = browserFont(font, size);
      ctx.fillStyle = `rgb(${Math.round(color.red * 255)}, ${Math.round(color.green * 255)}, ${Math.round(color.blue * 255)})`;
      ctx.fillText(text, 0, size * 1.4);
      const image = await pdfDoc.embedPng(canvas.toDataURL("image/png"));
      currentPage.drawImage(image, {
        x,
        y: currentY - size * 0.6,
        width: canvas.width / 3,
        height: canvas.height / 3,
      });
      await addOcrTextLayer(
        pdfDoc,
        [
          {
            pageNumber: pdfDoc.getPageCount(),
            text,
            width: pageWidth,
            height: pageHeight,
            lines: [
              {
                text,
                bbox: {
                  x0: x,
                  y0: pageHeight - currentY - size,
                  x1: x + width,
                  y1: pageHeight - currentY + size * 0.25,
                },
              },
            ],
          },
        ],
        { preserveDrawingOrder: true },
      );
      return;
    }
    currentPage.drawText(text, { x, y: currentY, size, font, color });
  }

  for (const block of blocks) {
    if (block.type === "page-break") {
      pendingBreak = true;
      continue;
    }
    if (pendingBreak && pageHasContent) newPage();
    pendingBreak = false;
    if (block.type === "hr") {
      ensurePageSpace(18);
      currentY -= 6;
      currentPage.drawLine({
        start: { x: margin, y: currentY },
        end: { x: pageWidth - margin, y: currentY },
        thickness: 1,
        color: rgb(0.85, 0.88, 0.92),
      });
      currentY -= 12;
      pageHasContent = true;
      continue;
    }
    if (block.type === "table" && block.tableRows) {
      const columns = Math.max(...block.tableRows.map((row) => row.length));
      const colWidth = printableWidth / Math.max(1, columns);
      if (colWidth < 16) throw new Error("HTML_TABLE_TOO_WIDE");
      const prepared = block.tableRows.map((row) =>
        row.map((cell) => ({
          ...cell,
          lines: wrapText(cell.text, cell.isHeader ? fontBold : fontRegular, 10, colWidth - 12),
        })),
      );
      const lineCount = (cells: (typeof prepared)[number]) =>
        Math.max(1, ...cells.map((cell) => cell.lines.length));
      const headers = prepared.slice(0, block.tableHeaderRows ?? 0);
      const bodyRows = prepared.slice(headers.length);
      const headerHeight = headers.reduce((total, row) => total + lineCount(row) * 14 + 12, 0);
      const pageCapacity = pageHeight - margin - bottomThreshold;
      if (headerHeight > pageCapacity - (bodyRows.length ? 26 : 0))
        throw new Error("HTML_TABLE_HEADER_TOO_TALL");

      async function drawCells(cells: (typeof prepared)[number], offset: number, rowsHere: number) {
        const top = currentY;
        const height = rowsHere * 14 + 12;
        for (let col = 0; col < columns; col++) {
          const cell = cells[col];
          currentPage.drawRectangle({
            x: margin + col * colWidth,
            y: top - height,
            width: colWidth,
            height,
            color: cell?.isHeader ? rgb(0.93, 0.95, 0.98) : rgb(1, 1, 1),
            borderColor: rgb(0.8, 0.85, 0.9),
            borderWidth: 0.5,
          });
          for (let line = 0; line < rowsHere; line++) {
            currentY = top - 15 - line * 14;
            await drawLine(
              cell?.lines[offset + line] || "",
              margin + col * colWidth + 6,
              cell?.isHeader ? fontBold : fontRegular,
              10,
              rgb(0.15, 0.18, 0.22),
            );
          }
        }
        currentY = top - height;
        pageHasContent = true;
      }
      async function drawHeaders() {
        for (const row of headers) await drawCells(row, 0, lineCount(row));
      }
      if (block.tableBreaks?.[headers.length]?.before && pageHasContent) newPage();
      ensurePageSpace(headerHeight + (bodyRows.length ? 26 : 0));
      await drawHeaders();
      let rowBreak = false;
      for (const [rowIndex, cells] of bodyRows.entries()) {
        const breaks = block.tableBreaks?.[headers.length + rowIndex];
        if ((rowBreak || (rowIndex > 0 && breaks?.before)) && pageHasContent) {
          newPage();
          await drawHeaders();
        }
        const count = lineCount(cells);
        let offset = 0;
        while (offset < count) {
          if (currentY - 26 < bottomThreshold) {
            newPage();
            await drawHeaders();
          }
          const fitting = Math.max(1, Math.floor((currentY - bottomThreshold - 12) / 14));
          const rowsHere = Math.min(count - offset, fitting);
          await drawCells(cells, offset, rowsHere);
          offset += rowsHere;
        }
        rowBreak = breaks?.after ?? false;
      }
      if (rowBreak) pendingBreak = true;
      currentY -= 10;
      continue;
    }
    const heading = block.type === "heading";
    const code = block.type === "code-block";
    const quote = block.type === "quote";
    const list = block.type === "list-item";
    const size = heading ? Math.max(12, 24 - ((block.level || 1) - 1) * 2.5) : code ? 9.5 : 11;
    const lineHeight = size * 1.45;
    const font =
      heading || block.segments.some((s) => s.bold)
        ? fontBold
        : code
          ? fontMono
          : quote || block.segments.some((s) => s.italic)
            ? fontItalic
            : fontRegular;
    const indent = list || quote ? 18 : code ? 8 : 0;
    const fullText = block.segments
      .map((s) => s.text)
      .join("")
      .replace(/\r\n?/g, "\n");
    const lines = wrapText(fullText, font, size, printableWidth - indent - (code ? 8 : 0), code);
    for (let i = 0; i < lines.length; i++) {
      ensurePageSpace(lineHeight + 12);
      currentY -= lineHeight;
      if (code)
        currentPage.drawRectangle({
          x: margin,
          y: currentY - 3,
          width: printableWidth,
          height: lineHeight + 1,
          color: rgb(0.96, 0.97, 0.98),
        });
      if (quote)
        currentPage.drawLine({
          start: { x: margin + 4, y: currentY - 3 },
          end: { x: margin + 4, y: currentY + size },
          thickness: 3,
          color: rgb(0.2, 0.45, 0.85),
        });
      if (list && i === 0)
        await drawLine(block.listPrefix || "• ", margin, fontBold, size, rgb(0.2, 0.25, 0.35));
      await drawLine(lines[i], margin + indent, font, size, rgb(0.15, 0.18, 0.22));
      pageHasContent = true;
    }
    currentY -= heading ? 12 : 8;
  }

  drawPageFooters(pdfDoc, fontRegular, pageWidth, margin, options.includePageNumbers);

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: pdfDoc.getPageCount(),
    title: finalTitle,
  };
}
