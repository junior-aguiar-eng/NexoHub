import { afterEach, expect, it, vi } from "vitest";
import { createTranslationPipeline } from "./translation-model";
import { TRANSLATION_MODEL } from "./translation-protocol";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  model: vi.fn(),
  tokenizer: vi.fn(),
  pipeline: vi.fn(),
}));
vi.mock("@huggingface/transformers", () => ({
  env: { useBrowserCache: true, cacheKey: "tr-test", fetch: mocks.fetch },
  AutoModelForSeq2SeqLM: { from_pretrained: mocks.model },
  M2M100Tokenizer: class {
    constructor(...args: unknown[]) {
      mocks.tokenizer(...args);
    }
  },
  TranslationPipeline: class {
    constructor(args: unknown) {
      mocks.pipeline(args);
    }
  },
}));
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it("carrega tokenizer e pesos pela mesma revisão sem descobrir main", async () => {
  mocks.model.mockResolvedValue({});
  mocks.fetch.mockImplementation(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith("tokenizer_config.json")
            ? { tokenizer_class: "M2M100Tokenizer" }
            : { version: "1.0" },
        ),
      ),
  );
  await createTranslationPipeline(TRANSLATION_MODEL.id, {
    revision: TRANSLATION_MODEL.revision,
    dtype: "q8",
    device: "wasm",
  });
  expect(mocks.fetch.mock.calls).toHaveLength(2);
  for (const [url] of mocks.fetch.mock.calls)
    expect(url).toContain(`/resolve/${TRANSLATION_MODEL.revision}/`);
  expect(mocks.model.mock.calls[0][1].revision).toBe(TRANSLATION_MODEL.revision);
  expect(mocks.tokenizer).toHaveBeenCalledOnce();
});

it("reabre JSONs pelo cache sem rede", async () => {
  mocks.model.mockResolvedValue({});
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async (url: string) =>
        new Response(
          JSON.stringify(
            url.endsWith("tokenizer_config.json") ? { tokenizer_class: "M2M100Tokenizer" } : {},
          ),
        ),
    }),
  });
  await createTranslationPipeline(TRANSLATION_MODEL.id, {
    revision: TRANSLATION_MODEL.revision,
    dtype: "q8",
    device: "wasm",
  });
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("quota de cache não impede tradução online", async () => {
  mocks.model.mockResolvedValue({});
  vi.stubGlobal("caches", {
    open: async () => {
      throw new DOMException("Quota", "QuotaExceededError");
    },
  });
  mocks.fetch.mockImplementation(
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith("tokenizer_config.json") ? { tokenizer_class: "M2M100Tokenizer" } : {},
        ),
      ),
  );
  await expect(
    createTranslationPipeline(TRANSLATION_MODEL.id, {
      revision: TRANSLATION_MODEL.revision,
      dtype: "q8",
      device: "wasm",
    }),
  ).resolves.toBeDefined();
});
