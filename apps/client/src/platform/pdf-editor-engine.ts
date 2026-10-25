import type { WrappedPdfiumModule } from "@embedpdf/pdfium";
import {
  editorReplacementIssue,
  editorUnsafeMapping,
  editorLatinText as latin,
} from "./pdf-editor-compatibility";
import {
  EDITOR_LIMITS,
  type EditorBitmap,
  type EditorPage,
  type EditorRevision,
  type EditorSnapshot,
  type EditorTextObject,
} from "./pdf-editor-types";

function fail(code: string): never {
  throw new Error(`EDITOR_${code}`);
}
const fonts = new Set([
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Times-Roman",
  "Courier",
]);
type Memory = { HEAPU8: Uint8Array };
export class PdfEditorEngine {
  constructor(private readonly api: WrappedPdfiumModule) {}
  private renderBitmap(
    page: number,
    form: number,
    pageWidth: number,
    pageHeight: number,
    side: number,
  ): EditorBitmap {
    const a = this.api;
    const scale = Math.min(side / Math.max(pageWidth, pageHeight), 2);
    const width = Math.max(1, Math.round(pageWidth * scale));
    const height = Math.max(1, Math.round(pageHeight * scale));
    const bitmap = a.FPDFBitmap_Create(width, height, 1);
    if (!bitmap) fail("MEMORIA");
    try {
      a.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xffffffff);
      a.FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, 0, 1);
      if (form) a.FPDF_FFLDraw(form, bitmap, page, 0, 0, width, height, 0, 1);
      const ptr = a.FPDFBitmap_GetBuffer(bitmap),
        stride = a.FPDFBitmap_GetStride(bitmap);
      const heap = (a.pdfium as unknown as Memory).HEAPU8;
      const data = new Uint8Array(width * height * 4);
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const output = (y * width + x) * 4,
            input = ptr + y * stride + x * 4;
          data[output] = heap[input + 2];
          data[output + 1] = heap[input + 1];
          data[output + 2] = heap[input];
          data[output + 3] = heap[input + 3];
        }
      return { data, width, height };
    } finally {
      a.FPDFBitmap_Destroy(bitmap);
    }
  }

  /** Renderiza bytes de uma revisão já exportável, sem reconstruir comandos ou salvar outro PDF. */
  renderRevisionPage(bytes: Uint8Array, index: number): EditorBitmap {
    if (!bytes.length) fail("PDF_INVALIDO");
    if (bytes.length > EDITOR_LIMITS.outputBytes) fail("LIMITE");
    const a = this.api,
      m = a.pdfium;
    const input = m.wasmExports.malloc(bytes.length);
    if (!input) fail("MEMORIA");
    let doc = 0,
      page = 0,
      form = 0,
      formInfo = 0;
    try {
      (m as unknown as Memory).HEAPU8.set(bytes, input);
      doc = a.FPDF_LoadMemDocument(input, bytes.length, "");
      if (!doc) fail(a.FPDF_GetLastError() === 4 ? "SENHA" : "PDF_INVALIDO");
      if (a.EPDF_IsEncrypted(doc)) fail("SENHA");
      const count = a.FPDF_GetPageCount(doc);
      if (count < 1 || count > EDITOR_LIMITS.pages) fail("LIMITE");
      if (!Number.isInteger(index) || index < 0 || index >= count) fail("PAGINA");
      if (a.FPDF_GetFormType(doc) > 0) {
        formInfo = a.PDFiumExt_OpenFormFillInfo();
        if (!formInfo) fail("OPERACAO");
        form = a.PDFiumExt_InitFormFillEnvironment(doc, formInfo);
        if (!form) fail("OPERACAO");
      }
      page = a.FPDF_LoadPage(doc, index);
      if (!page) fail("PAGINA");
      if (form) a.FORM_OnAfterLoadPage(page, form);
      const width = a.FPDF_GetPageWidth(page),
        height = a.FPDF_GetPageHeight(page);
      if (
        !Number.isFinite(width + height) ||
        Math.min(width, height) < 1 ||
        Math.max(width, height) > 14400 ||
        a.FPDFPage_CountObjects(page) > EDITOR_LIMITS.objects + EDITOR_LIMITS.elements
      )
        fail("LIMITE");
      return this.renderBitmap(page, form, width, height, EDITOR_LIMITS.renderSide);
    } finally {
      if (page) {
        if (form) a.FORM_OnBeforeClosePage(page, form);
        a.FPDF_ClosePage(page);
      }
      if (form) a.PDFiumExt_ExitFormFillEnvironment(form);
      if (formInfo) a.PDFiumExt_CloseFormFillInfo(formInfo);
      if (doc) a.FPDF_CloseDocument(doc);
      m.wasmExports.free(input);
    }
  }
  revise(
    bytes: Uint8Array,
    snapshot: EditorSnapshot,
    selectedPage: number,
    withThumbnails = false,
  ): EditorRevision {
    if (
      bytes.length > EDITOR_LIMITS.bytes ||
      snapshot.elements.length + snapshot.replacements.length > EDITOR_LIMITS.elements
    )
      fail("LIMITE");
    const imagePixels = snapshot.elements.reduce(
      (sum, element) => sum + (element.image ? element.image.width * element.image.height : 0),
      0,
    );
    if (!Number.isFinite(imagePixels) || imagePixels > 12_000_000) fail("LIMITE");
    if (!bytes.length) fail("PDF_INVALIDO");
    const a = this.api,
      m = a.pdfium,
      allocations: number[] = [],
      pages: number[] = [];
    const unowned = new Set<number>();
    const track = (object: number) => {
      if (object) unowned.add(object);
      return object;
    };
    const destroyObject = (object: number) => {
      unowned.delete(object);
      a.FPDFPageObj_Destroy(object);
    };
    const insertObject = (page: number, object: number) => {
      a.FPDFPage_InsertObject(page, object);
      unowned.delete(object);
    };
    const mem = () => (m as unknown as Memory).HEAPU8;
    const ptr = (size: number) => {
      const p = m.wasmExports.malloc(size);
      if (!p) fail("MEMORIA");
      allocations.push(p);
      return p;
    };
    const num = (p: number, type = "float") => Number(m.getValue(p, type));
    const wide = (text: string) => {
      const p = ptr((text.length + 1) * 2);
      m.stringToUTF16(text, p, (text.length + 1) * 2);
      return p;
    };
    const check = (ok: unknown) => {
      if (!ok) fail("OPERACAO");
    };
    let doc = 0,
      form = 0,
      formInfo = 0;
    try {
      const input = ptr(bytes.length);
      mem().set(bytes, input);
      doc = a.FPDF_LoadMemDocument(input, bytes.length, "");
      if (!doc) fail(a.FPDF_GetLastError() === 4 ? "SENHA" : "PDF_INVALIDO");
      if (a.EPDF_IsEncrypted(doc)) fail("SENHA");
      if (a.FPDF_GetFormType(doc) > 0) {
        formInfo = a.PDFiumExt_OpenFormFillInfo();
        check(formInfo);
        form = a.PDFiumExt_InitFormFillEnvironment(doc, formInfo);
        check(form);
      }
      const pageCount = a.FPDF_GetPageCount(doc);
      if (pageCount < 1 || pageCount > EDITOR_LIMITS.pages) fail("LIMITE");
      if (!Number.isInteger(selectedPage) || selectedPage < 0 || selectedPage >= pageCount)
        fail("PAGINA");
      const bounds = (obj: number) => {
        const p = ptr(16);
        check(a.FPDFPageObj_GetBounds(obj, p, p + 4, p + 8, p + 12));
        return { left: num(p), bottom: num(p + 4), right: num(p + 8), top: num(p + 12) };
      };
      const getText = (obj: number, textPage: number) => {
        const length = a.FPDFTextObj_GetText(obj, textPage, 0, 0);
        if (!length || length > (EDITOR_LIMITS.text + 1) * 2) return "";
        const p = ptr(length);
        a.FPDFTextObj_GetText(obj, textPage, p, length);
        return m.UTF16ToString(p);
      };
      const matrix = (obj: number) => {
        const p = ptr(24);
        check(a.FPDFPageObj_GetMatrix(obj, p));
        return Array.from({ length: 6 }, (_, i) => num(p + i * 4));
      };
      const setMatrix = (obj: number, values: number[]) => {
        const p = ptr(24);
        values.forEach((v, i) => {
          m.setValue(p + i * 4, v, "float");
        });
        check(a.FPDFPageObj_SetMatrix(obj, p));
      };
      const color = (obj: number, value: string, stroke = false) => {
        if (!/^#[\da-f]{6}$/i.test(value)) fail("COR");
        const rgb = [1, 3, 5].map((i) => Number.parseInt(value.slice(i, i + 2), 16));
        check(
          stroke
            ? a.FPDFPageObj_SetStrokeColor(obj, rgb[0], rgb[1], rgb[2], 255)
            : a.FPDFPageObj_SetFillColor(obj, rgb[0], rgb[1], rgb[2], 255),
        );
      };
      const validateText = (text: string) => {
        if (
          !text.trim() ||
          text.length > EDITOR_LIMITS.text ||
          Array.from(text).some((ch) => {
            const code = ch.codePointAt(0) ?? 0;
            return code < 32 && code !== 9 && code !== 10;
          })
        )
          fail("TEXTO");
      };
      const validBox = (box: { x: number; y: number; width: number; height: number }) => {
        if (
          ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
          box.x < 0 ||
          box.y < 0 ||
          box.width <= 0 ||
          box.height <= 0 ||
          box.x + box.width > 1.00001 ||
          box.y + box.height > 1.00001
        )
          fail("CAIXA");
      };
      const fontObject = (text: string, name: string, size: number) => {
        validateText(text);
        if (!fonts.has(name)) fail("FONTE");
        if (!latin(text)) fail("GLIFO");
        if (!Number.isFinite(size) || size < 0.001 || size > 12000) fail("TAMANHO");
        const obj = track(a.FPDFPageObj_NewTextObj(doc, name, size));
        check(obj);
        if (!a.FPDFText_SetText(obj, wide(text))) {
          destroyObject(obj);
          fail("GLIFO");
        }
        return obj;
      };
      const pageInfo: EditorPage[] = [],
        objectMaps: Map<string, { obj: number; info: EditorTextObject; index: number }>[] = [];
      const fontCoverage = new Map<number, Set<string>>();
      let objectCount = 0;
      for (let index = 0; index < pageCount; index++) {
        const page = a.FPDF_LoadPage(doc, index);
        check(page);
        pages.push(page);
        if (form) a.FORM_OnAfterLoadPage(page, form);
        const width = a.FPDF_GetPageWidth(page),
          height = a.FPDF_GetPageHeight(page);
        if (
          !Number.isFinite(width + height) ||
          width < 1 ||
          height < 1 ||
          Math.max(width, height) > 14400
        )
          fail("LIMITE");
        const textPage = a.FPDFText_LoadPage(page);
        check(textPage);
        const texts: EditorTextObject[] = [],
          objects = new Map<string, { obj: number; info: EditorTextObject; index: number }>();
        try {
          const count = a.FPDFPage_CountObjects(page);
          objectCount += count;
          if (objectCount > EDITOR_LIMITS.objects) fail("LIMITE");
          for (let i = 0; i < count; i++) {
            const obj = a.FPDFPage_GetObject(page, i);
            if (a.FPDFPageObj_GetType(obj) !== 1) continue;
            const text = getText(obj, textPage);
            if (!text.trim()) continue;
            const b = bounds(obj),
              xp = ptr(8);
            const corners = [
              [b.left, b.bottom],
              [b.right, b.top],
              [b.left, b.top],
              [b.right, b.bottom],
            ].map(([x, y]) => {
              check(a.FPDF_PageToDevice(page, 0, 0, 10000, 10000, 0, x, y, xp, xp + 4));
              return [num(xp, "i32") / 10000, num(xp + 4, "i32") / 10000];
            });
            const x = Math.min(...corners.map((p) => p[0])),
              y = Math.min(...corners.map((p) => p[1]));
            const sizeP = ptr(4);
            a.FPDFTextObj_GetFontSize(obj, sizeP);
            const font = a.FPDFTextObj_GetFont(obj),
              nameP = ptr(256);
            a.FPDFFont_GetBaseFontName(font, nameP, 256);
            const coverage = fontCoverage.get(font) ?? new Set<string>();
            for (const ch of text) coverage.add(ch);
            fontCoverage.set(font, coverage);
            const cp = ptr(16);
            a.FPDFPageObj_GetFillColor(obj, cp, cp + 4, cp + 8, cp + 12);
            const mat = matrix(obj);
            const clip = a.FPDFPageObj_GetClipPath(obj),
              clipPaths = clip ? a.FPDFClipPath_CountPaths(clip) : 0;
            if (clip) a.FPDF_DestroyClipPath(clip);
            const editRestriction: EditorTextObject["editRestriction"] =
              x < 0 || y < 0 || Math.max(...corners.flat()) > 1
                ? "bounds"
                : Math.abs(mat[1]) >= 0.001 ||
                    Math.abs(mat[2]) >= 0.001 ||
                    mat[0] <= 0 ||
                    mat[3] <= 0
                  ? "transform"
                  : a.FPDFTextObj_GetTextRenderMode(obj) !== 0
                    ? "renderMode"
                    : clipPaths > 0
                      ? "clip"
                      : editorUnsafeMapping(text)
                        ? "textMapping"
                        : undefined;
            const info: EditorTextObject = {
              id: `${index}:${i}`,
              text,
              x,
              y,
              width: Math.max(...corners.map((p) => p[0])) - x,
              height: Math.max(...corners.map((p) => p[1])) - y,
              fontName: m.UTF8ToString(nameP),
              fontSize: num(sizeP) * Math.abs(mat[3]),
              color: `#${[0, 4, 8]
                .map((o) =>
                  num(cp + o, "i32")
                    .toString(16)
                    .padStart(2, "0"),
                )
                .join("")}`,
              editable: !editRestriction,
              editRestriction,
              canChangeStyle: !a.FPDFPageObj_HasTransparency(obj) && clipPaths <= 0,
              styleRestriction: a.FPDFPageObj_HasTransparency(obj)
                ? "transparency"
                : clipPaths > 0
                  ? "clip"
                  : undefined,
              fontPolicy:
                a.FPDFFont_GetIsEmbedded(font) === 0 && fonts.has(m.UTF8ToString(nameP))
                  ? "latin"
                  : "observed",
            };
            texts.push(info);
            objects.set(info.id, { obj, info, index: i });
          }
        } finally {
          a.FPDFText_ClosePage(textPage);
        }
        pageInfo.push({ width, height, texts });
        objectMaps.push(objects);
      }
      const verifyObjects: { page: number; object: number; text: string }[] = [];
      for (const objects of objectMaps)
        for (const { obj, info } of objects.values()) {
          if (info.fontPolicy === "observed")
            info.supportedCharacters = Array.from(
              fontCoverage.get(a.FPDFTextObj_GetFont(obj)) ?? [],
            ).join("");
        }
      const touched = new Set<number>(),
        seen = new Set<string>();
      for (const replacement of snapshot.replacements) {
        if (seen.has(replacement.id)) fail("OBJETO");
        seen.add(replacement.id);
        const pageIndex = Number(replacement.id.split(":")[0]),
          entry = objectMaps[pageIndex]?.get(replacement.id);
        if (!entry?.info.editable) fail("OBJETO");
        const issue = editorReplacementIssue(entry.info, replacement);
        if (issue)
          fail(
            issue === "unprovenCharacters"
              ? "GLIFO"
              : issue === "fitError"
                ? "TEXTO_NAO_CABE"
                : "OBJETO",
          );
        if (replacement.text === "") {
          check(a.FPDFPage_RemoveObject(pages[pageIndex], entry.obj));
          a.FPDFPageObj_Destroy(entry.obj);
          entry.info.text = "";
          entry.info.editable = false;
          touched.add(pageIndex);
          continue;
        }
        validateText(replacement.text);
        if (replacement.text.includes("\n")) fail("TEXTO_NAO_CABE");
        const page = pages[pageIndex],
          oldBounds = bounds(entry.obj),
          oldMatrix = matrix(entry.obj);
        const fontSize = replacement.fontSize ?? entry.info.fontSize;
        if (!Number.isFinite(fontSize) || fontSize < 1 || fontSize > 1000) fail("TAMANHO");
        if (
          (replacement.fallbackFont ||
            (replacement.fontSize !== undefined && replacement.fontSize !== entry.info.fontSize)) &&
          !entry.info.canChangeStyle
        )
          fail("OBJETO");
        let obj = entry.obj;
        if (replacement.fallbackFont) {
          obj = fontObject(replacement.text, replacement.fallbackFont, fontSize / oldMatrix[3]);
          setMatrix(obj, oldMatrix);
          color(obj, entry.info.color);
        } else {
          const font = a.FPDFTextObj_GetFont(obj),
            p = ptr(4);
          const standard = a.FPDFFont_GetIsEmbedded(font) === 0 && fonts.has(entry.info.fontName);
          if (
            standard
              ? !latin(replacement.text)
              : Array.from(replacement.text).some(
                  (ch) => ch !== " " && !fontCoverage.get(font)?.has(ch),
                )
          )
            fail("GLIFO");
          for (const ch of replacement.text)
            if (
              !a.FPDFFont_GetGlyphWidth(font, ch.codePointAt(0) ?? 0, entry.info.fontSize, p) ||
              num(p) <= 0
            )
              fail("GLIFO");
          if (replacement.fontSize !== undefined && replacement.fontSize !== entry.info.fontSize) {
            obj = track(a.FPDFPageObj_CreateTextObj(doc, font, fontSize / oldMatrix[3]));
            check(obj);
            setMatrix(obj, oldMatrix);
            color(obj, entry.info.color);
          }
          check(a.FPDFText_SetText(obj, wide(replacement.text)));
        }
        const newBounds = bounds(obj);
        if (
          newBounds.right - newBounds.left > oldBounds.right - oldBounds.left + 2 ||
          newBounds.top > oldBounds.top + 2 ||
          newBounds.bottom < oldBounds.bottom - 3
        ) {
          if (obj !== entry.obj) destroyObject(obj);
          fail("TEXTO_NAO_CABE");
        }
        if (obj !== entry.obj) {
          const currentIndex = Array.from({ length: a.FPDFPage_CountObjects(page) }, (_, i) =>
            a.FPDFPage_GetObject(page, i),
          ).indexOf(entry.obj);
          if (currentIndex < 0) fail("OBJETO");
          check(a.FPDFPage_RemoveObject(page, entry.obj));
          a.FPDFPageObj_Destroy(entry.obj);
          check(a.FPDFPage_InsertObjectAtIndex(page, obj, currentIndex));
          unowned.delete(obj);
        }
        const verification = a.FPDFText_LoadPage(page);
        check(verification);
        try {
          if (
            getText(obj, verification).replace(/\s+/gu, " ").trim() !==
            replacement.text.replace(/\s+/gu, " ").trim()
          )
            fail("GLIFO");
        } finally {
          a.FPDFText_ClosePage(verification);
        }
        verifyObjects.push({ page: pageIndex, object: obj, text: replacement.text });
        entry.info.text = replacement.text;
        entry.info.fontSize = fontSize;
        touched.add(pageIndex);
      }
      for (const element of snapshot.elements) {
        if (seen.has(element.id)) fail("OBJETO");
        seen.add(element.id);
        const page = pages[element.page],
          info = pageInfo[element.page];
        if (!page || !info) fail("PAGINA");
        validBox(element);
        // Converter extremos inteiros uma única vez e interpolar em ponto flutuante.
        // Quantizar deslocamentos de 1 pt alterava escala/tamanho em páginas grandes.
        const edge = (x: number, y: number) => {
          const p = ptr(16);
          check(a.FPDF_DeviceToPage(page, 0, 0, 10000, 10000, 0, x, y, p, p + 8));
          return [num(p, "double"), num(p + 8, "double")];
        };
        const zero = edge(0, 0),
          right = edge(10000, 0),
          bottom = edge(0, 10000);
        const native = (x: number, y: number) => [
          zero[0] + x * (right[0] - zero[0]) + y * (bottom[0] - zero[0]),
          zero[1] + x * (right[1] - zero[1]) + y * (bottom[1] - zero[1]),
        ];
        const origin = native(element.x, element.y + element.height),
          dx = native(element.x + element.width, element.y + element.height),
          dy = native(element.x, element.y);
        const transform = (obj: number, width: number, height: number) =>
          setMatrix(obj, [
            (dx[0] - origin[0]) / width,
            (dx[1] - origin[1]) / width,
            (dy[0] - origin[0]) / height,
            (dy[1] - origin[1]) / height,
            ...origin,
          ]);
        const w = element.width * info.width,
          h = element.height * info.height;
        if (element.kind === "text") {
          const size = element.fontSize ?? 16,
            font = element.font ?? "Helvetica",
            text = element.text ?? "";
          validateText(text);
          if (!latin(text)) fail("GLIFO");
          if (!Number.isFinite(size) || size < 6 || size > 120) fail("TAMANHO");
          const lines: string[] = [];
          const metricObject = fontObject("M", font, size),
            metricFont = a.FPDFTextObj_GetFont(metricObject),
            metricPointer = ptr(4),
            widths = new Map<string, number>();
          const measure = (value: string) =>
            Array.from(value).reduce((total, ch) => {
              let width = widths.get(ch);
              if (width === undefined) {
                if (
                  !a.FPDFFont_GetGlyphWidth(metricFont, ch.codePointAt(0) ?? 0, size, metricPointer)
                )
                  fail("GLIFO");
                width = num(metricPointer);
                widths.set(ch, width);
              }
              return total + width;
            }, 0);
          for (const paragraph of text.split("\n")) {
            if (!paragraph) {
              lines.push("");
              continue;
            }
            let line = "";
            for (const word of paragraph.match(/\S+|\s+/g) ?? []) {
              const next = line + word;
              if (measure(next) <= w) line = next;
              else {
                if (line) lines.push(line);
                if (measure(word) > w) fail("TEXTO_NAO_CABE");
                line = word;
              }
            }
            lines.push(line);
          }
          if (lines.length * size * 1.25 > h) fail("TEXTO_NAO_CABE");
          for (const [lineIndex, line] of lines.entries()) {
            if (!line.trim()) continue;
            const obj = fontObject(line, font, size),
              b = bounds(obj);
            const offset =
              element.align === "center"
                ? (w - (b.right - b.left)) / 2
                : element.align === "right"
                  ? w - (b.right - b.left)
                  : 0;
            a.FPDFPageObj_Transform(
              obj,
              1,
              0,
              0,
              1,
              offset - b.left,
              h - size - lineIndex * size * 1.25,
            );
            // Compor a transformação da caixa com a translação da linha.
            const mat = matrix(obj),
              base = native(element.x, element.y + (size + lineIndex * size * 1.25) / info.height);
            const unitX = native(element.x + 1 / info.width, element.y),
              unitO = native(element.x, element.y),
              unitY = native(element.x, element.y - 1 / info.height);
            const ax = unitX[0] - unitO[0],
              ay = unitX[1] - unitO[1],
              bx = unitY[0] - unitO[0],
              by = unitY[1] - unitO[1];
            setMatrix(obj, [ax, ay, bx, by, base[0] + ax * mat[4], base[1] + ay * mat[4]]);
            color(obj, element.color);
            insertObject(page, obj);
            verifyObjects.push({ page: element.page, object: obj, text: line });
          }
        } else if (element.kind === "image") {
          const image = element.image;
          if (
            !image ||
            !Number.isInteger(image.width) ||
            !Number.isInteger(image.height) ||
            image.width < 1 ||
            image.height < 1 ||
            image.width * image.height > EDITOR_LIMITS.imagePixels ||
            image.data.length !== image.width * image.height * 4
          )
            fail("IMAGEM");
          const pixels = ptr(image.data.length);
          const bgra = mem().subarray(pixels, pixels + image.data.length);
          for (let i = 0; i < image.data.length; i += 4) {
            bgra[i] = image.data[i + 2];
            bgra[i + 1] = image.data[i + 1];
            bgra[i + 2] = image.data[i];
            bgra[i + 3] = image.data[i + 3];
          }
          const bitmap = a.FPDFBitmap_CreateEx(
              image.width,
              image.height,
              4,
              pixels,
              image.width * 4,
            ),
            obj = track(a.FPDFPageObj_NewImageObj(doc));
          check(bitmap);
          check(obj);
          try {
            check(a.FPDFImageObj_SetBitmap(0, 0, obj, bitmap));
            transform(obj, 1, 1);
            insertObject(page, obj);
          } finally {
            a.FPDFBitmap_Destroy(bitmap);
          }
        } else {
          const stroke = element.strokeWidth ?? 2;
          if (!Number.isFinite(stroke) || stroke < 0.5 || stroke > 20) fail("TAMANHO");
          let obj: number;
          if (element.kind === "rect") obj = track(a.FPDFPageObj_CreateNewRect(0, 0, w, h));
          else if (element.kind === "ellipse") {
            const k = 0.55228475,
              rx = w / 2,
              ry = h / 2;
            obj = track(a.FPDFPageObj_CreateNewPath(w, ry));
            a.FPDFPath_BezierTo(obj, w, ry + k * ry, rx + k * rx, h, rx, h);
            a.FPDFPath_BezierTo(obj, rx - k * rx, h, 0, ry + k * ry, 0, ry);
            a.FPDFPath_BezierTo(obj, 0, ry - k * ry, rx - k * rx, 0, rx, 0);
            a.FPDFPath_BezierTo(obj, rx + k * rx, 0, w, ry - k * ry, w, ry);
            a.FPDFPath_Close(obj);
          } else {
            const points =
              element.kind === "draw"
                ? element.points
                : [
                    { x: 0, y: 0 },
                    { x: 1, y: 1 },
                  ];
            if (
              !points ||
              points.length < 2 ||
              points.length > 2000 ||
              points.some(
                (p) => !Number.isFinite(p.x + p.y) || p.x < 0 || p.y < 0 || p.x > 1 || p.y > 1,
              )
            )
              fail("DESENHO");
            obj = track(a.FPDFPageObj_CreateNewPath(points[0].x * w, (1 - points[0].y) * h));
            for (const p of points.slice(1)) a.FPDFPath_LineTo(obj, p.x * w, (1 - p.y) * h);
          }
          check(obj);
          transform(obj, w, h);
          color(obj, element.color, true);
          check(a.FPDFPageObj_SetStrokeWidth(obj, stroke));
          check(a.FPDFPath_SetDrawMode(obj, 0, true));
          insertObject(page, obj);
        }
        touched.add(element.page);
      }
      for (const index of touched) check(a.FPDFPage_GenerateContent(pages[index]));
      const render = (index: number, side: number): EditorBitmap => {
        return this.renderBitmap(
          pages[index],
          form,
          pageInfo[index].width,
          pageInfo[index].height,
          side,
        );
      };
      const writer = a.PDFiumExt_OpenFileWriter();
      check(writer);
      let output: Uint8Array;
      try {
        check(a.FPDF_SaveAsCopy(doc, writer, 2));
        const size = a.PDFiumExt_GetFileWriterSize(writer);
        if (size > EDITOR_LIMITS.outputBytes) fail("LIMITE");
        const p = ptr(size);
        check(a.PDFiumExt_GetFileWriterData(writer, p, size));
        output = mem().slice(p, p + size);
        // O cache de Unicode do objeto vivo não prova que o arquivo salvo tem um CMap válido.
        // Reabrir os bytes serializados verifica o conteúdo efetivamente exportável.
        if (verifyObjects.length) {
          const checks = verifyObjects.map((item) => ({
            ...item,
            index: Array.from({ length: a.FPDFPage_CountObjects(pages[item.page]) }, (_, i) =>
              a.FPDFPage_GetObject(pages[item.page], i),
            ).indexOf(item.object),
          }));
          const reopened = a.FPDF_LoadMemDocument(p, size, "");
          check(reopened);
          try {
            for (const item of checks) {
              if (item.index < 0) fail("GLIFO");
              const freshPage = a.FPDF_LoadPage(reopened, item.page);
              check(freshPage);
              let freshText = 0;
              try {
                freshText = a.FPDFText_LoadPage(freshPage);
                check(freshText);
                if (
                  getText(a.FPDFPage_GetObject(freshPage, item.index), freshText)
                    .replace(/\s+/gu, " ")
                    .trim() !== item.text.replace(/\s+/gu, " ").trim()
                )
                  fail("GLIFO");
              } finally {
                if (freshText) a.FPDFText_ClosePage(freshText);
                a.FPDF_ClosePage(freshPage);
              }
            }
          } finally {
            a.FPDF_CloseDocument(reopened);
          }
        }
      } finally {
        a.PDFiumExt_CloseFileWriter(writer);
      }
      return {
        bytes: output,
        pages: pageInfo,
        preview: render(selectedPage, EDITOR_LIMITS.renderSide),
        thumbnails: withThumbnails ? pageInfo.map((_, i) => render(i, 150)) : [],
        signed: a.FPDF_GetSignatureCount(doc) > 0,
      };
    } finally {
      for (const object of unowned) a.FPDFPageObj_Destroy(object);
      for (const page of pages) {
        if (form) a.FORM_OnBeforeClosePage(page, form);
        a.FPDF_ClosePage(page);
      }
      if (form) a.PDFiumExt_ExitFormFillEnvironment(form);
      if (formInfo) a.PDFiumExt_CloseFormFillInfo(formInfo);
      if (doc) a.FPDF_CloseDocument(doc);
      for (const p of allocations) m.wasmExports.free(p);
    }
  }
}
