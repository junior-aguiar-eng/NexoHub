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
