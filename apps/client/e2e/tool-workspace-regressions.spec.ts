import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { workspaceOptions } from "./workspace-views";

const toolRoute = (route: string) => `${process.env.NEXOHUB_BASE_PATH ?? "/"}${route}`;

async function image(page: Page, width = 1200, height = 800, color = "#068577") {
  return Buffer.from(
    await page.evaluate(
      ({ width, height, color }) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponível");
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
        return [
          ...new Uint8Array(
            atob(canvas.toDataURL("image/png").split(",")[1])
              .split("")
              .map((c) => c.charCodeAt(0)),
          ),
        ];
      },
      { width, height, color },
    ),
  );
}
async function openImage(page: Page, route: string) {
  await page.goto(toolRoute(route));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "imagem.png", mimeType: "image/png", buffer: await image(page) });
  await expect(page.locator(".image-tool-panel img").first()).toBeVisible();
  await expect(page.locator(".image-tool-panel")).toContainText("1200");
}
async function document(pages = 3) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++)
    pdf.addPage([595, 842]).drawText(`Pagina real ${i + 1}`, { x: 60, y: 700, size: 24, font });
  const field = pdf.getForm().createTextField("nome");
  field.setText("Maria da Silva");
  field.addToPage(pdf.getPage(0), { x: 60, y: 600, width: 200, height: 30 });
  return Buffer.from(await pdf.save());
}

test("tokens e tipografia dos controles de imagem respeitam o tema", async ({ page }) => {
  await openImage(page, "recortar-imagem");
  await expect(page.locator(".image-tool-panel > :first-child")).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  const square = page.getByRole("button", { name: /1:1/ });
  await expect(square).toHaveCSS("font-size", "12px");
  await square.click();
  await expect(square).toHaveCSS("color", "rgb(255, 255, 255)");
});

test("recorte informa e exporta as mesmas dimensões ao tentar ultrapassar a borda", async ({
  page,
}) => {
  await openImage(page, "recortar-imagem");
  await page.getByRole("button", { name: /1:1/ }).click();
  await page.locator("#crop-x").fill("700");
  await expect(page.locator("#crop-x")).toHaveValue("400");
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  const bytes = await readFile(await (await pending).path());
  const dimensions = await page.evaluate(
    async (bytes) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const result = [bitmap.width, bitmap.height];
      bitmap.close();
      return result;
    },
    [...bytes],
  );
  expect(dimensions).toEqual([800, 800]);
});

for (const width of [1024, 1440]) {
  test(`paleta de cor permanece clicável em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openImage(page, "marca-dagua-imagem");
    await page.getByTitle("Vermelho", { exact: true }).click({ timeout: 2000 });
    await expect(page.getByTitle("Vermelho", { exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  test(`opções de recorte e conversão cabem na lateral em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ["recortar-imagem", "converter-imagem"]) {
      await openImage(page, route);
      const overflowing = await page.locator(".image-tool-panel button").evaluateAll((buttons) =>
        buttons.flatMap((button) => {
          const box = button.getBoundingClientRect();
          if (button.classList.contains("image-crop-region")) return [];
          const range = document.createRange();
          range.selectNodeContents(button);
          const bounds = [...range.getClientRects()];
          return bounds.some((r) => r.left < box.left - 1 || r.right > box.right + 1)
            ? [button.textContent]
            : [];
        }),
      );
      expect(overflowing, route).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    }
  });
}

for (const width of [390, 768, 1024, 1440]) {
  for (const route of ["traduzir-texto", "comparar-textos", "preencher-formulario"]) {
    test(`${route}: conteúdo carregado cabe em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(toolRoute(route));
      const fixture =
        route === "preencher-formulario"
          ? {
              name: "contrato-com-nome-longo-para-conferir-layout-do-formulario.pdf",
              mimeType: "application/pdf",
              buffer: await document(),
            }
          : {
              name: "documento-com-nome-longo-para-conferir-layout-dos-controles.txt",
              mimeType: "text/plain",
              buffer: Buffer.from("Texto de exemplo para trabalhar com documentos."),
            };
      await page.locator('input[type="file"]').first().setInputFiles(fixture);
      await expect(page.locator(".dedicated-tool-page--workspace")).toBeVisible();
      if (route === "preencher-formulario") {
        await workspaceOptions(page);
        await expect(page.getByRole("textbox", { name: "nome", exact: true })).toHaveValue(
          "Maria da Silva",
        );
      }
      if (route === "comparar-textos") {
        await expect(page.locator(".doc-compare-textarea").first()).toHaveValue(
          "Texto de exemplo para trabalhar com documentos.",
        );
        await expect(page.locator(".doc-compare-stats-bar")).toBeVisible();
      }
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width);
    });
  }
}

test("prévia de logotipo mostra os pixels e a posição da imagem escolhida", async ({ page }) => {
  await openImage(page, "marca-dagua-imagem");
  await page.getByRole("button", { name: /Logotipo/ }).click();
  const logo = await image(page, 40, 40, "#ff0000");
  await page
    .locator("#image-watermark-logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
  await page.locator("#logo-opacity").focus();
  await page.locator("#logo-opacity").press("End");
  const centerPixel = () =>
    page
      .locator(".image-tool-panel > :first-child img")
      .first()
      .evaluate((img) => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponível");
        ctx.drawImage(img, 0, 0);
        return [
          ...ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1)
            .data,
        ];
      });
  await expect.poll(centerPixel).toEqual([255, 0, 0, 255]);
  await page.getByRole("button", { name: "Superior esquerdo", exact: true }).click();
  await expect.poll(centerPixel).toEqual([6, 133, 119, 255]);
});

for (const route of ["girar-imagem", "marca-dagua-imagem"]) {
  test(`${route}: prévia aproveita a mesa sem recortar a imagem`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openImage(page, route);
    const preview = page.locator(".image-tool-panel > :first-child img").first();
    const box = await preview.boundingBox();
    expect(box?.width).toBeGreaterThan(route === "girar-imagem" ? 300 : 500);
    const contained = () =>
      preview.evaluate((img) => {
        const r = img.getBoundingClientRect(),
          p = img.parentElement?.getBoundingClientRect();
        return (
          p &&
          r.left >= p.left - 1 &&
          r.right <= p.right + 1 &&
          r.top >= p.top - 1 &&
          r.bottom <= p.bottom + 1
        );
      });
    await expect.poll(contained).toBe(true);
    if (route === "girar-imagem") {
      await page.getByRole("button", { name: /Girar.*à direita/i }).click();
      await expect.poll(contained).toBe(true);
    }
  });
}

for (const route of ["organizar-pdf", "remover-paginas", "extrair-paginas"]) {
  test(`${route}: página 49 ganha miniatura real quando entra na área visível`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(toolRoute(route));
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "cinquenta.pdf",
        mimeType: "application/pdf",
        buffer: await document(50),
      });
    const last = page.getByRole("img", { name: /página 49/i }).first();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toHaveAttribute("src", /^data:image\/jpeg/, { timeout: 15000 });
  });
}

test("pular capa solicita e exibe a miniatura da página dois", async ({ page }) => {
  await page.goto(toolRoute("numeros-de-pagina"));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "paginas.pdf", mimeType: "application/pdf", buffer: await document() });
  const preview = page.locator(".ilovepdf-file-thumb-wrapper img");
  await expect(preview).toBeVisible();
  const first = await preview.getAttribute("src");
  await page.getByRole("button", { name: "Página 2 (Pular Capa)", exact: true }).click();
  await expect(preview).toHaveAttribute("alt", /página 2/i);
  await expect.poll(() => preview.getAttribute("src")).not.toBe(first);
});

test("acrescentar imagem ao lote preserva o recorte configurado", async ({ page }) => {
  await openImage(page, "recortar-imagem");
  const square = page.getByRole("button", { name: /1:1/ });
  await square.click();
  await page.locator("#crop-x").fill("300");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "segunda.png",
      mimeType: "image/png",
      buffer: await image(page),
    });
  await expect(square).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#crop-x")).toHaveValue("300");
  await expect(page.locator("#crop-w")).toHaveValue("800");
});
