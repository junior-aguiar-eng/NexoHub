import { zlibSync } from "fflate";
import {
  PDFArray,
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFObjectCopier,
  PDFRawStream,
} from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export interface ExtractedImage {
  readonly id: string;
  readonly name: string;
  readonly pageNumber: number;
  readonly width: number;
  readonly height: number;
  readonly format: "jpeg" | "png";
  readonly data: Uint8Array;
}
export interface ExtractImagesOptions {
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly selectedPages?: readonly number[];
}

interface ImageResource {
  readonly stream: PDFRawStream;
  readonly resources: PDFDict;
  readonly width: number;
  readonly height: number;
}

// PNG encoding is independent of canvas: native pixels and alpha survive unchanged.
function pngChunk(type: string, bytes: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(bytes.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, bytes.length);
  chunk.set(
    Array.from(type, (char) => char.charCodeAt(0)),
    4,
  );
  chunk.set(bytes, 8);
  let crc = 0xffffffff;
  for (const byte of chunk.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  view.setUint32(chunk.length - 4, (crc ^ 0xffffffff) >>> 0);
  return chunk;
}
function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const rows = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++)
    rows.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const chunks = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlibSync(rows)),
    pngChunk("IEND", new Uint8Array()),
  ];
  const png = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    png.set(chunk, offset);
    offset += chunk.length;
  }
  return png;
}

interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly kind: number;
  readonly data: Uint8Array;
}

async function decodeImage(doc: PDFDocument, image: ImageResource): Promise<Uint8Array> {
  // Build a temporary decoding container referencing the original image and its color resources.
  // No page is rendered: PDF.js returns decoded samples including Decode/SMask/Mask handling.
  const container = await PDFDocument.create();
  const page = container.addPage([image.width, image.height]);
  const copier = PDFObjectCopier.for(doc.context, container.context);
  const stream = copier.copy(image.stream);
  const resources = copier.copy(image.resources);
  // XObject color spaces normally carry their own definition. Resolve resource aliases
  // as well; PDF.js deliberately only resolves named resources for inline images.
  const colorSpaces = image.resources.lookupMaybe(PDFName.of("ColorSpace"), PDFDict);
  let color = image.stream.dict.lookup(PDFName.of("ColorSpace"));
  const visitedColors = new Set<string>();
  while (
    color instanceof PDFName &&
    colorSpaces?.has(color) &&
    !visitedColors.has(color.toString())
  ) {
    visitedColors.add(color.toString());
    color = colorSpaces.lookup(color);
  }
  if (color) stream.dict.set(PDFName.of("ColorSpace"), copier.copy(color));
  resources.set(
    PDFName.of("XObject"),
    container.context.obj({ Im: container.context.register(stream) }),
  );
  page.node.set(PDFName.of("Resources"), resources);
  page.node.set(
    PDFName.of("Contents"),
    container.context.register(container.context.flateStream("q 1 0 0 1 0 0 cm /Im Do Q")),
  );
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  const task = pdfjs.getDocument({
    data: await container.save(),
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    useWasm: false,
    stopAtErrors: true,
  });
  try {
    const pdf = await task.promise;
    const decodedPage = await pdf.getPage(1);
    const operators = await decodedPage.getOperatorList();
    const index = operators.fnArray.findIndex(
      (op) => op === pdfjs.OPS.paintImageXObject || op === pdfjs.OPS.paintInlineImageXObject,
    );
    if (index < 0) throw new Error("PDF_IMAGE_DECODE_FAILED");
    const args = operators.argsArray[index];
    const decoded: DecodedImage =
      operators.fnArray[index] === pdfjs.OPS.paintInlineImageXObject
        ? args[0]
        : await new Promise<DecodedImage>((resolve) => {
            const objects = String(args[0]).startsWith("g_")
              ? decodedPage.commonObjs
              : decodedPage.objs;
            objects.get(args[0], resolve);
          });
    if (!decoded?.data || decoded.width !== image.width || decoded.height !== image.height)
      throw new Error("PDF_IMAGE_DECODE_FAILED");
    if (decoded.kind === pdfjs.ImageKind.RGBA_32BPP) {
      return encodePng(image.width, image.height, decoded.data);
    }
    const rgba = new Uint8Array(image.width * image.height * 4);
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const pixel = y * image.width + x;
        const out = pixel * 4;
        if (decoded.kind === pdfjs.ImageKind.RGB_24BPP) {
          rgba[out] = decoded.data[pixel * 3];
          rgba[out + 1] = decoded.data[pixel * 3 + 1];
          rgba[out + 2] = decoded.data[pixel * 3 + 2];
          rgba[out + 3] = 255;
        } else if (decoded.kind === pdfjs.ImageKind.GRAYSCALE_1BPP) {
          const sample =
            (decoded.data[y * Math.ceil(image.width / 8) + (x >> 3)] >> (7 - (x & 7))) & 1
              ? 255
              : 0;
          rgba[out] = sample;
          rgba[out + 1] = sample;
          rgba[out + 2] = sample;
          rgba[out + 3] = 255;
        } else throw new Error("PDF_IMAGE_DECODE_FAILED");
      }
    }
    return encodePng(image.width, image.height, rgba);
  } finally {
    await task.destroy();
  }
}

/** Extract image XObjects at native pixel dimensions, including nested Form resources.
 * JPEG bytes are retained when no PDF-specific color/decode/mask processing is necessary.
 * Other images are decoded to sRGB PNG with alpha; this is not page rasterization.
 * Inline images and context-colored stencil masks are not independent image resources.
 */
export async function extractImagesFromPdf(
  pdfBytes: Uint8Array,
  options: ExtractImagesOptions = {},
): Promise<ExtractedImage[]> {
  if (pdfBytes.length === 0) throw new Error("DOCUMENTO_VAZIO");
  const doc = await PDFDocument.load(pdfBytes);
  if (doc.getPageCount() === 0) throw new Error("DOCUMENTO_SEM_PAGINAS");
  const selected = options.selectedPages === undefined ? null : new Set(options.selectedPages);
  const results: ExtractedImage[] = [];
  for (const [pageIndex, page] of doc.getPages().entries()) {
    const pageNumber = pageIndex + 1;
    if (selected && !selected.has(pageNumber)) continue;
    const visited = new Set<PDFRawStream>();
    const images: ImageResource[] = [];
    function visit(resources: PDFDict) {
      const objects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict);
      if (!objects) return;
      for (const [, ref] of objects.entries()) {
        const object = doc.context.lookup(ref);
        if (!(object instanceof PDFRawStream) || visited.has(object)) continue;
        visited.add(object);
        const subtype = object.dict.lookup(PDFName.of("Subtype"));
        if (subtype === PDFName.of("Form")) {
          visit(object.dict.lookupMaybe(PDFName.of("Resources"), PDFDict) ?? resources);
        } else if (subtype === PDFName.of("Image")) {
          if (object.dict.lookupMaybe(PDFName.of("ImageMask"), PDFBool)?.asBoolean()) continue;
          const width = object.dict.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber() ?? 0;
          const height = object.dict.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber() ?? 0;
          if (
            width > 0 &&
            height > 0 &&
            width >= (options.minWidth ?? 16) &&
            height >= (options.minHeight ?? 16)
          )
            images.push({ stream: object, resources, width, height });
        }
      }
    }
    const resources = page.node.Resources();
    if (resources) visit(resources);
    for (const image of images) {
      const dict = image.stream.dict;
      const filter = dict.lookup(PDFName.of("Filter"));
      const filters =
        filter instanceof PDFArray
          ? filter.asArray().map((value) => doc.context.lookup(value))
          : [filter];
      const color = dict.lookup(PDFName.of("ColorSpace"));
      const jpeg =
        filters.length === 1 &&
        filters[0] === PDFName.of("DCTDecode") &&
        (color === PDFName.of("DeviceRGB") || color === PDFName.of("DeviceGray")) &&
        !dict.has(PDFName.of("SMask")) &&
        !dict.has(PDFName.of("Mask")) &&
        !dict.has(PDFName.of("Decode")) &&
        !dict.has(PDFName.of("DecodeParms"));
      const format = jpeg ? "jpeg" : "png";
      const data = jpeg ? image.stream.contents.slice() : await decodeImage(doc, image);
      const sequence = results.length + 1;
      results.push({
        id: `img-${pageNumber}-${sequence}`,
        name: `imagem_p${pageNumber}_${sequence}.${jpeg ? "jpg" : "png"}`,
        pageNumber,
        width: image.width,
        height: image.height,
        format,
        data,
      });
    }
  }
  return results;
}
