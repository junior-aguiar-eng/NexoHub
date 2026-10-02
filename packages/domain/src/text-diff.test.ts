import { describe, expect, it } from "vitest";
import { diffText } from "./text-diff";

describe("diffText", () => {
  it("retorna sem alterações quando os textos são idênticos", () => {
    const text = "Linha 1\nLinha 2\nLinha 3";
    const result = diffText(text, text);

    expect(result.stats.additions).toBe(0);
    expect(result.stats.deletions).toBe(0);
    expect(result.stats.unchanged).toBe(3);
    expect(result.lines).toHaveLength(3);
    expect(result.lines.every((line) => line.type === "unchanged")).toBe(true);
  });

  it("detecta linhas adicionadas", () => {
    const original = "Linha 1\nLinha 3";
    const modified = "Linha 1\nLinha 2\nLinha 3";
    const result = diffText(original, modified);

    expect(result.stats.additions).toBe(1);
    expect(result.stats.deletions).toBe(0);
    expect(result.stats.unchanged).toBe(2);

    const added = result.lines.find((line) => line.type === "added");
    expect(added?.content).toBe("Linha 2");
    expect(added?.modifiedLineNumber).toBe(2);
  });

  it("detecta linhas removidas", () => {
    const original = "Linha 1\nLinha 2\nLinha 3";
    const modified = "Linha 1\nLinha 3";
    const result = diffText(original, modified);

    expect(result.stats.additions).toBe(0);
    expect(result.stats.deletions).toBe(1);
    expect(result.stats.unchanged).toBe(2);

    const removed = result.lines.find((line) => line.type === "removed");
    expect(removed?.content).toBe("Linha 2");
    expect(removed?.originalLineNumber).toBe(2);
  });

  it("detecta modificações com substituições de linhas", () => {
    const original = "Início\nTexto antigo\nFim";
    const modified = "Início\nTexto novo\nFim";
    const result = diffText(original, modified);

    expect(result.stats.additions).toBe(1);
    expect(result.stats.deletions).toBe(1);
    expect(result.stats.unchanged).toBe(2);
  });

  it("lida corretamente com textos vazios", () => {
    const emptyResult = diffText("", "");
    expect(emptyResult.stats.additions).toBe(0);
    expect(emptyResult.stats.deletions).toBe(0);
    expect(emptyResult.lines).toHaveLength(0);

    const addedFromEmpty = diffText("", "Novo texto");
    expect(addedFromEmpty.stats.additions).toBe(1);
    expect(addedFromEmpty.stats.deletions).toBe(0);
    expect(addedFromEmpty.lines[0]?.content).toBe("Novo texto");
  });

  it("calcula realce inline de palavras e taxa de similaridade", () => {
    const original = "O contrato prevê cláusula de confidencialidade estrita.";
    const modified = "O contrato prevê cláusula de confidencialidade moderada.";
    const result = diffText(original, modified);

    expect(result.stats.additions).toBe(1);
    expect(result.stats.deletions).toBe(1);
    expect(result.stats.wordsAdded).toBe(1);
    expect(result.stats.wordsDeleted).toBe(1);
    expect(result.stats.similarityScore).toBeGreaterThanOrEqual(80);

    const removedLine = result.lines.find((l) => l.type === "removed");
    const addedLine = result.lines.find((l) => l.type === "added");

    expect(removedLine?.words).toBeDefined();
    expect(addedLine?.words).toBeDefined();

    const removedWord = removedLine?.words?.find((w) => w.type === "removed");
    expect(removedWord?.text).toBe("estrita");

    const addedWord = addedLine?.words?.find((w) => w.type === "added");
    expect(addedWord?.text).toBe("moderada");
  });
});
