export type DiffChangeType = "added" | "removed" | "unchanged";

export type DiffLine = {
  readonly id: string;
  readonly type: DiffChangeType;
  readonly content: string;
  readonly originalLineNumber?: number;
  readonly modifiedLineNumber?: number;
};

export type DiffStats = {
  readonly additions: number;
  readonly deletions: number;
  readonly unchanged: number;
};

export type TextDiffResult = {
  readonly lines: readonly DiffLine[];
  readonly stats: DiffStats;
};

const MAX_DIFF_LINES = 10_000;

export function diffText(original: string, modified: string): TextDiffResult {
  const originalLines = original.length === 0 ? [] : original.split(/\r?\n/);
  const modifiedLines = modified.length === 0 ? [] : modified.split(/\r?\n/);

  if (originalLines.length > MAX_DIFF_LINES || modifiedLines.length > MAX_DIFF_LINES) {
    throw new Error("O texto excede o limite de 10.000 linhas para comparação.");
  }

  // Otimização para textos idênticos
  if (original === modified) {
    const lines = originalLines.map((content, index) => ({
      id: `diff-same-${index + 1}`,
      type: "unchanged" as const,
      content,
      originalLineNumber: index + 1,
      modifiedLineNumber: index + 1,
    }));
    return {
      lines,
      stats: {
        additions: 0,
        deletions: 0,
        unchanged: lines.length,
      },
    };
  }

  // Algoritmo de Subsequência Comum Mais Longa (LCS)
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

  // Reconstrução do caminho
  const diffLines: DiffLine[] = [];
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
      diffLines.push({
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
      diffLines.push({
        id: `diff-added-${j}-${sequence}`,
        type: "added",
        content: modLine,
        modifiedLineNumber: j,
      });
      additions += 1;
      j -= 1;
    } else if (i > 0) {
      diffLines.push({
        id: `diff-removed-${i}-${sequence}`,
        type: "removed",
        content: origLine,
        originalLineNumber: i,
      });
      deletions += 1;
      i -= 1;
    }
  }

  diffLines.reverse();

  return {
    lines: diffLines,
    stats: {
      additions,
      deletions,
      unchanged,
    },
  };
}
