import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import parserUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { EditorBox, EditorPage, EditorSnapshot } from "./pdf-editor-types";

const normalized = (text: string) => text.normalize("NFC").replace(/\s+/gu, " ").trim();
/** Valida o texto serializado na região editada usando um leitor independente do motor de gravação. */
export async function verifyEditorText(
  bytes: Uint8Array,
  snapshot: EditorSnapshot,
  pages: EditorPage[],
): Promise<void> {
  let parser: Worker | undefined, pdfWorker: pdfjs.PDFWorker | undefined;
  let task: pdfjs.PDFDocumentLoadingTask | undefined;
  try {
    if (
      typeof document === "undefined" &&
      typeof Worker !== "undefined" &&
      typeof location !== "undefined"
    ) {
      parser = new Worker(new URL(parserUrl, location.href), { type: "module" });
      pdfWorker = pdfjs.PDFWorker.create({ port: parser });
    } else if (typeof process === "undefined" || !process.versions?.node)
      pdfjs.GlobalWorkerOptions.workerSrc = parserUrl;
    task = pdfjs.getDocument({
      data: bytes.slice(),
      ...(pdfWorker ? { worker: pdfWorker } : {}),
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: true,
    });
    const pdf = await task.promise;
    for (let index = 0; index < pages.length; index++) {
      const checks: { id: string; box: EditorBox; text: string }[] = [];
      for (const replacement of snapshot.replacements) {
        const object = pages[index].texts.find((t) => t.id === replacement.id);
        if (object && replacement.text)
          checks.push({ id: `source:${object.id}`, box: object, text: replacement.text });
      }
      for (const element of snapshot.elements)
        if (element.page === index && element.kind === "text" && element.text)
          checks.push({ id: `element:${element.id}`, box: element, text: element.text });
      if (!checks.length) continue;
      const page = await pdf.getPage(index + 1),
        viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const textItems = content.items.flatMap((item) => {
        if (!("str" in item)) return [];
        const matrix = pdfjs.Util.transform(viewport.transform, item.transform),
          length = Math.hypot(matrix[0], matrix[1]) || 1;
        const vx = (matrix[0] / length) * item.width,
          vy = (matrix[1] / length) * item.width;
        const xs = [matrix[4], matrix[4] + vx, matrix[4] - matrix[2], matrix[4] + vx - matrix[2]],
          ys = [matrix[5], matrix[5] + vy, matrix[5] - matrix[3], matrix[5] + vy - matrix[3]];
        return [
          {
            text: item.str,
            x: Math.min(...xs) / viewport.width,
            y: Math.min(...ys) / viewport.height,
            right: Math.max(...xs) / viewport.width,
            bottom: Math.max(...ys) / viewport.height,
          },
        ];
      });
      const replacements = new Map(snapshot.replacements.map((item) => [item.id, item.text]));
      const knownObjects = [
        ...pages[index].texts.map((item) => ({
          id: `source:${item.id}`,
          box: item,
          text: replacements.get(item.id) ?? item.text,
        })),
        ...snapshot.elements
          .filter((item) => item.page === index && item.kind === "text")
          .map((item) => ({ id: `element:${item.id}`, box: item, text: item.text ?? "" })),
      ].filter((item) => normalized(item.text));
      for (const check of checks) {
        const box = check.box;
        const nearby = textItems.filter(
          (item) =>
            item.right >= box.x - 0.001 &&
            item.x <= box.x + box.width + 0.001 &&
            item.bottom >= box.y - 0.001 &&
            item.y <= box.y + box.height + 0.001,
        );
        const expected = normalized(check.text);
        const parts = nearby.map((item) => normalized(item.text)).filter(Boolean);
        const matches = parts.some((_, start) => {
          let candidate = "";
          for (let end = start; end < parts.length; end++) {
            candidate = candidate ? `${candidate} ${parts[end]}` : parts[end];
            if (candidate === expected) return true;
            if (candidate.length > expected.length) break;
          }
          return false;
        });
        if (!matches) {
          // PDF.js pode fundir objetos contíguos em um item. Nesse caso, conferir o
          // conjunto completo esperado (alvo + vizinhos conhecidos), sem substring.
          const related = knownObjects.filter(({ box: object }) =>
            nearby.some(
              (item) =>
                item.right >= object.x - 0.001 &&
                item.x <= object.x + object.width + 0.001 &&
                item.bottom >= object.y - 0.001 &&
                item.y <= object.y + object.height + 0.001,
            ),
          );
          if (
            !related.some((item) => item.id === check.id) ||
            normalized(related.map((item) => item.text).join(" ")) !==
              normalized(nearby.map((item) => item.text).join(" "))
          )
            throw new Error("EDITOR_GLIFO");
        }
      }
      page.cleanup();
    }
  } finally {
    if (task) await task.destroy();
    pdfWorker?.destroy();
    parser?.terminate();
  }
}
