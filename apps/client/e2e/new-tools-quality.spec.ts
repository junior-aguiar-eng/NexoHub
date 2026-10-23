import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { degrees, PDFDocument, PDFName, rgb } from "pdf-lib";

async function upload(page: Page, route: string, bytes: Uint8Array) {
  await page.goto(route);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "amostra.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });
}
async function run(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
}
async function download(page: Page, name: RegExp = /Baixar arquivo gerado/i) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("link", { name }).click();
  return new Uint8Array(await readFile(await (await waiting).path()));
}
async function sample() {
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 300]).drawText("Conteudo original", { x: 20, y: 230, size: 12 });
  return pdf;
}

test("extração descobre imagens, exporta seleção e limpa galeria ao trocar PDF", async ({
  page,
}) => {
  const pdf = await sample();
  const image = await pdf.embedJpg(
    new Uint8Array(
      await readFile(new URL("../src/platform/fixtures/extraction-red-2x1.jpg", import.meta.url)),
    ),
  );
  pdf.getPage(0).drawImage(image, { x: 20, y: 20, width: 100, height: 50 });
  await upload(page, "/extrair-imagens", await pdf.save());
  await page.getByRole("checkbox").uncheck();
  await run(page);
  await expect(page.getByRole("button", { name: /Selecionar imagem_p1/ })).toBeVisible();
  const output = await download(page, /Baixar imagens selecionadas/);
  expect(output).toEqual(
    new Uint8Array(
      await readFile(new URL("../src/platform/fixtures/extraction-red-2x1.jpg", import.meta.url)),
    ),
  );
  const blank = await sample();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "outro.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await blank.save()),
    });
  await expect(page.getByRole("button", { name: /Selecionar imagem_p1/ })).toHaveCount(0);
});

test("desbloqueia AES-256 com senha exata e mantém formulário editável", async ({ page }) => {
  const bytes = new Uint8Array(
    await readFile(new URL("../src/platform/__fixtures__/pdf-unlock/AES-256.pdf", import.meta.url)),
  );
  await upload(page, "/desbloquear-pdf", bytes);
  await expect(page.getByPlaceholder("Digite a senha do PDF...")).toBeVisible();
  await page.getByPlaceholder("Digite a senha do PDF...").fill("incorreta");
  await run(page);
  await expect(page.getByRole("alert")).toContainText("A senha informada não abre");
  await page.getByPlaceholder("Digite a senha do PDF...").fill(" senha com espacos ");
  await run(page);
  const pdf = await PDFDocument.load(await download(page));
  expect(pdf.context.trailerInfo.Encrypt).toBeUndefined();
  expect(pdf.getForm().getTextField("nome").getText()).toBe("Valor editavel");
});

test("formulário mantém opção vazia e salva alterações dos campos", async ({ page }) => {
  const pdf = await sample();
  const form = pdf.getForm();
  form.createTextField("Nome").addToPage(pdf.getPage(0), { x: 20, y: 40, width: 160, height: 25 });
  const choice = form.createDropdown("Escolha");
  choice.addOptions(["Primeira", "Segunda"]);
  choice.addToPage(pdf.getPage(0), { x: 20, y: 80, width: 160, height: 25 });
  await upload(page, "/preencher-formulario", await pdf.save());
  await page.getByPlaceholder("Preencha este campo...").fill("Maria");
  await run(page);
  const output = await PDFDocument.load(await download(page));
  expect(output.getForm().getTextField("Nome").getText()).toBe("Maria");
  expect(output.getForm().getDropdown("Escolha").getSelected()).toEqual([]);
});

test("recorte na orientação visual mantém conteúdo vetorial", async ({ page }) => {
  const pdf = await sample();
  pdf.getPage(0).setRotation(degrees(90));
  await upload(page, "/recortar-pdf", await pdf.save());
  await run(page);
  const output = await PDFDocument.load(await download(page));
  expect(output.getPage(0).getCropBox()).toEqual({ x: 40, y: 30, width: 320, height: 240 });
  expect(output.getPage(0).node.Contents()).toBeDefined();
});

test("recorte não executa uma seleção parcialmente inválida", async ({ page }) => {
  await upload(page, "/recortar-pdf", await (await sample()).save());
  await page.getByRole("button", { name: "Páginas selecionadas" }).click();
  await page.locator("#crop-scope-select").fill("1, 999");
  await run(page);
  await expect(page.getByRole("alert")).toContainText("Selecione páginas válidas");
});

test("assinatura digitada produz saída sem autor fictício", async ({ page }) => {
  await upload(page, "/assinar-pdf", await (await sample()).save());
  await page.getByRole("button", { name: "Digitar", exact: true }).click();
  await page.getByPlaceholder("Digite seu nome completo...").fill("Maria da Silva");
  await run(page);
  const output = await PDFDocument.load(await download(page));
  expect(output.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"))).toBeDefined();
});

test("Markdown mantém palavras entre fontes e avisa quando precisa de OCR", async ({ page }) => {
  await upload(page, "/pdf-para-markdown", await (await sample()).save());
  const thumbnail = page.getByRole("img", { name: "Miniatura de amostra.pdf" });
  await expect(thumbnail).toBeVisible();
  const proportions = await thumbnail.evaluate((element) => {
    const image = element as HTMLImageElement;
    const box = image.getBoundingClientRect();
    return { rendered: box.width / box.height, native: image.naturalWidth / image.naturalHeight };
  });
  expect(proportions.rendered).toBeCloseTo(proportions.native, 1);
  await run(page);
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar .md", exact: true }).click();
  expect(await readFile(await (await waiting).path(), "utf8")).toContain("Conteudo original");
  const blank = await PDFDocument.create();
  blank.addPage();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "digitalizado.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await blank.save()),
    });
  await expect(page.getByRole("button", { name: "Baixar .md", exact: true })).toHaveCount(0);
  await run(page);
  await expect(page.getByRole("alert")).toContainText("Use OCR");
});

test("prévia carrega a página intermediária real ao navegar", async ({ page }) => {
  const pdf = await PDFDocument.create();
  for (const color of [rgb(1, 0, 0), rgb(0, 1, 0), rgb(0, 0, 1)]) {
    pdf.addPage([200, 200]).drawRectangle({ x: 0, y: 0, width: 200, height: 200, color });
  }
  await upload(page, "/recortar-pdf", await pdf.save());
  await expect(page.getByRole("img", { name: "Página 1 de amostra.pdf" })).toBeVisible();
  await page.getByRole("button", { name: "Próxima página" }).click();
  const preview = page.getByRole("img", { name: "Página 2 de amostra.pdf" });
  await expect(preview).toBeVisible();
  const pixel = await preview.evaluate((element) => {
    const image = element as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    context.drawImage(image, 0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data];
  });
  expect(pixel[0]).toBeLessThan(5);
  expect(pixel[1]).toBeGreaterThan(250);
});

for (const route of [
  "/recortar-pdf",
  "/assinar-pdf",
  "/preencher-formulario",
  "/desbloquear-pdf",
  "/extrair-imagens",
  "/pdf-para-markdown",
]) {
  test(`painel ${route} cabe nas quatro larguras`, async ({ page }, testInfo) => {
    const bytes = await (await sample()).save();
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await upload(page, route, bytes);
      await expect(page.locator(".ilovepdf-action-red-btn")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: testInfo.outputPath(`${route.slice(1)}-${width}.png`),
        fullPage: true,
      });
    }
  });
}

test("formulário, desbloqueio e Markdown mantêm contraste legível no tema claro", async ({
  page,
}) => {
  for (const route of ["/preencher-formulario", "/desbloquear-pdf", "/pdf-para-markdown"]) {
    await upload(page, route, await (await sample()).save());
    const ratios = await page.evaluate(() => {
      const rgb = (color: string) => (color.match(/[\d.]+/g) ?? []).map(Number);
      const blend = (front: number[], back: number[]) =>
        front
          .slice(0, 3)
          .map((value, i) => value * (front[3] ?? 1) + back[i] * (1 - (front[3] ?? 1)));
      const luminance = (color: number[]) =>
        color
          .map((value) => value / 255)
          .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
          .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
      return [
        ...document.querySelectorAll(
          ".form-fill-file-name,.form-fill-file-meta,.form-fill-empty-state p,.form-fill-preview-title,.form-fill-preview-footer-hint,.unlock-file-name,.unlock-already-unlocked-card p,.unlock-preview-title,.ilovepdf-compress-options-sidebar label span",
        ),
      ].map((element) => {
        const ancestors: Element[] = [];
        let current: Element | null = element;
        while (current) {
          ancestors.unshift(current);
          current = current.parentElement;
        }
        const background = ancestors.reduce(
          (color, node) => blend(rgb(getComputedStyle(node).backgroundColor), color),
          [255, 255, 255],
        );
        const a = luminance(rgb(getComputedStyle(element).color));
        const b = luminance(background);
        return {
          text: element.textContent,
          ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        };
      });
    });
    expect(ratios.length).toBeGreaterThan(0);
    for (const item of ratios) expect(item.ratio, item.text ?? route).toBeGreaterThanOrEqual(4.5);
  }
});
