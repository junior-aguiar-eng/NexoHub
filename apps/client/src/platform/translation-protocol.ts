export type TranslationLanguage = "en" | "pt" | "es";
export interface TranslationProgressInfo {
  status: "downloading" | "initializing" | "translating" | "ready";
  progress: number;
  loadedBytes?: number;
  totalBytes?: number;
  message?: string;
  currentChunk?: number;
  totalChunks?: number;
}
export interface BrowserTranslationOptions {
  sourceLang: TranslationLanguage;
  targetLang: TranslationLanguage;
  onProgress?: (info: TranslationProgressInfo) => void;
  signal?: AbortSignal;
}
export interface BrowserTranslationResult {
  translatedText: string;
  sourceLang: TranslationLanguage;
  targetLang: TranslationLanguage;
  engine: "transformers.js-nllb-200";
}
export const NLLB_MODEL_ID = "Xenova/nllb-200-distilled-600M";
export interface TranslationWorkerRequest {
  id: number;
  text: string;
  sourceLang: TranslationLanguage;
  targetLang: TranslationLanguage;
}
export type TranslationWorkerResponse =
  | { id: number; type: "progress"; progress: TranslationProgressInfo }
  | { id: number; type: "result"; result: BrowserTranslationResult }
  | { id: number; type: "error"; code: string };
