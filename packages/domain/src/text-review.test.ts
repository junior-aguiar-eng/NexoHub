import { describe, expect, it } from "vitest";
import { applyReviewFindings, reviewText } from "./text-review";

describe("revisão textual determinística", () => {
  it("detecta ocorrências com offsets estáveis e sem sobreposição", () => {
    const findings = reviewText("Este  texto texto tem espaço antes .\nFim.  ");

    expect(findings.map((finding) => finding.rule)).toEqual([
      "REPEATED_WHITESPACE",
      "DUPLICATE_WORD",
      "SPACE_BEFORE_PUNCTUATION",
      "TRAILING_WHITESPACE",
    ]);
    expect(findings.every((finding) => finding.original.length > 0)).toBe(true);
  });

  it("aplica achados selecionados do fim para o início", () => {
    const source = "Este  texto texto tem espaço antes .";
    const findings = reviewText(source);

    expect(applyReviewFindings(source, findings)).toBe("Este texto tem espaço antes.");
  });

  it("rejeita achado que não corresponde mais ao texto", () => {
    const findings = reviewText("texto texto");

    expect(() => applyReviewFindings("outro texto", findings)).toThrow(/inválido ou sobreposto/);
  });
});
