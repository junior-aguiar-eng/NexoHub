import { PDFDocument } from "pdf-lib";

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

const PDF_HEADER_MAGIC = "%PDF-";
const PDF_EOF_MAGIC = "%%EOF";

/**
 * Converte Uint8Array em string ASCII de forma segura e rápida.
 */
function uint8ArrayToAscii(bytes: Uint8Array): string {
  let result = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    result += String.fromCharCode(...slice);
  }
  return result;
}

/**
 * Localiza ocorrência de uma sequência de caracteres ASCII no Uint8Array.
 */
function indexOfAscii(buffer: Uint8Array, needle: string, startFrom = 0): number {
  const needleLen = needle.length;
  if (needleLen === 0) return 0;
  const maxSearch = buffer.length - needleLen;
  for (let i = startFrom; i <= maxSearch; i++) {
    let match = true;
    for (let j = 0; j < needleLen; j++) {
      if (buffer[i + j] !== needle.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * Localiza a última ocorrência de uma sequência de caracteres ASCII no Uint8Array.
 */
function lastIndexOfAscii(buffer: Uint8Array, needle: string): number {
  const needleLen = needle.length;
  if (needleLen === 0) return 0;
  for (let i = buffer.length - needleLen; i >= 0; i--) {
    let match = true;
    for (let j = 0; j < needleLen; j++) {
      if (buffer[i + j] !== needle.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

/**
 * Reconstrói ou restaura referências cruzadas e trailer
 * para arquivos cujo final foi truncado ou corrompido.
 */
function reconstructXrefAndTrailer(buffer: Uint8Array): {
  buffer: Uint8Array;
  fixedTrailer: boolean;
  fixedXref: boolean;
  fixedEof: boolean;
} {
  const ascii = uint8ArrayToAscii(buffer);

  // 1. Verifica se já existe um Cross-Reference Stream (/Type /XRef) recente no buffer
  const xrefStreamRegex = /(\d+)\s+(\d+)\s+obj[\s\S]*?\/Type\s*\/XRef/g;
  let lastXrefStreamOffset = -1;
  let xrefStreamMatch: RegExpExecArray | null = xrefStreamRegex.exec(ascii);
  while (xrefStreamMatch !== null) {
    lastXrefStreamOffset = xrefStreamMatch.index;
    xrefStreamMatch = xrefStreamRegex.exec(ascii);
  }

  // Se encontramos um /Type /XRef e faltava apenas o startxref ou %%EOF:
  if (lastXrefStreamOffset !== -1) {
    const trailerBytes = new TextEncoder().encode(`\nstartxref\n${lastXrefStreamOffset}\n%%EOF\n`);
    const combined = new Uint8Array(buffer.length + trailerBytes.length);
    combined.set(buffer, 0);
    combined.set(trailerBytes, buffer.length);
    return { buffer: combined, fixedTrailer: true, fixedXref: true, fixedEof: true };
  }

  // 2. Verifica se já existe uma tabela xref textual antes do fim do arquivo
  const lastXrefTextOffset = ascii.lastIndexOf("\nxref\n");
  if (lastXrefTextOffset !== -1) {
    // Se achou uma tabela xref e o trailer está intacto, restaura startxref
    const hasTrailer = ascii.indexOf("trailer", lastXrefTextOffset) !== -1;
    if (hasTrailer) {
      const trailerBytes = new TextEncoder().encode(
        `\nstartxref\n${lastXrefTextOffset + 1}\n%%EOF\n`,
      );
      const combined = new Uint8Array(buffer.length + trailerBytes.length);
      combined.set(buffer, 0);
      combined.set(trailerBytes, buffer.length);
      return { buffer: combined, fixedTrailer: false, fixedXref: true, fixedEof: true };
    }
  }

  // 3. Reconstrução completa sintetizando nova tabela xref e trailer
  const objRegex = /(\d+)\s+(\d+)\s+obj/g;
  const objects: Array<{ id: number; generation: number; offset: number }> = [];
  let match: RegExpExecArray | null = objRegex.exec(ascii);
  while (match !== null) {
    const id = Number.parseInt(match[1], 10);
    const generation = Number.parseInt(match[2], 10);
    const offset = match.index;
    objects.push({ id, generation, offset });
    match = objRegex.exec(ascii);
  }

  if (objects.length === 0) {
    return { buffer, fixedTrailer: false, fixedXref: false, fixedEof: false };
  }

  // Ordena por id do objeto
  objects.sort((a, b) => a.id - b.id);

  // Localiza objeto de Catálogo (/Type /Catalog) ou referência /Root em trailers anteriores
  const catalogMatch = /(\d+)\s+\d+\s+obj[\s\S]*?\/Type\s*\/Catalog/i.exec(ascii);
  const rootRefMatch = /\/Root\s+(\d+)\s+\d+\s+R/i.exec(ascii);
  let catalogObjId = catalogMatch
    ? Number.parseInt(catalogMatch[1], 10)
    : rootRefMatch
      ? Number.parseInt(rootRefMatch[1], 10)
      : objects[0].id;

  if (!catalogMatch && !rootRefMatch) {
    const pagesMatch = /(\d+)\s+\d+\s+obj[\s\S]*?\/Type\s*\/Pages/i.exec(ascii);
    if (pagesMatch) {
      catalogObjId = Number.parseInt(pagesMatch[1], 10);
    }
  }

  const maxId = objects[objects.length - 1].id;
  const xrefOffset = buffer.length;

  let xrefContent = `\nxref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  const offsetMap = new Map<number, number>();
  for (const obj of objects) {
    offsetMap.set(obj.id, obj.offset);
  }

  for (let i = 1; i <= maxId; i++) {
    const offset = offsetMap.get(i);
    if (offset !== undefined) {
      const padded = offset.toString().padStart(10, "0");
      xrefContent += `${padded} 00000 n \n`;
    } else {
      xrefContent += "0000000000 00000 f \n";
    }
  }

  xrefContent += `trailer\n<<\n  /Size ${maxId + 1}\n  /Root ${catalogObjId} 0 R\n>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const encoder = new TextEncoder();
  const trailerBytes = encoder.encode(xrefContent);
  const combined = new Uint8Array(buffer.length + trailerBytes.length);
  combined.set(buffer, 0);
  combined.set(trailerBytes, buffer.length);

  return { buffer: combined, fixedTrailer: true, fixedXref: true, fixedEof: true };
}

/**
 * Repara arquivos PDF corrompidos, recuperando páginas intactas,
 * corrigindo cabeçalhos e reconstruindo estruturas sintáticas.
 */
export async function repairPdfDocument(rawBytes: Uint8Array): Promise<PdfRepairResult> {
  const originalSize = rawBytes.length;

  if (originalSize === 0) {
    throw new Error("EMPTY_DOCUMENT");
  }

  let fixedHeader = false;
  let fixedEof = false;
  let fixedTrailer = false;
  let fixedXref = false;
  const warnings: string[] = [];

  // 1. Sanitização e alinhamento de cabeçalho (%PDF-)
  let processedBytes = rawBytes;
  const headerIndex = indexOfAscii(processedBytes, PDF_HEADER_MAGIC);

  if (headerIndex > 0 && headerIndex < 4096) {
    // Remove lixo/BOM anterior ao início do PDF
    processedBytes = processedBytes.subarray(headerIndex);
    fixedHeader = true;
  } else if (headerIndex === -1) {
    // Se não encontrou o cabeçalho, verifica se possui estrutura de objetos PDF
    const firstObj = indexOfAscii(processedBytes, "obj");
    if (firstObj !== -1) {
      const headerBytes = new TextEncoder().encode("%PDF-1.7\n");
      const combined = new Uint8Array(headerBytes.length + processedBytes.length);
      combined.set(headerBytes, 0);
      combined.set(processedBytes, headerBytes.length);
      processedBytes = combined;
      fixedHeader = true;
    } else {
      throw new Error("CORRUPTED_DOCUMENT");
    }
  }

  // 2. Verificação de final de arquivo (%%EOF)
  const eofIndex = lastIndexOfAscii(processedBytes, PDF_EOF_MAGIC);
  if (eofIndex === -1) {
    fixedEof = true;
  }

  // 3. Tentativa de carregamento inicial
  let sourceDoc: PDFDocument | null = null;
  try {
    sourceDoc = await PDFDocument.load(processedBytes, {
      ignoreEncryption: false,
    });
  } catch (_loadErr) {
    // Se falhar o load padrão, tenta reconstrução agressiva de xref e trailer
    const reconstructed = reconstructXrefAndTrailer(processedBytes);
    processedBytes = reconstructed.buffer;
    fixedTrailer = reconstructed.fixedTrailer || fixedTrailer;
    fixedXref = reconstructed.fixedXref || fixedXref;
    fixedEof = reconstructed.fixedEof || fixedEof;

    try {
      sourceDoc = await PDFDocument.load(processedBytes, {
        ignoreEncryption: false,
      });
    } catch (secondErr) {
      if (secondErr instanceof Error && /password|encrypt/i.test(secondErr.message)) {
        throw new Error("SENHA_OBRIGATORIA");
      }
      throw new Error("CORRUPTED_DOCUMENT");
    }
  }

  // 4. Extração e reconstrução resiliente página a página em novo documento limpo
  const totalDetectedPages = sourceDoc.getPageCount();
  if (totalDetectedPages === 0) {
    throw new Error("CORRUPTED_DOCUMENT");
  }

  const cleanDoc = await PDFDocument.create();
  let recoveredPages = 0;

  for (let i = 0; i < totalDetectedPages; i++) {
    try {
      const [copiedPage] = await cleanDoc.copyPages(sourceDoc, [i]);
      cleanDoc.addPage(copiedPage);
      recoveredPages++;
    } catch (_pageErr) {
      warnings.push(`Página ${i + 1} não pôde ser recuperada devido a fluxo corrompido.`);
    }
  }

  if (recoveredPages === 0) {
    throw new Error("CORRUPTED_DOCUMENT");
  }

  // 5. Gera o novo arquivo PDF restaurado
  const repairedBytes = await cleanDoc.save();

  const report: PdfRepairReport = {
    fixedHeader,
    fixedEof,
    fixedTrailer,
    fixedXref,
    recoveredPages,
    totalDetectedPages,
    originalSize,
    repairedSize: repairedBytes.length,
    warnings,
  };

  return {
    pdfBytes: repairedBytes,
    report,
  };
}
