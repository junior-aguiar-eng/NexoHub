// Identificadores e marcadores são preservados literalmente, sem exposição ao modelo.
const LITERAL_PATTERN =
  /https?:\/\/[^\s<>]*[^\s<>.,;:!?]|www\.[^\s<>]*[^\s<>.,;:!?]|[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}|\{\{[^{}]*\}\}|\$\{[^{}]*\}|%[A-Za-z_][A-Za-z_0-9]*%/g;

export function isPreservedChunk(chunk: string): boolean {
  if (/^[\s\p{P}\p{S}]+$/u.test(chunk)) return true;
  LITERAL_PATTERN.lastIndex = 0;
  const match = LITERAL_PATTERN.exec(chunk);
  return match?.[0] === chunk;
}

/**
 * Limita os blocos de prosa à janela de contexto do modelo sem perder caracteres.
 * Literais podem exceder o limite: permanecem inteiros e não são enviados ao modelo.
 */
export function segmentTextForTranslation(text: string, maxChunkLength: number = 400): string[] {
  if (!Number.isInteger(maxChunkLength) || maxChunkLength < 2) {
    throw new Error("LIMITE_DE_BLOCO_INVALIDO");
  }
  if (!text.trim()) return [];
  const chunks: string[] = [];
  function appendPlain(part: string): void {
    let remaining = part;
    while (remaining) {
      const leading = remaining.match(/^\s+/)?.[0];
      if (leading) {
        chunks.push(leading);
        remaining = remaining.slice(leading.length);
        continue;
      }
      // Cada sentença completa tem sua própria inferência: evita que o modelo
      // descarte títulos ou o final de um parágrafo ao condensar várias sentenças.
      // Intl.Segmenter reconhece abreviações e pontuação sem regras por corpus.
      const sentence = new Intl.Segmenter(undefined, { granularity: "sentence" })
        .segment(remaining)
        [Symbol.iterator]()
        .next().value?.segment;
      let end = Math.min(maxChunkLength, sentence?.length ?? remaining.length);
      if (end < remaining.length) {
        // Prefere palavra completa, mas também limita tokens sem espaços.
        const candidate = remaining.slice(0, end + 1);
        const spaces = [...candidate.matchAll(/\s+/g)];
        const boundary = spaces.at(-1)?.index;
        if (boundary) end = boundary;
        // Nunca corta um par substituto UTF-16.
        else if (/[\uD800-\uDBFF]/.test(remaining[end - 1] ?? "")) end--;
      }
      const piece = remaining.slice(0, end);
      const trailing = piece.match(/\s+$/)?.[0] ?? "";
      const content = piece.slice(0, piece.length - trailing.length);
      if (content) chunks.push(content);
      if (trailing) chunks.push(trailing);
      remaining = remaining.slice(end);
    }
  }
  // Quebras, recuos e marcadores não dependem de o modelo respeitar formatação.
  const separators = new RegExp(`(${LITERAL_PATTERN.source}|\\r\\n|[\\r\\n\\t]+)`, "g");
  for (const part of text.split(separators)) {
    if (!part) continue;
    if (isPreservedChunk(part)) chunks.push(part);
    else appendPlain(part);
  }
  return chunks;
}
