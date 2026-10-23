import { init } from "@embedpdf/pdfium";
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import { PdfEditorEngine } from "./pdf-editor-engine";
import type { EditorSnapshot } from "./pdf-editor-types";

const scope = globalThis as unknown as {
  onmessage: (
    event: MessageEvent<{
      bytes: Uint8Array;
      snapshot: EditorSnapshot;
      page: number;
      thumbnails?: boolean;
    }>,
  ) => void;
  postMessage: (data: unknown, transfer?: Transferable[]) => void;
};
scope.onmessage = async ({ data }) => {
  try {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error("EDITOR_WORKER");
    const api = await init({ wasmBinary: await response.arrayBuffer() });
    api.PDFiumExt_Init();
    const result = new PdfEditorEngine(api).revise(
      data.bytes,
      data.snapshot,
      data.page,
      data.thumbnails,
    );
    if (
      data.snapshot.replacements.some((item) => item.text) ||
      data.snapshot.elements.some((item) => item.kind === "text")
    ) {
      const { verifyEditorText } = await import("./pdf-editor-verify");
      await verifyEditorText(result.bytes, data.snapshot, result.pages);
    }
    scope.postMessage({ result }, [
      result.bytes.buffer,
      result.preview.data.buffer,
      ...result.thumbnails.map((t) => t.data.buffer),
    ]);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    scope.postMessage({ error: code.startsWith("EDITOR_") ? code : "EDITOR_OPERACAO" });
  }
};
