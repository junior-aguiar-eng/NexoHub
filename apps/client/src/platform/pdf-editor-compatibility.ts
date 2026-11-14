import type { EditorFont, EditorReplacement, EditorTextObject } from "./pdf-editor-types";

export const editorLatinText = (text: string) =>
  /^[\x20-\x7e\xa0-\xff\u20ac\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\n]*$/.test(text);

// Ligaduras e códigos privados exigem um mapeamento que este perfil não homologa.
export const editorUnsafeMapping = (text: string) =>
  /[\p{Cc}\p{Co}\ufb00-\ufb06\ufffd]/u.test(text);

/** Pré-verificação conservadora; geometria e serialização continuam validadas pelo motor. */
export function editorReplacementIssue(
  object: EditorTextObject,
  replacement: EditorReplacement,
): "unsafeObject" | "unsafeStyle" | "unprovenCharacters" | "fitError" | undefined {
  if (!object.editable) return "unsafeObject";
  if (!replacement.text) return;
  if (replacement.text.includes("\n") && !replacement.maxWidth) return "fitError";
  if (editorUnsafeMapping(replacement.text)) return "unprovenCharacters";
  if (
    object.canChangeStyle === false &&
    (replacement.fallbackFont ||
      (replacement.fontSize !== undefined && replacement.fontSize !== object.fontSize))
  )
    return "unsafeStyle";
  if (replacement.fallbackFont || object.fontPolicy === "latin") {
    if (!editorLatinText(replacement.text)) return "unprovenCharacters";
  } else if (object.fontPolicy === "observed") {
    const coverage = new Set(object.supportedCharacters);
    if (Array.from(replacement.text).some((ch) => ch !== " " && !coverage.has(ch)))
      return "unprovenCharacters";
  }
}

export function pickCompatibleFallbackFont(fontName: string): EditorFont {
  const lower = fontName.toLowerCase();
  if (lower.includes("courier") || lower.includes("mono") || lower.includes("consolas")) {
    return "Courier";
  }
  if (
    lower.includes("times") ||
    lower.includes("serif") ||
    lower.includes("georgia") ||
    lower.includes("garamond")
  ) {
    return "Times-Roman";
  }
  const bold =
    lower.includes("bold") ||
    lower.includes("black") ||
    lower.includes("heavy") ||
    lower.includes("semibold");
  const italic = lower.includes("italic") || lower.includes("oblique");
  if (bold && italic) return "Helvetica-BoldOblique";
  if (bold) return "Helvetica-Bold";
  if (italic) return "Helvetica-Oblique";
  return "Helvetica";
}

export function needsFallbackForText(object: EditorTextObject, text: string): boolean {
  if (object.fontPolicy !== "observed" || !object.supportedCharacters) return false;
  const coverage = new Set(object.supportedCharacters);
  return Array.from(text).some((ch) => ch !== " " && ch !== "\n" && !coverage.has(ch));
}

export interface GroupedEditorText extends EditorTextObject {
  memberIds: string[];
  lineCount: number;
}

/**
 * Agrupa objetos textuais editáveis adjacentes na mesma linha/frase
 * para evitar edição caractere por caractere em PDFs com kerning fragmentado.
 */
export function groupEditableTextRuns(texts: readonly EditorTextObject[]): GroupedEditorText[] {
  const nonEditable: GroupedEditorText[] = [];
  const editable: EditorTextObject[] = [];
  for (const item of texts) {
    if (!item.editable) {
      nonEditable.push({ ...item, memberIds: [item.id], lineCount: 1 });
    } else {
      editable.push(item);
    }
  }

  const sorted = [...editable].sort((a, b) => {
    const lineTol = Math.max(a.height, b.height, 0.006) * 0.55;
    if (Math.abs(a.y - b.y) > lineTol) return a.y - b.y;
    return a.x - b.x;
  });

  const groups: GroupedEditorText[] = [];
  for (const item of sorted) {
    const prev = groups[groups.length - 1];
    if (prev) {
      const lineTol = Math.max(prev.height, item.height, 0.006) * 0.55;
      const sameLine = Math.abs(prev.y - item.y) <= lineTol;
      const sameStyle =
        prev.fontName === item.fontName &&
        prev.color === item.color &&
        prev.fontPolicy === item.fontPolicy &&
        Math.abs(prev.fontSize - item.fontSize) <= Math.max(prev.fontSize, item.fontSize) * 0.18;
      const prevRight = prev.x + prev.width;
      const gap = item.x - prevRight;
      const maxGap = Math.max(0.025, prev.height * 1.4);
      if (sameLine && sameStyle && gap >= -0.006 && gap <= maxGap) {
        const space =
          gap > Math.max(0.0025, prev.height * 0.16) &&
          !prev.text.endsWith(" ") &&
          !item.text.startsWith(" ")
            ? " "
            : "";
        const right = Math.max(prevRight, item.x + item.width);
        const top = Math.min(prev.y, item.y);
        const bottom = Math.max(prev.y + prev.height, item.y + item.height);
        const chars = new Set([
          ...(prev.supportedCharacters ? Array.from(prev.supportedCharacters) : []),
          ...(item.supportedCharacters ? Array.from(item.supportedCharacters) : []),
        ]);
        prev.text = `${prev.text}${space}${item.text}`;
        prev.x = Math.min(prev.x, item.x);
        prev.y = top;
        prev.width = right - prev.x;
        prev.height = bottom - top;
        prev.canChangeStyle = prev.canChangeStyle !== false && item.canChangeStyle !== false;
        if (chars.size > 0) prev.supportedCharacters = Array.from(chars).join("");
        prev.memberIds.push(item.id);
        continue;
      }
    }
    groups.push({ ...item, memberIds: [item.id], lineCount: 1 });
  }

  return [...groups, ...nonEditable.map((item) => ({ ...item, lineCount: 1 }))];
}

/**
 * Une linhas consecutivas de um mesmo parágrafo (mesma coluna, estilo e espaçamento normal)
 * para edição contínua estilo Adobe Acrobat, mantendo células de tabela e colunas separadas.
 */
export function groupEditableParagraphs(texts: readonly EditorTextObject[]): GroupedEditorText[] {
  const lineGroups = groupEditableTextRuns(texts);
  const nonEditable = lineGroups.filter((g) => !g.editable);
  const lines = lineGroups.filter((g) => g.editable);
  const paragraphs: GroupedEditorText[] = [];

  for (const line of lines) {
    let matched: GroupedEditorText | undefined;
    for (let idx = paragraphs.length - 1; idx >= 0; idx--) {
      const candidate = paragraphs[idx];
      const avgLineH = candidate.height / Math.max(1, candidate.lineCount);
      const vGap = line.y - (candidate.y + candidate.height);
      if (vGap > Math.max(avgLineH, line.height) * 1.2) break;
      const sameColumn =
        Math.abs(candidate.x - line.x) <= 0.02 ||
        Math.abs(candidate.x + candidate.width / 2 - (line.x + line.width / 2)) <= 0.02;
      const sameStyle =
        candidate.fontName === line.fontName &&
        candidate.color === line.color &&
        candidate.fontPolicy === line.fontPolicy &&
        Math.abs(candidate.fontSize - line.fontSize) <=
          Math.max(candidate.fontSize, line.fontSize) * 0.12;
      const normalSpacing =
        vGap >= -avgLineH * 0.2 && vGap <= Math.max(avgLineH, line.height) * 0.95;
      const compatibleWidth =
        Math.min(candidate.width, line.width) >= Math.max(candidate.width, line.width) * 0.25;
      if (sameColumn && sameStyle && normalSpacing && compatibleWidth) {
        matched = candidate;
        break;
      }
    }
    if (matched) {
      const right = Math.max(matched.x + matched.width, line.x + line.width);
      const bottom = Math.max(matched.y + matched.height, line.y + line.height);
      const chars = new Set([
        ...(matched.supportedCharacters ? Array.from(matched.supportedCharacters) : []),
        ...(line.supportedCharacters ? Array.from(line.supportedCharacters) : []),
      ]);
      matched.text = `${matched.text}\n${line.text}`;
      matched.x = Math.min(matched.x, line.x);
      matched.width = right - matched.x;
      matched.height = bottom - matched.y;
      matched.lineCount += 1;
      matched.canChangeStyle = matched.canChangeStyle !== false && line.canChangeStyle !== false;
      if (chars.size > 0) matched.supportedCharacters = Array.from(chars).join("");
      matched.memberIds.push(...line.memberIds);
      continue;
    }
    paragraphs.push({ ...line, memberIds: [...line.memberIds] });
  }

  return [...paragraphs, ...nonEditable];
}
