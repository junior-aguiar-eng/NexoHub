import { mergeReviewFindings, type ReviewFinding, reviewText } from "@nexohub/domain";
import { isWordIgnoredOrCustom } from "./user-vocabulary";

export type ReviewProgressCallback = (progress: number, message: string) => void;

interface HunspellInstance {
  spell: (word: string) => boolean;
  suggest: (word: string) => string[];
  addWord: (word: string) => void;
  removeWord: (word: string) => void;
  dispose: () => void;
}

let cachedHunspell: HunspellInstance | null = null;
let cachedBuffers: { aff: Uint8Array; dic: Uint8Array } | null = null;
let isInitializing = false;
let initPromise: Promise<HunspellInstance> | null = null;

function matchCase(source: string, target: string): string {
  if (!source || !target) return target;
  if (source === source.toUpperCase()) return target.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) {
    return target.charAt(0).toUpperCase() + target.slice(1);
  }
  return target;
}

async function fetchDictionaryBuffer(
  url: string,
  onProgress?: (ratio: number) => void,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao baixar dicionário em ${url}: HTTP ${response.status}`);
  }

  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? Number.parseInt(contentLength, 10) : 0;

  if (!response.body || !total || !onProgress) {
    const arrayBuffer = await response.arrayBuffer();
    onProgress?.(1);
    return new Uint8Array(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      onProgress(Math.min(0.99, received / total));
    }
  }

  const combined = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  onProgress(1);
  return combined;
}

export async function getHunspellInstance(
  onProgress?: ReviewProgressCallback,
): Promise<HunspellInstance> {
  if (cachedHunspell) {
    onProgress?.(100, "Corretor ortográfico pronto.");
    return cachedHunspell;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      onProgress?.(10, "Iniciando motor ortográfico WASM...");
      const { loadModule } = await import("hunspell-asm");
      const factory = await loadModule();

      if (!cachedBuffers) {
        onProgress?.(25, "Carregando regras morfológicas pt-BR...");
        let affData: Uint8Array | null = null;
        let dicData: Uint8Array | null = null;

        if (
          typeof window !== "undefined" &&
          typeof fetch === "function" &&
          typeof window.location?.origin === "string" &&
          window.location.origin.startsWith("http")
        ) {
          try {
            const aff = await fetchDictionaryBuffer("/dictionaries/pt-BR/pt_BR.aff", (r) => {
              onProgress?.(25 + Math.round(r * 25), "Baixando afixos pt-BR...");
            });
            const dic = await fetchDictionaryBuffer("/dictionaries/pt-BR/pt_BR.dic", (r) => {
              onProgress?.(50 + Math.round(r * 40), "Baixando vocabulário pt-BR...");
            });
            affData = aff;
            dicData = dic;
          } catch {
            // Prossegue para o fallback local
          }
        }

        if (!affData || !dicData) {
          // Ambiente Node / Vitest / Test runner
          const fs = await import("node:fs");
          const path = await import("node:path");

          const candidateAffPaths = [
            path.resolve(process.cwd(), "public/dictionaries/pt-BR/pt_BR.aff"),
            path.resolve(process.cwd(), "apps/client/public/dictionaries/pt-BR/pt_BR.aff"),
            path.resolve(process.cwd(), "node_modules/dictionary-pt/index.aff"),
            path.resolve(process.cwd(), "apps/client/node_modules/dictionary-pt/index.aff"),
          ];
          const candidateDicPaths = [
            path.resolve(process.cwd(), "public/dictionaries/pt-BR/pt_BR.dic"),
            path.resolve(process.cwd(), "apps/client/public/dictionaries/pt-BR/pt_BR.dic"),
            path.resolve(process.cwd(), "node_modules/dictionary-pt/index.dic"),
            path.resolve(process.cwd(), "apps/client/node_modules/dictionary-pt/index.dic"),
          ];

          const affResolved = candidateAffPaths.find((p) => fs.existsSync(p));
          const dicResolved = candidateDicPaths.find((p) => fs.existsSync(p));

          if (!affResolved || !dicResolved) {
            throw new Error("Não foi possível localizar os arquivos de dicionário pt-BR.");
          }

          affData = new Uint8Array(fs.readFileSync(affResolved));
          dicData = new Uint8Array(fs.readFileSync(dicResolved));
        }

        cachedBuffers = { aff: affData, dic: dicData };
      }

      onProgress?.(92, "Compilando léxico no runtime Hunspell...");
      const affMounted = factory.mountBuffer(cachedBuffers.aff, "pt_BR.aff");
      const dicMounted = factory.mountBuffer(cachedBuffers.dic, "pt_BR.dic");
      const instance = factory.create(affMounted, dicMounted);

      cachedHunspell = instance;
      onProgress?.(100, "Corretor pronto.");
      return instance;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

// Regex para identificar URLs e e-mails que não devem ser revisados ortograficamente
const URL_OR_EMAIL_REGEX =
  /^(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/i;

// Regex para identificar siglas comuns e formatos técnicos (ex: CNPJ, LGPD, PDF, HTML, v1, 100km)
const ACRONYM_OR_TECHNICAL_REGEX = /^([A-ZÇÃÕÁÉÍÓÚÂÊÔ]{2,8}|\d+.*|.*[0-9_].*)$/;

export function checkWordSpelling(
  word: string,
  hunspell: HunspellInstance,
): { isCorrect: boolean; suggestions: readonly string[] } {
  const trimmed = word.trim();
  if (trimmed.length <= 1) return { isCorrect: true, suggestions: [] };

  if (URL_OR_EMAIL_REGEX.test(trimmed)) return { isCorrect: true, suggestions: [] };
  if (ACRONYM_OR_TECHNICAL_REGEX.test(trimmed)) return { isCorrect: true, suggestions: [] };
  if (isWordIgnoredOrCustom(trimmed)) return { isCorrect: true, suggestions: [] };

  const isOk = hunspell.spell(trimmed);
  if (isOk) return { isCorrect: true, suggestions: [] };

  // Caso falhe com inicial maiúscula, testa em minúsculo
  const lower = trimmed.toLowerCase();
  if (trimmed !== lower && hunspell.spell(lower)) {
    return { isCorrect: true, suggestions: [] };
  }

  // Gera sugestões limitadas às 4 melhores
  const rawSuggestions = hunspell.suggest(trimmed).slice(0, 4);
  const matchedSuggestions = rawSuggestions.map((s) => matchCase(trimmed, s));

  return {
    isCorrect: false,
    suggestions: matchedSuggestions,
  };
}

const WORD_TOKEN_REGEX = /[\p{L}\p{M}]+(?:[-'][\p{L}\p{M}]+)*/gu;

export async function performBrowserReview(options: {
  text: string;
  onProgress?: ReviewProgressCallback;
  hunspellOverride?: HunspellInstance;
}): Promise<readonly ReviewFinding[]> {
  const { text, onProgress, hunspellOverride } = options;
  if (!text || text.trim().length === 0) return [];

  // 1. Executa as regras contextuais e sintáticas do domínio
  const contextualFindings = reviewText(text);

  // 2. Inicializa o motor Hunspell WASM
  const hunspell = hunspellOverride ?? (await getHunspellInstance(onProgress));

  // 3. Varre palavras do texto identificando possíveis erros ortográficos
  const spellingFindings: ReviewFinding[] = [];
  WORD_TOKEN_REGEX.lastIndex = 0;

  for (const match of text.matchAll(WORD_TOKEN_REGEX)) {
    const word = match[0];
    const start = match.index;
    const end = start + word.length;

    // Se houver achado contextual que já cobre essa posição, ignora
    if (contextualFindings.some((cf) => start < cf.end && end > cf.start)) {
      continue;
    }

    const { isCorrect, suggestions } = checkWordSpelling(word, hunspell);
    if (!isCorrect) {
      const topReplacement = suggestions[0] ?? word;
      spellingFindings.push({
        id: `SPELLING:${start}:${end}`,
        rule: "SPELLING",
        severity: "warning",
        start,
        end,
        original: word,
        replacement: topReplacement,
        suggestions,
        message: `Possível erro de ortografia: "${word}".`,
      });
    }
  }

  // 4. Combina achados contextuais com achados ortográficos
  return mergeReviewFindings(contextualFindings, spellingFindings);
}
