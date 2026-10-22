import { describe, expect, it } from "vitest";
import {
  performBrowserTranslation,
  segmentTextForTranslation,
  type TranslationProgressInfo,
} from "./browser-translator";

describe("browser-translator", () => {
  describe("segmentTextForTranslation", () => {
    it("retorna array vazio para texto vazio ou espaços", () => {
      expect(segmentTextForTranslation("")).toEqual([]);
      expect(segmentTextForTranslation("   \n\n  ")).toEqual([]);
    });

    it("mantém textos curtos em um único bloco", () => {
      const text = "Este é um texto curto para tradução.";
      const chunks = segmentTextForTranslation(text);
      expect(chunks).toEqual([text]);
    });

    it("preserva quebras de parágrafos entre blocos", () => {
      const text = "Primeiro parágrafo.\n\nSegundo parágrafo.";
      const chunks = segmentTextForTranslation(text);
      expect(chunks).toEqual(["Primeiro parágrafo.", "\n\n", "Segundo parágrafo."]);
    });

    it("segmenta parágrafos extensos em sentenças sem estourar o limite de caracteres", () => {
      const sentence1 = "Esta é a primeira sentença consideravelmente longa do texto de teste.";
      const sentence2 =
        "Aqui temos a segunda sentença informativa com mais detalhes sobre a execução.";
      const sentence3 =
        "Por fim, a terceira sentença conclui o raciocínio de teste de segmentação.";
      const longParagraph = `${sentence1} ${sentence2} ${sentence3}`;

      const chunks = segmentTextForTranslation(longParagraph, 80);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(100);
      }
      expect(chunks.join(" ")).toContain("Esta é a primeira sentença");
      expect(chunks.join(" ")).toContain("conclui o raciocínio");
    });
  });

  describe("performBrowserTranslation", () => {
    it("retorna o texto original sem tradução se o idioma de origem for igual ao de destino", async () => {
      const result = await performBrowserTranslation("Olá mundo", {
        sourceLang: "pt",
        targetLang: "pt",
      });
      expect(result.translatedText).toBe("Olá mundo");
      expect(result.sourceLang).toBe("pt");
      expect(result.targetLang).toBe("pt");
    });

    it("rejeita pares de idiomas não suportados", async () => {
      await expect(
        performBrowserTranslation("Hello", {
          // @ts-expect-error teste proposital de par inválido
          sourceLang: "ja",
          targetLang: "pt",
        }),
      ).rejects.toThrow("PAR_DE_IDIOMAS_NAO_SUPORTADO");
    });

    it("executa tradução com sucesso e emite progresso em ambiente de teste", async () => {
      const progressList: TranslationProgressInfo[] = [];
      const result = await performBrowserTranslation("Contrato de prestação de serviços", {
        sourceLang: "pt",
        targetLang: "en",
        onProgress: (info) => progressList.push(info),
      });

      expect(result.translatedText).toBe("[EN] Contrato de prestação de serviços");
      expect(result.engine).toBe("transformers.js-nllb-200");
      expect(progressList.length).toBeGreaterThan(0);
      expect(progressList.at(-1)?.status).toBe("ready");
      expect(progressList.at(-1)?.progress).toBe(100);
    });

    it("rejeita quando o signal já estiver abortado", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        performBrowserTranslation("Hello world", {
          sourceLang: "en",
          targetLang: "pt",
          signal: controller.signal,
        }),
      ).rejects.toThrow("OPERACAO_CANCELADA");
    });
  });
});
