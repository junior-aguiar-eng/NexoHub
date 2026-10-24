// @vitest-environment node
import { readFile } from "node:fs/promises";
import { init, type WrappedPdfiumModule } from "@embedpdf/pdfium";
import {
  decodePDFRawStream,
  degrees,
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFString,
  rgb,
} from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, expect, it } from "vitest";
import { redactPreservingWithPdfium } from "./pdf-redaction-engine";

let api: WrappedPdfiumModule;
beforeAll(async () => {
  api = await init({
    wasmBinary: await readFile(
      new URL("../../node_modules/@embedpdf/pdfium/dist/pdfium.wasm", import.meta.url),
    ),
  });
  api.PDFiumExt_Init();
});
const area = {
  id: "one",
  pageIndex: 0,
  xPercent: 10,
  yPercent: 22,
  widthPercent: 65,
  heightPercent: 12,
  color: "black",
};
async function source(rotation = 0, crop = false) {
  const d = await PDFDocument.create(),
    p = d.addPage([500, 700]);
  p.drawText("SEGREDO_UNICO", { x: 70, y: 500, size: 18 });
  p.drawText("PUBLICO_FORA", { x: 70, y: 400, size: 18 });
  if (crop) p.setCropBox(25, 40, 450, 600);
  p.setRotation(degrees(rotation));
  d.setTitle("SEGREDO_UNICO");
  d.setSubject("SEGREDO_UNICO");
  return d.save();
}
async function inspect(bytes: Uint8Array) {
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    standardFontDataUrl: new URL("../../public/standard_fonts/", import.meta.url).pathname,
  });
  try {
    const d = await task.promise,
      p = await d.getPage(1);
    return {
      items: (await p.getTextContent()).items.flatMap((i) => ("str" in i ? [i] : [])),
      annotations: await p.getAnnotations(),
      metadata: await d.getMetadata(),
    };
  } finally {
    await task.destroy();
  }
}
function streams(bytes: Uint8Array) {
  return PDFDocument.load(bytes).then((d) =>
    d.context.enumerateIndirectObjects().flatMap(([, o]) => {
      if (!(o instanceof PDFRawStream)) return [];
      try {
        return [Buffer.from(decodePDFRawStream(o).decode())];
      } catch {
        return [Buffer.from(o.getContents())];
      }
    }),
  );
}
it("remove texto e cópias nos metadados sem rasterizar nem alterar o original", async () => {
  const bytes = await source(),
    original = bytes.slice();
  const output = await redactPreservingWithPdfium(api, bytes, { redactions: [area] });
  const result = await inspect(output);
  expect(result.items.map((i) => i.str).join(" ")).not.toContain("SEGREDO_UNICO");
  expect(result.items.map((i) => i.str).join(" ")).toContain("PUBLICO_FORA");
  expect(result.metadata.info).not.toHaveProperty("Title");
  for (const s of await streams(output)) {
    expect(s.includes(Buffer.from("SEGREDO_UNICO"))).toBe(false);
    expect(s.toString().toUpperCase()).not.toContain(
      Buffer.from("SEGREDO_UNICO").toString("hex").toUpperCase(),
    );
  }
  expect(bytes).toEqual(original);
});
it.each([0, 90, 180, 270])(
  "respeita CropBox e rotação %s em coordenadas da prévia",
  async (rotation) => {
    const input = await source(rotation, true);
    const task = pdfjs.getDocument({ data: input.slice() });
    let rect: typeof area;
    try {
      const d = await task.promise,
        v = (await d.getPage(1)).getViewport({ scale: 1 });
      const points = [v.convertToViewportPoint(60, 530), v.convertToViewportPoint(350, 480)];
      const left = Math.min(...points.map((p) => p[0])),
        top = Math.min(...points.map((p) => p[1]));
      rect = {
        ...area,
        xPercent: (left / v.width) * 100,
        yPercent: (top / v.height) * 100,
        widthPercent: (Math.abs(points[1][0] - points[0][0]) / v.width) * 100,
        heightPercent: (Math.abs(points[1][1] - points[0][1]) / v.height) * 100,
      };
    } finally {
      await task.destroy();
    }
    const out = await redactPreservingWithPdfium(api, input, { redactions: [rect] });
    const result = await inspect(out);
    expect(result.items.map((i) => i.str)).toContain("PUBLICO_FORA");
    expect(result.items.map((i) => i.str)).not.toContain("SEGREDO_UNICO");
    const doc = await PDFDocument.load(out);
    expect(doc.getPage(0).getRotation().angle).toBe(rotation);
    expect(doc.getPage(0).getCropBox()).toEqual({ x: 25, y: 40, width: 450, height: 600 });
  },
);
it("preserva valores e links fora das tarjas e recusa atingir um widget", async () => {
  const doc = await PDFDocument.load(await source());
  const p = doc.getPage(0),
    f = doc.getForm().createTextField("publico");
  f.setText("VALOR_PUBLICO");
  f.addToPage(p, { x: 50, y: 100, width: 300, height: 30 });
  p.node.addAnnot(
    doc.context.register(
      doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [50, 200, 300, 225],
        A: { S: "URI", URI: PDFString.of("https://example.com/public") },
      }),
    ),
  );
  const input = await doc.save();
  const out = await redactPreservingWithPdfium(api, input, { redactions: [area] });
  expect((await PDFDocument.load(out)).getForm().getTextField("publico").getText()).toBe(
    "VALOR_PUBLICO",
  );
  expect(
    (await inspect(out)).annotations.some(
      (a) => "url" in a && a.url === "https://example.com/public",
    ),
  ).toBe(true);
  await expect(
    redactPreservingWithPdfium(api, input, {
      redactions: [{ ...area, yPercent: 80, heightPercent: 10 }],
    }),
  ).rejects.toThrow("PDF_OCULTACAO_ANOTACAO_NA_AREA");
});
it("recusa extensões privadas em vez de manter uma cópia recuperável", async () => {
  const d = await PDFDocument.load(await source());
  d.getPage(0).node.set(PDFName.of("PrivateBackup"), PDFString.of("SEGREDO_UNICO"));
  await expect(
    redactPreservingWithPdfium(api, await d.save(), { redactions: [area] }),
  ).rejects.toThrow("PDF_OCULTACAO_PERFIL_NAO_SUPORTADO");
});
it("não oferece preservação para estruturas ativas, camadas ou fontes não homologadas", async () => {
  for (const key of ["OpenAction", "OCProperties", "StructTreeRoot"]) {
    const d = await PDFDocument.load(await source());
    d.catalog.set(PDFName.of(key), d.context.obj({}));
    await expect(
      redactPreservingWithPdfium(api, await d.save(), { redactions: [area] }),
    ).rejects.toThrow("PDF_OCULTACAO_PERFIL_NAO_SUPORTADO");
  }
});
it("valida todas as áreas antes de produzir bytes", async () => {
  const input = await source();
  for (const invalid of [
    { ...area, pageIndex: 5 },
    { ...area, xPercent: 99 },
    { ...area, widthPercent: NaN },
  ])
    await expect(
      redactPreservingWithPdfium(api, input, { redactions: [area, invalid] }),
    ).rejects.toThrow("AREA_OCULTACAO_INVALIDA");
});
it("elimina pixels privados da imagem e mantém pixels externos sem rasterizar a página", async () => {
  const d = await PDFDocument.create(),
    p = d.addPage([500, 700]);
  const pixels = new Uint8Array(16 * 8 * 3);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 16; x++)
      pixels.set(x < 8 ? [217, 33, 157] : [22, 185, 99], (y * 16 + x) * 3);
  const image = d.context.register(
    d.context.flateStream(pixels, {
      Type: "XObject",
      Subtype: "Image",
      Width: 16,
      Height: 8,
      ColorSpace: "DeviceRGB",
      BitsPerComponent: 8,
    }),
  );
  p.node.set(PDFName.of("Resources"), d.context.obj({ XObject: { Im1: image } }));
  p.node.set(
    PDFName.of("Contents"),
    d.context.register(d.context.flateStream("q 400 0 0 200 50 300 cm /Im1 Do Q")),
  );
  const out = await redactPreservingWithPdfium(api, await d.save(), {
    redactions: [{ ...area, xPercent: 9, yPercent: 27, widthPercent: 41.2, heightPercent: 31 }],
  });
  for (const stream of await streams(out))
    expect(stream.includes(Buffer.from(Array(8).fill([217, 33, 157]).flat()))).toBe(false);
  const task = pdfjs.getDocument({ data: out.slice() });
  try {
    const document = await task.promise,
      page = await document.getPage(1),
      viewport = page.getViewport({ scale: 1 });
    const factory = document.canvasFactory as {
      create(
        w: number,
        h: number,
      ): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
      destroy(pair: unknown): void;
    };
    const target = factory.create(viewport.width, viewport.height);
    try {
      await page.render({ canvas: target.canvas, canvasContext: target.context, viewport }).promise;
      expect([...target.context.getImageData(150, 300, 1, 1).data]).toEqual([0, 0, 0, 255]);
      expect([...target.context.getImageData(350, 300, 1, 1).data]).toEqual([22, 185, 99, 255]);
    } finally {
      factory.destroy(target);
    }
  } finally {
    await task.destroy();
  }
});
it("remove duas instâncias de Form XObject sem deixar a cópia original em recursos", async () => {
  const donor = await PDFDocument.create(),
    p = donor.addPage([500, 200]);
  p.drawText("SEGREDO_FORM", { x: 40, y: 100, size: 18 });
  p.drawText("PUBLICO_DENTRO", { x: 40, y: 50, size: 18 });
  const d = await PDFDocument.create(),
    [embedded] = await d.embedPdf(await donor.save()),
    target = d.addPage([500, 700]);
  target.drawPage(embedded, { x: 20, y: 480, width: 400, height: 160 });
  target.drawPage(embedded, { x: 20, y: 100, width: 400, height: 160 });
  const out = await redactPreservingWithPdfium(api, await d.save(), {
    redactions: [540, 160].map((y, i) => ({
      ...area,
      id: String(i),
      xPercent: 6,
      yPercent: (700 - y - 50) / 7,
      widthPercent: 64,
      heightPercent: 50 / 7,
    })),
  });
  const result = await inspect(out),
    text = result.items.map((i) => i.str).join(" ");
  expect(text).not.toContain("SEGREDO_FORM");
  expect(text.match(/PUBLICO_DENTRO/g)).toHaveLength(2);
  for (const s of await streams(out)) {
    expect(s.toString()).not.toContain("SEGREDO_FORM");
    expect(s.toString().toUpperCase()).not.toContain(
      Buffer.from("SEGREDO_FORM").toString("hex").toUpperCase(),
    );
  }
});
it("não copia streams órfãos ou recursos não usados e descarta metadados de página", async () => {
  const d = await PDFDocument.load(await source()),
    p = d.getPage(0);
  d.context.register(d.context.flateStream("BACKUP_PRIVADO"));
  p.node.set(PDFName.of("Metadata"), d.context.register(d.context.flateStream("BACKUP_PRIVADO")));
  const donor = await PDFDocument.create();
  donor.addPage([300, 100]).drawText("BACKUP_PRIVADO", { x: 20, y: 50 });
  const [embedded] = await d.embedPdf(await donor.save());
  await d.flush();
  p.node.Resources()?.set(PDFName.of("XObject"), d.context.obj({ Fm1: embedded.ref }));
  const out = await redactPreservingWithPdfium(api, await d.save(), { redactions: [area] });
  for (const s of await streams(out)) {
    expect(s.toString()).not.toContain("BACKUP_PRIVADO");
    expect(s.toString().toUpperCase()).not.toContain(
      Buffer.from("BACKUP_PRIVADO").toString("hex").toUpperCase(),
    );
  }
});
it("recusa caches privados no dicionário de um stream de página", async () => {
  const d = await PDFDocument.load(await source()),
    contents = d.getPage(0).node.Contents();
  if (!(contents instanceof PDFArray)) throw new Error("fixture");
  const stream = d.context.lookup(contents.get(0));
  if (!(stream instanceof PDFRawStream)) throw new Error("fixture");
  stream.dict.set(PDFName.of("PrivateBackup"), PDFString.of("SEGREDO_UNICO"));
  await expect(
    redactPreservingWithPdfium(api, await d.save(), { redactions: [area] }),
  ).rejects.toThrow("PDF_OCULTACAO_PERFIL_NAO_SUPORTADO");
});
it("recusa fonte incorporada e imagem com máscara antes de aplicar", async () => {
  for (const kind of ["font", "image"]) {
    const d = await PDFDocument.load(await source()),
      p = d.getPage(0);
    if (kind === "font") {
      const fonts = p.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
      if (!fonts) throw new Error("fixture");
      const font = d.context.lookup(fonts.values()[0], PDFDict);
      font.set(PDFName.of("ToUnicode"), d.context.register(d.context.flateStream("SEGREDO_UNICO")));
    } else {
      const image = d.context.register(
        d.context.flateStream(new Uint8Array(3), {
          Type: "XObject",
          Subtype: "Image",
          Width: 1,
          Height: 1,
          ColorSpace: "DeviceRGB",
          BitsPerComponent: 8,
          SMask: PDFName.of("None"),
        }),
      );
      p.node.Resources()?.set(PDFName.of("XObject"), d.context.obj({ Im1: image }));
    }
    await expect(
      redactPreservingWithPdfium(api, await d.save(), { redactions: [area] }),
    ).rejects.toThrow("PDF_OCULTACAO_PERFIL_NAO_SUPORTADO");
  }
});
it("não gera resultado parcial quando rótulo ou limites são incompatíveis", async () => {
  await expect(
    redactPreservingWithPdfium(api, new Uint8Array(21 * 1024 * 1024), { redactions: [area] }),
  ).rejects.toThrow("PDF_OCULTACAO_PRESERVACAO_LIMITE");
  await expect(
    redactPreservingWithPdfium(api, await source(), { redactions: [{ ...area, label: "🔒" }] }),
  ).rejects.toThrow("PDF_OCULTACAO_ROTULO_NAO_SUPORTADO");
  await expect(
    redactPreservingWithPdfium(api, await source(), { redactions: Array(201).fill(area) }),
  ).rejects.toThrow("PDF_OCULTACAO_PRESERVACAO_LIMITE");
});
it("recusa retângulos de anotação invertidos em vez de contornar a detecção de interseção", async () => {
  const d = await PDFDocument.load(await source());
  d.getPage(0).node.addAnnot(
    d.context.register(
      d.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [300, 530, 50, 480],
        A: { S: "URI", URI: PDFString.of("https://example.com") },
      }),
    ),
  );
  await expect(
    redactPreservingWithPdfium(api, await d.save(), { redactions: [area] }),
  ).rejects.toThrow("PDF_OCULTACAO_PERFIL_NAO_SUPORTADO");
});
it("preserva texto fora da região mesmo quando está no mesmo objeto textual", async () => {
  const d = await PDFDocument.create(),
    p = d.addPage([500, 700]);
  p.drawText("SIGILOSO PUBLICO_MESMA_LINHA", { x: 70, y: 500, size: 18 });
  const out = await redactPreservingWithPdfium(api, await d.save(), {
    redactions: [{ ...area, xPercent: 13, yPercent: 25, widthPercent: 19, heightPercent: 6 }],
  });
  const text = (await inspect(out)).items.map((i) => i.str).join(" ");
  expect(text).not.toContain("SIGILOSO");
  expect(text).toContain("PUBLICO_MESMA_LINHA");
});
it("remove também texto invisível dentro da região selecionada", async () => {
  const d = await PDFDocument.load(await source()),
    p = d.getPage(0),
    content = p.node.Contents();
  if (!(content instanceof PDFArray)) throw new Error("fixture");
  const stream = d.context.lookup(content.get(0));
  if (!(stream instanceof PDFRawStream)) throw new Error("fixture");
  const raw = decodePDFRawStream(stream).decode();
  p.node.set(
    PDFName.of("Contents"),
    d.context.obj([
      d.context.register(
        d.context.flateStream(Buffer.concat([Buffer.from("3 Tr\n"), Buffer.from(raw)])),
      ),
    ]),
  );
  const out = await redactPreservingWithPdfium(api, await d.save(), { redactions: [area] });
  expect((await inspect(out)).items.map((i) => i.str).join(" ")).not.toContain("SEGREDO_UNICO");
  for (const s of await streams(out))
    expect(s.toString().toUpperCase()).not.toContain(
      Buffer.from("SEGREDO_UNICO").toString("hex").toUpperCase(),
    );
});
it("preserva fundo vetorial externo quando a tarja cobre apenas parte do caminho", async () => {
  const d = await PDFDocument.create(),
    p = d.addPage([500, 700]);
  p.drawRectangle({ x: 0, y: 0, width: 500, height: 700, color: rgb(0.2, 0.4, 0.8) });
  p.drawText("SEGREDO_UNICO", { x: 70, y: 500, size: 18 });
  const out = await redactPreservingWithPdfium(api, await d.save(), { redactions: [area] });
  const task = pdfjs.getDocument({ data: out.slice() });
  try {
    const doc = await task.promise,
      page = await doc.getPage(1),
      viewport = page.getViewport({ scale: 1 });
    const factory = doc.canvasFactory as {
      create(
        w: number,
        h: number,
      ): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
      destroy(pair: unknown): void;
    };
    const target = factory.create(viewport.width, viewport.height);
    try {
      await page.render({ canvas: target.canvas, canvasContext: target.context, viewport }).promise;
      expect([...target.context.getImageData(450, 650, 1, 1).data]).toEqual([51, 102, 204, 255]);
    } finally {
      factory.destroy(target);
    }
  } finally {
    await task.destroy();
  }
});
it.each(["MK", "AP"])("recusa dados privados aninhados em link: %s", async (kind) => {
  const d = await PDFDocument.load(await source());
  const extra =
    kind === "MK"
      ? { MK: { PrivateBackup: PDFString.of("SEGREDO_UNICO") } }
      : {
          AP: {
            N: d.context.register(
              d.context.flateStream("", {
                Type: "XObject",
                Subtype: "Form",
                BBox: [0, 0, 100, 20],
                PrivateBackup: PDFString.of("SEGREDO_UNICO"),
              }),
            ),
          },
        };
  d.getPage(0).node.addAnnot(
    d.context.register(
      d.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: [50, 100, 150, 120],
        A: { S: "URI", URI: PDFString.of("https://example.com") },
        ...extra,
      }),
    ),
  );
  await expect(
    redactPreservingWithPdfium(api, await d.save(), { redactions: [area] }),
  ).rejects.toThrow("PDF_OCULTACAO_PERFIL_NAO_SUPORTADO");
});
it("elimina recurso não usado em aparência preservada de campo externo", async () => {
  const d = await PDFDocument.load(await source()),
    p = d.getPage(0),
    f = d.getForm().createTextField("publico");
  f.setText("PUBLICO");
  f.addToPage(p, { x: 50, y: 100, width: 200, height: 25 });
  await d.flush();
  const ap = f.acroField.getWidgets()[0].dict.lookup(PDFName.of("AP"), PDFDict),
    normal = ap.lookup(PDFName.of("N"));
  if (!(normal instanceof PDFRawStream) && !(normal instanceof PDFContentStream))
    throw new Error("fixture");
  const unused = d.context.register(
    d.context.flateStream("BT /F1 18 Tf 10 10 Td (SEGREDO_UNICO) Tj ET", {
      Type: "XObject",
      Subtype: "Form",
      BBox: [0, 0, 300, 50],
      Resources: { Font: { F1: { Type: "Font", Subtype: "Type1", BaseFont: "Helvetica" } } },
    }),
  );
  normal.dict
    .lookup(PDFName.of("Resources"), PDFDict)
    .set(PDFName.of("XObject"), d.context.obj({ Fm1: unused }));
  const out = await redactPreservingWithPdfium(
    api,
    await d.save({ updateFieldAppearances: false }),
    { redactions: [area] },
  );
  expect((await PDFDocument.load(out)).getForm().getTextField("publico").getText()).toBe("PUBLICO");
  for (const stream of await streams(out)) {
    expect(stream.toString()).not.toContain("SEGREDO_UNICO");
    expect(stream.toString().toUpperCase()).not.toContain(
      Buffer.from("SEGREDO_UNICO").toString("hex").toUpperCase(),
    );
  }
});
it.each(["MediaBox", "CropBox"])(
  "recusa caixa %s invertida antes de calcular áreas",
  async (box) => {
    const d = await PDFDocument.load(await source());
    d.getPage(0).node.set(PDFName.of(box), d.context.obj([500, 700, 0, 0]));
    const input = await d.save(),
      task = pdfjs.getDocument({ data: input.slice() });
    try {
      const doc = await task.promise;
      expect(
        (await (await doc.getPage(1)).getTextContent()).items.some(
          (i) => "str" in i && i.str === "SEGREDO_UNICO",
        ),
      ).toBe(true);
    } finally {
      await task.destroy();
    }
    await expect(redactPreservingWithPdfium(api, input, { redactions: [area] })).rejects.toThrow(
      "PDF_OCULTACAO_PERFIL_NAO_SUPORTADO",
    );
  },
);
it("não aceita referência Do em string como prova de uso de recurso privado", async () => {
  const d = await PDFDocument.load(await source()),
    p = d.addPage([500, 700]);
  p.drawText("(/Fm1 Do)", { x: 50, y: 500 });
  const unused = d.context.register(
    d.context.flateStream("BT /F1 18 Tf 10 10 Td (SEGREDO_UNICO) Tj ET", {
      Type: "XObject",
      Subtype: "Form",
      BBox: [0, 0, 300, 50],
      Resources: { Font: { F1: { Type: "Font", Subtype: "Type1", BaseFont: "Helvetica" } } },
    }),
  );
  p.node.Resources()?.set(PDFName.of("XObject"), d.context.obj({ Fm1: unused }));
  const out = await redactPreservingWithPdfium(api, await d.save(), { redactions: [area] });
  for (const stream of await streams(out)) {
    expect(stream.toString()).not.toContain("SEGREDO_UNICO");
    expect(stream.toString().toUpperCase()).not.toContain(
      Buffer.from("SEGREDO_UNICO").toString("hex").toUpperCase(),
    );
  }
});
it("poda recursos por página sem apagar recursos compartilhados usados por outra página", async () => {
  const donor = await PDFDocument.create();
  donor.addPage([300, 100]).drawText("PUBLICO_PRIMEIRA", { x: 10, y: 50, size: 12 });
  donor.addPage([300, 100]).drawText("MANTER_SEGUNDA", { x: 10, y: 50, size: 12 });
  const d = await PDFDocument.load(await source()),
    [first, second] = await d.embedPdf(await donor.save(), [0, 1]),
    p1 = d.getPage(0),
    p2 = d.addPage([500, 700]);
  p1.drawPage(first, { x: 50, y: 100, width: 300, height: 100 });
  p2.drawPage(second, { x: 50, y: 100, width: 300, height: 100 });
  await d.flush();
  const shared = p1.node.Resources();
  if (!shared) throw new Error("fixture");
  const objects = d.context.obj({});
  for (const page of [p1, p2])
    for (const [name, ref] of page.node
      .Resources()
      ?.lookup(PDFName.of("XObject"), PDFDict)
      .entries() ?? [])
      objects.set(name, ref);
  shared.set(PDFName.of("XObject"), objects);
  p1.node.set(PDFName.of("Resources"), shared);
  p2.node.set(PDFName.of("Resources"), shared);
  const out = await redactPreservingWithPdfium(api, await d.save(), { redactions: [area] });
  expect((await inspect(out)).items.map((i) => i.str).join(" ")).toContain("PUBLICO_PRIMEIRA");
  const task = pdfjs.getDocument({ data: out.slice() });
  try {
    const doc = await task.promise;
    expect(
      (await (await doc.getPage(2)).getTextContent()).items
        .flatMap((i) => ("str" in i ? [i.str] : []))
        .join(" "),
    ).toContain("MANTER_SEGUNDA");
  } finally {
    await task.destroy();
  }
});
it.each(["Border", "ProcSet", "FirstChar", "Parent", "DA"])(
  "recusa grafo privado escondido em posição tipada: %s",
  async (kind) => {
    const d = await PDFDocument.load(await source()),
      p = d.getPage(0),
      backup = d.context.obj({ PrivateBackup: PDFString.of("SEGREDO_UNICO") });
    if (kind === "Border")
      p.node.addAnnot(
        d.context.register(
          d.context.obj({
            Type: "Annot",
            Subtype: "Link",
            Rect: [50, 100, 150, 120],
            Border: backup,
            A: { S: "URI", URI: PDFString.of("https://example.com") },
          }),
        ),
      );
    if (kind === "ProcSet") p.node.Resources()?.set(PDFName.of("ProcSet"), backup);
    if (kind === "FirstChar") {
      const fonts = p.node.Resources()?.lookup(PDFName.of("Font"), PDFDict);
      if (!fonts) throw new Error("fixture");
      d.context.lookup(fonts.values()[0], PDFDict).set(PDFName.of("FirstChar"), backup);
    }
    if (kind === "Parent") {
      const f = d.getForm().createTextField("publico");
      f.setText("PUBLICO");
      f.addToPage(p, { x: 50, y: 100, width: 200, height: 25 });
      f.acroField.getWidgets()[0].dict.set(PDFName.of("Parent"), d.context.register(backup));
    }
    if (kind === "DA") {
      const f = d.getForm().createTextField("publico");
      f.setText("PUBLICO");
      f.addToPage(p, { x: 50, y: 100, width: 200, height: 25 });
      d.catalog
        .lookup(PDFName.of("AcroForm"), PDFDict)
        .set(PDFName.of("DA"), PDFString.of("(SEGREDO_UNICO) pop"));
    }
    await expect(
      redactPreservingWithPdfium(api, await d.save({ updateFieldAppearances: false }), {
        redactions: [area],
      }),
    ).rejects.toThrow("PDF_OCULTACAO_PERFIL_NAO_SUPORTADO");
  },
);
