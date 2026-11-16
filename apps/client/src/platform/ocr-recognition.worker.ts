import { createWorker, type Worker as TesseractWorker } from "tesseract.js";

// Worker de plataforma: terminar este proprietário encerra também seus workers dedicados filhos.
const scope = globalThis as unknown as {
  onmessage:
    | ((
        event: MessageEvent<
          | { type: "initialize"; language: "por" | "eng" | "spa" }
          | { type: "recognize"; image: Blob }
        >,
      ) => void)
    | null;
  postMessage(message: unknown): void;
};
let engine: TesseractWorker | undefined;
scope.onmessage = async (event) => {
  try {
    if (event.data.type === "initialize") {
      engine = await createWorker(event.data.language, 1, {
        logger: (message) =>
          scope.postMessage({
            type: "progress",
            status: message.status,
            progress: message.progress ?? 0,
          }),
        errorHandler: () => scope.postMessage({ type: "error" }),
      });
      scope.postMessage({ type: "ready" });
    } else if (engine) {
      const result = await engine.recognize(event.data.image, {}, { blocks: true });
      scope.postMessage({ type: "result", data: result.data });
    } else scope.postMessage({ type: "error" });
  } catch {
    scope.postMessage({ type: "error" });
  }
};
