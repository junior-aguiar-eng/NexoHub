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
  preservedNames?: readonly string[];
  onProgress?: (info: TranslationProgressInfo) => void;
  signal?: AbortSignal;
}
export interface BrowserTranslationResult {
  translatedText: string;
  sourceLang: TranslationLanguage;
  targetLang: TranslationLanguage;
  engine: "transformers.js-m2m100" | "identity";
}
/** Perfil browser auditado; licença dos pesos distinta da licença do runtime. */
export const TRANSLATION_MODEL = {
  id: "Xenova/m2m100_418M",
  revision: "9c374f0b7aca709787cea97b047bfbbd1559d177",
  baseModel: "facebook/m2m100_418M",
  baseLicense: "MIT",
  weightsBytes: 631984548,
  encoderSha256: "13a94e354a9140764eb81102d77d3ec6952d796e6f113c651eeb3c3443da0386",
  decoderSha256: "007654bcabb6cea6fd3bde34ce933137b431330b3755781145d7b6906270b45a",
} as const;
export interface TranslationWorkerRequest {
  id: number;
  text: string;
  sourceLang: TranslationLanguage;
  targetLang: TranslationLanguage;
  preservedNames?: readonly string[];
}
export type TranslationWorkerResponse =
  | { id: number; type: "progress"; progress: TranslationProgressInfo }
  | { id: number; type: "result"; result: BrowserTranslationResult }
  | { id: number; type: "error"; code: string };
