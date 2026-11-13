import type { WrappedPdfiumModule } from "@embedpdf/pdfium";
import { Unzlib } from "fflate";
import {
  BlendMode,
  concatTransformationMatrix,
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  type PDFObject,
  PDFObjectCopier,
  PDFPage,
  PDFPageLeaf,
  PDFRawStream,
  PDFString,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
} from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import type { RedactionArea, RedactPdfOptions } from "./pdf-engine";
import { getVisiblePageGeometry } from "./pdf-page-geometry";

function unsupported(): never {
  throw new Error("PDF_OCULTACAO_PERFIL_NAO_SUPORTADO");
}
const key = PDFName.of;
const standardFonts = new Set(Object.values(StandardFonts));
const pageKeys = new Set(
  "Type Parent Resources MediaBox CropBox BleedBox TrimBox ArtBox Rotate Contents Annots Metadata Thumb LastModified UserUnit".split(
    " ",
  ),
);
const formKeys = new Set(
  "Type Subtype FormType BBox Matrix Resources Length Filter DecodeParms Metadata".split(" "),
);
const imageKeys = new Set(
  "Type Subtype Width Height ColorSpace BitsPerComponent Interpolate Decode Length Filter Metadata".split(
    " ",
  ),
);
const fontKeys = new Set(
  "Type Subtype BaseFont Encoding FirstChar LastChar Widths Name".split(" "),
);
const annotationKeys = new Set(
  "Type Subtype Rect P F AP AS Border BS MK C H A Dest FT T TU TM Ff V DV Opt MaxLen DA Q Parent Kids NM M".split(
    " ",
  ),
);
const forbidden = new Set(
  "ByteRange XFA StructTreeRoot StructParent StructParents MarkInfo OC OCProperties OCG JavaScript JS AA OpenAction EmbeddedFiles AF PieceInfo RichMediaContent Alternates ActualText Alt".split(
    " ",
  ),
);
function allowKeys(dict: PDFDict, allowed: Set<string>) {
  for (const name of dict.keys()) if (!allowed.has(name.decodeText())) unsupported();
}
function nameOf(dict: PDFDict, name: string): string | undefined {
  const value = dict.lookupMaybe(key(name), PDFName);
  return value?.decodeText();
}
function numberOf(dict: PDFDict, name: string): number {
  const value = dict.lookupMaybe(key(name), PDFNumber)?.asNumber();
  if (value === undefined || !Number.isFinite(value)) unsupported();
  return value as number;
}
function boundedDecode(stream: PDFRawStream, limit: number): Uint8Array {
  const filter = stream.dict.get(key("Filter"));
  if (stream.dict.has(key("DecodeParms"))) unsupported();
  if (!filter) {
    if (stream.getContents().length > limit) unsupported();
    return stream.getContents();
  }
  if (!(filter instanceof PDFName) || filter.decodeText() !== "FlateDecode") unsupported();
  let size = 0;
  const chunks: Uint8Array[] = [];
  const decoder = new Unzlib((chunk) => {
    size += chunk.length;
    if (size > limit) unsupported();
    chunks.push(chunk);
  });
  const source = stream.getContents();
  for (let index = 0; index < source.length; index += 1024)
    decoder.push(source.subarray(index, index + 1024), index + 1024 >= source.length);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}
function rawStream(doc: PDFDocument, ref: PDFObject): PDFRawStream {
  const object = doc.context.lookup(ref);
  if (!(object instanceof PDFRawStream)) unsupported();
  return object;
}
function validateContent(stream: PDFRawStream, appearance = false) {
  if (nameOf(stream.dict, "Subtype") !== "Form")
    allowKeys(stream.dict, new Set(["Length", "Filter", "DecodeParms"]));
  let text = new TextDecoder("latin1").decode(boundedDecode(stream, 2 * 1024 * 1024));
  // Standard widget wrappers carry no replacement text or property dictionary.
  if (appearance) text = text.replace(/\/Tx\s+BMC\b/g, "").replace(/\bEMC\b/g, "");
  // The initial profile excludes marked content, inline images and comment/private caches.
  if (text.includes("%") || /\b(?:BDC|BMC|EMC|BI)\b/.test(text)) unsupported();
  return text;
}
/** Only top-level name/Do operators count; names inside strings/hex/arrays are data. */
function paintedXObjects(text: string): Set<string> {
  const used = new Set<string>();
  let index = 0,
    arrayDepth = 0,
    dictDepth = 0,
    previousName: string | undefined;
  const delimiter = (char: string) => char.charCodeAt(0) === 0 || /[\s()[\]<>/%]/.test(char);
  while (index < text.length) {
    const char = text[index];
    if (char.charCodeAt(0) === 0 || /\s/.test(char)) {
      index++;
      continue;
    }
    if (char === "(") {
      let depth = 1;
      index++;
      while (index < text.length && depth) {
        const next = text[index++];
        if (next === "\\") index++;
        else if (next === "(") depth++;
        else if (next === ")") depth--;
      }
      if (depth) unsupported();
      previousName = undefined;
      continue;
    }
    if (char === "<" && text[index + 1] !== "<") {
      const end = text.indexOf(">", index + 1);
      if (end < 0 || !/^[\da-f\s]*$/i.test(text.slice(index + 1, end))) unsupported();
      index = end + 1;
      previousName = undefined;
      continue;
    }
    if (text.slice(index, index + 2) === "<<") {
      dictDepth++;
      index += 2;
      previousName = undefined;
      continue;
    }
    if (text.slice(index, index + 2) === ">>") {
      if (--dictDepth < 0) unsupported();
      index += 2;
      previousName = undefined;
      continue;
    }
    if (char === "[") {
      arrayDepth++;
      index++;
      previousName = undefined;
      continue;
    }
    if (char === "]") {
      if (--arrayDepth < 0) unsupported();
      index++;
      previousName = undefined;
      continue;
    }
    if (char === "/") {
      const start = ++index;
      while (index < text.length && !delimiter(text[index])) index++;
      previousName =
        !arrayDepth && !dictDepth
          ? text
              .slice(start, index)
              .replace(/#([\da-f]{2})/gi, (_, hex: string) =>
                String.fromCharCode(Number.parseInt(hex, 16)),
              )
          : undefined;
      continue;
    }
    const start = index;
    while (index < text.length && !delimiter(text[index])) index++;
    if (index === start) unsupported();
    if (!arrayDepth && !dictDepth && text.slice(start, index) === "Do" && previousName)
      used.add(previousName);
    previousName = undefined;
  }
  if (arrayDepth || dictDepth) unsupported();
  return used;
}
function finiteArray(array: PDFArray, length: number): number[] {
  if (array.size() !== length) unsupported();
  const values = array
    .asArray()
    .map((value) => (value instanceof PDFNumber ? value.asNumber() : NaN));
  if (!values.every(Number.isFinite)) unsupported();
  return values;
}
function validateGeometry(doc: PDFDocument) {
  for (const page of doc.getPages()) {
    for (const array of [
      page.node.MediaBox(),
      page.node.CropBox(),
      ...["BleedBox", "TrimBox", "ArtBox"].map((name) =>
        page.node.lookupMaybe(key(name), PDFArray),
      ),
    ]) {
      if (!array) continue;
      const values = finiteArray(array, 4);
      if (
        values[2] <= values[0] ||
        values[3] <= values[1] ||
        values.some((value) => Math.abs(value) > 14400)
      )
        unsupported();
    }
    const rotation = page.node.Rotate()?.asNumber() ?? 0;
    if (!Number.isFinite(rotation) || !Number.isInteger(rotation) || rotation % 90 !== 0)
      unsupported();
  }
}
interface Rectangle {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
function rectangles(doc: PDFDocument, options: RedactPdfOptions): Map<number, Rectangle[]> {
  if (!options.redactions.length) throw new Error("AREA_OCULTACAO_OBRIGATORIA");
  if (options.redactions.length > 200) throw new Error("PDF_OCULTACAO_PRESERVACAO_LIMITE");
  const pages = doc.getPages(),
    result = new Map<number, Rectangle[]>();
  for (const area of options.redactions) {
    if (
      !Number.isInteger(area.pageIndex) ||
      area.pageIndex < 0 ||
      area.pageIndex >= pages.length ||
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
    const view = getVisiblePageGeometry(pages[area.pageIndex]);
    const corners = [
      view.toPdfPoint(
        (area.xPercent * view.width) / 100,
        ((100 - area.yPercent) * view.height) / 100,
      ),
      view.toPdfPoint(
        ((area.xPercent + area.widthPercent) * view.width) / 100,
        ((100 - area.yPercent - area.heightPercent) * view.height) / 100,
      ),
    ];
    const rect = {
      left: Math.min(...corners.map((p) => p.x)),
      right: Math.max(...corners.map((p) => p.x)),
      bottom: Math.min(...corners.map((p) => p.y)),
      top: Math.max(...corners.map((p) => p.y)),
    };
    const list = result.get(area.pageIndex) ?? [];
    list.push(rect);
    result.set(area.pageIndex, list);
  }
  return result;
}
function validateProfile(doc: PDFDocument, selected: Map<number, Rectangle[]>) {
  const seen = new Set<PDFDict>();
  let imagePixels = 0;
  type LeafKind = "number" | "name" | "string" | "boolean" | "value";
  const flatValue = (value: PDFObject, depth = 0): boolean => {
    if (depth > 3) return false;
    if (value instanceof PDFArray)
      return (
        value.size() <= 1000 &&
        value.asArray().every((item) => {
          const resolved = doc.context.lookup(item);
          return resolved !== undefined && flatValue(resolved, depth + 1);
        })
      );
    return (
      value instanceof PDFString ||
      value instanceof PDFHexString ||
      value instanceof PDFName ||
      value instanceof PDFBool ||
      (value instanceof PDFNumber && Number.isFinite(value.asNumber()))
    );
  };
  const defaultAppearance = (text: string) => {
    if (text.length > 4096) unsupported();
    const operands: string[] = [];
    const numeric = (value: string) =>
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) && Number.isFinite(Number(value));
    for (const token of text.trim().split(/\s+/).filter(Boolean)) {
      if (numeric(token) || token.startsWith("/")) {
        operands.push(token);
        continue;
      }
      if (token === "Tf") {
        if (
          operands.length !== 2 ||
          !/^\/(?:F\d+|Helv|ZaDb|Helvetica|Times-Roman|Courier|(?:Helvetica|Times|Courier|Symbol|ZapfDingbats)[\w-]*-\d+)$/.test(
            operands[0],
          ) ||
          !numeric(operands[1])
        )
          unsupported();
      } else {
        const size =
          token === "rg"
            ? 3
            : token === "k"
              ? 4
              : ["g", "Tc", "Tw", "Tz", "TL", "Tr", "Ts"].includes(token)
                ? 1
                : 0;
        if (!size || operands.length !== size || !operands.every(numeric)) unsupported();
      }
      operands.length = 0;
    }
    if (operands.length) unsupported();
  };
  const leaf = (dict: PDFDict, name: string, kind: LeafKind) => {
    const value = dict.lookup(key(name));
    if (!value) return;
    const valid =
      kind === "number"
        ? value instanceof PDFNumber && Number.isFinite(value.asNumber())
        : kind === "name"
          ? value instanceof PDFName
          : kind === "string"
            ? value instanceof PDFString || value instanceof PDFHexString
            : kind === "boolean"
              ? value instanceof PDFBool
              : flatValue(value);
    if (!valid) unsupported();
    if (name === "DA" && (value instanceof PDFString || value instanceof PDFHexString))
      defaultAppearance(value.decodeText());
  };
  const named = (dict: PDFDict, name: string, allowed: readonly string[]) => {
    leaf(dict, name, "name");
    const value = nameOf(dict, name);
    if (value && !allowed.includes(value)) unsupported();
  };
  const resources = (dict: PDFDict | undefined, content?: string): PDFDict | undefined => {
    if (!dict) return;
    const clean = dict.clone(doc.context);
    allowKeys(dict, new Set("Font XObject ExtGState ProcSet".split(" ")));
    const processSet = dict.lookup(key("ProcSet"));
    if (processSet) {
      if (
        !(processSet instanceof PDFArray) ||
        !processSet
          .asArray()
          .every(
            (value) =>
              value instanceof PDFName &&
              ["PDF", "Text", "ImageB", "ImageC", "ImageI"].includes(value.decodeText()),
          )
      )
        unsupported();
    }
    const fonts = dict.lookupMaybe(key("Font"), PDFDict);
    if (fonts)
      for (const [alias, ref] of fonts.entries()) {
        if (
          !/^(?:F\d+|Helv|ZaDb|Helvetica|Times-Roman|Courier|(?:Helvetica|Times|Courier|Symbol|ZapfDingbats)[\w-]*-\d+)$/.test(
            alias.decodeText(),
          )
        )
          unsupported();
        const font = doc.context.lookup(ref, PDFDict);
        allowKeys(font, fontKeys);
        named(font, "Type", ["Font"]);
        leaf(font, "FirstChar", "number");
        leaf(font, "LastChar", "number");
        const base = nameOf(font, "BaseFont");
        if (
          !base ||
          !standardFonts.has(base as StandardFonts) ||
          nameOf(font, "Subtype") !== "Type1"
        )
          unsupported();
        const widths = font.lookupMaybe(key("Widths"), PDFArray);
        if (
          widths &&
          !widths
            .asArray()
            .every((value) => value instanceof PDFNumber && Number.isFinite(value.asNumber()))
        )
          unsupported();
        const declaredName = nameOf(font, "Name");
        if (declaredName && declaredName !== alias.decodeText() && declaredName !== base)
          unsupported();
        const encoding = font.get(key("Encoding"));
        if (
          encoding &&
          (!(encoding instanceof PDFName) ||
            !["WinAnsiEncoding", "MacRomanEncoding", "StandardEncoding"].includes(
              encoding.decodeText(),
            ))
        )
          unsupported();
      }
    const objects = dict.lookupMaybe(key("XObject"), PDFDict);
    if (objects) {
      // Clone per owner: inherited/shared resource dictionaries must not lose another page's entries.
      const kept = doc.context.obj({});
      const used = content === undefined ? undefined : paintedXObjects(content);
      if (!used && objects.keys().length) unsupported();
      for (const [alias, ref] of objects.entries()) {
        if (
          !/^(?:[IF]m?\d+|[Xx]\d+|Image-\d+|EmbeddedPdfPage-\d+|FlatWidget-\d+)$/.test(
            alias.decodeText(),
          )
        )
          unsupported();
        xobject(rawStream(doc, ref));
        if (used?.has(alias.decodeText())) kept.set(alias, ref);
      }
      clean.set(key("XObject"), kept);
    }
    const states = dict.lookupMaybe(key("ExtGState"), PDFDict);
    if (states)
      for (const [alias, ref] of states.entries()) {
        if (!/^GS-?\d+$/.test(alias.decodeText())) unsupported();
        const state = doc.context.lookup(ref, PDFDict);
        allowKeys(state, new Set("Type CA ca BM LW LC LJ ML D RI OP op OPM SA AIS TK".split(" ")));
        named(state, "Type", ["ExtGState"]);
        for (const name of ["CA", "ca", "LW", "LC", "LJ", "ML", "OPM"]) leaf(state, name, "number");
        for (const name of ["OP", "op", "SA", "AIS", "TK"]) leaf(state, name, "boolean");
        named(state, "RI", [
          "AbsoluteColorimetric",
          "RelativeColorimetric",
          "Perceptual",
          "Saturation",
        ]);
        const dash = state.lookup(key("D"));
        if (
          dash &&
          (!(dash instanceof PDFArray) ||
            dash.size() !== 2 ||
            !(dash.get(0) instanceof PDFArray) ||
            !(dash.get(1) instanceof PDFNumber))
        )
          unsupported();
        if (dash instanceof PDFArray) {
          const entries = dash.get(0);
          if (entries instanceof PDFArray) finiteArray(entries, entries.size());
        }

        const blend = nameOf(state, "BM");
        if (blend && blend !== "Normal") unsupported();
      }
    return clean;
  };
  const xobject = (stream: PDFRawStream, appearance = false): void => {
    if (seen.has(stream.dict)) return;
    seen.add(stream.dict);
    named(stream.dict, "Type", ["XObject"]);
    const subtype = nameOf(stream.dict, "Subtype");
    if (subtype === "Form") {
      allowKeys(stream.dict, formKeys);
      leaf(stream.dict, "FormType", "number");
      const bbox = stream.dict.lookupMaybe(key("BBox"), PDFArray);
      if (!bbox) unsupported();
      const bounds = finiteArray(bbox, 4);
      if (bounds[2] <= bounds[0] || bounds[3] <= bounds[1]) unsupported();
      const matrix = stream.dict.lookupMaybe(key("Matrix"), PDFArray);
      if (matrix) finiteArray(matrix, 6);
      const content = validateContent(stream, appearance);
      const cleaned = resources(stream.dict.lookupMaybe(key("Resources"), PDFDict), content);
      if (cleaned) stream.dict.set(key("Resources"), cleaned);
    } else if (subtype === "Image") {
      allowKeys(stream.dict, imageKeys);
      leaf(stream.dict, "Interpolate", "boolean");
      const decode = stream.dict.lookup(key("Decode"));
      if (decode) {
        if (!(decode instanceof PDFArray)) unsupported();
        finiteArray(decode, nameOf(stream.dict, "ColorSpace") === "DeviceRGB" ? 6 : 2);
      }
      const width = numberOf(stream.dict, "Width"),
        height = numberOf(stream.dict, "Height");
      const color = nameOf(stream.dict, "ColorSpace");
      if (
        !["DeviceRGB", "DeviceGray"].includes(color ?? "") ||
        numberOf(stream.dict, "BitsPerComponent") !== 8 ||
        !Number.isInteger(width) ||
        !Number.isInteger(height) ||
        width <= 0 ||
        height <= 0 ||
        Math.max(width, height) > 8192 ||
        width * height > 24_000_000
      )
        unsupported();
      imagePixels += width * height;
      if (imagePixels > 96_000_000) unsupported();
      const expected = width * height * (color === "DeviceRGB" ? 3 : 1);
      if (boundedDecode(stream, expected + 1).length !== expected) unsupported();
    } else unsupported();
  };
  const pageWidgets = new Set<PDFDict>();
  const sourcePages = new Set<PDFDict>(doc.getPages().map((page) => page.node));
  const appearance = (widget: PDFDict) => {
    const dictionary = widget.lookupMaybe(key("AP"), PDFDict);
    if (!dictionary) return;
    allowKeys(dictionary, new Set(["N", "R", "D"]));
    for (const [, ref] of dictionary.entries()) {
      const object = doc.context.lookup(ref);
      if (object instanceof PDFRawStream) xobject(object, true);
      else if (object instanceof PDFDict)
        for (const [, state] of object.entries()) xobject(rawStream(doc, state), true);
      else unsupported();
    }
  };
  const color = (dict: PDFDict, name: string) => {
    const value = dict.get(key(name));
    if (!value) return;
    const array = doc.context.lookup(value);
    if (!(array instanceof PDFArray) || ![0, 1, 3, 4].includes(array.size())) unsupported();
    finiteArray(array, array.size());
  };
  const auxiliary = (annotation: PDFDict) => {
    named(annotation, "Type", ["Annot"]);
    named(annotation, "Subtype", ["Widget", "Link"]);
    named(annotation, "H", ["N", "I", "O", "P", "T"]);
    const owner = annotation.lookup(key("P"));
    if (owner && (!(owner instanceof PDFDict) || !sourcePages.has(owner))) unsupported();
    const rect = annotation.lookup(key("Rect"));
    if (rect) {
      if (!(rect instanceof PDFArray)) unsupported();
      finiteArray(rect, 4);
    }
    for (const name of ["F", "Ff", "MaxLen", "Q"]) leaf(annotation, name, "number");
    for (const name of ["T", "TU", "TM", "DA", "NM", "M"]) leaf(annotation, name, "string");
    for (const name of ["AS"]) leaf(annotation, name, "name");
    for (const name of ["V", "DV", "Opt"]) leaf(annotation, name, "value");
    named(annotation, "FT", ["Tx", "Btn", "Ch"]);
    const border = annotation.lookup(key("Border"));
    if (border) {
      if (!(border instanceof PDFArray) || ![3, 4].includes(border.size())) unsupported();
      for (let index = 0; index < 3; index++) {
        const value = border.get(index);
        if (!(value instanceof PDFNumber) || !Number.isFinite(value.asNumber())) unsupported();
      }
      if (border.size() === 4) {
        const dash = border.get(3);
        if (!(dash instanceof PDFArray)) unsupported();
        finiteArray(dash, dash.size());
      }
    }

    const action = annotation.lookupMaybe(key("A"), PDFDict);
    if (action) {
      allowKeys(action, new Set(["Type", "S", "URI", "IsMap"]));
      if (nameOf(action, "S") !== "URI") unsupported();
      const uri = action.lookup(key("URI"));
      if (!(uri instanceof PDFString) && !(uri instanceof PDFHexString)) unsupported();
      const isMap = action.lookup(key("IsMap"));
      if (isMap && !(isMap instanceof PDFBool)) unsupported();
    }
    if (annotation.has(key("Dest"))) unsupported();
    const style = annotation.lookupMaybe(key("BS"), PDFDict);
    if (style) {
      allowKeys(style, new Set(["Type", "W", "S", "D"]));
      named(style, "Type", ["Border"]);
      if (style.has(key("W"))) numberOf(style, "W");
      const line = nameOf(style, "S");
      if (line && !["S", "D", "B", "I", "U"].includes(line)) unsupported();
      const dash = style.lookupMaybe(key("D"), PDFArray);
      if (dash) finiteArray(dash, dash.size());
    }
    const characteristics = annotation.lookupMaybe(key("MK"), PDFDict);
    if (characteristics) {
      allowKeys(characteristics, new Set(["R", "BC", "BG", "CA", "RC", "AC", "TP"]));
      for (const name of ["R", "TP"])
        if (characteristics.has(key(name))) numberOf(characteristics, name);
      color(characteristics, "BC");
      color(characteristics, "BG");
      for (const name of ["CA", "RC", "AC"]) {
        const value = characteristics.lookup(key(name));
        if (value && !(value instanceof PDFString) && !(value instanceof PDFHexString))
          unsupported();
      }
    }
    color(annotation, "C");
  };
  // Reject hidden/active structures even if they would not be painted in the preview.
  const visited = new Set<unknown>();
  const walk = (object: unknown): void => {
    if (visited.has(object)) return;
    visited.add(object);
    if (object instanceof PDFRawStream) walk(object.dict);
    else if (object instanceof PDFArray) for (const item of object.asArray()) walk(item);
    else if (object instanceof PDFDict) {
      for (const [name, value] of object.entries()) {
        if (forbidden.has(name.decodeText())) unsupported();
        walk(value);
      }
      object.delete(key("Metadata"));
      object.delete(key("Thumb"));
      object.delete(key("LastModified"));
    }
  };
  for (const [, object] of doc.context.enumerateIndirectObjects()) walk(object);
  for (const [index, page] of doc.getPages().entries()) {
    allowKeys(page.node, pageKeys);
    const unit = page.node.get(key("UserUnit"));
    if (unit && (!(unit instanceof PDFNumber) || unit.asNumber() !== 1)) unsupported();
    const contents = page.node.Contents();
    const content =
      contents instanceof PDFRawStream
        ? validateContent(contents)
        : contents instanceof PDFArray
          ? contents
              .asArray()
              .map((ref) => validateContent(rawStream(doc, ref)))
              .join("\n")
          : "";
    const cleaned = resources(page.node.Resources(), content);
    if (cleaned) page.node.set(key("Resources"), cleaned);
    for (const ref of page.node.Annots()?.asArray() ?? []) {
      const annotation = doc.context.lookup(ref, PDFDict);
      allowKeys(annotation, annotationKeys);
      const subtype = nameOf(annotation, "Subtype");
      if (subtype !== "Link" && subtype !== "Widget") unsupported();
      if (subtype === "Link")
        allowKeys(annotation, new Set("Type Subtype Rect P F Border BS C H A".split(" ")));
      auxiliary(annotation);
      const owner = annotation.lookup(key("P"));
      if (owner && owner !== page.node) unsupported();
      if (subtype === "Widget") {
        pageWidgets.add(annotation);
        appearance(annotation);
      }
      const rect = annotation.lookupMaybe(key("Rect"), PDFArray);
      if (rect?.size() !== 4) unsupported();
      const coords =
        rect?.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : NaN)) ?? [];
      if (!coords.every(Number.isFinite) || coords[0] >= coords[2] || coords[1] >= coords[3])
        unsupported();
      if (
        selected
          .get(index)
          ?.some(
            (r) =>
              Math.max(coords[0], r.left) < Math.min(coords[2], r.right) &&
              Math.max(coords[1], r.bottom) < Math.min(coords[3], r.top),
          )
      )
        throw new Error("PDF_OCULTACAO_ANOTACAO_NA_AREA");
    }
  }
  const acro = doc.catalog.lookupMaybe(key("AcroForm"), PDFDict);
  if (!acro && pageWidgets.size) unsupported();
  if (acro) {
    allowKeys(acro, new Set("Fields NeedAppearances SigFlags CO DR DA Q".split(" ")));
    resources(acro.lookupMaybe(key("DR"), PDFDict));
    leaf(acro, "DA", "string");
    leaf(acro, "Q", "number");
    leaf(acro, "SigFlags", "number");
    leaf(acro, "NeedAppearances", "boolean");
    const fieldNodes = new Set<PDFDict>();
    const validateFields = (nodes: PDFArray, depth = 0) => {
      if (depth > 32 || fieldNodes.size > 1000) unsupported();
      for (const ref of nodes.asArray()) {
        const node = doc.context.lookup(ref, PDFDict);
        if (fieldNodes.has(node)) unsupported();
        fieldNodes.add(node);
        allowKeys(node, annotationKeys);
        auxiliary(node);
        if (!node.has(key("Subtype")) && (node.has(key("A")) || node.has(key("Dest"))))
          unsupported();
        if (!node.has(key("Subtype")) && (node.has(key("MK")) || node.has(key("AP"))))
          unsupported();
        const children = node.lookupMaybe(key("Kids"), PDFArray);
        if (children) validateFields(children, depth + 1);
      }
    };
    const fields = acro.lookupMaybe(key("Fields"), PDFArray);
    if (fields) validateFields(fields);
    for (const node of fieldNodes) {
      const parent = node.lookup(key("Parent"));
      if (parent && (!(parent instanceof PDFDict) || !fieldNodes.has(parent))) unsupported();
    }
    const order = acro.lookupMaybe(key("CO"), PDFArray);
    if (
      order &&
      !order.asArray().every((ref) => {
        const field = doc.context.lookup(ref);
        return field instanceof PDFDict && fieldNodes.has(field);
      })
    )
      unsupported();
    const knownWidgets = new Set<PDFDict>();
    for (const field of doc.getForm().getFields()) {
      allowKeys(field.acroField.dict, annotationKeys);
      for (const widget of field.acroField.getWidgets()) {
        if (!pageWidgets.has(widget.dict)) unsupported();
        knownWidgets.add(widget.dict);
        auxiliary(widget.dict);
        appearance(widget.dict);
      }
    }
    if (knownWidgets.size !== pageWidgets.size) unsupported();
  }
}
async function freshCopy(source: PDFDocument): Promise<Uint8Array> {
  await source.flush();
  const target = await PDFDocument.create();
  const copier = PDFObjectCopier.for(source.context, target.context);
  for (const page of source.getPages()) {
    const node = target.context.lookup(copier.copy(page.ref));
    if (!(node instanceof PDFPageLeaf)) unsupported();
    const reference = target.context.getObjectRef(node);
    if (!reference) unsupported();
    target.addPage(PDFPage.of(node, reference, target));
  }
  const form = source.catalog.lookupMaybe(key("AcroForm"), PDFDict);
  if (form) target.catalog.set(key("AcroForm"), copier.copy(form));
  return target.save({ useObjectStreams: true, updateFieldAppearances: false });
}

/** Qualified opt-in profile; no visual-only fallback and no mutation of source bytes. */
export async function redactPreservingWithPdfium(
  api: WrappedPdfiumModule,
  bytes: Uint8Array,
  options: RedactPdfOptions,
): Promise<Uint8Array> {
  if (!bytes.length) throw new Error("EMPTY_DOCUMENT");
  if (bytes.length > 20 * 1024 * 1024) throw new Error("PDF_OCULTACAO_PRESERVACAO_LIMITE");
  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  if (source.getPageCount() > 30) throw new Error("PDF_OCULTACAO_PRESERVACAO_LIMITE");
  validateGeometry(source);
  const selected = rectangles(source, options);
  validateProfile(source, selected);
  const inputBytes = await freshCopy(source);
  const m = api.pdfium,
    allocations: number[] = [];
  const memory = () => (m as unknown as { HEAPU8: Uint8Array }).HEAPU8;
  const ptr = (size: number) => {
    const p = m.wasmExports.malloc(size);
    if (!p) throw new Error("PDF_OCULTACAO_MEMORIA");
    allocations.push(p);
    return p;
  };
  const check = (ok: unknown) => {
    if (!ok) throw new Error("PDF_OCULTACAO_OPERACAO");
  };
  let doc = 0,
    writer = 0;
  let output: Uint8Array;
  try {
    const input = ptr(inputBytes.length);
    memory().set(inputBytes, input);
    doc = api.FPDF_LoadMemDocument(input, inputBytes.length, "");
    check(doc);
    for (const [index, areas] of selected) {
      const page = api.FPDF_LoadPage(doc, index);
      check(page);
      try {
        for (const rect of areas) {
          const annotation = api.FPDFPage_CreateAnnot(page, 28);
          check(annotation);
          try {
            const r = ptr(16);
            [rect.left, rect.top, rect.right, rect.bottom].forEach((v, i) => {
              m.setValue(r + i * 4, v, "float");
            });
            check(api.FPDFAnnot_SetRect(annotation, r));
          } finally {
            api.FPDFPage_CloseAnnot(annotation);
          }
        }
        check(api.EPDFPage_ApplyRedactions(page));
        check(api.FPDFPage_GenerateContent(page));
      } finally {
        api.FPDF_ClosePage(page);
      }
    }
    writer = api.PDFiumExt_OpenFileWriter();
    check(writer);
    check(api.FPDF_SaveAsCopy(doc, writer, 2));
    const size = api.PDFiumExt_GetFileWriterSize(writer);
    if (size > 80 * 1024 * 1024) throw new Error("PDF_OCULTACAO_PRESERVACAO_LIMITE");
    const out = ptr(size);
    check(api.PDFiumExt_GetFileWriterData(writer, out, size));
    output = memory().slice(out, out + size);
  } finally {
    if (writer) api.PDFiumExt_CloseFileWriter(writer);
    if (doc) api.FPDF_CloseDocument(doc);
    for (const p of allocations) m.wasmExports.free(p);
  }
  const result = await PDFDocument.load(output, { updateMetadata: false });
  const font = await result.embedFont(StandardFonts.Helvetica);
  for (const area of options.redactions) {
    const page = result.getPage(area.pageIndex),
      view = getVisiblePageGeometry(page);
    const x = (area.xPercent * view.width) / 100,
      y = ((100 - area.yPercent - area.heightPercent) * view.height) / 100,
      width = (area.widthPercent * view.width) / 100,
      height = (area.heightPercent * view.height) / 100;
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...view.matrix));
    const background = area.color === "white" ? 1 : area.color === "gray" ? 0.5 : 0;
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: rgb(background, background, background),
      opacity: 1,
      blendMode: BlendMode.Normal,
    });
    const label = area.label?.trim();
    if (label) {
      try {
        font.encodeText(label);
      } catch {
        throw new Error("PDF_OCULTACAO_ROTULO_NAO_SUPORTADO");
      }
      if (label.length > 200) throw new Error("PDF_OCULTACAO_PRESERVACAO_LIMITE");
      const size = Math.min(
        10,
        height * 0.5,
        width / Math.max(1, font.widthOfTextAtSize(label, 1)),
      );
      page.drawText(label, {
        x: x + (width - font.widthOfTextAtSize(label, size)) / 2,
        y: y + (height - size) / 2,
        font,
        size,
        color: area.color === "white" ? rgb(0, 0, 0) : rgb(1, 1, 1),
        opacity: 1,
        blendMode: BlendMode.Normal,
      });
    }
    page.pushOperators(popGraphicsState());
  }
  return freshCopy(result);
}

export type RedactionPresetKind = "cpf" | "cnpj" | "email" | "phone";

export interface FindTextRedactionOptions {
  readonly caseSensitive?: boolean;
  readonly color?: "black" | "white" | "gray";
  readonly label?: string;
}

const PRESET_PATTERNS: Record<RedactionPresetKind, string> = {
  cpf: "(?<!\\d)\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}(?!\\d)",
  cnpj: "(?<!\\d)\\d{2}\\.?\\d{3}\\.?\\d{3}\\/?\\d{4}-?\\d{2}(?!\\d)",
  email: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
  phone: "(?:\\+?55\\s?)?(?:\\(?\\d{2}\\)?\\s?)(?:9?\\d{4}[-.\\s]?\\d{4})(?!\\d)",
};

function buildTextSearchRegex(
  queryOrRegex: string | RegExp | RedactionPresetKind,
  caseSensitive?: boolean,
): RegExp | null {
  if (queryOrRegex instanceof RegExp) {
    let flags = queryOrRegex.flags.replace(/g/g, "");
    if (caseSensitive === true) flags = flags.replace(/i/g, "");
    else if (caseSensitive === false && !flags.includes("i")) flags += "i";
    return new RegExp(queryOrRegex.source, `${flags}g`);
  }
  const trimmed = queryOrRegex.trim();
  if (!trimmed) return null;
  if (trimmed in PRESET_PATTERNS) {
    return new RegExp(PRESET_PATTERNS[trimmed as RedactionPresetKind], "g");
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, caseSensitive ? "g" : "gi");
}

interface TextSlice {
  readonly str: string;
  readonly width: number;
  readonly hasEOL: boolean;
  readonly strStart: number;
  readonly strEnd: number;
  readonly baselineX: number;
  readonly baselineY: number;
  readonly ux: number;
  readonly uy: number;
  readonly vx: number;
  readonly vy: number;
  readonly fontHeight: number;
}

function clampPercent(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Localiza ocorrências de texto ou padrões (CPF, CNPJ, e-mail, telefone ou regex)
 * usando PDF.js `getTextContent()` e converte para porcentagens visuais do viewport.
 */
export async function findTextRedactionRects(
  pdfBytes: Uint8Array,
  queryOrRegex: string | RegExp | RedactionPresetKind,
  options: FindTextRedactionOptions = {},
): Promise<RedactionArea[]> {
  if (pdfBytes.byteLength === 0) return [];
  const regex = buildTextSearchRegex(queryOrRegex, options.caseSensitive);
  if (!regex) return [];

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    stopAtErrors: false,
  });

  try {
    const doc = await loadingTask.promise;
    const results: RedactionArea[] = [];
    const color = options.color ?? "black";
    const label = options.label?.trim() || undefined;

    for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
      const page = await doc.getPage(pageIndex + 1);
      try {
        const viewport = page.getViewport({ scale: 1 });
        if (viewport.width <= 0 || viewport.height <= 0) continue;

        const textContent = await page.getTextContent();
        const slices: TextSlice[] = [];
        let pageText = "";

        for (const rawItem of textContent.items) {
          if (!("str" in rawItem) || !rawItem.str) continue;
          const tx = pdfjsLib.Util.transform(viewport.transform, rawItem.transform);
          const advanceLen = Math.hypot(tx[0], tx[1]);
          const upLen = Math.hypot(tx[2], tx[3]);
          const fontHeight = rawItem.height > 0 ? rawItem.height : upLen || advanceLen || 10;
          const ux = advanceLen > 0 ? tx[0] / advanceLen : 1;
          const uy = advanceLen > 0 ? tx[1] / advanceLen : 0;
          const vx = upLen > 0 ? tx[2] / upLen : 0;
          const vy = upLen > 0 ? tx[3] / upLen : -1;

          const prev = slices[slices.length - 1];
          if (prev) {
            const prevEndX = prev.baselineX + prev.ux * prev.width;
            const prevEndY = prev.baselineY + prev.uy * prev.width;
            const dx = tx[4] - prevEndX;
            const dy = tx[5] - prevEndY;
            const parallelGap = dx * prev.ux + dy * prev.uy;
            const perpGap = Math.abs(-dx * prev.uy + dy * prev.ux);
            const boundaryHasSpace = /\s$/.test(prev.str) || /^\s/.test(rawItem.str);
            if (
              !boundaryHasSpace &&
              (prev.hasEOL || perpGap > fontHeight * 0.5 || parallelGap > fontHeight * 0.2)
            ) {
              pageText += " ";
            }
          }

          const strStart = pageText.length;
          pageText += rawItem.str;
          const strEnd = pageText.length;

          slices.push({
            str: rawItem.str,
            width: rawItem.width,
            hasEOL: rawItem.hasEOL,
            strStart,
            strEnd,
            baselineX: tx[4],
            baselineY: tx[5],
            ux,
            uy,
            vx,
            vy,
            fontHeight,
          });
        }

        regex.lastIndex = 0;
        for (;;) {
          const match = regex.exec(pageText);
          if (!match) break;
          if (match[0].length === 0) {
            regex.lastIndex++;
            continue;
          }
          const matchStart = match.index;
          const matchEnd = matchStart + match[0].length;
          const overlapping = slices.filter(
            (slice) => slice.strEnd > matchStart && slice.strStart < matchEnd,
          );
          if (overlapping.length === 0) continue;

          // Agrupa fatias na mesma linha visual para gerar caixas contínuas e precisas
          const boxes: Array<{
            minX: number;
            maxX: number;
            minY: number;
            maxY: number;
            fontHeight: number;
          }> = [];

          for (const slice of overlapping) {
            const localStart = Math.max(0, matchStart - slice.strStart);
            const localEnd = Math.min(slice.str.length, matchEnd - slice.strStart);
            const len = slice.str.length;
            const startFrac = len > 0 ? localStart / len : 0;
            const endFrac = len > 0 ? localEnd / len : 1;
            const padW = Math.min(1.5, slice.fontHeight * 0.12);
            const w = slice.width > 0 ? slice.width : Math.max(slice.fontHeight * 0.5, 4);
            const d0 = Math.max(0, startFrac * w - padW);
            const d1 = Math.min(w, endFrac * w + padW);

            const ax = slice.baselineX + slice.ux * d0;
            const ay = slice.baselineY + slice.uy * d0;
            const bx = slice.baselineX + slice.ux * d1;
            const by = slice.baselineY + slice.uy * d1;
            const ascent = slice.fontHeight * 0.92;
            const descent = slice.fontHeight * 0.25;

            const xs = [
              ax + slice.vx * ascent,
              bx + slice.vx * ascent,
              ax - slice.vx * descent,
              bx - slice.vx * descent,
            ];
            const ys = [
              ay + slice.vy * ascent,
              by + slice.vy * ascent,
              ay - slice.vy * descent,
              by - slice.vy * descent,
            ];

            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const lastBox = boxes[boxes.length - 1];
            if (
              lastBox &&
              Math.abs(lastBox.minY - minY) <= Math.max(lastBox.fontHeight, slice.fontHeight) * 0.6
            ) {
              lastBox.minX = Math.min(lastBox.minX, minX);
              lastBox.maxX = Math.max(lastBox.maxX, maxX);
              lastBox.minY = Math.min(lastBox.minY, minY);
              lastBox.maxY = Math.max(lastBox.maxY, maxY);
            } else {
              boxes.push({ minX, maxX, minY, maxY, fontHeight: slice.fontHeight });
            }
          }

          for (const box of boxes) {
            const rawLeft = clampPercent((box.minX / viewport.width) * 100, 0, 99.9);
            const rawTop = clampPercent((box.minY / viewport.height) * 100, 0, 99.9);
            const rawRight = clampPercent((box.maxX / viewport.width) * 100, rawLeft + 0.1, 100);
            const rawBottom = clampPercent((box.maxY / viewport.height) * 100, rawTop + 0.1, 100);

            const xPercent = Math.round(rawLeft * 100) / 100;
            const yPercent = Math.round(rawTop * 100) / 100;
            const widthPercent = Math.max(
              0.1,
              Math.min(100 - xPercent, Math.round((rawRight - xPercent) * 100) / 100),
            );
            const heightPercent = Math.max(
              0.1,
              Math.min(100 - yPercent, Math.round((rawBottom - yPercent) * 100) / 100),
            );

            results.push({
              id: `auto-redact-${pageIndex}-${results.length}-${Date.now()}`,
              pageIndex,
              xPercent,
              yPercent,
              widthPercent,
              heightPercent,
              color,
              ...(label ? { label } : {}),
            });
          }
        }
      } finally {
        page.cleanup();
      }
    }

    return results;
  } finally {
    await loadingTask.destroy();
  }
}
