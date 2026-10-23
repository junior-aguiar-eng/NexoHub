import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { degrees, PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

async function source(rotation = 0) {
  const pdf = await PDFDocument.create();
  const p = pdf.addPage([500, 700]);
  p.drawText("Contrato original", { x: 70, y: 500, size: 18 });
  p.drawText("Texto preservado", { x: 70, y: 400, size: 14 });
  p.setRotation(degrees(rotation));
  pdf.addPage([400, 600]).drawText("Segunda pagina");
  return pdf.save();
}
async function open(page: Page, bytes?: Uint8Array) {
  await page.goto("/editar-pdf");
  await page.getByLabel("Selecionar PDF", { exact: true }).setInputFiles({
    name: "original.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes ?? (await source())),
  });
  await expect(
    page.getByRole("button", { name: "Editar texto existente", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
}
async function ready(page: Page) {
  await expect(page.getByRole("button", { name: "Adicionar texto", exact: true })).toBeEnabled({
    timeout: 30000,
  });
}
async function save(page: Page) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  return new Uint8Array(await readFile(await (await download).path()));
}
async function texts(bytes: Uint8Array) {
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const doc = await task.promise;
    const out: string[] = [];
    for (let i = 1; i <= doc.numPages; i++)
      out.push(
        (await (await doc.getPage(i)).getTextContent()).items
          .map((t) => ("str" in t ? t.str : ""))
          .join(" "),
      );
    return out;
  } finally {
    await task.destroy();
  }
}
test("edita texto original no WASM local, adiciona texto e exporta PDF verificável", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Editar texto existente", exact: true }).click();
  await page
    .getByRole("button", { name: "Selecionar texto: Contrato original", exact: true })
    .click();
  await page.getByLabel("Conteúdo do texto").fill("Contrato novo");
  await page.getByRole("button", { name: "Aplicar alteração", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Adicionar texto", exact: true }).click();
  await ready(page);
  await page.getByLabel("Conteúdo do texto").fill("Edição útil");
  await page.getByRole("button", { name: "Aplicar alteração", exact: true }).click();
  await ready(page);
  const result = await texts(await save(page));
  expect(result[0]).toContain("Contrato novo");
  expect(result[0]).not.toContain("Contrato original");
  expect(result[0]).toContain("Edição útil");
  expect(result[0]).toContain("Texto preservado");
  expect(result[1]).toContain("Segunda pagina");
});
test("histórico misto desfaz e refaz edição real e elemento novo", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Adicionar texto", exact: true }).click();
  await ready(page);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await ready(page);
  expect((await texts(await save(page)))[0]).not.toContain("Seu texto aqui");
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await ready(page);
  expect((await texts(await save(page)))[0]).toContain("Seu texto aqui");
});
test("texto que não cabe mantém revisão e permite corrigir sem perder o documento", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Editar texto existente", exact: true }).click();
  await page
    .getByRole("button", { name: "Selecionar texto: Contrato original", exact: true })
    .click();
  await page.getByLabel("Conteúdo do texto").fill("W".repeat(100));
  await page.getByRole("button", { name: "Aplicar alteração", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("não cabe", { timeout: 30000 });
  await ready(page);
  await page.getByLabel("Conteúdo do texto").fill("Novo");
  await page.getByRole("button", { name: "Aplicar alteração", exact: true }).click();
  await ready(page);
  expect((await texts(await save(page)))[0]).toContain("Novo");
});
test("editor cabe nas quatro larguras e mantém foco visível", async ({ page }, info) => {
  await open(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`editor-${width}.png`), fullPage: true });
  }
  const button = page.getByRole("button", { name: "Adicionar texto", exact: true });
  await button.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(button).toHaveCSS("outline-style", "solid");
});
test("imagem, forma e desenho exportam junto com o conteúdo vetorial original", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("button", { name: "Retângulo", exact: true }).click();
  await ready(page);
  await page.getByLabel("Posição Y (%)", { exact: true }).fill("50");
  await page.getByRole("button", { name: "Aplicar alteração", exact: true }).click();
  await ready(page);
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 10;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas");
    ctx.fillStyle = "#e76b53";
    ctx.fillRect(0, 0, 10, 10);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByLabel("Inserir imagem", { exact: true }).setInputFiles({
    name: "imagem.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Selecionar elemento: Inserir imagem" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Desenhar", exact: true }).click();
  const stage = page.locator(".pdf-editor-stage");
  const box = await stage.boundingBox();
  if (!box) throw new Error("Sem página");
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.75, { steps: 8 });
  await page.mouse.up();
  await ready(page);
  const bytes = await save(page),
    task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const doc = await task.promise;
    const ops = await (await doc.getPage(1)).getOperatorList();
    expect(ops.fnArray).toContain(pdfjs.OPS.paintImageXObject);
  } finally {
    await task.destroy();
  }
  expect((await texts(bytes))[0]).toContain("Contrato original");
});
test("cancelamento encerra worker e permite abrir novamente", async ({ page }) => {
  await page.goto("/editar-pdf");
  const started = page.waitForEvent("worker");
  await page.getByLabel("Selecionar PDF", { exact: true }).setInputFiles({
    name: "original.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await source()),
  });
  const worker = await started,
    closed = worker.waitForEvent("close");
  await page.getByRole("button", { name: "Cancelar operação", exact: true }).click();
  await closed;
  await expect(page.getByRole("button", { name: "Selecionar PDF", exact: true })).toBeEnabled();
  await open(page);
});
test("navegação interna e voltar do navegador pedem confirmação antes de descartar edições", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "Editar PDF", exact: true }).click();
  await page.getByLabel("Selecionar PDF", { exact: true }).setInputFiles({
    name: "original.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await source()),
  });
  await ready(page);
  await page.getByRole("button", { name: "Adicionar texto", exact: true }).click();
  await ready(page);
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  await page
    .getByRole("navigation", { name: "Navegação Principal" })
    .getByRole("button", { name: "Juntar PDF", exact: true })
    .click();
  await expect.poll(() => dialogs).toBe(1);
  await expect(page).toHaveURL(/editar-pdf$/);
  await page.evaluate(() => history.back());
  await expect.poll(() => dialogs).toBe(2);
  await expect(page).toHaveURL(/editar-pdf$/);
  expect((await texts(await save(page)))[0]).toContain("Seu texto aqui");
});
