import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkWordSpelling, performBrowserReview } from "./browser-reviewer";
import { addCustomWord, clearSessionIgnored, ignoreWordInSession } from "./user-vocabulary";

vi.mock("hunspell-asm", () => ({
  loadModule: async () => {
    throw new Error("WASM indisponível");
  },
}));

describe("browser-reviewer", () => {
  const mockHunspell = {
    spell: (word: string) => {
      const valid = new Set([
        "este",
        "é",
        "um",
        "texto",
        "em",
        "português",
        "com",
        "palavras",
        "corretas",
        "documento",
        "jurídico",
        "paralelepípedo",
        "os",
        "prejuízos",
        "são",
        "e",
        "tem",
        "erro",
      ]);
      return valid.has(word.toLowerCase());
    },
    suggest: (word: string) => {
      if (word.toLowerCase() === "portugues") return ["português"];
      if (word.toLowerCase() === "palavrs") return ["palavras"];
      if (word.toLowerCase() === "paralelepipedo") return ["paralelepípedo"];
      return ["correto"];
    },
    addWord: () => {},
    removeWord: () => {},
    dispose: () => {},
  };

  beforeEach(() => {
    localStorage.clear();
    clearSessionIgnored();
  });

  describe("checkWordSpelling", () => {
    it("valida palavras corretas", () => {
      const result = checkWordSpelling("Português", mockHunspell);
      expect(result.isCorrect).toBe(true);
      expect(result.suggestions).toHaveLength(0);
    });

    it("detecta erro e preserva capitalização na sugestão", () => {
      const result = checkWordSpelling("Portugues", mockHunspell);
      expect(result.isCorrect).toBe(false);
      expect(result.suggestions).toContain("Português");
    });

    it("ignora URLs, e-mails e siglas técnicas", () => {
      expect(checkWordSpelling("https://nexohub.org", mockHunspell).isCorrect).toBe(true);
      expect(checkWordSpelling("contato@nexohub.org", mockHunspell).isCorrect).toBe(true);
      expect(checkWordSpelling("LGPD", mockHunspell).isCorrect).toBe(true);
      expect(checkWordSpelling("CNPJ", mockHunspell).isCorrect).toBe(true);
      expect(checkWordSpelling("v1", mockHunspell).isCorrect).toBe(true);
    });

    it("respeita vocabulário personalizado do usuário", () => {
      expect(checkWordSpelling("neologismo", mockHunspell).isCorrect).toBe(false);

      addCustomWord("neologismo");
      expect(checkWordSpelling("neologismo", mockHunspell).isCorrect).toBe(true);
    });

    it("respeita palavras ignoradas na sessão", () => {
      expect(checkWordSpelling("temporario", mockHunspell).isCorrect).toBe(false);

      ignoreWordInSession("temporario");
      expect(checkWordSpelling("temporario", mockHunspell).isCorrect).toBe(true);
    });
  });

  describe("performBrowserReview", () => {
    it("combina regras contextuais de domínio com ortografia morfológica", async () => {
      const text = "Os prejuízos são vultuosos e tem palavrs com erro.";
      const findings = await performBrowserReview({
        text,
        hunspellOverride: mockHunspell,
      });

      const rules = findings.map((f) => f.rule);
      expect(rules).toContain("PARONYM_CONTEXT");
      expect(rules).toContain("SPELLING");

      const spellingFinding = findings.find((f) => f.rule === "SPELLING");
      expect(spellingFinding?.original).toBe("palavrs");
      expect(spellingFinding?.replacement).toBe("palavras");
    });

    it("retorna lista vazia para texto vazio", async () => {
      const findings = await performBrowserReview({
        text: "   ",
        hunspellOverride: mockHunspell,
      });
      expect(findings).toEqual([]);
    });
  });
});

it("preserva identificadores antes da tokenização ortográfica", async () => {
  const engine = {
    spell: () => false,
    suggest: () => ["alterado"],
    addWord: () => {},
    removeWord: () => {},
    dispose: () => {},
  };
  const text = "https://exemploerrrado.com/relatorio usuarioerrrado@exemplo.com {{relatorio}}";
  expect(await performBrowserReview({ text, hunspellOverride: engine })).toEqual([]);
});

it("não relata revisão concluída quando o motor morfológico falha", async () => {
  const progress: string[] = [];
  await expect(
    performBrowserReview({
      text: "Esste relatóriu.",
      onProgress: (_p, message) => progress.push(message),
    }),
  ).rejects.toThrow("REVIEW_UNAVAILABLE");
  expect(progress.some((message) => message.includes("concluída"))).toBe(false);
});
