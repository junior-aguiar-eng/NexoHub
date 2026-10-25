import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const route = `${process.env.NEXOHUB_BASE_PATH ?? "/"}preencher-formulario`;
async function fixture(name = "ANTES") {
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(new Date("2026-10-24T00:00:00Z"));
  pdf.setModificationDate(new Date("2026-10-24T00:00:00Z"));
  const pages = [pdf.addPage([600, 800]), pdf.addPage([600, 800]), pdf.addPage([600, 800])];
  pages.forEach((p, i) => {
    p.drawText(`Formulario real pagina ${i + 1}`, { x: 40, y: 750, size: 22 });
  });
  const form = pdf.getForm();
  const text = form.createTextField("nome");
  text.setText(name);
  text.addToPage(pages[0], { x: 50, y: 650, width: 400, height: 35 });
  form.createCheckBox("aceite").addToPage(pages[0], { x: 50, y: 590, width: 25, height: 25 });
  const radio = form.createRadioGroup("plano");
  radio.addOptionToPage("A", pages[0], { x: 50, y: 520, width: 25, height: 25 });
  radio.addOptionToPage("B", pages[1], { x: 50, y: 520, width: 25, height: 25 });
  const country = form.createDropdown("pais");
  country.setOptions(["Brasil", "Portugal"]);
  country.addToPage(pages[1], { x: 50, y: 650, width: 250, height: 35 });
  const list = form.createOptionList("idiomas");
  list.setOptions(["PT", "EN", "ES"]);
  list.enableMultiselect();
  list.select(["PT"]);
  list.addToPage(pages[2], { x: 50, y: 520, width: 250, height: 150 });
  const long = form.createTextField(
    "Nome muito longo do responsável pela revisão do documento e dos dados de cadastro sem abreviações",
  );
  long.addToPage(pages[2], { x: 50, y: 400, width: 450, height: 35 });
  return Buffer.from(await pdf.save());
}
async function upload(page: Page, bytes = fixture()) {
  const source = await bytes;
  await test.info().attach("corpus-formulario.sha256", {
    body: Buffer.from(createHash("sha256").update(source).digest("hex")),
    contentType: "text/plain",
  });
  await page.goto(route);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "formulario.pdf", mimeType: "application/pdf", buffer: source });
}
async function ready(page: Page) {
  await expect(page.getByRole("status", { name: "Estado da prévia do formulário" })).toContainText(
    "Prévia atualizada",
  );
  await expect(page.locator(".form-fill-preview-image")).toBeVisible();
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeEnabled();
}
async function output(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  return readFile(await (await pending).path());
}

test("prévia acompanha texto, checkbox, rádio e lista; download conserva os valores editáveis", async ({
  page,
}) => {
  await upload(page);
  await ready(page);
  let previous = await page.locator(".form-fill-preview-image").getAttribute("src");
  await page.getByLabel("nome", { exact: true }).fill("José da Conceição");
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await ready(page);
  await expect(page.locator(".form-fill-preview-image")).not.toHaveAttribute("src", previous ?? "");
  previous = await page.locator(".form-fill-preview-image").getAttribute("src");
  await page.getByLabel("aceite", { exact: true }).check();
  await ready(page);
  await expect(page.locator(".form-fill-preview-image")).not.toHaveAttribute("src", previous ?? "");
  await page.getByRole("button", { name: "Ir para plano na página 2", exact: true }).click();
  await ready(page);
  await page.getByRole("radio", { name: "B", exact: true }).check();
  await page.getByLabel("pais", { exact: true }).selectOption("Portugal");
  await ready(page);
  await page.getByRole("button", { name: "Ir para idiomas na página 3", exact: true }).click();
  await ready(page);
  previous = await page.locator(".form-fill-preview-image").getAttribute("src");
  await page.getByLabel("idiomas", { exact: true }).selectOption(["EN", "ES"]);
  await ready(page);
  await expect(page.locator(".form-fill-preview-image")).not.toHaveAttribute("src", previous ?? "");
  const pdf = await PDFDocument.load(await output(page)),
    form = pdf.getForm();
  expect(form.getTextField("nome").getText()).toBe("José da Conceição");
  expect(form.getCheckBox("aceite").isChecked()).toBe(true);
  expect(form.getRadioGroup("plano").getSelected()).toBe("B");
  expect(form.getDropdown("pais").getSelected()).toEqual(["Portugal"]);
  expect(form.getOptionList("idiomas").getSelected()).toEqual(["EN", "ES"]);
  expect(pdf.getPages().every((p) => (p.node.Annots()?.size() ?? 0) > 0)).toBe(true);
});

test("achatar retira widgets somente da saída escolhida e preserva os valores visíveis", async ({
  page,
}) => {
  const source = await fixture();
  await upload(page, Promise.resolve(source));
  await ready(page);
  await page.getByLabel("nome", { exact: true }).fill("João de São Luís");
  await ready(page);
  await page.getByLabel("Achatar formulário (Flatten)", { exact: true }).check();
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await ready(page);
  const bytes = await output(page),
    pdf = await PDFDocument.load(bytes);
  expect(pdf.getForm().getFields()).toHaveLength(0);
  expect(pdf.getPages().every((p) => (p.node.Annots()?.size() ?? 0) === 0)).toBe(true);
  expect((await PDFDocument.load(source)).getForm().getTextField("nome").getText()).toBe("ANTES");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl: fileURLToPath(
      new URL("../public/standard_fonts/", import.meta.url),
    ).replaceAll("\\", "/"),
  });
  try {
    const document = await task.promise;
    const text = await (await document.getPage(1)).getTextContent();
    expect(text.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" ")).toContain(
      "João de São Luís",
    );
  } finally {
    await task.destroy();
  }
});

test("caractere não representável bloqueia exportação e não exibe uma revisão antiga", async ({
  page,
}) => {
  await upload(page);
  await ready(page);
  await page.getByLabel("nome", { exact: true }).fill("漢字");
  await expect(page.getByRole("alert")).toContainText("não representa");
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await expect(page.locator(".form-fill-preview-image")).toHaveCount(0);
  await page.getByLabel("nome", { exact: true }).fill("José");
  await ready(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(
    (await PDFDocument.load(await output(page))).getForm().getTextField("nome").getText(),
  ).toBe("José");
});

test("troca de arquivo e digitação rápida descartam revisão anterior", async ({ page }) => {
  await upload(page);
  await ready(page);
  await page.getByLabel("nome", { exact: true }).fill("REVISÃO ABANDONADA");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "outro.pdf",
      mimeType: "application/pdf",
      buffer: await fixture("NOVO"),
    });
  await expect(page.getByLabel("nome", { exact: true })).toHaveValue("NOVO");
  await ready(page);
  for (const value of ["José A", "José B", "José Final"])
    await page.getByLabel("nome", { exact: true }).fill(value);
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await ready(page);
  expect(
    (await PDFDocument.load(await output(page))).getForm().getTextField("nome").getText(),
  ).toBe("José Final");
});

test("campos longos e navegação por teclado cabem nas quatro larguras", async ({ page }) => {
  await upload(page);
  await ready(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const button = page.getByRole("button", { name: "Ir para idiomas na página 3", exact: true });
    await button.focus();
    await button.press("Enter");
    await ready(page);
    await expect(page.getByRole("spinbutton", { name: "Página da prévia" })).toHaveValue("3");
    await expect(button).toBeFocused();
    const bounds = await button.boundingBox();
    expect(bounds?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
});

test("sair durante atualização não publica prévia nem erro na próxima ferramenta", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await upload(page);
  await ready(page);
  await page.getByLabel("nome", { exact: true }).fill("ABANDONADO");
  await page.getByRole("button", { name: "Todas as ferramentas", exact: true }).click();
  await expect(page.locator(".form-fill-container")).toHaveCount(0);
  await upload(page, fixture("ATUAL"));
  await ready(page);
  await expect(page.getByLabel("nome", { exact: true })).toHaveValue("ATUAL");
  expect(errors).toEqual([]);
});

test("arquivo de texto arrastado é recusado e um PDF válido pode ser selecionado em seguida", async ({
  page,
}) => {
  await page.goto(route);
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(["nao e PDF"], "texto.txt", { type: "text/plain" }));
    return data;
  });
  await page
    .getByRole("region", { name: "Área para soltar arquivos", exact: true })
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByRole("alert")).toContainText(/PDF/i);
  await expect(page.locator(".ilovepdf-upload-dropzone")).toBeVisible();
  await expect(page.getByText("Carregando campos...", { exact: true })).toHaveCount(0);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "valido.pdf", mimeType: "application/pdf", buffer: await fixture() });
  await ready(page);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("PDF malformado encerra carregamento e permite trocar o documento", async ({ page }) => {
  await page.goto(route);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "invalido.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("arquivo invalido"),
    });
  await expect(page.getByRole("alert")).toContainText(/PDF|documento/i);
  await expect(page.getByText("Carregando campos...", { exact: true })).toHaveCount(0);
  const choose = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Selecionar outro PDF", exact: true }).click();
  await (await choose).setFiles({
    name: "novo.pdf",
    mimeType: "application/pdf",
    buffer: await fixture(),
  });
  await ready(page);
});

test("PDF sem campos mantém prévia original identificada e não oferece preenchimento fictício", async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]).drawText("Documento original sem campos", { x: 50, y: 700, size: 22 });
  await upload(page, Promise.resolve(Buffer.from(await pdf.save())));
  await expect(page.locator(".form-fill-preview-image")).toBeVisible();
  await expect(page.getByRole("status", { name: "Estado da prévia do formulário" })).toContainText(
    "Documento original",
  );
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await expect(page.getByRole("link", { name: /Baixar arquivo gerado/ })).toHaveCount(0);
});
