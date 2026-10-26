import { afterEach, expect, it, vi } from "vitest";
import { createOcrRecognitionSession } from "./ocr-recognition-session";

afterEach(() => vi.unstubAllGlobals());
it("termina o worker de plataforma mesmo com inicialização sem resposta", async () => {
  const terminate = vi.fn();
  const workers: { terminate: typeof terminate; postMessage: ReturnType<typeof vi.fn> }[] = [];
  vi.stubGlobal(
    "Worker",
    class {
      terminate = terminate;
      postMessage = vi.fn();
      constructor() {
        workers.push(this);
      }
    },
  );
  const controller = new AbortController();
  const pending = createOcrRecognitionSession("por", vi.fn(), controller.signal);
  expect(workers).toHaveLength(1);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(terminate).toHaveBeenCalledOnce();
});
