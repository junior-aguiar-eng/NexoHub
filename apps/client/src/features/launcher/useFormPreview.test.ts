import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { PDFDocument } from "pdf-lib";
import { afterEach, expect, it, vi } from "vitest";
import { renderPdfPageToDataUrl } from "@/platform/pdf-engine";
import { getPdfFormRevisionBytes } from "@/platform/pdf-form";
import { useFormPreview } from "./useFormPreview";

vi.mock("@/platform/pdf-engine", () => ({
  renderPdfPageToDataUrl: vi.fn(async () => "data:image/png;base64,NOVA"),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
async function source() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([300, 300]);
  pdf.addPage([300, 300]);
  pdf.getForm().createTextField("nome").addToPage(page, { x: 20, y: 100, width: 200, height: 30 });
  const bytes = await pdf.save();
  const file = new File([], "igual.pdf");
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.slice().buffer });
  return file;
}
it("mostra e entrega a revisão do último valor digitado, sem exportar estado pendente", async () => {
  const file = await source();
  const view = renderHook(
    ({ values }) => useFormPreview({ file, values, enabled: true, flatten: false, page: 1 }),
    { initialProps: { values: { nome: "antes" } } },
  );
  view.rerender({ values: { nome: "José da Conceição" } });
  expect(view.result.current.pending).toBe(true);
  expect(view.result.current.revision).toBeUndefined();
  await waitFor(() => expect(view.result.current.pending).toBe(false));
  const revision = view.result.current.revision;
  if (!revision) throw new Error("Revisão ausente");
  expect(
    (await PDFDocument.load(getPdfFormRevisionBytes(revision)))
      .getForm()
      .getTextField("nome")
      .getText(),
  ).toBe("José da Conceição");
  expect(view.result.current.previewUrl).toContain("NOVA");
});
it("mudar página reutiliza os mesmos bytes; achatar cria outra revisão validada", async () => {
  const file = await source(),
    values = { nome: "João" };
  const view = renderHook(
    ({ page, flatten }) => useFormPreview({ file, values, enabled: true, page, flatten }),
    { initialProps: { page: 1, flatten: false } },
  );
  await waitFor(() => expect(view.result.current.revision).toBeDefined());
  const first = view.result.current.revision;
  view.rerender({ page: 2, flatten: false });
  await waitFor(() => expect(view.result.current.pending).toBe(false));
  expect(view.result.current.revision).toBe(first);
  view.rerender({ page: 2, flatten: true });
  expect(view.result.current.revision).toBeUndefined();
  await waitFor(() => expect(view.result.current.revision).toBeDefined());
  const revision = view.result.current.revision;
  if (!revision) throw new Error("Revisão ausente");
  expect(revision).not.toBe(first);
  expect(
    (await PDFDocument.load(getPdfFormRevisionBytes(revision))).getForm().getFields(),
  ).toHaveLength(0);
});
it("trocar arquivo descarta renderização tardia e sair cancela o render atual", async () => {
  let finish: (value: string) => void = () => {};
  let oldSignal: AbortSignal | undefined;
  vi.mocked(renderPdfPageToDataUrl).mockImplementationOnce((_bytes, _page, _scale, signal) => {
    oldSignal = signal;
    return new Promise<string>((resolve) => {
      finish = resolve;
    });
  });
  const a = await source(),
    b = await source(),
    values = { nome: "Maria" };
  const view = renderHook(
    ({ file }) => useFormPreview({ file, values, enabled: true, page: 1, flatten: false }),
    { initialProps: { file: a } },
  );
  await waitFor(() => expect(oldSignal).toBeDefined());
  view.rerender({ file: b });
  expect(view.result.current.previewUrl).toBeUndefined();
  await waitFor(() => expect(view.result.current.revision?.source).toBe(b));
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => finish("data:image/png;base64,ANTIGA"));
  expect(view.result.current.previewUrl).toContain("NOVA");
  view.unmount();
  const signal = vi.mocked(renderPdfPageToDataUrl).mock.lastCall?.[3];
  expect(signal?.aborted).toBe(true);
});
it("erro de fonte bloqueia revisão e pode ser corrigido sem conservar a prévia antiga", async () => {
  const file = await source();
  const view = renderHook(
    ({ values }) => useFormPreview({ file, values, enabled: true, page: 1, flatten: false }),
    { initialProps: { values: { nome: "漢字" } } },
  );
  await waitFor(() => expect(view.result.current.error).toBeTruthy());
  expect(view.result.current.revision).toBeUndefined();
  expect(view.result.current.previewUrl).toBeUndefined();
  view.rerender({ values: { nome: "José" } });
  expect(view.result.current.error).toBeUndefined();
  await waitFor(() => expect(view.result.current.revision).toBeDefined());
});

it("falha de renderização não libera download; tentar novamente valida uma nova prévia", async () => {
  vi.mocked(renderPdfPageToDataUrl).mockResolvedValueOnce("");
  const file = await source(),
    values = { nome: "José" };
  const view = renderHook(() =>
    useFormPreview({ file, values, enabled: true, page: 1, flatten: false }),
  );
  await waitFor(() => expect(view.result.current.error).toBeTruthy());
  expect(view.result.current.revision).toBeUndefined();
  act(() => view.result.current.retry());
  await waitFor(() => expect(view.result.current.revision).toBeDefined());
  expect(view.result.current.error).toBeUndefined();
});

it("achatar durante renderização descarta a imagem da revisão editável anterior", async () => {
  let finish: (value: string) => void = () => {};
  let signal: AbortSignal | undefined;
  vi.mocked(renderPdfPageToDataUrl).mockImplementationOnce((_bytes, _page, _scale, current) => {
    signal = current;
    return new Promise<string>((resolve) => {
      finish = resolve;
    });
  });
  const file = await source(),
    values = { nome: "Maria" };
  const view = renderHook(
    ({ flatten }) => useFormPreview({ file, values, enabled: true, page: 1, flatten }),
    { initialProps: { flatten: false } },
  );
  await waitFor(() => expect(signal).toBeDefined());
  view.rerender({ flatten: true });
  expect(view.result.current.revision).toBeUndefined();
  await waitFor(() => expect(view.result.current.revision?.flatten).toBe(true));
  expect(signal?.aborted).toBe(true);
  await act(async () => finish("data:image/png;base64,ANTIGA"));
  expect(view.result.current.previewUrl).toContain("NOVA");
});
