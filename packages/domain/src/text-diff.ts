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

/** Myers limitado a poucas edições; o limite controla memória, nunca a precisão. */
function sparsePairs(
  original: readonly string[],
  modified: readonly string[],
): [number, number][] | null {
  const frontier = new Map<number, number>([[1, 0]]);
  const trace: Map<number, number>[] = [];
  for (let distance = 0; distance <= 128; distance++) {
    trace.push(new Map(frontier));
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      let x =
        diagonal === -distance ||
        (diagonal !== distance &&
          (frontier.get(diagonal - 1) ?? -1) < (frontier.get(diagonal + 1) ?? -1))
          ? (frontier.get(diagonal + 1) ?? 0)
          : (frontier.get(diagonal - 1) ?? 0) + 1;
      let y = x - diagonal;
      while (x < original.length && y < modified.length && original[x] === modified[y]) {
        x++;
        y++;
      }
      frontier.set(diagonal, x);
      if (x >= original.length && y >= modified.length) {
        const pairs: [number, number][] = [];
        x = original.length;
        y = modified.length;
        for (let d = distance; d >= 0; d--) {
          const previous = trace[d];
          if (!previous) break;
          const k = x - y;
          const previousK =
            k === -d || (k !== d && (previous.get(k - 1) ?? -1) < (previous.get(k + 1) ?? -1))
              ? k + 1
              : k - 1;
          const previousX = previous.get(previousK) ?? 0;
          const previousY = previousX - previousK;
          while (x > previousX && y > previousY) pairs.push([--x, --y]);
          x = previousX;
          y = previousY;
        }
        return pairs.reverse();
      }
    }
  }
  return null;
}

/** LCS exato por Hirschberg: duas linhas de contagens, sem matriz quadrática. */
function commonPairs(original: readonly string[], modified: readonly string[]): [number, number][] {
  const pairs: [number, number][] = [];
  function row(a0: number, a1: number, b0: number, b1: number, reverse: boolean): Uint32Array {
    const width = b1 - b0;
    let previous = new Uint32Array(width + 1);
    let current = new Uint32Array(width + 1);
    for (let i = 0; i < a1 - a0; i++) {
      current[0] = 0;
      for (let j = 0; j < width; j++) {
        current[j + 1] =
          original[reverse ? a1 - i - 1 : a0 + i] === modified[reverse ? b1 - j - 1 : b0 + j]
            ? (previous[j] ?? 0) + 1
            : Math.max(previous[j + 1] ?? 0, current[j] ?? 0);
      }
      [previous, current] = [current, previous];
    }
    return previous;
  }
  function split(a0: number, middle: number, a1: number, b0: number, b1: number): number {
    const left = row(a0, middle, b0, b1, false);
    const right = row(middle, a1, b0, b1, true);
    let best = -1;
    let boundary = 0;
    for (let j = 0; j <= b1 - b0; j++) {
      const score = (left[j] ?? 0) + (right[b1 - b0 - j] ?? 0);
      if (score > best) {
        best = score;
        boundary = j;
      }
    }
    return b0 + boundary;
  }
  function visit(a0: number, a1: number, b0: number, b1: number): void {
    while (a0 < a1 && b0 < b1 && original[a0] === modified[b0]) {
      pairs.push([a0++, b0++]);
    }
    let suffix = 0;
    while (
      a0 < a1 - suffix &&
      b0 < b1 - suffix &&
      original[a1 - suffix - 1] === modified[b1 - suffix - 1]
    )
      suffix++;
    const aEnd = a1 - suffix;
    const bEnd = b1 - suffix;
    if (a0 < aEnd && b0 < bEnd) {
      if (aEnd - a0 === 1) {
        for (let j = b0; j < bEnd; j++)
          if (original[a0] === modified[j]) {
            pairs.push([a0, j]);
            break;
          }
      } else {
        // Textos inteiramente distintos não precisam do percurso quadrático de LCS.
        const values = new Set(original.slice(a0, aEnd));
        if (modified.slice(b0, bEnd).some((value) => values.has(value))) {
          const sparse = sparsePairs(original.slice(a0, aEnd), modified.slice(b0, bEnd));
          if (sparse) {
            for (const [i, j] of sparse) pairs.push([a0 + i, b0 + j]);
          } else {
            const middle = Math.floor((a0 + aEnd) / 2);
            const boundary = split(a0, middle, aEnd, b0, bEnd);
            visit(a0, middle, b0, boundary);
            visit(middle, aEnd, boundary, bEnd);
          }
        }
      }
    }
    for (let i = suffix; i > 0; i--) pairs.push([a1 - i, b1 - i]);
  }
  visit(0, original.length, 0, modified.length);
  return pairs;
}

export function tokenizeWords(text: string): string[] {
  if (text.length === 0) return [];
  const match = text.match(/[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]/gu);
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

  const originalWords: DiffWord[] = [];
  const modifiedWords: DiffWord[] = [];
  let wordsAdded = 0;
  let wordsDeleted = 0;
  let i = 0;
  let j = 0;
  const matches = commonPairs(
    origTokens.map((token) => token.normalize("NFC")),
    modTokens.map((token) => token.normalize("NFC")),
  );
  for (const [a, b] of [...matches, [origTokens.length, modTokens.length]]) {
    while (i < a) {
      const text = origTokens[i] ?? "";
      originalWords.push({ id: `word-rem-${i++}`, type: "removed", text });
      if (/[\p{L}\p{N}]/u.test(text)) wordsDeleted++;
    }
    while (j < b) {
      const text = modTokens[j] ?? "";
      modifiedWords.push({ id: `word-add-${j++}`, type: "added", text });
      if (/[\p{L}\p{N}]/u.test(text)) wordsAdded++;
    }
    if (i < origTokens.length && j < modTokens.length) {
      originalWords.push({ id: `word-same-${i}`, type: "unchanged", text: origTokens[i++] ?? "" });
      modifiedWords.push({ id: `word-same-${a}`, type: "unchanged", text: modTokens[j++] ?? "" });
    }
  }

  return {
    originalWords,
    modifiedWords,
    wordsAdded,
    wordsDeleted,
  };
}

function countWords(text: string): number {
  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu);
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

  // Trimming de prefixo comum e sufixo comum (reduz drasticamente o espaço de busca O(N*M))
  const n = originalLines.length;
  const m = modifiedLines.length;

  let prefixLen = 0;
  while (prefixLen < n && prefixLen < m && originalLines[prefixLen] === modifiedLines[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < n - prefixLen &&
    suffixLen < m - prefixLen &&
    originalLines[n - 1 - suffixLen] === modifiedLines[m - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const rawDiffLines: {
    id: string;
    type: DiffChangeType;
    content: string;
    originalLineNumber?: number;
    modifiedLineNumber?: number;
  }[] = [];

  let additions = 0;
  let deletions = 0;
  let unchanged = 0;
  let sequence = 0;

  // 1. Prefixo comum idêntico
  for (let p = 0; p < prefixLen; p++) {
    sequence += 1;
    rawDiffLines.push({
      id: `diff-unchanged-${p + 1}-${p + 1}-${sequence}`,
      type: "unchanged",
      content: originalLines[p] ?? "",
      originalLineNumber: p + 1,
      modifiedLineNumber: p + 1,
    });
    unchanged += 1;
  }

  // 2. Miolo divergente
  const midN = n - prefixLen - suffixLen;
  const midM = m - prefixLen - suffixLen;
  const origMid = originalLines.slice(prefixLen, n - suffixLen);
  const modMid = modifiedLines.slice(prefixLen, m - suffixLen);

  let originalIndex = 0;
  let modifiedIndex = 0;
  for (const [a, b] of [...commonPairs(origMid, modMid), [midN, midM]]) {
    while (originalIndex < a) {
      sequence++;
      rawDiffLines.push({
        id: `diff-removed-${sequence}`,
        type: "removed",
        content: origMid[originalIndex] ?? "",
        originalLineNumber: prefixLen + originalIndex + 1,
      });
      originalIndex++;
      deletions++;
    }
    while (modifiedIndex < b) {
      sequence++;
      rawDiffLines.push({
        id: `diff-added-${sequence}`,
        type: "added",
        content: modMid[modifiedIndex] ?? "",
        modifiedLineNumber: prefixLen + modifiedIndex + 1,
      });
      modifiedIndex++;
      additions++;
    }
    if (originalIndex < midN && modifiedIndex < midM) {
      sequence++;
      rawDiffLines.push({
        id: `diff-unchanged-${sequence}`,
        type: "unchanged",
        content: origMid[originalIndex] ?? "",
        originalLineNumber: prefixLen + originalIndex + 1,
        modifiedLineNumber: prefixLen + modifiedIndex + 1,
      });
      originalIndex++;
      modifiedIndex++;
      unchanged++;
    }
  }

  // 3. Sufixo comum idêntico
  for (let s = 0; s < suffixLen; s++) {
    sequence += 1;
    const origLineNum = n - suffixLen + s + 1;
    const modLineNum = m - suffixLen + s + 1;
    rawDiffLines.push({
      id: `diff-unchanged-${origLineNum}-${modLineNum}-${sequence}`,
      type: "unchanged",
      content: originalLines[n - suffixLen + s] ?? "",
      originalLineNumber: origLineNum,
      modifiedLineNumber: modLineNum,
    });
    unchanged += 1;
  }

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
      : Math.max(
          0,
          Math.min(
            totalWordsAdded + totalWordsDeleted > 0 ? 99.99 : 100,
            Math.round((wordsKept / baseWords) * 10_000) / 100,
          ),
        );

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
