export type DiffChangeType = "added" | "removed" | "unchanged";

export type DiffWord = {
  readonly id: string;
  readonly type: DiffChangeType;
  readonly text: string;
};

export type DiffLine = {
  readonly id: string;
  readonly type: DiffChangeType;
  readonly content: string;
  readonly originalLineNumber?: number;
  readonly modifiedLineNumber?: number;
  readonly words?: readonly DiffWord[];
};

export type DiffStats = {
  readonly additions: number;
  readonly deletions: number;
  readonly unchanged: number;
  readonly wordsAdded: number;
  readonly wordsDeleted: number;
  readonly similarityScore: number;
};

export type TextDiffResult = {
  readonly lines: readonly DiffLine[];
  readonly stats: DiffStats;
};

const MAX_DIFF_LINES = 10_000;

export function tokenizeWords(text: string): string[] {
  if (text.length === 0) return [];
  const match = text.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]/gu);
  return match ?? [text];
}

export function diffWords(
  original: string,
  modified: string,
): {
  originalWords: DiffWord[];
  modifiedWords: DiffWord[];
  wordsAdded: number;
  wordsDeleted: number;
} {
  const origTokens = tokenizeWords(original);
  const modTokens = tokenizeWords(modified);

  if (original === modified) {
    const words: DiffWord[] = origTokens.map((text, idx) => ({
      id: `word-same-${idx}`,
      type: "unchanged",
      text,
    }));
    return {
      originalWords: words,
      modifiedWords: words,
      wordsAdded: 0,
      wordsDeleted: 0,
    };
  }

  const MAX_TOKEN_LCS = 600;
  if (origTokens.length > MAX_TOKEN_LCS || modTokens.length > MAX_TOKEN_LCS) {
    return {
      originalWords: origTokens.map((text, idx) => ({
        id: `word-rem-fallback-${idx}`,
        type: "removed",
        text,
      })),
      modifiedWords: modTokens.map((text, idx) => ({
        id: `word-add-fallback-${idx}`,
        type: "added",
        text,
      })),
      wordsAdded: modTokens.filter((t) => /\p{L}|\p{N}/u.test(t)).length,
      wordsDeleted: origTokens.filter((t) => /\p{L}|\p{N}/u.test(t)).length,
    };
  }

  const n = origTokens.length;
  const m = modTokens.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    const rowNext = dp[i + 1];
    const rowCurr = dp[i];
    if (!rowNext || !rowCurr) continue;
    for (let j = 0; j < m; j++) {
      if (origTokens[i] === modTokens[j]) {
        rowNext[j + 1] = (rowCurr[j] ?? 0) + 1;
      } else {
        rowNext[j + 1] = Math.max(rowNext[j] ?? 0, rowCurr[j + 1] ?? 0);
      }
    }
  }

  const originalWords: DiffWord[] = [];
  const modifiedWords: DiffWord[] = [];

  let i = n;
  let j = m;
  let wordsAdded = 0;
  let wordsDeleted = 0;
  let seq = 0;

  while (i > 0 || j > 0) {
    seq += 1;
    const origTok = origTokens[i - 1] ?? "";
    const modTok = modTokens[j - 1] ?? "";
    const valLeft = dp[i]?.[j - 1] ?? 0;
    const valUp = dp[i - 1]?.[j] ?? 0;

    if (i > 0 && j > 0 && origTok === modTok) {
      originalWords.push({ id: `word-same-${seq}`, type: "unchanged", text: origTok });
      modifiedWords.push({ id: `word-same-${seq}`, type: "unchanged", text: modTok });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || valLeft >= valUp)) {
      modifiedWords.push({ id: `word-add-${seq}`, type: "added", text: modTok });
      if (/\p{L}|\p{N}/u.test(modTok)) {
        wordsAdded += 1;
      }
      j -= 1;
    } else if (i > 0) {
      originalWords.push({ id: `word-rem-${seq}`, type: "removed", text: origTok });
      if (/\p{L}|\p{N}/u.test(origTok)) {
        wordsDeleted += 1;
      }
      i -= 1;
    }
  }

  originalWords.reverse();
  modifiedWords.reverse();

  return {
    originalWords,
    modifiedWords,
    wordsAdded,
    wordsDeleted,
  };
}

function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
}

export function diffText(original: string, modified: string): TextDiffResult {
  const originalLines = original.length === 0 ? [] : original.split(/\r?\n/);
  const modifiedLines = modified.length === 0 ? [] : modified.split(/\r?\n/);

  if (originalLines.length > MAX_DIFF_LINES || modifiedLines.length > MAX_DIFF_LINES) {
    throw new Error("O texto excede o limite de 10.000 linhas para comparação.");
  }

  const totalOrigWords = countWords(original);
  const totalModWords = countWords(modified);

  // Otimização para textos idênticos
  if (original === modified) {
    const lines = originalLines.map((content, index) => ({
      id: `diff-same-${index + 1}`,
      type: "unchanged" as const,
      content,
      originalLineNumber: index + 1,
      modifiedLineNumber: index + 1,
      words: [{ id: `word-same-${index + 1}`, type: "unchanged" as const, text: content }],
    }));
    return {
      lines,
      stats: {
        additions: 0,
        deletions: 0,
        unchanged: lines.length,
        wordsAdded: 0,
        wordsDeleted: 0,
        similarityScore: 100,
      },
    };
  }

  // Algoritmo de Subsequência Comum Mais Longa (LCS) por linhas
  const n = originalLines.length;
  const m = modifiedLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 0; i < n; i++) {
    const rowNext = dp[i + 1];
    const rowCurr = dp[i];
    if (!rowNext || !rowCurr) continue;
    for (let j = 0; j < m; j++) {
      if (originalLines[i] === modifiedLines[j]) {
        rowNext[j + 1] = (rowCurr[j] ?? 0) + 1;
      } else {
        rowNext[j + 1] = Math.max(rowCurr[j + 1] ?? 0, rowNext[j] ?? 0);
      }
    }
  }

  // Reconstrução do caminho de linhas
  const rawDiffLines: {
    id: string;
    type: DiffChangeType;
    content: string;
    originalLineNumber?: number;
    modifiedLineNumber?: number;
  }[] = [];

  let i = n;
  let j = m;

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;
  let sequence = 0;

  while (i > 0 || j > 0) {
    sequence += 1;
    const origLine = originalLines[i - 1] ?? "";
    const modLine = modifiedLines[j - 1] ?? "";
    const valLeft = dp[i]?.[j - 1] ?? 0;
    const valUp = dp[i - 1]?.[j] ?? 0;

    if (i > 0 && j > 0 && origLine === modLine) {
      rawDiffLines.push({
        id: `diff-unchanged-${i}-${j}-${sequence}`,
        type: "unchanged",
        content: origLine,
        originalLineNumber: i,
        modifiedLineNumber: j,
      });
      unchanged += 1;
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || valLeft >= valUp)) {
      rawDiffLines.push({
        id: `diff-added-${j}-${sequence}`,
        type: "added",
        content: modLine,
        modifiedLineNumber: j,
      });
      additions += 1;
      j -= 1;
    } else if (i > 0) {
      rawDiffLines.push({
        id: `diff-removed-${i}-${sequence}`,
        type: "removed",
        content: origLine,
        originalLineNumber: i,
      });
      deletions += 1;
      i -= 1;
    }
  }

  rawDiffLines.reverse();

  // Pareamento de blocos alterados para calcular realce de palavras (inline word diff)
  const finalLines: DiffLine[] = [];
  let totalWordsAdded = 0;
  let totalWordsDeleted = 0;
  let idx = 0;

  while (idx < rawDiffLines.length) {
    const current = rawDiffLines[idx];
    if (!current) break;

    if (current.type === "unchanged") {
      finalLines.push({
        ...current,
        words: [{ id: `word-unchanged-${current.id}`, type: "unchanged", text: current.content }],
      });
      idx += 1;
      continue;
    }

    // Coleta todas as alterações contíguas (remoções e adições) até a próxima linha inalterada
    const changeBlock: typeof rawDiffLines = [];
    while (idx < rawDiffLines.length && rawDiffLines[idx]?.type !== "unchanged") {
      const line = rawDiffLines[idx];
      if (line) changeBlock.push(line);
      idx += 1;
    }

    const removedBlock = changeBlock.filter((l) => l.type === "removed");
    const addedBlock = changeBlock.filter((l) => l.type === "added");

    const pairCount = Math.min(removedBlock.length, addedBlock.length);

    // Parear linhas 1 a 1 para calcular diff de palavras
    for (let p = 0; p < pairCount; p++) {
      const rem = removedBlock[p];
      const add = addedBlock[p];
      if (!rem || !add) continue;

      const wordResult = diffWords(rem.content, add.content);
      totalWordsAdded += wordResult.wordsAdded;
      totalWordsDeleted += wordResult.wordsDeleted;

      finalLines.push({
        ...rem,
        words: wordResult.originalWords,
      });
      finalLines.push({
        ...add,
        words: wordResult.modifiedWords,
      });
    }

    // Remoções sobressalentes
    for (let r = pairCount; r < removedBlock.length; r++) {
      const rem = removedBlock[r];
      if (!rem) continue;
      const tokens = tokenizeWords(rem.content);
      const words = tokens.map((text, tIdx) => ({
        id: `word-rem-${rem.id}-${tIdx}`,
        type: "removed" as const,
        text,
      }));
      totalWordsDeleted += countWords(rem.content);
      finalLines.push({
        ...rem,
        words,
      });
    }

    // Adições sobressalentes
    for (let a = pairCount; a < addedBlock.length; a++) {
      const add = addedBlock[a];
      if (!add) continue;
      const tokens = tokenizeWords(add.content);
      const words = tokens.map((text, tIdx) => ({
        id: `word-add-${add.id}-${tIdx}`,
        type: "added" as const,
        text,
      }));
      totalWordsAdded += countWords(add.content);
      finalLines.push({
        ...add,
        words,
      });
    }
  }

  // Similaridade baseada em palavras mantidas
  const baseWords = Math.max(totalOrigWords, totalModWords, 1);
  const wordsKept = Math.max(0, totalOrigWords - totalWordsDeleted);
  const similarityScore =
    totalOrigWords === 0 && totalModWords === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((wordsKept / baseWords) * 100)));

  return {
    lines: finalLines,
    stats: {
      additions,
      deletions,
      unchanged,
      wordsAdded: totalWordsAdded,
      wordsDeleted: totalWordsDeleted,
      similarityScore,
    },
  };
}
