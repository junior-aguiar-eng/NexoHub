import { expect, it, vi } from "vitest";
import { PdfPreviewQueue } from "./pdf-preview-queue";

it("cancela a renderização anterior por identidade de arquivo e descarta tarefas obsoletas", async () => {
  let release: (value: string) => void = () => {};
  let activeSignal: AbortSignal | undefined;
  const render = vi.fn((_file: File, _page: number, signal: AbortSignal) => {
    activeSignal = signal;
    return new Promise<string>((resolve) => {
      release = resolve;
    });
  });
  const queue = new PdfPreviewQueue(render);
  const a = new File(["a"], "igual.pdf"),
    b = new File(["b"], "igual.pdf");
  const old = queue.request(a, 1);
  await Promise.resolve();
  const oldSignal = activeSignal;
  const skipped = queue.request(a, 2);
  const next = queue.request(b, 1);
  expect(oldSignal?.aborted).toBe(true);
  release("antiga");
  expect(await old).toBe("");
  expect(await skipped).toBe("");
  await Promise.resolve();
  release("nova");
  expect(await next).toBe("nova");
  queue.cancel();
  expect(activeSignal?.aborted).toBe(true);
  expect(render).toHaveBeenCalledTimes(2);
});
it("limita cache a seis páginas e mantém a última solicitação ao pular rapidamente", async () => {
  const render = vi.fn(async (_file: File, page: number) => String(page));
  const queue = new PdfPreviewQueue(render);
  const file = new File(["pdf"], "origem.pdf");
  for (let page = 1; page <= 8; page++) expect(await queue.request(file, page)).toBe(String(page));
  expect(await queue.request(file, 8)).toBe("8");
  expect(render).toHaveBeenCalledTimes(8);
  expect(await queue.request(file, 1)).toBe("1");
  expect(render).toHaveBeenCalledTimes(9);
  const a = queue.request(file, 9),
    b = queue.request(file, 10),
    c = queue.request(file, 9);
  expect(await a).toBe("");
  expect(await b).toBe("");
  expect(await c).toBe("9");
  queue.cancel();
});

it("cancela a página ativa lenta e inicia a nova sem aguardar sua conclusão", async () => {
  let release: (value: string) => void = () => {};
  const signals: AbortSignal[] = [];
  const render = vi.fn((_file: File, page: number, signal: AbortSignal) => {
    signals.push(signal);
    return page === 1
      ? new Promise<string>((resolve) => {
          release = resolve;
        })
      : Promise.resolve("segunda");
  });
  const queue = new PdfPreviewQueue(render);
  const file = new File(["pdf"], "documento.pdf");
  const old = queue.request(file, 1);
  await Promise.resolve();
  const next = queue.request(file, 2);
  await Promise.resolve();
  expect(signals[0]?.aborted).toBe(true);
  expect(render).toHaveBeenCalledTimes(2);
  expect(await next).toBe("segunda");
  release("obsoleta");
  expect(await old).toBe("");
  queue.cancel();
});
