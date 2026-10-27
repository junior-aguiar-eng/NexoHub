import { applyReviewFindings, diffText, diffWords, reviewText } from "@nexohub/domain";
import { describe, expect, it } from "vitest";
import { comparisonReference, reviewReference } from "./__fixtures__/q-c0-text/corpus";
import { readDocumentText } from "./document-reader";

describe("Q-C0 — comparação e revisão em corpus autoral", () => {
  it("reconstrói as duas fontes com números, linhas repetidas, vazias e Unicode", () => {
    const diff = diffText(comparisonReference.original, comparisonReference.modified);
    expect(diff.stats).toMatchObject({ additions: 2, deletions: 1, unchanged: 6 });
    for (const [excluded, source, number] of [
      ["added", comparisonReference.original, "originalLineNumber"],
      ["removed", comparisonReference.modified, "modifiedLineNumber"],
    ] as const) {
      const lines = diff.lines.filter((line) => line.type !== excluded);
      expect(lines.map((line) => line.content)).toEqual(source.split(/\r?\n/));
      expect(lines.map((line) => line[number])).toEqual(lines.map((_, i) => i + 1));
    }
    expect(new Set(diff.lines.map((line) => line.id)).size).toBe(diff.lines.length);
  });

  it("normaliza apenas a equivalência de palavras, preservando a grafia NFC/NFD", () => {
    const original = "Ação";
    const modified = original.normalize("NFD");
    const words = diffWords(original, modified);
    expect(words.wordsAdded).toBe(0);
    expect(words.wordsDeleted).toBe(0);
    expect(words.originalWords.map((word) => word.text).join("")).toBe(original);
    expect(words.modifiedWords.map((word) => word.text).join("")).toBe(modified);
    const diff = diffText(original, modified);
    expect(diff.stats.similarityScore).toBe(100);
    expect(diff.lines.filter((line) => line.type !== "added").map((line) => line.content)).toEqual([
      original,
    ]);
    expect(
      diff.lines.filter((line) => line.type !== "removed").map((line) => line.content),
    ).toEqual([modified]);
  });

  it("lê TXT sem alterar bytes textuais e recusa comparação acima de 10.000 linhas", async () => {
    const file = new File([comparisonReference.original], "controle.txt", { type: "text/plain" });
    expect(await readDocumentText(file)).toBe(comparisonReference.original);
    expect(() => diffText("linha\n".repeat(10_001), "controle")).toThrow();
  });

  it("aplica somente a regra contextual selecionada e preserva identificadores protegidos", () => {
    const findings = reviewText(reviewReference.original);
    const selected = findings.filter((finding) => finding.original === "fasso");
    expect(selected).toHaveLength(1);
    const finding = selected[0];
    expect(finding).toBeDefined();
    if (!finding) throw new Error("Achado ausente");
    expect(reviewReference.original.slice(finding.start, finding.end)).toBe("fasso");
    expect(applyReviewFindings(reviewReference.original, findings, new Set([finding.id]))).toBe(
      reviewReference.original.replace("Eu fasso", "Eu faço"),
    );
    expect(applyReviewFindings(reviewReference.original, findings, new Set())).toBe(
      reviewReference.original,
    );
    expect(() => applyReviewFindings("Texto substituído", findings)).toThrow();
  });
});
