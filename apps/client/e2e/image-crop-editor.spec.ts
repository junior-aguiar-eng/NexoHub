import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const route = `${process.env.NEXOHUB_BASE_PATH ?? "/"}recortar-imagem`;
async function source(page: Page, width = 1200, height = 800) {
  return Buffer.from(
    await page.evaluate(
      ({ width, height }) => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponível");
        ctx.fillStyle = "#059669";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(100, 100, 400, 200);
        ctx.clearRect(600, 400, 600, 400);
        return c.toDataURL("image/png").split(",")[1];
      },
      { width, height },
    ),
    "base64",
  );
}
async function open(page: Page) {
  await page.goto(route);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "origem.png", mimeType: "image/png", buffer: await source(page) });
  await expect(page.locator(".image-crop-editor")).toHaveAttribute("data-ready", "true");
}
async function crop(page: Page, x: number, y: number, w: number, h: number) {
  // Reduzir primeiro evita que a coordenada seja limitada pela seleção anterior.
  await page.locator("#crop-w").fill(String(w));
  await page.locator("#crop-h").fill(String(h));
  await page.locator("#crop-x").fill(String(x));
  await page.locator("#crop-y").fill(String(y));
}
async function rect(page: Page) {
  return Promise.all(
    ["x", "y", "w", "h"].map(async (key) =>
      Number(await page.locator(`#crop-${key}`).inputValue()),
    ),
  );
}
async function dragHandle(page: Page, name: string, dx: number, dy: number) {
  const handle = page.getByRole("button", { name, exact: true });
  const b = await handle.boundingBox();
  if (!b) throw new Error("Alça indisponível");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + dx, b.y + b.height / 2 + dy, { steps: 30 });
  await page.mouse.up();
}
async function download(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  const bytes = await readFile(await (await pending).path());
  return page.evaluate(
    async (data) => {
      const img = await createImageBitmap(new Blob([new Uint8Array(data)]));
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.drawImage(img, 0, 0);
      const result = {
        size: [img.width, img.height],
        pixel: [...ctx.getImageData(10, 10, 1, 1).data],
      };
      img.close();
      return result;
    },
    [...bytes],
  );
}

test("alças, zoom, pan e teclado preservam as coordenadas do download", async ({ page }) => {
  await open(page);
  await crop(page, 100, 100, 400, 200);
  const imageBounds = await page.locator("cropper-image").boundingBox();
  if (!imageBounds) throw new Error("Imagem indisponível");
  await dragHandle(page, "Redimensionar pelo canto inferior direito", 50, 30);
  await expect.poll(async () => (await rect(page))[2]).toBeGreaterThan(400);
  const before = await rect(page);
  expect(Math.abs(before[2] - (400 + (50 * 1200) / imageBounds.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(before[3] - (200 + (30 * 800) / imageBounds.height))).toBeLessThanOrEqual(1);
  await page.getByRole("slider", { name: "Zoom da visualização" }).fill("200");
  expect(await rect(page)).toEqual(before);
  await page.getByRole("button", { name: "Mover visualização", exact: true }).click();
  const viewport = page.getByRole("region", { name: "Área de recorte", exact: true });
  await viewport.focus();
  await viewport.press("ArrowRight");
  expect(await rect(page)).toEqual(before);
  await page.getByRole("button", { name: "Mover visualização", exact: true }).click();
  const move = page.getByRole("button", { name: /^Mover área de recorte\./ });
  await move.focus();
  await move.press("ArrowRight");
  await expect(page.locator("#crop-x")).toHaveValue(String(before[0] + 1));
  expect(await download(page)).toEqual({ size: [before[2], before[3]], pixel: [255, 0, 0, 255] });
});

test("preset quadrado permanece proporcional ao redimensionar por alça", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: /1:1/ }).click();
  const handle = page.getByRole("button", {
    name: "Redimensionar pelo canto inferior direito",
    exact: true,
  });
  await handle.focus();
  await handle.press("Shift+ArrowLeft");
  const [x, y, w, h] = await rect(page);
  expect(w).toBe(790);
  expect(h).toBe(790);
  expect(x + w).toBeLessThanOrEqual(1200);
  expect(y + h).toBeLessThanOrEqual(800);
});

test("imagem visível coincide com o canvas em ajuste, zoom e resize", async ({ page }) => {
  await open(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const zoom of [100, 200]) {
      await page.getByRole("slider", { name: "Zoom da visualização" }).fill(String(zoom));
      await expect
        .poll(() =>
          page.locator("cropper-canvas").evaluate((canvas) => {
            const image = canvas.querySelector("cropper-image");
            if (!image) throw new Error("Imagem indisponível");
            const a = canvas.getBoundingClientRect(),
              b = image.getBoundingClientRect();
            return Math.max(
              Math.abs(a.left - b.left),
              Math.abs(a.top - b.top),
              Math.abs(a.width - b.width),
              Math.abs(a.height - b.height),
            );
          }),
        )
        .toBeLessThan(1);
    }
  }
});

test("recorte mantém transparência na saída", async ({ page }) => {
  await open(page);
  await crop(page, 600, 400, 300, 200);
  expect(await download(page)).toEqual({ size: [300, 200], pixel: [0, 0, 0, 0] });
});

test("carrega Cropper apenas após importar imagem para recorte", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("cropper")) requests.push(request.url());
  });
  await page.goto(route);
  expect(requests).toEqual([]);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "origem.png", mimeType: "image/png", buffer: await source(page) });
  await expect(page.locator(".image-crop-editor")).toHaveAttribute("data-ready", "true");
  expect(requests.length).toBeGreaterThan(0);
});

test("falha ao carregar o editor mantém o recorte numérico utilizável", async ({ page }) => {
  await page.route("**/*cropper*", (request) => request.abort());
  await page.goto(route);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "origem.png", mimeType: "image/png", buffer: await source(page) });
  await expect(page.getByRole("alert")).toContainText("continuar pelos campos");
  await crop(page, 100, 100, 400, 200);
  expect(await download(page)).toEqual({ size: [400, 200], pixel: [255, 0, 0, 255] });
});

test("recorta JPEG com EXIF usando a orientação visual do original", async ({ page }) => {
  await page.goto(route);
  const bytes = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 48;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 48, 48);
    ctx.fillStyle = "blue";
    ctx.fillRect(48, 0, 48, 48);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", 1));
    if (!blob) throw new Error("JPEG indisponível");
    const original = new Uint8Array(await blob.arrayBuffer());
    const exif = [
      255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0,
      0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
    ];
    return [...original.slice(0, 2), ...exif, ...original.slice(2)];
  });
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "orientada.jpg", mimeType: "image/jpeg", buffer: Buffer.from(bytes) });
  await expect(page.locator(".image-crop-editor")).toHaveAttribute("data-ready", "true");
  await expect(page.getByRole("region", { name: "Imagens do lote", exact: true })).toContainText(
    "48 × 96",
  );
  await crop(page, 0, 0, 48, 48);
  const result = await download(page);
  expect(result.size).toEqual([48, 48]);
  expect(result.pixel[0]).toBeGreaterThan(240);
  expect(result.pixel[1]).toBeLessThan(20);
  expect(result.pixel[2]).toBeLessThan(20);
});

test("resize da janela e troca de imagem não alteram o recorte compartilhado", async ({ page }) => {
  await open(page);
  await crop(page, 100, 100, 300, 200);
  const before = await rect(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("slider", { name: "Zoom da visualização" }).fill("200");
    await page.getByRole("button", { name: "Ajustar visualização", exact: true }).click();
    expect(await rect(page)).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "retrato.png",
      mimeType: "image/png",
      buffer: await source(page, 640, 960),
    });
  await page.getByRole("button", { name: "Visualizar imagem 2: retrato.png", exact: true }).click();
  await expect(page.locator(".image-crop-editor")).toHaveAttribute("data-ready", "true");
  expect(await rect(page)).toEqual(before);
});

test("toque redimensiona pela alça com alvo de pelo menos 44px", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await open(page);
  await crop(page, 100, 100, 400, 200);
  const handle = page.getByRole("button", {
    name: "Redimensionar pelo canto inferior direito",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const box = await handle.boundingBox();
  if (!box) throw new Error("Alça indisponível");
  expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
  const session = await context.newCDPSession(page),
    x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let i = 1; i <= 5; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + i * 3, y: y + i * 3 }],
    });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(async () => (await rect(page))[2]).toBeGreaterThan(400);
  await context.close();
});
