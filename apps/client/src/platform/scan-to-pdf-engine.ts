import { degrees, PDFDocument, type PDFImage } from "pdf-lib";

export type ScanFilterType = "original" | "bw" | "grayscale" | "contrast";

export interface ScannedPageItem {
  readonly id: string;
  readonly imageBytes: Uint8Array;
  readonly mimeType?: string;
  readonly rotation?: number; // 0, 90, 180, 270
  readonly filter?: ScanFilterType;
}

export interface ScanToPdfOptions {
  readonly pageSize?: "A4" | "Letter" | "fit";
  readonly orientation?: "portrait" | "landscape" | "auto";
  readonly margin?: "none" | "small" | "normal";
}

const PAGE_DIMENSIONS: Record<"A4" | "Letter", [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612.0, 792.0],
};

const MARGIN_VALUES: Record<"none" | "small" | "normal", number> = {
  none: 0,
  small: 20,
  normal: 36,
};

async function normalizeWebp(bytes: Uint8Array): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/webp" }));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("SCAN_CANVAS_UNAVAILABLE");
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("SCAN_IMAGE_CONVERSION_FAILED"))),
        "image/png",
      ),
    );
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    bitmap.close();
  }
}

/**
 * Aplica processamento de imagem nos pixels para emular scanner de documentos real:
 * - "grayscale": conversão balanceada para luminância monocromática.
 * - "contrast": aumento de contraste e equalização de brancos/pretos.
 * - "bw": limiarização documental de alto contraste (fundo branco papel, texto preto nítido).
 */
export async function applyScanFilter(
  imageBytes: Uint8Array,
  filter: ScanFilterType = "original",
  mimeType: string = "image/jpeg",
): Promise<Uint8Array> {
  if (filter === "original") {
    return imageBytes;
  }

  // Se não estiver em ambiente de navegador com Canvas disponível
  if (typeof document === "undefined" || !document.createElement) {
    return imageBytes;
  }

  try {
    const blob = new Blob([imageBytes as unknown as BlobPart], { type: mimeType });
    const imgBitmap = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = imgBitmap.width;
    canvas.height = imgBitmap.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      imgBitmap.close();
      return imageBytes;
    }

    ctx.drawImage(imgBitmap, 0, 0);
    imgBitmap.close();
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = data.length;

    if (filter === "grayscale") {
      for (let i = 0; i < len; i += 4) {
        const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = lum;
        data[i + 1] = lum;
        data[i + 2] = lum;
      }
    } else if (filter === "contrast") {
      let minLum = 255;
      let maxLum = 0;
      for (let i = 0; i < len; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (lum < minLum) minLum = lum;
        if (lum > maxLum) maxLum = lum;
      }
      const range = Math.max(1, maxLum - minLum);
      for (let i = 0; i < len; i += 4) {
        const r = Math.min(255, Math.max(0, ((data[i] - minLum) / range) * 255));
        const g = Math.min(255, Math.max(0, ((data[i + 1] - minLum) / range) * 255));
        const b = Math.min(255, Math.max(0, ((data[i + 2] - minLum) / range) * 255));
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    } else if (filter === "bw") {
      // Limiarização documental adaptativa
      let sumLum = 0;
      for (let i = 0; i < len; i += 4) {
        sumLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      const avgLum = sumLum / (len / 4);
      const threshold = Math.min(220, Math.max(80, avgLum * 0.95));

      for (let i = 0; i < len; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const val = lum >= threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    return await new Promise<Uint8Array>((resolve) => {
      canvas.toBlob(
        async (resBlob) => {
          if (!resBlob) {
            resolve(imageBytes);
            return;
          }
          resolve(new Uint8Array(await resBlob.arrayBuffer()));
        },
        mimeType.includes("png") ? "image/png" : "image/jpeg",
        0.92,
      );
    });
  } catch {
    return imageBytes;
  }
}

/**
 * Compila uma lista de páginas escaneadas / fotografadas em um documento PDF consolidado.
 */
export async function compileScannedPagesToPdf(
  pages: ScannedPageItem[],
  options: ScanToPdfOptions = {},
): Promise<Uint8Array> {
  if (!pages || pages.length === 0) {
    throw new Error("NENHUMA_PAGINA_DIGITALIZADA");
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setProducer("NexoHub Document Scanner");

  const pageSizeName = options.pageSize || "A4";
  const margin = MARGIN_VALUES[options.margin || "small"] ?? MARGIN_VALUES.small;

  for (const pageItem of pages) {
    let processedBytes = pageItem.imageBytes;
    const isWebp =
      processedBytes[0] === 0x52 &&
      processedBytes[1] === 0x49 &&
      processedBytes[8] === 0x57 &&
      processedBytes[9] === 0x45 &&
      processedBytes[10] === 0x42 &&
      processedBytes[11] === 0x50;
    if (isWebp) processedBytes = await normalizeWebp(processedBytes);
    if (pageItem.filter && pageItem.filter !== "original") {
      processedBytes = await applyScanFilter(
        processedBytes,
        pageItem.filter,
        isWebp ? "image/png" : pageItem.mimeType || "image/jpeg",
      );
    }

    // Tenta embutir como JPEG ou PNG de acordo com assinatura
    let embeddedImg: PDFImage;
    const isPng =
      processedBytes.length >= 8 &&
      processedBytes[0] === 0x89 &&
      processedBytes[1] === 0x50 &&
      processedBytes[2] === 0x4e &&
      processedBytes[3] === 0x47;

    try {
      if (isPng) {
        embeddedImg = await pdfDoc.embedPng(processedBytes);
      } else {
        embeddedImg = await pdfDoc.embedJpg(processedBytes);
      }
    } catch {
      // Fallback cruzado caso extensão/header discorde
      try {
        if (isPng) {
          embeddedImg = await pdfDoc.embedJpg(processedBytes);
        } else {
          embeddedImg = await pdfDoc.embedPng(processedBytes);
        }
      } catch (err) {
        throw new Error(
          `FALHA_AO_EMBUTIR_IMAGEM: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const imgWidth = embeddedImg.width;
    const imgHeight = embeddedImg.height;

    let targetPageWidth: number;
    let targetPageHeight: number;

    if (pageSizeName === "fit") {
      targetPageWidth = imgWidth + margin * 2;
      targetPageHeight = imgHeight + margin * 2;
    } else {
      const [baseW, baseH] = PAGE_DIMENSIONS[pageSizeName] || PAGE_DIMENSIONS.A4;
      const isImgLandscape = imgWidth > imgHeight;
      const orient = options.orientation || "auto";

      if (orient === "landscape" || (orient === "auto" && isImgLandscape)) {
        targetPageWidth = baseH;
        targetPageHeight = baseW;
      } else {
        targetPageWidth = baseW;
        targetPageHeight = baseH;
      }
    }

    const printableW = targetPageWidth - margin * 2;
    const printableH = targetPageHeight - margin * 2;

    const scale = Math.min(printableW / imgWidth, printableH / imgHeight, 1);
    const drawW = imgWidth * scale;
    const drawH = imgHeight * scale;

    const x = margin + (printableW - drawW) / 2;
    const y = margin + (printableH - drawH) / 2;

    const page = pdfDoc.addPage([targetPageWidth, targetPageHeight]);

    const rot = pageItem.rotation || 0;
    if (rot !== 0) {
      page.setRotation(degrees(rot));
    }

    page.drawImage(embeddedImg, {
      x,
      y,
      width: drawW,
      height: drawH,
    });
  }

  return await pdfDoc.save({ useObjectStreams: true });
}
