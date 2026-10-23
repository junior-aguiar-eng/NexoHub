import { afterEach, describe, expect, it, vi } from "vitest";
import { segmentTextForTranslation, type TranslationProgressInfo } from "./browser-translator";
import {
  performRuntimeTranslation as performBrowserTranslation,
  resetRuntimeCache as resetTranslatorCache,
} from "./translation-runtime";

const neuralBlock = vi.hoisted(() => vi.fn(async (text: string) => [{ translation_text: text }]));
vi.mock("@huggingface/transformers", () => ({
  env: {},
  pipeline: vi.fn(async () => neuralBlock),
}));
afterEach(() => {
  resetTranslatorCache();
  neuralBlock.mockReset();
  neuralBlock.mockImplementation(async (text: string) => [{ translation_text: text }]);
});

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

    it("executa tradução com sucesso e emite progresso usando pipeline neural isolado", async () => {
      const progressList: TranslationProgressInfo[] = [];
      const result = await performBrowserTranslation("Contrato de prestação de serviços", {
        sourceLang: "pt",
        targetLang: "en",
        onProgress: (info) => progressList.push(info),
      });

      expect(result.translatedText).toBe("Contrato de prestação de serviços");
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

describe("segmentação sem perda", () => {
  it.each([
    "!".repeat(405),
    `...${"Documento válido. ".repeat(30)}`,
    "a".repeat(1000),
    "  Primeira linha\r\n\tSegunda linha\n\n  Última linha  ",
    `Olá {{nome}}, veja https://example.com/relatorio e envie para pessoa@example.com. ${"Texto. ".repeat(90)}`,
  ])("conserva todos os caracteres e respeita o limite", (text) => {
    const chunks = segmentTextForTranslation(text);
    expect(chunks.join("")).toBe(text);
    expect(chunks.every((chunk) => chunk.length <= 400 || /^[\s\p{P}\p{S}]+$/u.test(chunk))).toBe(
      true,
    );
  });
  it("isola placeholders e endereços para que não sejam traduzidos", () => {
    const chunks = segmentTextForTranslation(
      "Olá {{nome}}! Envie para pessoa@example.com e https://example.com.",
    );
    expect(chunks).toContain("{{nome}}");
    expect(chunks).toContain("pessoa@example.com");
    expect(chunks).toContain("https://example.com");
  });
});

describe("montagem neural e preservação literal", () => {
  it("preserva links e marcadores maiores que o limite sem enviá-los ao modelo", async () => {
    neuralBlock.mockImplementation(async () => [{ translation_text: "Translated" }]);
    const url = `https://example.com/${"a".repeat(600)}`;
    const placeholder = `{{${"campo".repeat(100)}}}`;
    const result = await performBrowserTranslation(`Olá ${url}\n${placeholder} fim`, {
      sourceLang: "pt",
      targetLang: "en",
    });
    expect(neuralBlock.mock.calls.map(([block]) => block)).toEqual(["Olá", "fim"]);
    expect(result.translatedText).toBe(`Translated ${url}\n${placeholder} Translated`);
  });
  it("mantém quebras, recuos, marcadores e separadores de blocos", async () => {
    const text = `  Olá {{nome}}!\r\n\t${"Documento válido. ".repeat(40)}\nhttps://example.com  `;
    const result = await performBrowserTranslation(text, { sourceLang: "pt", targetLang: "en" });
    expect(neuralBlock).toHaveBeenCalled();
    expect(
      neuralBlock.mock.calls.every(
        ([block]) => !block.includes("{{nome}}") && !block.includes("https://example.com"),
      ),
    ).toBe(true);
    expect(result.translatedText).toBe(text);
  });
  it("rejeita saída neural vazia em vez de anunciar tradução do original", async () => {
    neuralBlock.mockResolvedValueOnce([{ translation_text: "" }]);
    await expect(
      performBrowserTranslation("Olá", { sourceLang: "pt", targetLang: "en" }),
    ).rejects.toThrow("TRADUCAO_SEM_RESULTADO");
  });
});
