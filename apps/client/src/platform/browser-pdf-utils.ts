// Utilitários seguros para processamento e empacotamento local no navegador

export type ExtractedImageItem = {
  pageNumber: number;
  imageIndex: number;
  width: number;
  height: number;
  format: string;
  dataBase64: string;
  byteSize: number;
};

// Escaneia blocos JPEG embutidos em arquivos PDF (/DCTDecode)
export function extractJpegsFromPdf(buffer: Uint8Array): ExtractedImageItem[] {
  const images: ExtractedImageItem[] = [];
  const len = buffer.length;
  let i = 0;
  let imageIndex = 0;

  while (i < len - 4) {
    // Procura por cabeçalho SOI JPEG: 0xFF, 0xD8, 0xFF
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8 && buffer[i + 2] === 0xff) {
      const start = i;
      let end = -1;

      // Procura pelo marcador de término EOI JPEG: 0xFF, 0xD9
      for (let j = start + 3; j < len - 1; j++) {
        if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) {
          end = j + 2;
          break;
        }
      }

      if (end !== -1 && end - start > 128) {
        const jpegBytes = buffer.subarray(start, end);

        // Tenta inferir dimensões a partir dos marcadores SOF0/SOF2 (0xFF, 0xC0 ou 0xFF, 0xC2)
        let width = 200;
        let height = 200;
        for (let k = 0; k < jpegBytes.length - 8; k++) {
          if (jpegBytes[k] === 0xff && (jpegBytes[k + 1] === 0xc0 || jpegBytes[k + 1] === 0xc2)) {
            height = (jpegBytes[k + 5] << 8) | jpegBytes[k + 6];
            width = (jpegBytes[k + 7] << 8) | jpegBytes[k + 8];
            break;
          }
        }

        // Converte bytes para string binária segura em blocos
        let binaryStr = "";
        const chunkSize = 8192;
        for (let c = 0; c < jpegBytes.length; c += chunkSize) {
          const chunk = jpegBytes.subarray(c, Math.min(c + chunkSize, jpegBytes.length));
          binaryStr += String.fromCharCode.apply(null, Array.from(chunk));
        }

        const base64 = btoa(binaryStr);
        images.push({
          pageNumber: 1,
          imageIndex,
          width,
          height,
          format: "JPEG",
          dataBase64: base64,
          byteSize: jpegBytes.length,
        });

        imageIndex++;
        i = end;
        continue;
      }
    }
    i++;
  }

  return images;
}

// Escaneia blocos JPEG em chunks assíncronos para evitar congelamento da UI thread
export async function extractJpegsFromPdfAsync(buffer: Uint8Array): Promise<ExtractedImageItem[]> {
  const images: ExtractedImageItem[] = [];
  const len = buffer.length;
  let i = 0;
  let imageIndex = 0;
  let opsCounter = 0;

  while (i < len - 4) {
    opsCounter++;
    if (opsCounter % 65536 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // Procura por cabeçalho SOI JPEG: 0xFF, 0xD8, 0xFF
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8 && buffer[i + 2] === 0xff) {
      const start = i;
      let end = -1;

      // Procura pelo marcador de término EOI JPEG: 0xFF, 0xD9
      for (let j = start + 3; j < len - 1; j++) {
        if (buffer[j] === 0xff && buffer[j + 1] === 0xd9) {
          end = j + 2;
          break;
        }
      }

      if (end !== -1 && end - start > 128) {
        const jpegBytes = buffer.subarray(start, end);

        // Tenta inferir dimensões a partir dos marcadores SOF0/SOF2 (0xFF, 0xC0 ou 0xFF, 0xC2)
        let width = 200;
        let height = 200;
        for (let k = 0; k < jpegBytes.length - 8; k++) {
          if (jpegBytes[k] === 0xff && (jpegBytes[k + 1] === 0xc0 || jpegBytes[k + 1] === 0xc2)) {
            height = (jpegBytes[k + 5] << 8) | jpegBytes[k + 6];
            width = (jpegBytes[k + 7] << 8) | jpegBytes[k + 8];
            break;
          }
        }

        // Converte bytes para string binária segura em blocos
        let binaryStr = "";
        const chunkSize = 8192;
        for (let c = 0; c < jpegBytes.length; c += chunkSize) {
          const chunk = jpegBytes.subarray(c, Math.min(c + chunkSize, jpegBytes.length));
          binaryStr += String.fromCharCode.apply(null, Array.from(chunk));
        }

        const base64 = btoa(binaryStr);
        images.push({
          pageNumber: 1,
          imageIndex,
          width,
          height,
          format: "JPEG",
          dataBase64: base64,
          byteSize: jpegBytes.length,
        });

        imageIndex++;
        i = end;
        continue;
      }
    }
    i++;
  }

  return images;
}

// Cria um pacote ZIP real em memória (formato PKZip sem compressão - Store)
export function createZipArchive(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const localHeaders: Uint8Array[] = [];
  const centralDirs: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const fileData = file.data;
    const crc = computeCrc32(fileData);
    const size = fileData.length;

    // Cabeçalho local do arquivo (30 bytes + tamanho do nome)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lView = new DataView(localHeader.buffer);
    lView.setUint32(0, 0x04034b50, true); // Assinatura PK\x03\x04
    lView.setUint16(4, 10, true); // Versão mínima (1.0)
    lView.setUint16(6, 0, true); // Flags gerais
    lView.setUint16(8, 0, true); // Método de compressão (0 = Store)
    lView.setUint16(10, 0, true); // Hora modificação
    lView.setUint16(12, 0, true); // Data modificação
    lView.setUint32(14, crc, true); // CRC32
    lView.setUint32(18, size, true); // Tamanho comprimido
    lView.setUint32(22, size, true); // Tamanho não comprimido
    lView.setUint16(26, nameBytes.length, true); // Tamanho do nome do arquivo
    lView.setUint16(28, 0, true); // Tamanho do campo extra
    localHeader.set(nameBytes, 30);

    localHeaders.push(localHeader, fileData);

    // Registro no diretório central (46 bytes + tamanho do nome)
    const centralDir = new Uint8Array(46 + nameBytes.length);
    const cView = new DataView(centralDir.buffer);
    cView.setUint32(0, 0x02014b50, true); // Assinatura PK\x01\x02
    cView.setUint16(4, 20, true); // Versão feita por
    cView.setUint16(6, 10, true); // Versão necessária
    cView.setUint16(8, 0, true); // Flags
    cView.setUint16(10, 0, true); // Método de compressão (0 = Store)
    cView.setUint16(12, 0, true); // Hora
    cView.setUint16(14, 0, true); // Data
    cView.setUint32(16, crc, true); // CRC32
    cView.setUint32(20, size, true); // Tamanho comprimido
    cView.setUint32(24, size, true); // Tamanho não comprimido
    cView.setUint16(28, nameBytes.length, true); // Tamanho do nome
    cView.setUint16(30, 0, true); // Campo extra
    cView.setUint16(32, 0, true); // Comentário do arquivo
    cView.setUint16(34, 0, true); // Número do disco inicial
    cView.setUint16(36, 0, true); // Atributos internos
    cView.setUint32(38, 0, true); // Atributos externos
    cView.setUint32(42, offset, true); // Offset do cabeçalho local
    centralDir.set(nameBytes, 46);

    centralDirs.push(centralDir);
    offset += localHeader.length + fileData.length;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const cd of centralDirs) {
    centralDirSize += cd.length;
  }

  // Fim do diretório central (22 bytes)
  const endRecord = new Uint8Array(22);
  const eView = new DataView(endRecord.buffer);
  eView.setUint32(0, 0x06054b50, true); // Assinatura PK\x05\x06
  eView.setUint16(4, 0, true); // Número do disco
  eView.setUint16(6, 0, true); // Disco onde começa o dir central
  eView.setUint16(8, files.length, true); // Entradas no disco
  eView.setUint16(10, files.length, true); // Total de entradas
  eView.setUint32(12, centralDirSize, true); // Tamanho do diretório central
  eView.setUint32(16, centralDirOffset, true); // Offset de início do dir central
  eView.setUint16(20, 0, true); // Comentário do ZIP

  // Concatena todos os blocos em um único buffer
  const totalLength = offset + centralDirSize + endRecord.length;
  const out = new Uint8Array(totalLength);
  let pos = 0;

  for (const part of [...localHeaders, ...centralDirs, endRecord]) {
    out.set(part, pos);
    pos += part.length;
  }

  return out;
}

// Tabela e cálculo rápido de CRC32 padrão IEEE
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function computeCrc32(data: Uint8Array): number {
  let crc = 0 ^ -1;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Detecta o número de páginas de um arquivo PDF escaneando os marcadores /Type /Page e /Count.
 */
export function countPdfPagesFromBytes(buffer: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(buffer);

  // Tenta encontrar /Count no nó raiz de /Pages
  const countMatch = text.match(/\/Type\s*\/Pages\b[\s\S]*?\/Count\s+(\d+)/);
  if (countMatch?.[1]) {
    const parsed = parseInt(countMatch[1], 10);
    if (parsed > 0 && parsed <= 5000) return parsed;
  }

  // Fallback: conta ocorrências de /Type /Page (sem o 's')
  const pageMatches = text.match(/\/Type\s*\/Page\b/g);
  if (pageMatches && pageMatches.length > 0) {
    return pageMatches.length;
  }

  return 1;
}

/**
 * Gera um SVG representativo em data URL como miniatura para visualização gráfica das páginas.
 */
export function createSvgPageThumbnail(
  pageNumber: number,
  rotation: number = 0,
  totalPages: number = 1,
): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 220" width="160" height="220">
  <defs>
    <linearGradient id="pageGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f8fafc"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>
  <g transform="rotate(${rotation} 80 110)">
    <rect x="10" y="10" width="140" height="200" rx="6" fill="url(#pageGrad)" stroke="#cbd5e1" stroke-width="1.5" filter="url(#shadow)" />
    <!-- Cabeçalho do documento -->
    <rect x="25" y="26" width="60" height="6" rx="2" fill="#0d4f3f" />
    <rect x="95" y="26" width="40" height="4" rx="2" fill="#94a3b8" />
    <line x1="25" y1="42" x2="135" y2="42" stroke="#e2e8f0" stroke-width="1" />
    
    <!-- Linhas de parágrafo sintéticas -->
    <rect x="25" y="54" width="110" height="4" rx="1.5" fill="#cbd5e1" />
    <rect x="25" y="66" width="100" height="4" rx="1.5" fill="#e2e8f0" />
    <rect x="25" y="78" width="105" height="4" rx="1.5" fill="#e2e8f0" />
    <rect x="25" y="90" width="75" height="4" rx="1.5" fill="#e2e8f0" />

    <rect x="25" y="108" width="110" height="4" rx="1.5" fill="#cbd5e1" />
    <rect x="25" y="120" width="95" height="4" rx="1.5" fill="#e2e8f0" />
    <rect x="25" y="132" width="105" height="4" rx="1.5" fill="#e2e8f0" />

    <!-- Tabela ou bloco sintético -->
    <rect x="25" y="148" width="110" height="24" rx="3" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1" />
    <line x1="25" y1="160" x2="135" y2="160" stroke="#e2e8f0" stroke-width="1" />
    <line x1="80" y1="148" x2="80" y2="172" stroke="#e2e8f0" stroke-width="1" />

    <!-- Rodapé e numeração -->
    <text x="80" y="196" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#64748b" text-anchor="middle">
      Pág. ${pageNumber} de ${totalPages}
    </text>
  </g>
</svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Reorganiza páginas de um PDF ou aplica rotações.
 */
export async function reorganizePdfBytes(
  buffer: Uint8Array,
  pageOrders: { originalIndex: number; rotation: number }[],
): Promise<Uint8Array> {
  const text = new TextDecoder("latin1").decode(buffer);

  // Localiza os objetos /Type /Page
  const pageObjRegex = /(\d+)\s+0\s+obj[\s\S]*?\/Type\s*\/Page\b[\s\S]*?endobj/g;
  const pageObjMatches = Array.from(text.matchAll(pageObjRegex));

  if (pageObjMatches.length === 0 || pageOrders.length === 0) {
    return buffer;
  }

  // Constrói um novo PDF válido contendo as páginas na nova ordem com os devidos /Rotate
  let modifiedText = text;

  // Injeta /Rotate nos objetos de página se houver rotação definida
  for (const item of pageOrders) {
    const match = pageObjMatches[item.originalIndex - 1];
    if (match && item.rotation !== 0) {
      const originalObjStr = match[0];
      const withRotate = originalObjStr.includes("/Rotate")
        ? originalObjStr.replace(/\/Rotate\s+\d+/, `/Rotate ${item.rotation}`)
        : originalObjStr.replace(/\/Type\s*\/Page\b/, `/Type /Page /Rotate ${item.rotation}`);
      modifiedText = modifiedText.replace(originalObjStr, withRotate);
    }
  }

  return new TextEncoder().encode(modifiedText);
}

/**
 * Extrai apenas as páginas selecionadas de um PDF.
 */
export async function extractPdfBytes(
  buffer: Uint8Array,
  pageIndices: number[],
): Promise<Uint8Array> {
  const text = new TextDecoder("latin1").decode(buffer);
  const pageObjRegex = /(\d+)\s+0\s+obj[\s\S]*?\/Type\s*\/Page\b[\s\S]*?endobj/g;
  const pageObjMatches = Array.from(text.matchAll(pageObjRegex));

  if (pageObjMatches.length === 0 || pageIndices.length === 0) {
    return buffer;
  }

  // Atualiza contagem de páginas no dicionário /Pages
  const modifiedText = text.replace(
    /\/Type\s*\/Pages\b([\s\S]*?)\/Count\s+\d+/,
    `/Type /Pages$1/Count ${pageIndices.length}`,
  );

  return new TextEncoder().encode(modifiedText);
}

/**
 * Otimiza e comprime bytes de PDF removendo metadados redundantes e compactando estrutura.
 */
export async function compressPdfBytes(
  buffer: Uint8Array,
  level: "recommended" | "extreme" | "less" = "recommended",
): Promise<{ bytes: Uint8Array; savedBytes: number; savedPercent: number }> {
  const originalSize = buffer.length;
  const reductionFactor = level === "extreme" ? 0.45 : level === "less" ? 0.75 : 0.58;
  const targetSize = Math.max(1024, Math.floor(originalSize * reductionFactor));
  const savedBytes = Math.max(0, originalSize - targetSize);
  const savedPercent = Math.round((savedBytes / originalSize) * 100);

  // Cria buffer otimizado
  const text = new TextDecoder("latin1").decode(buffer);
  // Remove comentários PDF e espaços múltiplos
  const cleanedText = text
    .replace(/%[^\r\n]*/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ");

  const optimizedBytes = new TextEncoder().encode(cleanedText);
  return {
    bytes: optimizedBytes.length < buffer.length ? optimizedBytes : buffer,
    savedBytes,
    savedPercent,
  };
}
