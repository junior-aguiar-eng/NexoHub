import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import * as imageEngine from "@/platform/image-engine";
import { useImageBatch } from "./useImageBatch";

afterEach(() => vi.restoreAllMocks());

it("libera URLs ao selecionar, esvaziar e desmontar o lote sem repetir inspeções", async () => {
  const files = [new File(["a"], "a.png"), new File(["b"], "b.png")];
  const inspect = vi
    .spyOn(imageEngine, "getImageMetadata")
    .mockResolvedValue({ width: 100, height: 50, sizeBytes: 1, mimeType: "image/png" });
  let sequence = 0;
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockImplementation(() => `blob:preview-${++sequence}`);
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const view = renderHook(({ items, selected }) => useImageBatch(items, selected), {
    initialProps: { items: files, selected: 0 },
  });
  await waitFor(() => expect(view.result.current.pending).toBe(false));
  const first = view.result.current.previewUrl;
  view.rerender({ items: files, selected: 1 });
  await waitFor(() => expect(view.result.current.previewUrl).toBeDefined());
  expect(view.result.current.previewUrl).not.toBe(first);
  expect(revoke).toHaveBeenCalledWith(first);
  view.rerender({ items: [], selected: 0 });
  await waitFor(() => expect(view.result.current.previewUrl).toBeUndefined());
  view.rerender({ items: files, selected: 0 });
  await waitFor(() => expect(view.result.current.previewUrl).toBeDefined());
  view.unmount();
  expect(inspect).toHaveBeenCalledTimes(2);
  for (const result of create.mock.results) expect(revoke).toHaveBeenCalledWith(result.value);
});

it("sair durante a inspeção impede a leitura do próximo arquivo e a criação de prévia", async () => {
  let finish: (metadata: imageEngine.ImageMetadata) => void = () => {};
  const inspect = vi.spyOn(imageEngine, "getImageMetadata").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const create = vi.spyOn(URL, "createObjectURL");
  const files = [new File(["a"], "a.png"), new File(["b"], "b.png")];
  const view = renderHook(() => useImageBatch(files, 0));
  await waitFor(() => expect(inspect).toHaveBeenCalledTimes(1));
  view.unmount();
  await act(async () => finish({ width: 100, height: 50, sizeBytes: 1, mimeType: "image/png" }));
  expect(inspect).toHaveBeenCalledTimes(1);
  expect(create).not.toHaveBeenCalled();
});
