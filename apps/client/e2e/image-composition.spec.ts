import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { workspaceDocument, workspaceOptions } from "./workspace-views";

const route = `${process.env.NEXOHUB_BASE_PATH ?? "/"}marca-dagua-imagem`;
async function png(page: Page, logo = false) {
  const buffer = Buffer.from(
    await page.evaluate((logo) => {
      const c = document.createElement("canvas");
      c.width = logo ? 40 : 600;
      c.height = logo ? 40 : 400;
      const ctx = c.getContext("2d");
      if (!ctx) throw Error("Canvas");
      ctx.fillStyle = logo ? "#0000ff" : "#00ff00";
      ctx.fillRect(0, 0, logo ? 20 : 100, c.height);
      return c.toDataURL().split(",")[1];
    }, logo),
    "base64",
  );
  await test.info().attach("corpus-composicao", {
    contentType: "application/json",
    body: JSON.stringify({
      source: "gerador Canvas sintético neste teste, sem imagens de terceiros",
      width: logo ? 40 : 600,
      height: logo ? 40 : 400,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    }),
  });
  return buffer;
}
async function open(page: Page) {
  await page.goto(route);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "origem.png", mimeType: "image/png", buffer: await png(page) });
  await page.getByRole("button", { name: "Composição avançada", exact: true }).click();
}
async function rectangle(page: Page) {
  await page.getByRole("button", { name: "Adicionar retângulo", exact: true }).click();
  await workspaceOptions(page);
  for (const [key, value] of [
    ["x", "100"],
    ["y", "100"],
    ["width", "200"],
    ["height", "100"],
    ["color", "#ff0000"],
  ])
    await page.locator(`#composition-${key}`).fill(value);
}
async function preview(page: Page) {
  await workspaceDocument(page);
  const image = page.getByAltText("Prévia da composição", { exact: true });
  await expect(image).toBeVisible();
  await expect(page.locator(".image-composition-panel")).toHaveAttribute("data-ready", "true");
  return image.evaluate(async (img: HTMLImageElement) => [
    ...new Uint8Array(await (await fetch(img.src)).arrayBuffer()),
  ]);
}
async function pixels(page: Page, bytes: number[], x: number, y: number) {
  return page.evaluate(
    async ({ bytes, x, y }) => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const c = new OffscreenCanvas(image.width, image.height),
        ctx = c.getContext("2d");
      if (!ctx) throw Error("Canvas");
      ctx.drawImage(image, 0, 0);
      const pixel = [...ctx.getImageData(x, y, 1, 1).data];
      image.close();
      return pixel;
    },
    { bytes, x, y },
  );
}
async function download(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  return [...(await readFile(await (await pending).path()))];
}
test("retângulo, texto com acentos e histórico produzem a mesma prévia e download", async ({
  page,
}) => {
  await open(page);
  await rectangle(page);
  await page.getByRole("button", { name: "Adicionar texto", exact: true }).click();
  await page.locator("#composition-text").fill("Ação, João e café");
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.locator("#composition-text")).not.toHaveValue("Ação, João e café");
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(page.locator("#composition-text")).toHaveValue("Ação, João e café");
  const before = await preview(page);
  const ink = await page.evaluate(async (bytes) => {
    const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
    const c = new OffscreenCanvas(600, 400),
      ctx = c.getContext("2d");
    if (!ctx) throw Error("Canvas");
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const data = ctx.getImageData(0, 0, 200, 40).data;
    let ink = 0;
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 3] > 100 && data[i] + data[i + 1] + data[i + 2] < 150) ink++;
    return ink;
  }, before);
  expect(ink).toBeGreaterThan(200);
  expect(await pixels(page, before, 200, 150)).toEqual([255, 0, 0, 255]);
  expect(await pixels(page, before, 500, 350)).toEqual([0, 0, 0, 0]);
  const after = await download(page);
  expect(after).toEqual(before);
});
test("imagem com alpha, ordem, exclusão e modo rápido preservado", async ({ page }) => {
  await open(page);
  await rectangle(page);
  await page
    .locator("#composition-image")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await png(page, true) });
  for (const [key, v] of [
    ["x", "100"],
    ["y", "100"],
    ["width", "100"],
    ["height", "100"],
  ])
    await page.locator(`#composition-${key}`).fill(v);
  let bytes = await preview(page);
  expect(await pixels(page, bytes, 110, 110)).toEqual([0, 0, 255, 255]);
  expect(await pixels(page, bytes, 180, 110)).toEqual([255, 0, 0, 255]);
  await page.getByRole("button", { name: "Enviar para trás", exact: true }).click();
  bytes = await preview(page);
  expect(await pixels(page, bytes, 110, 110)).toEqual([255, 0, 0, 255]);
  await page.getByRole("button", { name: "Excluir objeto", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Objetos da composição" }).getByRole("button"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Objetos da composição" }).getByRole("button"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Marca d’água rápida", exact: true }).click();
  await expect(page.locator("#wm-text")).toBeVisible();
  await page.getByRole("button", { name: "Composição avançada", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Objetos da composição" }).getByRole("button"),
  ).toHaveCount(2);
});
test("mesa avançada cabe em quatro larguras e descarta prévias antigas", async ({ page }) => {
  await open(page);
  await rectangle(page);
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
  }
  await page.locator("#composition-color").fill("#0000ff");
  await page.locator("#composition-color").fill("#ff0000");
  const bytes = await preview(page);
  expect(await pixels(page, bytes, 200, 150)).toEqual([255, 0, 0, 255]);
});

test("mover pelo canvas registra um único comando e mantém pixels do original", async ({
  page,
}) => {
  await open(page);
  await rectangle(page);
  await preview(page);
  const canvas = page.locator(".image-composition-interaction .upper-canvas");
  await expect(canvas).toBeVisible();
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  if (!bounds) throw Error("Canvas");
  const scale = bounds.width / 600;
  await page.mouse.move(bounds.x + 200 * scale, bounds.y + 150 * scale);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 240 * scale, bounds.y + 170 * scale, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator("#composition-x")).toHaveValue("140");
  expect(
    Math.abs(Number(await page.locator("#composition-y").inputValue()) - 120),
  ).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Desfazer", exact: true }).click();
  await expect(page.locator("#composition-x")).toHaveValue("100");
  await page.getByRole("button", { name: "Refazer", exact: true }).click();
  await expect(page.locator("#composition-x")).toHaveValue("140");
  const bytes = await preview(page);
  expect(await pixels(page, bytes, 150, 130)).toEqual([255, 0, 0, 255]);
});

test("aguarda imagem adicionada antes de exportar, sem omitir o asset", async ({ page }) => {
  await open(page);
  await rectangle(page);
  await preview(page);
  await page.evaluate(() => {
    const decode = window.createImageBitmap;
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async (...args: Parameters<typeof createImageBitmap>) => {
        const bitmap: ImageBitmap = await Reflect.apply(decode, window, args);
        if (bitmap.width === 40)
          await new Promise<void>((resolve) => {
            Object.assign(window, { assetDecodeWaiting: true, releaseAssetDecode: resolve });
          });
        return bitmap;
      },
    });
  });
  await page
    .locator("#composition-image")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await png(page, true) });
  await page.waitForFunction(() => Reflect.get(window, "assetDecodeWaiting"));
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await page.evaluate(() => Reflect.get(window, "releaseAssetDecode")());
  await expect(
    page.getByRole("list", { name: "Objetos da composição" }).getByRole("button"),
  ).toHaveCount(2);
  await preview(page);
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeEnabled();
  const bytes = await download(page);
  expect(await pixels(page, bytes, 5, 5)).toEqual([0, 0, 255, 255]);
});

test("sair do modo avançado cancela a importação e libera a execução ao voltar", async ({
  page,
}) => {
  await open(page);
  await rectangle(page);
  await page.evaluate(() => {
    const decode = window.createImageBitmap;
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: async (...args: Parameters<typeof createImageBitmap>) => {
        const bitmap: ImageBitmap = await Reflect.apply(decode, window, args);
        if (bitmap.width === 40)
          await new Promise<void>((resolve) => {
            Object.assign(window, { assetDecodeWaiting: true, releaseAssetDecode: resolve });
          });
        return bitmap;
      },
    });
  });
  await page
    .locator("#composition-image")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: await png(page, true) });
  await page.waitForFunction(() => Reflect.get(window, "assetDecodeWaiting"));
  await page.getByRole("button", { name: "Marca d’água rápida", exact: true }).click();
  await page.getByRole("button", { name: "Composição avançada", exact: true }).click();
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeEnabled();
  await page.evaluate(() => Reflect.get(window, "releaseAssetDecode")());
  await preview(page);
  await expect(
    page.getByRole("list", { name: "Objetos da composição" }).getByRole("button"),
  ).toHaveCount(1);
});

test("valida o lote inteiro e compõe todas as imagens após remover a incompatível", async ({
  page,
}) => {
  await open(page);
  await rectangle(page);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "pequena.png", mimeType: "image/png", buffer: await png(page, true) });
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await expect(page.getByRole("alert").first()).toContainText("fora de uma das imagens do lote");
  await page.getByRole("button", { name: "Remover imagem 2: pequena.png", exact: true }).click();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "segunda.png", mimeType: "image/png", buffer: await png(page) });
  await page.getByRole("button", { name: "Visualizar imagem 2: segunda.png", exact: true }).click();
  await preview(page);
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeEnabled();
  const zip = unzipSync(new Uint8Array(await download(page)));
  expect(Object.keys(zip)).toEqual(["1_origem_marca_dagua.png", "2_segunda_marca_dagua.png"]);
  for (const bytes of Object.values(zip))
    expect(await pixels(page, [...bytes], 200, 150)).toEqual([255, 0, 0, 255]);
});
test("elipse preserva alpha fora da forma e desenha o centro", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Adicionar elipse", exact: true }).click();
  for (const [key, v] of [
    ["x", "200"],
    ["y", "100"],
    ["width", "100"],
    ["height", "100"],
    ["color", "#ff0000"],
  ])
    await page.locator(`#composition-${key}`).fill(v);
  const bytes = await preview(page);
  expect(await pixels(page, bytes, 250, 150)).toEqual([255, 0, 0, 255]);
  expect(await pixels(page, bytes, 200, 100)).toEqual([0, 0, 0, 0]);
});
test("mover por toque usa coordenadas do original na tela móvel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await rectangle(page);
  for (const [key, v] of [
    ["x", "20"],
    ["y", "20"],
    ["width", "400"],
    ["height", "250"],
  ])
    await page.locator(`#composition-${key}`).fill(v);
  await preview(page);
  const canvas = page.locator(".image-composition-interaction .upper-canvas");
  // O scroll "nearest" pode deixar o alvo sob o cabeçalho fixo; CDP não verifica oclusão.
  await canvas.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  const bounds = await canvas.boundingBox();
  if (!bounds) throw Error("Canvas");
  const scale = bounds.width / 600;
  const cdp = await page.context().newCDPSession(page);
  const x = bounds.x + 220 * scale,
    y = bounds.y + 145 * scale;
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.classList.contains("upper-canvas"),
      { x, y },
    ),
  ).toBe(true);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 40 * scale, y: y + 20 * scale, id: 1 }],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect
    .poll(async () => Number(await page.locator("#composition-x").inputValue()))
    .toBeGreaterThan(20);
  expect(
    Math.abs(Number(await page.locator("#composition-x").inputValue()) - 60),
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(Number(await page.locator("#composition-y").inputValue()) - 40),
  ).toBeLessThanOrEqual(2);
});
