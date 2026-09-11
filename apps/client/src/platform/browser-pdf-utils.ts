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
