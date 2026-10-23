import {
  concatTransformationMatrix,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  StandardFonts,
} from "pdf-lib";
import { getVisiblePageGeometry } from "./pdf-page-geometry";

export interface CropMargins {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}
export interface CropPdfOptions {
  readonly margins: CropMargins;
  readonly scope?: "all" | "selected";
  readonly selectedPages?: readonly number[];
}

/** Recorte visual não destrutivo: preserva streams e ajusta as caixas da página. */
export async function cropPdfDocument(
  pdfBytes: Uint8Array,
  options: CropPdfOptions,
): Promise<Uint8Array> {
  if (!pdfBytes.length) throw new Error("DOCUMENTO_VAZIO");
  const { top, bottom, left, right } = options.margins;
  if (![top, bottom, left, right].every((value) => Number.isFinite(value) && value >= 0)) {
    throw new Error("MARGEM_INVALIDA");
  }
  if (top + bottom >= 95 || left + right >= 95) throw new Error("RECORTE_MUITO_GRANDE");
  const doc = await PDFDocument.load(pdfBytes);
  const count = doc.getPageCount();
  if (!count) throw new Error("DOCUMENTO_SEM_PAGINAS");
  const selected =
    options.scope === "selected"
      ? (options.selectedPages ?? [])
      : doc.getPageIndices().map((index) => index + 1);
  if (
    !selected.length ||
    selected.some((page) => !Number.isInteger(page) || page < 1 || page > count)
  ) {
    throw new Error("PAGINAS_INVALIDAS");
  }
  for (const number of new Set(selected)) {
    const page = doc.getPage(number - 1);
    const geometry = getVisiblePageGeometry(page);
    const a = geometry.toPdfPoint((geometry.width * left) / 100, (geometry.height * bottom) / 100);
    const b = geometry.toPdfPoint(
      geometry.width * (1 - right / 100),
      geometry.height * (1 - top / 100),
    );
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const width = Math.abs(b.x - a.x);
    const height = Math.abs(b.y - a.y);
    page.setCropBox(x, y, width, height);
    page.setMediaBox(x, y, width, height);
  }
  return doc.save({ useObjectStreams: true });
}

export interface SignaturePlacement {
  readonly page?: number | "all" | "first" | "last";
  readonly xPercent: number;
  readonly yPercent: number;
  readonly widthPercent: number;
  readonly heightPercent: number;
}
export interface SignPdfOptions {
  readonly signatureImageBytes?: Uint8Array;
  readonly signerName?: string;
  readonly includeDate?: boolean;
  readonly dateText?: string;
  readonly placement: SignaturePlacement;
}

/** Selo visual; não cria assinatura criptográfica ou certificado digital. */
export async function signPdfDocument(
  pdfBytes: Uint8Array,
  options: SignPdfOptions,
): Promise<Uint8Array> {
  if (!pdfBytes.length) throw new Error("DOCUMENTO_VAZIO");
  const { placement, signatureImageBytes } = options;
  const signerName = options.signerName?.trim();
  if (!signatureImageBytes?.length && !signerName) throw new Error("ASSINATURA_VAZIA");
  const percentages = [
    placement.xPercent,
    placement.yPercent,
    placement.widthPercent,
    placement.heightPercent,
  ];
  if (
    !percentages.every((value) => Number.isFinite(value) && value >= 0 && value <= 100) ||
    placement.widthPercent === 0 ||
    placement.heightPercent === 0
  ) {
    throw new Error("POSICAO_ASSINATURA_INVALIDA");
  }
  const doc = await PDFDocument.load(pdfBytes);
  const count = doc.getPageCount();
  if (!count) throw new Error("DOCUMENTO_SEM_PAGINAS");
  const target = placement.page ?? "last";
  let indices: number[];
  if (target === "all") indices = doc.getPageIndices();
  else if (target === "first") indices = [0];
  else if (target === "last") indices = [count - 1];
  else if (typeof target === "number" && Number.isInteger(target) && target >= 1 && target <= count)
    indices = [target - 1];
  else throw new Error("PAGINAS_INVALIDAS");

  const image = signatureImageBytes?.length
    ? signatureImageBytes[0] === 0x89
      ? await doc.embedPng(signatureImageBytes)
      : await doc.embedJpg(signatureImageBytes)
    : undefined;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const lines = [];
  if (signerName) lines.push({ text: `Assinado por: ${signerName}`, font: bold });
  if (options.includeDate) {
    const date =
      options.dateText ||
      new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(),
      );
    lines.push({ text: `Data: ${date}`, font });
  }
  // Validação antes de desenhar: Helvetica usa WinAnsi e não aceita todos os alfabetos.
  try {
    for (const line of lines) line.font.encodeText(line.text);
  } catch {
    throw new Error("ASSINATURA_TEXTO_NAO_SUPORTADO");
  }

  for (const index of indices) {
    const page = doc.getPage(index);
    const geometry = getVisiblePageGeometry(page);
    const width = (geometry.width * placement.widthPercent) / 100;
    const height = (geometry.height * placement.heightPercent) / 100;
    const x = Math.min(geometry.width - width, (geometry.width * placement.xPercent) / 100);
    const y = Math.min(geometry.height - height, (geometry.height * placement.yPercent) / 100);
    // Nome e data integram a caixa do selo: nunca escapam da área visível, mesmo no rodapé.
    const maxTextWidth = Math.max(
      0,
      ...lines.map((line) => line.font.widthOfTextAtSize(line.text, 1)),
    );
    const fontSize = lines.length
      ? Math.min(8, width / Math.max(1, maxTextWidth), height / (lines.length * (image ? 3 : 1.5)))
      : 8;
    const lineHeight = fontSize * 1.5;
    const textHeight = lines.length * lineHeight;
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...geometry.matrix));
    if (image) {
      const availableHeight = height - textHeight;
      const scale = Math.min(width / image.width, availableHeight / image.height);
      const imageWidth = image.width * scale;
      const imageHeight = image.height * scale;
      page.drawImage(image, {
        x: x + (width - imageWidth) / 2,
        y: y + textHeight + (availableHeight - imageHeight) / 2,
        width: imageWidth,
        height: imageHeight,
      });
    }
    lines.forEach((line, index) => {
      page.drawText(line.text, {
        x,
        y: y + (lines.length - index - 1) * lineHeight + fontSize * 0.3,
        size: fontSize,
        font: line.font,
        color: rgb(0.2, 0.25, 0.3),
      });
    });
    page.pushOperators(popGraphicsState());
  }
  return doc.save({ useObjectStreams: true });
}
