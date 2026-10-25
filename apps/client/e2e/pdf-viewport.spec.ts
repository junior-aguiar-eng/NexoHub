import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

const route = (name: string) => `${process.env.NEXOHUB_BASE_PATH ?? "/"}${name}`;
async function fixture() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const page = pdf.addPage([600, 800]);
    page.setCropBox(20, 30, 560, 740);
    if (i === 2) page.setRotation(degrees(90));
    page.drawRectangle({ x: 30, y: 40, width: 500, height: 700, color: rgb(i / 3, 0.5, 0.8) });
    page.drawText(`Documento real pagina ${i + 1}`, { x: 50, y: 700, size: 20, font });
  }
  const field = pdf.getForm().createTextField("nome");
  field.setText("Maria");
  field.addToPage(pdf.getPage(0), { x: 50, y: 600, width: 150, height: 30 });
  return Buffer.from(await pdf.save());
}
for (const name of [
  "recortar-pdf",
  "assinar-pdf",
  "ocultar-pdf",
  "marca-dagua",
  "numeros-de-pagina",
  "preencher-formulario",
  "pdf-para-jpg",
  "pdf-para-markdown",
]) {
  test(`${name}: navega, amplia e ajusta a largura sem duplicar controles`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(route(name));
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "tres-paginas.pdf",
        mimeType: "application/pdf",
        buffer: await fixture(),
      });
    const viewer = page.locator(".pdf-viewport");
    const img = viewer.locator("img").first();
    await expect(img).toBeVisible();
    await expect(page.getByRole("button", { name: "Página anterior", exact: true })).toHaveCount(1);
    expect(
      await viewer.locator(".pdf-viewport-scroll").evaluate((element) => {
        const box = element.getBoundingClientRect();
        let ancestor = element.parentElement;
        while (ancestor && !ancestor.classList.contains("dedicated-tool-workspace-main")) {
          const css = getComputedStyle(ancestor),
            bounds = ancestor.getBoundingClientRect();
          if (
            ["auto", "scroll", "hidden", "clip"].includes(css.overflowY) &&
            box.bottom > bounds.bottom + 2
          )
            return true;
          ancestor = ancestor.parentElement;
        }
        return false;
      }),
    ).toBe(false);
    const first = await img.getAttribute("src");
    const jump = page.getByRole("spinbutton", { name: "Página da prévia" });
    await jump.fill("3");
    await jump.press("Enter");
    await expect(page.getByRole("button", { name: "Próxima página", exact: true })).toBeDisabled();
    await expect(img).toBeVisible();
    await expect(img).not.toHaveAttribute("src", first ?? "");
    const originalWidth = (await img.boundingBox())?.width ?? 0;
    expect(originalWidth).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Ampliar prévia" }).click();
    await page.getByRole("button", { name: "Ampliar prévia" }).click();
    await expect(page.getByLabel("Zoom da visualização", { exact: true })).toHaveText("150%");
    expect((await img.boundingBox())?.width ?? 0).toBeGreaterThan(originalWidth * 1.45);
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      expect(
        await viewer.locator("button,input").evaluateAll((nodes) =>
          nodes.some((node) => {
            const b = node.getBoundingClientRect();
            return b.width < 44 || b.height < 44;
          }),
        ),
      ).toBe(false);
    }
    await page.getByRole("button", { name: "Ajustar à largura", exact: true }).click();
    await expect(page.getByLabel("Zoom da visualização", { exact: true })).toHaveText("100%");
    await expect(jump).toHaveValue("3");
    await jump.focus();
    await expect(jump).toBeFocused();
  });
}

test("zoom e navegação não alteram o recorte exportado com CropBox e rotação", async ({ page }) => {
  await page.goto(route("recortar-pdf"));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "recorte.pdf", mimeType: "application/pdf", buffer: await fixture() });
  await expect(page.locator(".pdf-viewport img").first()).toBeVisible();
  await page.getByRole("button", { name: "Ampliar prévia" }).click();
  const jump = page.getByRole("spinbutton", { name: "Página da prévia" });
  await jump.fill("3");
  await jump.press("Enter");
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  const doc = await PDFDocument.load(await readFile(await (await pending).path()));
  expect(
    doc.getPages().map((p) => ({ box: p.getCropBox(), rotation: p.getRotation().angle })),
  ).toEqual(
    [0, 0, 90].map((rotation) => ({ box: { x: 76, y: 104, width: 448, height: 592 }, rotation })),
  );
});

// Compare decoded page operators and geometry, not timestamps or container bytes.
for (const name of ["marca-dagua", "numeros-de-pagina", "assinar-pdf", "ocultar-pdf"]) {
  test(`${name}: o PDF baixado preserva as mesmas alterações depois de ampliar e navegar`, async ({
    page,
  }) => {
    // O carimbo de data é um input; fixá-lo isola o efeito do zoom entre as duas saídas.
    if (name === "assinar-pdf")
      await page.clock.setFixedTime(new Date("2026-10-25T12:00:00-03:00"));
    const bytes = await fixture();
    const outputs: unknown[] = [];
    for (const zoomed of [false, true]) {
      await page.goto(route(name));
      await page
        .locator('input[type="file"]')
        .first()
        .setInputFiles({ name: "geometria.pdf", mimeType: "application/pdf", buffer: bytes });
      await expect(page.locator(".pdf-viewport img").first()).toBeVisible();
      if (name === "marca-dagua") await page.locator("#watermark-input-text").fill("REVISAO LOCAL");
      if (name === "assinar-pdf") {
        await page.getByRole("button", { name: "Digitar", exact: true }).click();
        await page.getByPlaceholder("Digite seu nome completo...").fill("Maria Teste");
        await expect(page.locator(".ilovepdf-action-red-btn")).toBeEnabled();
      }
      if (name === "ocultar-pdf") {
        await page.getByRole("button", { name: "Adicionar Tarja Manual" }).click();
        await page.getByLabel("Posição horizontal (%)").fill("12");
        await page.getByLabel("Posição vertical (%)").fill("20");
        await page.getByLabel("Largura (%)").fill("30");
        await page.getByLabel("Altura (%)").fill("10");
      }
      if (zoomed) {
        await page.getByRole("button", { name: "Ampliar prévia" }).click();
        const jump = page.getByRole("spinbutton", { name: "Página da prévia" });
        await jump.fill("3");
        await jump.press("Enter");
        await expect(page.locator(".pdf-viewport img").first()).toBeVisible();
        await page.getByRole("button", { name: "Ampliar prévia" }).click();
      }
      await page.locator(".ilovepdf-action-red-btn").click();
      const pending = page.waitForEvent("download");
      await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
      const pdf = await PDFDocument.load(await readFile(await (await pending).path()));
      outputs.push(
        pdf.getPages().map((p) => ({
          box: p.getCropBox(),
          rotation: p.getRotation().angle,
          operators: p.node.Contents()?.toString(),
        })),
      );
      // Node IDs alone are insufficient: inspect all generated content/image streams as well.
      const { PDFRawStream, decodePDFRawStream } = await import("pdf-lib");
      outputs.push(
        pdf.context
          .enumerateIndirectObjects()
          .flatMap(([, object]) =>
            object instanceof PDFRawStream
              ? [Buffer.from(decodePDFRawStream(object).decode()).toString("base64")]
              : [],
          ),
      );
    }
    expect(outputs[2]).toEqual(outputs[0]);
    expect(outputs[3]).toEqual(outputs[1]);
  });
}

test("desenhar tarja após zoom usa percentuais da página rotacionada, não pixels da tela", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(route("ocultar-pdf"));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "coordenadas.pdf",
      mimeType: "application/pdf",
      buffer: await fixture(),
    });
  const jump = page.getByRole("spinbutton", { name: "Página da prévia" });
  await jump.fill("3");
  await jump.press("Enter");
  await expect(page.locator(".pdf-viewport img")).toBeVisible();
  await page.getByRole("button", { name: "Ampliar prévia" }).click();
  await page.getByRole("button", { name: "Ampliar prévia" }).click();
  const canvas = page.getByTestId("redact-preview-canvas");
  await page
    .locator(".pdf-viewport-scroll")
    .evaluate((el) => el.scrollIntoView({ block: "start", behavior: "instant" }));
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Prévia ausente");
  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3, { steps: 10 });
  await page.mouse.up();
  for (const [label, value] of [
    ["Posição horizontal (%)", 10],
    ["Posição vertical (%)", 20],
    ["Largura (%)", 20],
    ["Altura (%)", 10],
  ] as const) {
    await expect(page.getByLabel(label)).toHaveValue(String(value));
  }
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  const output = await readFile(await (await pending).path());
  await page.goto(route("pdf-para-jpg"));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "ocultado.pdf", mimeType: "application/pdf", buffer: output });
  const outputJump = page.getByRole("spinbutton", { name: "Página da prévia" });
  await outputJump.fill("3");
  await outputJump.press("Enter");
  const img = page.locator(".pdf-viewport img");
  await expect(img).toBeVisible();
  const pixels = await img.evaluate((element) => {
    const image = element as HTMLImageElement;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas ausente");
    ctx.drawImage(image, 0, 0);
    return [0.12, 0.5].map((x, i) =>
      [
        ...ctx.getImageData(
          Math.floor(canvas.width * x),
          Math.floor(canvas.height * (i ? 0.5 : 0.22)),
          1,
          1,
        ).data,
      ].slice(0, 3),
    );
  });
  expect(pixels[0].every((value) => value < 25)).toBe(true);
  expect(pixels[1][2]).toBeGreaterThan(100);
});

test("assinatura arrastada com zoom mantém coordenadas no PDF rotacionado baixado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(route("assinar-pdf"));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "assinatura.pdf",
      mimeType: "application/pdf",
      buffer: await fixture(),
    });
  const jump = page.getByRole("spinbutton", { name: "Página da prévia" });
  await jump.fill("3");
  await jump.press("Enter");
  await expect(page.locator(".pdf-viewport img").first()).toBeVisible();
  await page.getByRole("button", { name: "Imagem / Carimbo", exact: true }).click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas ausente");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 32, 32);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page
    .locator("#sign-upload-file")
    .setInputFiles({ name: "selo.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await page.getByRole("checkbox").uncheck();
  await page.getByRole("button", { name: "Ampliar prévia" }).click();
  await page.getByRole("button", { name: "Ampliar prévia" }).click();
  await page.locator(".pdf-viewport-scroll").evaluate((el) => {
    el.scrollIntoView({ block: "start", behavior: "instant" });
    el.scrollTop = el.scrollHeight;
    el.scrollLeft = el.scrollWidth;
  });
  const stamp = page.getByText("Selo de Assinatura", { exact: true }).locator("..").locator("..");
  const stampBox = await stamp.boundingBox(),
    documentBox = await page.locator(".pdf-viewport .ilovepdf-file-thumb-wrapper").boundingBox();
  if (!stampBox || !documentBox) throw new Error("Selo ausente");
  const x = stampBox.x + stampBox.width / 2,
    y = stampBox.y + stampBox.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - documentBox.width * 0.1, y - documentBox.height * 0.1, { steps: 10 });
  await page.mouse.up();
  const position = await stamp.evaluate((el) => [el.style.left, el.style.bottom]);
  expect(position).toEqual(["55%", "18%"]);
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  const pdf = await PDFDocument.load(await readFile(await (await pending).path()));
  const { PDFArray, PDFRawStream, decodePDFRawStream } = await import("pdf-lib");
  const contents = pdf.getPage(2).node.Contents();
  if (!(contents instanceof PDFArray)) throw new Error("Sem conteúdo");
  const operators = contents
    .asArray()
    .map((ref) => {
      const stream = pdf.context.lookup(ref);
      if (!(stream instanceof PDFRawStream)) throw new Error("Sem stream");
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    })
    .join("\n");
  const matrices = [
    ...operators.matchAll(/([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) cm/g),
  ].map((match) => match.slice(1).map(Number));
  expect(
    matrices.some(
      ([a, b, c, d, x, y]) =>
        a === 1 &&
        b === 0 &&
        c === 0 &&
        d === 1 &&
        Math.abs(x - 477) < 0.01 &&
        Math.abs(y - 100.8) < 0.01,
    ),
  ).toBe(true);
  expect(pdf.getPage(2).getRotation().angle).toBe(90);
  expect(pdf.getPage(2).getCropBox()).toEqual({ x: 20, y: 30, width: 560, height: 740 });
});

test("zoom amplia também o texto sobreposto da marca, mantendo proporções da folha", async ({
  page,
}) => {
  await page.goto(route("marca-dagua"));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "proporcoes.pdf",
      mimeType: "application/pdf",
      buffer: await fixture(),
    });
  await expect(page.locator(".pdf-viewport img")).toBeVisible();
  const overlay = page.locator(".pdf-viewport-page").getByText("CONFIDENCIAL", { exact: true });
  const before = (await overlay.boundingBox())?.width;
  if (!before) throw new Error("Marca ausente");
  await page.getByRole("button", { name: "Ampliar prévia" }).click();
  await page.getByRole("button", { name: "Ampliar prévia" }).click();
  await expect
    .poll(async () => ((await overlay.boundingBox())?.width ?? 0) / before)
    .toBeCloseTo(1.5, 1);
});
