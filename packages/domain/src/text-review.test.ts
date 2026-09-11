import { describe, expect, it } from "vitest";
import {
  applyReviewFindings,
  mergeReviewFindings,
  type ReviewFinding,
  reviewText,
} from "./text-review";

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

  it("detecta e corrige parônimos e armadilhas frequentes em pt-BR", () => {
    const text =
      "Os prejuízos são vultuosos. Foi expedido um mandato de prisão, embora seu mandato fosse regular. O diretor teria intervido ao ponto de ficar sob judice, haja vistos os autos.";
    const findings = reviewText(text);

    const rules = findings.map((f) => f.rule);
    expect(rules).toContain("PARONYM_CONTEXT");

    const corrected = applyReviewFindings(text, findings);
    expect(corrected).toContain("Os prejuízos são vultosos.");
    expect(corrected).toContain("mandado de prisão");
    expect(corrected).toContain("intervindo");
    expect(corrected).toContain("a ponto de");
    expect(corrected).toContain("sub judice");
    expect(corrected).toContain("haja vista");
  });

  it("detecta construções inadequadas com pronome onde e artigo após cujo", () => {
    const text =
      "Numa situação onde tudo falhou, os autores, cujos os direitos foram lesados, reclamam.";
    const findings = reviewText(text);

    expect(findings.map((f) => f.rule)).toContain("STYLE_SUGGESTION");
    const corrected = applyReviewFindings(text, findings);
    expect(corrected).toBe(
      "Numa situação em que tudo falhou, os autores, cujos direitos foram lesados, reclamam.",
    );
  });

  it("não gera falsos positivos em expressões cultas e corretas", () => {
    const text =
      "A vultosa quantia foi gasta no prédio onde moram. O parlamentar exerceu seu mandato eletivo com afinco e teria intervindo a tempo.";
    const findings = reviewText(text);

    // "vultosa" está correto, "onde" refere-se a prédio (local físico), "mandato eletivo" está correto, "teria intervindo" está correto.
    expect(
      findings.filter((f) => f.rule === "PARONYM_CONTEXT" || f.rule === "STYLE_SUGGESTION"),
    ).toHaveLength(0);
  });

  it("combina achados de múltiplos motores sem sobreposição de offsets", () => {
    const primary: readonly ReviewFinding[] = [
      {
        id: "LT:0:5",
        rule: "LANGUAGE_TOOL",
        severity: "warning",
        start: 0,
        end: 5,
        original: "Fazem",
        replacement: "Faz",
        message: "Concordância impessoal.",
      },
      {
        id: "LT:30:35",
        rule: "LANGUAGE_TOOL",
        severity: "suggestion",
        start: 30,
        end: 35,
        original: "texto",
        replacement: "texto",
        message: "Nota de estilo.",
      },
    ];

    const secondary: readonly ReviewFinding[] = [
      // Sobrepõe com o primeiro do primary (deve ser descartado)
      {
        id: "SEC:0:10",
        rule: "PARONYM_CONTEXT",
        severity: "warning",
        start: 0,
        end: 10,
        original: "Fazem dias",
        replacement: "Faz dias",
        message: "Duplicado.",
      },
      // Novo achado independente (deve ser aceito)
      {
        id: "SEC:15:24",
        rule: "PARONYM_CONTEXT",
        severity: "warning",
        start: 15,
        end: 24,
        original: "vultuosos",
        replacement: "vultosos",
        message: "Parônimo vultoso.",
      },
    ];

    const merged = mergeReviewFindings(primary, secondary);
    expect(merged.map((f) => f.id)).toEqual(["LT:0:5", "SEC:15:24", "LT:30:35"]);
  });
});
