/** Evita a descoberta de tokenizer em `main` feita pelo AutoTokenizer 4.x.
 * Os dois JSONs e os pesos usam a mesma revisão imutável. */
import {
  AutoModelForSeq2SeqLM,
  env,
  M2M100Tokenizer,
  TranslationPipeline,
} from "@huggingface/transformers";

export async function createTranslationPipeline(
  modelId: string,
  options: Parameters<typeof AutoModelForSeq2SeqLM.from_pretrained>[1] & { revision: string },
) {
  const readJSON = async (file: string) => {
    const url = `https://huggingface.co/${modelId}/resolve/${options.revision}/${file}`;
    let cache: Cache | undefined;
    try {
      if (env.useBrowserCache && typeof caches !== "undefined")
        cache = await caches.open(env.cacheKey);
    } catch {
      /* Cache indisponível: a inferência online continua possível. */
    }
    const cached = await cache?.match(url);
    if (cached) return cached.json();
    const response = await env.fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${file}`);
    if (cache) {
      try {
        await cache.put(url, response.clone());
      } catch {
        /* Quota não transforma resposta válida em falha de tradução. */
      }
    }
    return response.json();
  };
  const [tokenizerJSON, tokenizerConfig, model] = await Promise.all([
    readJSON("tokenizer.json"),
    readJSON("tokenizer_config.json"),
    AutoModelForSeq2SeqLM.from_pretrained(modelId, options),
  ]);
  if (tokenizerConfig.tokenizer_class !== "M2M100Tokenizer")
    throw new Error("TRADUCAO_MODELO_INCOMPATIVEL");
  const tokenizer = new M2M100Tokenizer(tokenizerJSON, tokenizerConfig);
  return new TranslationPipeline({ task: "translation", tokenizer, model });
}
