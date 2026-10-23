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

  it("otimiza documentos longos com prefixo e sufixo comum com alta performance", () => {
    const prefix = Array.from({ length: 3000 }, (_, idx) => `Prefixo linha ${idx + 1}`).join("\n");
    const suffix = Array.from({ length: 3000 }, (_, idx) => `Sufixo linha ${idx + 1}`).join("\n");
    const original = `${prefix}\nLinha antiga no meio\n${suffix}`;
    const modified = `${prefix}\nLinha nova no meio\n${suffix}`;

    const start = Date.now();
    const result = diffText(original, modified);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(500); // Executa instantaneamente graças ao trimming
    expect(result.stats.additions).toBe(1);
    expect(result.stats.deletions).toBe(1);
    expect(result.stats.unchanged).toBe(6000);
    expect(result.lines).toHaveLength(6002);
  });

  it("compara miolo inteiramente distinto acima de 4M células sem matriz quadrática", () => {
    const original = Array.from({ length: 2500 }, (_, idx) => `Original ${idx}`).join("\n");
    const modified = Array.from({ length: 2500 }, (_, idx) => `Modificado ${idx}`).join("\n");

    const result = diffText(original, modified);
    expect(result.stats.deletions).toBe(2500);
    expect(result.stats.additions).toBe(2500);
    expect(result.stats.unchanged).toBe(0);
    expect(result.lines).toHaveLength(5000);
  });
});

describe("comparação exata de documentos reais", () => {
  it("preserva 310 palavras iguais quando somente a última muda", () => {
    const result = diffText(`${"palavra ".repeat(310)}fim`, `${"palavra ".repeat(310)}final`);
    expect(result.stats.wordsAdded).toBe(1);
    expect(result.stats.wordsDeleted).toBe(1);
    expect(result.stats.similarityScore).toBeGreaterThan(99);
  });
  it("encontra palavras comuns em parágrafos longos com mudanças nos extremos", () => {
    const text = "conteúdo português ".repeat(350);
    const result = diffText(`antigo ${text}ontem`, `novo ${text}hoje`);
    expect(result.stats.wordsAdded).toBe(2);
    expect(result.stats.wordsDeleted).toBe(2);
  });
  it("reconhece grafias Unicode equivalentes sem perder o texto original", () => {
    const original = "ação";
    const modified = original.normalize("NFD");
    const result = diffText(original, modified);
    expect(result.stats.wordsAdded).toBe(0);
    expect(result.stats.wordsDeleted).toBe(0);
    expect(result.stats.similarityScore).toBe(100);
    expect(
      result.lines
        .find((line) => line.type === "added")
        ?.words?.map((word) => word.text)
        .join(""),
    ).toBe(modified);
  });
  it("mantém linhas iguais dentro de miolo que excede quatro milhões de células", () => {
    const original = [
      "antes",
      ...Array.from({ length: 2100 }, (_, index) => `cláusula ${index}`),
      "fim antigo",
    ].join("\n");
    const modified = [
      "depois",
      ...Array.from({ length: 2100 }, (_, index) => `cláusula ${index}`),
      "fim novo",
    ].join("\n");
    const result = diffText(original, modified);
    expect(result.stats.unchanged).toBe(2100);
    expect(result.stats.additions).toBe(2);
    expect(result.stats.deletions).toBe(2);
  });
  it("informa limite de linhas sem produzir relatório parcial", () => {
    expect(() => diffText("linha\n".repeat(10_001), "outro")).toThrow("10.000 linhas");
  });
});

it("processa dez mil linhas com duas mudanças sem percorrer matriz quadrática", () => {
  const middle = Array.from({ length: 9998 }, (_, index) => `Cláusula ${index}`).join("\n");
  const start = Date.now();
  const result = diffText(`Antes\n${middle}\nFinal antigo`, `Depois\n${middle}\nFinal novo`);
  expect(result.stats.unchanged).toBe(9998);
  expect(Date.now() - start).toBeLessThan(2000);
});

it("não arredonda uma alteração real para 100% de similaridade", () => {
  const result = diffText(`${"palavra ".repeat(310)}fim`, `${"palavra ".repeat(310)}final`);
  expect(result.stats.similarityScore).toBeCloseTo(99.68, 2);
});
