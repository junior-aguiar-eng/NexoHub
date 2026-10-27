import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

/** Oráculo de testes via PDF.js; estrutura também conferida em pdf-lib. Não integra a aplicação. */
export async function captureAccessSnapshot(bytes: Uint8Array, password?: string) {
  const task = getDocument({ data: bytes.slice(), password, useSystemFonts: true });
  try {
    const doc = await task.promise;
    const info = (await doc.getMetadata()).info as Record<string, unknown>;
    const pages = [];
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      pages.push({
        box: [...page.view],
        rotation: page.rotate,
        text: (await page.getTextContent()).items.flatMap((item) =>
          "str" in item && item.str.trim() ? [item.str] : [],
        ),
      });
      page.cleanup();
    }
    const fields = [...((await doc.getFieldObjects())?.entries() ?? [])]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, widgets]) => ({
        name,
        widgets: widgets.map((widget) => {
          // PDF.js descreve field objects como objetos abertos; comparar somente o contrato aferido.
          const data = widget as Record<string, unknown>;
          return { type: data.type, value: data.value, rect: data.rect, page: data.page };
        }),
      }));
    const attachments = [];
    for (const [id, entry] of (await doc.getAttachments())?.entries() ?? []) {
      const content = entry.content ?? (await doc.getAttachmentContent(id));
      if (!(content instanceof Uint8Array)) throw new Error("Anexo de controle inválido");
      attachments.push({ name: entry.filename, bytes: [...content] });
    }
    attachments.sort((a, b) => a.name.localeCompare(b.name));
    return {
      title: info.Title,
      author: info.Author,
      creationDate: info.CreationDate,
      pages,
      fields,
      attachments,
    };
  } finally {
    await task.destroy();
  }
}
