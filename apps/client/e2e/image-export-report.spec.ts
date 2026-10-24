import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";

const route = (name: string) => `${process.env.NEXOHUB_BASE_PATH ?? "/"}${name}`;
async function photo(page: Page, width = 96, height = 48) {
  return Buffer.from(
    await page.evaluate(
      ({ width, height }) => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        const ctx = c.getContext("2d");
        if (!ctx) throw Error("Canvas");
        ctx.fillStyle = "#ff0000";
        ctx.fillRect(0, 0, width / 2, height);
        return c.toDataURL().split(",")[1];
      },
      { width, height },
    ),
    "base64",
  );
}
async function open(page: Page, name: string) {
  await page.goto(route(name));
  const buffer = await photo(page);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer });
  return buffer;
}
async function run(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  await expect(page.getByRole("heading", { name: /Pronto! Arquivo processado/ })).toBeVisible();
}
async function download(page: Page) {
  const next = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  return readFile(await (await next).path());
}
test("conversão mostra imagens antes/depois e aumento real sem promessa de economia", async ({
  page,
}) => {
  await open(page, "converter-imagem");
  await run(page);
  const report = page.getByRole("region", { name: "Resultado das imagens", exact: true });
  await expect(report).toBeVisible();
  await expect(report).toContainText("96 × 48");
  await expect(report).toContainText("Aumento");
  const images = [
    page.getByAltText("Imagem original", { exact: true }),
    page.getByAltText("Imagem processada", { exact: true }),
  ];
  for (const image of images) {
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBe(96);
  }
  const bytes = await download(page);
  const pixel = await page.evaluate(
    async (bytes) => {
      const b = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const c = new OffscreenCanvas(b.width, b.height),
        ctx = c.getContext("2d");
      if (!ctx) throw Error("Canvas");
      ctx.drawImage(b, 0, 0);
      b.close();
      return [...ctx.getImageData(80, 10, 1, 1).data];
    },
    [...bytes],
  );
  expect(pixel).toEqual([255, 255, 255, 255]);
});
test("PNG mantém perfis de esforço sem perdas e expõe dimensões reais", async ({ page }) => {
  await open(page, "comprimir-imagem");
  await expect(page.getByRole("button", { name: /^Recomendada\b/ })).toHaveCount(0);
  await expect(page.getByText("Otimização PNG sem perdas", { exact: true })).toBeVisible();
  for (const name of ["Rápida", "Equilibrada", "Intensiva"])
    await expect(page.getByRole("button", { name: new RegExp(`^${name}\\b`) })).toBeVisible();
  await page.getByRole("button", { name: /^Intensiva\b/ }).click();
  await run(page);
  const report = page.getByRole("region", { name: "Resultado das imagens", exact: true });
  await expect(report).toContainText("96 × 48");
  await expect(report).toContainText("PNG");
});
test("rotação informa cada saída real do lote e separa o tamanho do ZIP", async ({ page }) => {
  await page.goto(route("girar-imagem"));
  const source = await photo(page);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles([
      { name: "foto.png", mimeType: "image/png", buffer: source },
      { name: "foto.png", mimeType: "image/png", buffer: await photo(page, 48, 96) },
    ]);
  await run(page);
  const report = page.getByRole("region", { name: "Resultado das imagens", exact: true });
  await expect(report.getByRole("listitem")).toHaveCount(2);
  await expect(report).toContainText("96 × 48");
  await expect(report).toContainText("48 × 96");
  await expect(report).toContainText("ZIP");
  const bytes = await download(page),
    files = unzipSync(bytes);
  expect(Object.keys(files)).toEqual(["1_foto_girado.png", "2_foto_girado.png"]);
  for (const file of Object.values(files)) expect(file.length).toBeGreaterThan(0);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
  }
});

async function sample(page: Page, bytes: Uint8Array, x: number, y: number) {
  return page.evaluate(
    async ({ bytes, x, y }) => {
      const b = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const c = new OffscreenCanvas(b.width, b.height),
        ctx = c.getContext("2d");
      if (!ctx) throw Error("Canvas");
      ctx.drawImage(b, 0, 0);
      b.close();
      return [...ctx.getImageData(x, y, 1, 1).data];
    },
    { bytes: [...bytes], x, y },
  );
}
test("espelhamento atua em todo o lote ao selecionar a segunda prévia", async ({ page }) => {
  await page.goto(route("girar-imagem"));
  const files = [
    { name: "primeira.png", mimeType: "image/png", buffer: await photo(page) },
    { name: "segunda.png", mimeType: "image/png", buffer: await photo(page, 48, 96) },
  ];
  await page.locator("input[type=file]").first().setInputFiles(files);
  await page.getByRole("button", { name: "Visualizar imagem 2: segunda.png", exact: true }).click();
  await page.getByRole("button", { name: /Girar.*esquerda/i }).click();
  await page.getByLabel("Inverter horizontal", { exact: true }).check();
  await run(page);
  const zip = unzipSync(await download(page));
  for (const [key, width] of [
    ["1_primeira_girado.png", 96],
    ["2_segunda_girado.png", 48],
  ] as const) {
    expect(await sample(page, zip[key], 2, 2)).toEqual([0, 0, 0, 0]);
    expect(await sample(page, zip[key], width - 3, 2)).toEqual([255, 0, 0, 255]);
  }
});
test("marca rápida preserva alpha e centro em todo o lote com prévia selecionada", async ({
  page,
}) => {
  await page.goto(route("marca-dagua-imagem"));
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles([
      { name: "primeira.png", mimeType: "image/png", buffer: await photo(page) },
      { name: "segunda.png", mimeType: "image/png", buffer: await photo(page, 48, 96) },
    ]);
  await page.getByRole("button", { name: "Visualizar imagem 2: segunda.png", exact: true }).click();
  await page.getByRole("button", { name: "Logotipo / Imagem", exact: true }).click();
  const logo = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 8;
      c.height = 8;
      const ctx = c.getContext("2d");
      if (!ctx) throw Error("Canvas");
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, 8, 8);
      return c.toDataURL().split(",")[1];
    }),
    "base64",
  );
  await page
    .locator("#image-watermark-logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: logo });
  await run(page);
  const zip = unzipSync(await download(page));
  for (const [key, x, y] of [
    ["1_primeira_marca_dagua.png", 48, 24],
    ["2_segunda_marca_dagua.png", 24, 48],
  ] as const) {
    const pixel = await sample(page, zip[key], x, y);
    expect(pixel.slice(0, 3)).toEqual([0, 0, 0]);
    expect(pixel[3]).toBeGreaterThanOrEqual(126);
    expect(pixel[3]).toBeLessThanOrEqual(129);
  }
});
test("perfis JPEG usam compressões efetivamente distintas", async ({ page }) => {
  await page.goto(route("comprimir-imagem"));
  const buffer = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 256;
      const ctx = c.getContext("2d");
      if (!ctx) throw Error("Canvas");
      const p = ctx.createImageData(256, 256);
      let seed = 42;
      for (let i = 0; i < p.data.length; i += 4) {
        for (let j = 0; j < 3; j++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          p.data[i + j] = seed >>> 24;
        }
        p.data[i + 3] = 255;
      }
      ctx.putImageData(p, 0, 0);
      return c.toDataURL("image/jpeg", 1).split(",")[1];
    }),
    "base64",
  );
  const sizes = [];
  for (const name of ["Baixa", "Recomendada", "Extrema"]) {
    await page.goto(route("comprimir-imagem"));
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles({ name: "ruido.jpg", mimeType: "image/jpeg", buffer });
    await page.getByRole("button", { name: new RegExp(`^${name}\\b`) }).click();
    await run(page);
    sizes.push((await download(page)).length);
  }
  expect(sizes[0]).toBeGreaterThan(sizes[1]);
  expect(sizes[1]).toBeGreaterThan(sizes[2]);
});

test("download mantém contraste no tema escuro", async ({ page }) => {
  await open(page, "converter-imagem");
  await run(page);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const button = page.getByRole("link", { name: /Baixar arquivo gerado/ });
  await button.evaluate(async (element) => {
    if (getComputedStyle(element).backgroundColor)
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  await expect
    .poll(() =>
      button.evaluate((element) => {
        const s = getComputedStyle(element);
        const luminance = (value: string) => {
          const rgb = value
            .match(/[\d.]+/g)
            ?.slice(0, 3)
            .map(Number);
          if (!rgb) throw Error("Cor inválida");
          const linear = rgb.map((n) => {
            const v = n / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
        };
        const text = luminance(s.color),
          background = luminance(s.backgroundColor);
        return (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05);
      }),
    )
    .toBeGreaterThanOrEqual(4.5);
});
