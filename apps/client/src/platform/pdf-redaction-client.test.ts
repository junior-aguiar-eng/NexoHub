import { afterEach, expect, it, vi } from "vitest";
import { redactBrowserPdf } from "./pdf-redaction-client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function workerMock() {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as null | ((e: MessageEvent) => void),
    onerror: null as null | (() => void),
    onmessageerror: null,
  };
  function WorkerMock() {
    return worker;
  }
  vi.stubGlobal("Worker", WorkerMock);
  return worker;
}
const options = {
  redactions: [
    { id: "a", pageIndex: 0, xPercent: 0, yPercent: 0, widthPercent: 10, heightPercent: 10 },
  ],
};
it("transfere apenas cópia e termina o worker ao cancelar", async () => {
  const w = workerMock(),
    c = new AbortController(),
    bytes = new Uint8Array([1, 2]);
  const run = redactBrowserPdf(bytes, options, c.signal);
  expect(w.postMessage.mock.calls[0][0].bytes).not.toBe(bytes);
  c.abort();
  await expect(run).rejects.toThrow("OPERACAO_CANCELADA");
  expect(w.terminate).toHaveBeenCalledOnce();
  expect(bytes).toEqual(new Uint8Array([1, 2]));
});
it("retorna exatamente os bytes aplicados e encerra o worker", async () => {
  const w = workerMock(),
    bytes = new Uint8Array([3, 4]);
  const run = redactBrowserPdf(new Uint8Array([1]), options);
  w.onmessage?.({ data: { bytes } } as MessageEvent);
  expect(await run).toBe(bytes);
  expect(w.terminate).toHaveBeenCalledOnce();
});
it("propaga recusa de perfil sem fallback", async () => {
  const w = workerMock();
  const run = redactBrowserPdf(new Uint8Array([1]), options);
  w.onmessage?.({ data: { error: "PDF_OCULTACAO_PERFIL_NAO_SUPORTADO" } } as MessageEvent);
  await expect(run).rejects.toThrow("PDF_OCULTACAO_PERFIL_NAO_SUPORTADO");
  expect(w.terminate).toHaveBeenCalledOnce();
});
it("encerra timeout ou falha de inicialização e recusa cancelamento prévio", async () => {
  vi.useFakeTimers();
  const w = workerMock(),
    run = redactBrowserPdf(new Uint8Array([1]), options);
  const check = expect(run).rejects.toThrow("PDF_OCULTACAO_WORKER");
  await vi.advanceTimersByTimeAsync(60000);
  await check;
  expect(w.terminate).toHaveBeenCalledOnce();
  const c = new AbortController();
  c.abort();
  await expect(redactBrowserPdf(new Uint8Array([1]), options, c.signal)).rejects.toThrow(
    "OPERACAO_CANCELADA",
  );
});
