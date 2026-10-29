import type { TranslationWorkerRequest, TranslationWorkerResponse } from "./translation-protocol";
import { performRuntimeTranslation, translationErrorCode } from "./translation-runtime";

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<TranslationWorkerRequest>) => void;
  postMessage: (message: TranslationWorkerResponse) => void;
};
// O cliente envia um pedido por vez; a fila também protege outros consumidores do protocolo.
let pending = Promise.resolve();
scope.onmessage = ({ data }) => {
  pending = pending.then(async () => {
    try {
      const result = await performRuntimeTranslation(data.text, {
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        preservedNames: data.preservedNames,
        onProgress: (progress) => scope.postMessage({ id: data.id, type: "progress", progress }),
      });
      scope.postMessage({ id: data.id, type: "result", result });
    } catch (error) {
      scope.postMessage({ id: data.id, type: "error", code: translationErrorCode(error) });
    }
  });
};
