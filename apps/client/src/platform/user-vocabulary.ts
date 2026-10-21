const STORAGE_KEY = "nexohub:user-vocabulary:v1";

const sessionIgnoredWords = new Set<string>();
let customWordsCache: Set<string> | null = null;

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

export function getCustomVocabulary(): ReadonlySet<string> {
  if (customWordsCache) return customWordsCache;

  const set = new Set<string>();
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === "string" && item.trim().length > 0) {
              set.add(normalizeWord(item));
            }
          }
        }
      }
    } catch (err) {
      console.warn("Falha ao carregar vocabulário personalizado:", err);
    }
  }

  customWordsCache = set;
  return set;
}

function persistCustomVocabulary(set: Set<string>): void {
  customWordsCache = set;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
    } catch (err) {
      console.warn("Falha ao salvar vocabulário personalizado:", err);
    }
  }
}

export function addCustomWord(word: string): void {
  const normalized = normalizeWord(word);
  if (!normalized) return;
  const set = new Set(getCustomVocabulary());
  set.add(normalized);
  persistCustomVocabulary(set);
}

export function removeCustomWord(word: string): void {
  const normalized = normalizeWord(word);
  if (!normalized) return;
  const set = new Set(getCustomVocabulary());
  set.delete(normalized);
  persistCustomVocabulary(set);
}

export function ignoreWordInSession(word: string): void {
  const normalized = normalizeWord(word);
  if (normalized) {
    sessionIgnoredWords.add(normalized);
  }
}

export function isWordIgnoredOrCustom(word: string): boolean {
  const normalized = normalizeWord(word);
  if (!normalized) return true;
  if (sessionIgnoredWords.has(normalized)) return true;
  return getCustomVocabulary().has(normalized);
}

export function clearSessionIgnored(): void {
  sessionIgnoredWords.clear();
}
