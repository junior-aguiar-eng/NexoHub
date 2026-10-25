// @vitest-environment node
import { PDFDocument } from "pdf-lib";
import { expect, it } from "vitest";
import { verifyEditorText } from "./pdf-editor-verify";

async function pdf(text: string, x = 50) {
  const doc = await PDFDocument.create();
  doc.addPage([500, 700]).drawText(text, { x, y: 500, size: 18 });
  return doc.save();
}
const pages = [
  {
    width: 500,
    height: 700,
    texts: [
      {
        id: "0:0",
        text: "Novo",
        x: 0.1,
        y: 0.25,
        width: 0.4,
        height: 0.08,
        fontName: "Helvetica",
        fontSize: 18,
        color: "#000000",
        editable: true,
      },
    ],
  },
];
it("confere a substituição nos bytes exportados com leitor independente", async () => {
  await expect(
    verifyEditorText(
      await pdf("Novo"),
      { replacements: [{ id: "0:0", text: "Novo" }], elements: [] },
      pages,
    ),
  ).resolves.toBeUndefined();
});
it("recusa conteúdo serializado diferente do solicitado", async () => {
  await expect(
    verifyEditorText(
      await pdf("ÿ"),
      { replacements: [{ id: "0:0", text: "Ω" }], elements: [] },
      pages,
    ),
  ).rejects.toThrow("EDITOR_GLIFO");
});
it("correspondência fora da área editada não valida a alteração", async () => {
  await expect(
    verifyEditorText(
      await pdf("Novo", 400),
      { replacements: [{ id: "0:0", text: "Novo" }], elements: [] },
      pages,
    ),
  ).rejects.toThrow("EDITOR_GLIFO");
});

it("não aceita o texto solicitado como substring de um conteúdo diferente", async () => {
  await expect(
    verifyEditorText(
      await pdf("Novo indevido"),
      {
        replacements: [{ id: "0:0", text: "Novo" }],
        elements: [],
      },
      pages,
    ),
  ).rejects.toThrow("EDITOR_GLIFO");
});

it("aceita o item correto mesmo com outro objeto na mesma região", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 700]);
  page.drawText("Novo", { x: 50, y: 500, size: 18 });
  page.drawText("Outro", { x: 50, y: 480, size: 18 });
  await expect(
    verifyEditorText(
      await doc.save(),
      {
        replacements: [{ id: "0:0", text: "Novo" }],
        elements: [],
      },
      pages,
    ),
  ).resolves.toBeUndefined();
});

it.each([
  ["Novo", true],
  ["Novo indevido", false],
] as const)(
  "confere objetos contíguos agregados sem aceitar conteúdo extra: %s",
  async (actual, valid) => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont("Helvetica");
    const offset = font.widthOfTextAtSize("Casa", 18);
    const page = doc.addPage([500, 700]);
    page.drawText(actual, { x: 50, y: 500, size: 18, font });
    page.drawText(" vizinho", { x: 50 + offset, y: 500, size: 18, font });
    const objects = [
      {
        ...pages[0],
        texts: [
          { ...pages[0].texts[0], text: "Casa", width: offset / 500 },
          {
            ...pages[0].texts[0],
            id: "0:1",
            text: " vizinho",
            x: (50 + offset) / 500,
            width: font.widthOfTextAtSize(" vizinho", 18) / 500,
          },
        ],
      },
    ];
    const result = verifyEditorText(
      await doc.save(),
      {
        replacements: [{ id: "0:0", text: "Novo" }],
        elements: [],
      },
      objects,
    );
    if (valid) await expect(result).resolves.toBeUndefined();
    else await expect(result).rejects.toThrow("EDITOR_GLIFO");
  },
);
