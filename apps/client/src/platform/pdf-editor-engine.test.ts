// @vitest-environment node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { init } from "@embedpdf/pdfium";
import {
  clip,
  concatTransformationMatrix,
  decodePDFRawStream,
  degrees,
  endPath,
  PDFDocument,
  PDFName,
  PDFRawStream,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
} from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { beforeAll, expect, it } from "vitest";
import { PdfEditorEngine } from "./pdf-editor-engine";
import { commitEditorSnapshot, editorHistory, redoEditor, undoEditor } from "./pdf-editor-state";
import { verifyEditorText } from "./pdf-editor-verify";

let engine: PdfEditorEngine;

it("confere proveniência das fixtures e incorporação integral da fonte licenciada", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("./__fixtures__/pdf-editor/corpus.json", import.meta.url), "utf8"),
  ) as {
    font: { sha256: string };
    fixtures: { file: string; sha256: string }[];
  };
  const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
  for (const fixture of manifest.fixtures) {
    const data = await readFile(
      new URL(`./__fixtures__/pdf-editor/${fixture.file}`, import.meta.url),
    );
    expect(hash(data)).toBe(fixture.sha256);
  }
  const pdf = await PDFDocument.load(
    await readFile(new URL("./__fixtures__/pdf-editor/embedded-full.pdf", import.meta.url)),
  );
  const embedded = pdf.context
    .enumerateIndirectObjects()
    .map(([, object]) => object)
    .filter(
      (object): object is PDFRawStream =>
        object instanceof PDFRawStream && object.dict.has(PDFName.of("Length1")),
    );
  expect(embedded.map((stream) => hash(decodePDFRawStream(stream).decode()))).toContain(
    manifest.font.sha256,
  );
});
beforeAll(async () => {
  const wasmBinary = await readFile(
    new URL("../../node_modules/@embedpdf/pdfium/dist/pdfium.wasm", import.meta.url),
  );
  const api = await init({ wasmBinary });
  api.PDFiumExt_Init();
  engine = new PdfEditorEngine(api);
});

it("informa o motivo da recusa de texto inclinado antes de editar", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([500, 700]).drawText("Texto inclinado", {
    x: 70,
    y: 300,
    size: 18,
    rotate: degrees(15),
  });
  const initial = engine.revise(await pdf.save(), { replacements: [], elements: [] }, 0);
  expect(initial.pages[0].texts[0]).toMatchObject({
    editable: false,
    editRestriction: "transform",
  });
});

it("recusa texto com recorte interno que poderia esconder a substituição", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([500, 700]);
  page.pushOperators(pushGraphicsState(), rectangle(70, 490, 40, 40), clip(), endPath());
  page.drawText("Texto recortado", { x: 70, y: 500, size: 18 });
  page.pushOperators(popGraphicsState());
  const bytes = await pdf.save();
  const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  expect(initial.pages[0].texts[0]).toMatchObject({ editable: false, editRestriction: "clip" });
  expect(() =>
    engine.revise(bytes, { replacements: [{ id: "0:0", text: "Novo" }], elements: [] }, 0),
  ).toThrow("EDITOR_OBJETO");
});

it("expõe apenas o repertório observado para fonte incorporada", async () => {
  const bytes = new Uint8Array(
    await readFile(new URL("./__fixtures__/pdf-editor/embedded-subset.pdf", import.meta.url)),
  );
  const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  const object = initial.pages[0].texts[0];
  expect(object.fontPolicy).toBe("observed");
  expect(object.supportedCharacters).toContain("ç");
  expect(object.supportedCharacters).not.toContain("ñ");
});

it("fonte completa preserva coluna, formulário, pixels não editados e original", async () => {
  const bytes = new Uint8Array(
    await readFile(new URL("./__fixtures__/pdf-editor/embedded-full.pdf", import.meta.url)),
  );
  const original = bytes.slice();
  const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  const object = initial.pages[0].texts.find((o) => o.text.trim() === "Ação útil original");
  if (!object) throw new Error("Fixture sem objeto principal");
  const snapshot = { replacements: [{ id: object.id, text: "Ação útil" }], elements: [] };
  const result = engine.revise(bytes, snapshot, 0);
  await verifyEditorText(result.bytes, snapshot, initial.pages);
  expect(await text(result.bytes)).toContain("Coluna preservada");
  expect(await text(result.bytes)).not.toContain("Ação útil original");
  expect(
    (await PDFDocument.load(result.bytes)).getForm().getTextField("campo-preservado").getText(),
  ).toBe("Valor mantido");
  expect(bytes).toEqual(original);
  const before = initial.preview,
    after = result.preview;
  expect([after.width, after.height]).toEqual([before.width, before.height]);
  let changedOutside = 0;
  for (let y = 0; y < before.height; y++)
    for (let x = 0; x < before.width; x++) {
      if (
        x >= object.x * before.width - 5 &&
        x <= (object.x + object.width) * before.width + 5 &&
        y >= object.y * before.height - 5 &&
        y <= (object.y + object.height) * before.height + 5
      )
        continue;
      const offset = (y * before.width + x) * 4;
      if (
        before.data
          .subarray(offset, offset + 4)
          .some((value, i) => value !== after.data[offset + i])
      )
        changedOutside++;
    }
  expect(changedOutside).toBe(0);
  expect(() =>
    engine.revise(bytes, { replacements: [{ id: object.id, text: "ñ" }], elements: [] }, 0),
  ).toThrow("EDITOR_GLIFO");
});

it("identifica transparência e ligadura que exigem preservação conservadora", async () => {
  const bytes = new Uint8Array(
    await readFile(new URL("./__fixtures__/pdf-editor/embedded-full.pdf", import.meta.url)),
  );
  const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  const alpha = initial.pages[0].texts.find((o) => o.text.includes("Transparência"));
  expect(alpha).toMatchObject({
    editable: true,
    canChangeStyle: false,
    styleRestriction: "transparency",
  });
  expect(initial.pages[0].texts.find((o) => o.text.includes("of"))).toMatchObject({
    editable: false,
    editRestriction: "textMapping",
  });
});

it("fonte incorporada mantém campo, regiões e prévia exportada na exclusão e no histórico", async () => {
  const bytes = new Uint8Array(
    await readFile(new URL("./__fixtures__/pdf-editor/embedded-full.pdf", import.meta.url)),
  );
  const original = bytes.slice();
  const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  const object = initial.pages[0].texts.find((item) => item.text.trim() === "Ação útil original");
  if (!object) throw new Error("Fixture sem texto");
  const edited = commitEditorSnapshot(editorHistory(), {
    replacements: [{ id: object.id, text: "Ação útil" }],
    elements: [],
  });
  const deleted = commitEditorSnapshot(edited, {
    replacements: [{ id: object.id, text: "" }],
    elements: [],
  });
  const undone = undoEditor(deleted);
  const redone = redoEditor(undone);
  for (const [history, expected] of [
    [edited, "Ação útil"],
    [deleted, ""],
    [undone, "Ação útil"],
    [redone, ""],
  ] as const) {
    const revision = engine.revise(bytes, history.present, 0);
    const reopened = engine.revise(revision.bytes, { replacements: [], elements: [] }, 0);
    const isolated = engine.renderRevisionPage(revision.bytes, 0);
    expect(isolated.data.length).toBe(revision.preview.data.length);
    expect(isolated.data.every((value, i) => value === revision.preview.data[i])).toBe(true);
    expect(reopened.preview.data.length).toBe(revision.preview.data.length);
    expect(reopened.preview.data.every((value, i) => value === revision.preview.data[i])).toBe(
      true,
    );
    const extracted = await text(revision.bytes);
    expect(extracted).toContain("Coluna preservada");
    expect(extracted.includes("Ação útil")).toBe(!!expected);
    expect(
      (await PDFDocument.load(revision.bytes)).getForm().getTextField("campo-preservado").getText(),
    ).toBe("Valor mantido");
    let changedOutside = 0;
    const { width, height, data } = initial.preview;
    for (let offset = 0; offset < data.length; offset += 4) {
      const x = (offset / 4) % width,
        y = Math.floor(offset / 4 / width);
      if (
        x >= object.x * width - 5 &&
        x <= (object.x + object.width) * width + 5 &&
        y >= object.y * height - 5 &&
        y <= (object.y + object.height) * height + 5
      )
        continue;
      if (
        data
          .subarray(offset, offset + 4)
          .some((value, channel) => value !== revision.preview.data[offset + channel])
      )
        changedOutside++;
    }
    expect(changedOutside).toBe(0);
  }
  expect(bytes).toEqual(original);
});
async function source(rotation = 0, crop = false) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([500, 700]);
  page.drawText("Contrato original", { x: 70, y: 500, size: 18 });
  page.drawText("Conteudo preservado", { x: 70, y: 400, size: 14 });
  page.setRotation(degrees(rotation));
  if (crop) page.setCropBox(25, 40, 450, 600);
  pdf.addPage([300, 400]).drawText("Outra pagina");
  return pdf.save();
}
async function text(bytes: Uint8Array, page = 1) {
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    return (await (await (await task.promise).getPage(page)).getTextContent()).items
      .map((i) => ("str" in i ? i.str : ""))
      .join(" ");
  } finally {
    await task.destroy();
  }
}

it.each([0, 90, 180, 270])(
  "renderização isolada respeita CropBox e rotação %s sem alterar a revisão",
  async (rotation) => {
    const bytes = await source(rotation, true);
    const revision = engine.revise(bytes, { replacements: [], elements: [] }, 0);
    const original = revision.bytes.slice();
    const preview = engine.renderRevisionPage(revision.bytes, 0);
    expect([preview.width, preview.height]).toEqual([
      revision.preview.width,
      revision.preview.height,
    ]);
    expect(preview.data.every((value, i) => value === revision.preview.data[i])).toBe(true);
    expect(revision.bytes).toEqual(original);
  },
);
it("substitui objeto textual de verdade, preserva originais e outros conteúdos", async () => {
  const bytes = await source();
  const copy = bytes.slice();
  const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  const object = initial.pages[0].texts.find((t) => t.text === "Contrato original");
  expect(object).toBeDefined();
  if (!object) throw new Error("Fixture sem texto");
  const result = engine.revise(
    bytes,
    {
      replacements: [{ id: object.id, text: "Ação revisada", fallbackFont: "Helvetica" }],
      elements: [],
    },
    0,
  );
  expect(await text(result.bytes)).toContain("Ação revisada");
  expect(await text(result.bytes)).not.toContain("Contrato original");
  expect(await text(result.bytes)).toContain("Conteudo preservado");
  expect(await text(result.bytes, 2)).toContain("Outra pagina");
  expect(bytes).toEqual(copy);
});
it.each([0, 90, 180, 270])(
  "mantém crop e rotação %s e coordenadas normalizadas",
  async (rotation) => {
    const bytes = await source(rotation, true);
    const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
    const object = initial.pages[0].texts[0];
    expect(object.x).toBeGreaterThanOrEqual(0);
    expect(object.y).toBeGreaterThanOrEqual(0);
    expect(object.x + object.width).toBeLessThanOrEqual(1);
    const result = engine.revise(
      bytes,
      { replacements: [{ id: object.id, text: "Novo", fallbackFont: "Helvetica" }], elements: [] },
      0,
    );
    const pdf = await PDFDocument.load(result.bytes);
    expect(pdf.getPage(0).getRotation().angle).toBe(rotation);
    expect(pdf.getPage(0).getCropBox()).toEqual({ x: 25, y: 40, width: 450, height: 600 });
    expect(await text(result.bytes)).toContain("Novo");
  },
);
it("adiciona texto com acentos, formas e linhas sem rasterizar o documento", async () => {
  const result = engine.revise(
    await source(),
    {
      replacements: [],
      elements: [
        {
          id: "t",
          page: 0,
          kind: "text",
          x: 0.1,
          y: 0.8,
          width: 0.7,
          height: 0.1,
          text: "Edição útil",
          font: "Helvetica",
          fontSize: 18,
          color: "#123456",
          align: "left",
        },
        {
          id: "r",
          page: 0,
          kind: "rect",
          x: 0.1,
          y: 0.6,
          width: 0.2,
          height: 0.1,
          color: "#ff0000",
          strokeWidth: 2,
        },
        {
          id: "l",
          page: 0,
          kind: "line",
          x: 0.2,
          y: 0.7,
          width: 0.3,
          height: 0.01,
          color: "#000000",
          strokeWidth: 2,
        },
      ],
    },
    0,
  );
  expect(await text(result.bytes)).toContain("Edição útil");
  expect(await text(result.bytes)).toContain("Contrato original");
  expect(result.preview.data.length).toBe(result.preview.width * result.preview.height * 4);
});
it("recusa excesso de texto na caixa e caracteres sem suporte sem exportar silenciosamente", async () => {
  const bytes = await source();
  const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  expect(() =>
    engine.revise(
      bytes,
      { replacements: [{ id: initial.pages[0].texts[0].id, text: "W".repeat(200) }], elements: [] },
      0,
    ),
  ).toThrow(/TEXTO_NAO_CABE/);
  expect(() =>
    engine.revise(
      bytes,
      {
        replacements: [
          { id: initial.pages[0].texts[0].id, text: "你好", fallbackFont: "Helvetica" },
        ],
        elements: [],
      },
      0,
    ),
  ).toThrow(/GLIFO/);
});
it("recusa PDF inválido, comandos fora da página e limites", async () => {
  expect(() =>
    engine.revise(new Uint8Array([1, 2]), { replacements: [], elements: [] }, 0),
  ).toThrow(/PDF_INVALIDO/);
  expect(() =>
    engine.revise(new Uint8Array(21 * 1024 * 1024), { replacements: [], elements: [] }, 0),
  ).toThrow(/LIMITE/);
  expect(() => engine.revise(new Uint8Array(), { replacements: [], elements: [] }, 0)).toThrow();
});
it("preserva fonte incorporada em subconjunto e altera texto com acentos", async () => {
  const bytes = new Uint8Array(
    await readFile(new URL("./__fixtures__/pdf-editor/embedded-subset.pdf", import.meta.url)),
  );
  const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  const object = initial.pages[0].texts.find((o) => o.text.includes("Texto original"));
  expect(object?.fontName).toContain("Liberation");
  if (!object) throw new Error("Fixture sem texto");
  const result = engine.revise(
    bytes,
    { replacements: [{ id: object.id, text: "ação original" }], elements: [] },
    0,
  );
  expect(await text(result.bytes)).toContain("ação original");
  expect(await text(result.bytes)).not.toContain("Texto original com ação");
  expect(await text(result.bytes)).toContain("Conteúdo preservado");
});
it("reduz tamanho da fonte para acomodar alteração e exclui texto original de verdade", async () => {
  const bytes = await source(),
    initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  const id = initial.pages[0].texts[0].id;
  const smaller = engine.revise(
    bytes,
    { replacements: [{ id, text: "Contrato mais longo revisado", fontSize: 8 }], elements: [] },
    0,
  );
  expect(await text(smaller.bytes)).toContain("Contrato mais longo revisado");
  const removed = engine.revise(bytes, { replacements: [{ id, text: "" }], elements: [] }, 0);
  expect(await text(removed.bytes)).not.toContain("Contrato original");
  expect(await text(removed.bytes)).toContain("Conteudo preservado");
});
it("limita o orçamento total de imagens antes de reservar memória de pixels", async () => {
  const image = { width: 3000, height: 2500, data: new Uint8Array(0) };
  const element = {
    id: "a",
    kind: "image" as const,
    page: 0,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.2,
    color: "#000000",
    image,
  };
  expect(() =>
    engine.revise(
      new Uint8Array([1]),
      { replacements: [], elements: [element, { ...element, id: "b" }] },
      0,
    ),
  ).toThrow("EDITOR_LIMITE");
});
it.each([0, 90, 180, 270])(
  "texto novo usa coordenadas da área visível com crop e rotação %s",
  async (rotation) => {
    const bytes = await source(rotation, true);
    const result = engine.revise(
      bytes,
      {
        replacements: [],
        elements: [
          {
            id: "novo",
            page: 0,
            kind: "text",
            x: 0.2,
            y: 0.5,
            width: 0.6,
            height: 0.2,
            text: "Novo",
            font: "Helvetica",
            fontSize: 18,
            color: "#000000",
          },
        ],
      },
      0,
    );
    const task = pdfjs.getDocument({ data: result.bytes.slice(), useSystemFonts: true });
    try {
      const page = await (await task.promise).getPage(1),
        viewport = page.getViewport({ scale: 1 });
      const item = (await page.getTextContent()).items.find((i) => "str" in i && i.str === "Novo");
      if (!item || !("str" in item)) throw new Error("Texto novo ausente");
      const point = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      // A origem textual é a baseline; a caixa visual desconta o bearing do glifo.
      expect(Math.abs(point[0] - viewport.width * 0.2)).toBeLessThan(2);
      expect(point[1]).toBeCloseTo(viewport.height * 0.5 + 18, 0);
    } finally {
      await task.destroy();
    }
  },
);
it("prévia e exportação preservam aparência e valor de campos de formulário", async () => {
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([400, 500]);
  const field = pdf.getForm().createTextField("nome");
  field.setText("Nome preenchido");
  field.addToPage(page, { x: 50, y: 300, width: 250, height: 40 });
  const result = engine.revise(await pdf.save(), { replacements: [], elements: [] }, 0);
  const reopened = await PDFDocument.load(result.bytes);
  expect(reopened.getForm().getTextField("nome").getText()).toBe("Nome preenchido");
  const { data, width, height } = result.preview;
  let ink = 0;
  for (let y = Math.ceil(height * 0.33); y < height * 0.38; y++)
    for (let x = Math.ceil(width * 0.16); x < width * 0.7; x++) {
      const p = (y * width + x) * 4;
      if (data[p] < 180 && data[p + 1] < 180 && data[p + 2] < 180) ink++;
    }
  expect(ink).toBeGreaterThan(100);
});
it("recusa PDF que exige senha antes de produzir uma revisão", async () => {
  const bytes = new Uint8Array(
    await readFile(new URL("./__fixtures__/pdf-unlock/AES-256.pdf", import.meta.url)),
  );
  expect(() => engine.revise(bytes, { replacements: [], elements: [] }, 0)).toThrow("EDITOR_SENHA");
});

it("edita texto cujo tamanho visual vem da matriz e não do tamanho nominal da fonte", async () => {
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([500, 700]);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(18, 0, 0, 18, 0, 0));
  page.drawText("Contrato original", { x: 4, y: 28, size: 1 });
  page.pushOperators(popGraphicsState());
  const bytes = await pdf.save(),
    initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  expect(initial.pages[0].texts[0].fontSize).toBeCloseTo(18, 1);
  const changed = engine.revise(
    bytes,
    { replacements: [{ id: initial.pages[0].texts[0].id, text: "Contrato novo" }], elements: [] },
    0,
  );
  expect(await text(changed.bytes)).toContain("Contrato novo");
});
it.each(["你好", "Ω", "Ж", "🙂", "ñ"])(
  "recusa glifo sem representação segura na fonte existente: %s",
  async (unsupported) => {
    const bytes = new Uint8Array(
      await readFile(new URL("./__fixtures__/pdf-editor/embedded-subset.pdf", import.meta.url)),
    );
    const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
    expect(() =>
      engine.revise(
        bytes,
        { replacements: [{ id: initial.pages[0].texts[0].id, text: unsupported }], elements: [] },
        0,
      ),
    ).toThrow("EDITOR_GLIFO");
  },
);
it("excluir objeto anterior não invalida a substituição com fonte alternativa do seguinte", async () => {
  const bytes = await source(),
    initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  const result = engine.revise(
    bytes,
    {
      replacements: [
        { id: initial.pages[0].texts[0].id, text: "" },
        { id: initial.pages[0].texts[1].id, text: "Novo", fallbackFont: "Helvetica" },
      ],
      elements: [],
    },
    0,
  );
  expect(await text(result.bytes)).toContain("Novo");
  expect(await text(result.bytes)).not.toContain("Contrato original");
});
it("texto novo aceita espaços no início e entre palavras", async () => {
  const result = engine.revise(
    await source(),
    {
      replacements: [],
      elements: [
        {
          id: "texto",
          page: 0,
          kind: "text",
          x: 0.1,
          y: 0.6,
          width: 0.8,
          height: 0.2,
          text: "  Ação  útil  ",
          color: "#000000",
          font: "Helvetica",
          fontSize: 18,
        },
      ],
    },
    0,
  );
  expect(await text(result.bytes)).toMatch(/Ação\s+útil/);
});
it("tamanho da fonte permanece preciso em páginas grandes sem quantizar vetores unitários", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([14400, 14400]);
  const result = engine.revise(
    await pdf.save(),
    {
      replacements: [],
      elements: [
        {
          id: "texto",
          page: 0,
          kind: "text",
          x: 0.1,
          y: 0.2,
          width: 0.5,
          height: 0.1,
          text: "Preciso",
          fontSize: 18,
          font: "Helvetica",
          color: "#000000",
        },
      ],
    },
    0,
  );
  const task = pdfjs.getDocument({ data: result.bytes.slice(), useSystemFonts: true });
  try {
    const item = (await (await (await task.promise).getPage(1)).getTextContent()).items.find(
      (i) => "str" in i && i.str === "Preciso",
    );
    if (!item || !("str" in item)) throw new Error("Texto ausente");
    expect(Math.hypot(item.transform[0], item.transform[1])).toBeCloseTo(18, 2);
  } finally {
    await task.destroy();
  }
});
it("recusa recriar texto transparente e preserva opacidade ao substituir no próprio objeto", async () => {
  const pdf = await PDFDocument.create(),
    page = pdf.addPage([500, 700]);
  page.drawText("Texto original", { x: 70, y: 500, size: 18, opacity: 0.2 });
  const bytes = await pdf.save(),
    initial = engine.revise(bytes, { replacements: [], elements: [] }, 0),
    id = initial.pages[0].texts[0].id;
  expect(() =>
    engine.revise(bytes, { replacements: [{ id, text: "Novo", fontSize: 17 }], elements: [] }, 0),
  ).toThrow("EDITOR_OBJETO");
  const result = engine.revise(bytes, { replacements: [{ id, text: "Novo" }], elements: [] }, 0);
  const reds = result.preview.data.filter((_, i) => i % 4 === 0);
  expect(Math.min(...reds.subarray(0, 100))).toBe(255);
  let darkest = 255;
  for (let i = 0; i < result.preview.data.length; i += 4)
    darkest = Math.min(darkest, result.preview.data[i]);
  expect(darkest).toBeGreaterThanOrEqual(200);
  expect(darkest).toBeLessThan(240);
});
