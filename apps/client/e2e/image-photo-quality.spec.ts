import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const photos = [
  { id: "chelsea", hash: "596aa1e7cb875eb79f437e310381d26b338a81c2da23439704a73c4651e8c4bb" },
  { id: "coffee", hash: "cc02f8ca188b167c775a7101b5d767d1e71792cf762c33d6fa15a4599b5a8de7" },
];
const routes = [
  "comprimir-imagem",
  "converter-imagem",
  "redimensionar-imagem",
  "recortar-imagem",
  "girar-imagem",
  "marca-dagua-imagem",
];
for (const photo of photos)
  for (const route of routes) {
    test(`${photo.id}: fotografia CC0 em ${route}`, async ({ page }, info) => {
      const source = await readFile(
        new URL(`../src/platform/__fixtures__/q-c0-photos/${photo.id}.png`, import.meta.url),
      );
      expect(createHash("sha256").update(source).digest("hex")).toBe(photo.hash);
      await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}${route}`);
      await page
        .locator('input[type="file"]')
        .first()
        .setInputFiles({ name: `${photo.id}.png`, mimeType: "image/png", buffer: source });
      await expect(page.locator(".image-tool-panel img").first()).toBeVisible();
      if (route === "recortar-imagem") {
        await page.locator("#crop-w").fill("200");
        await page.locator("#crop-h").fill("100");
        await page.locator("#crop-x").fill("10");
        await page.locator("#crop-y").fill("20");
      }
      if (route === "marca-dagua-imagem") await page.locator("#wm-text").fill("Q-C0");
      await page.locator(".ilovepdf-action-red-btn").click();
      const pending = page.waitForEvent("download");
      await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
      const download = await pending;
      const output = await readFile(await download.path());
      const outputPath = info.outputPath(
        route === "converter-imagem" ? "imagem-exportada.jpg" : "imagem-exportada.png",
      );
      await writeFile(outputPath, output);
      await info.attach("imagem-exportada", {
        contentType: route === "converter-imagem" ? "image/jpeg" : "image/png",
        path: outputPath,
      });
      const metrics = await page.evaluate(
        async ({ source, output, route }) => {
          const input = await createImageBitmap(new Blob([new Uint8Array(source)]));
          const result = await createImageBitmap(new Blob([new Uint8Array(output)]));
          const width =
            route === "girar-imagem"
              ? input.height
              : route === "redimensionar-imagem"
                ? Math.round(input.width / 2)
                : route === "recortar-imagem"
                  ? 200
                  : input.width;
          const height =
            route === "girar-imagem"
              ? input.width
              : route === "redimensionar-imagem"
                ? Math.round(input.height / 2)
                : route === "recortar-imagem"
                  ? 100
                  : input.height;
          if (result.width !== width || result.height !== height)
            throw Error("Dimensões divergentes da referência");
          const reference = new OffscreenCanvas(width, height),
            actual = new OffscreenCanvas(width, height);
          const ctx = reference.getContext("2d"),
            out = actual.getContext("2d");
          if (!ctx || !out) throw Error("Canvas indisponível");
          ctx.imageSmoothingQuality = "high";
          if (route === "girar-imagem") {
            ctx.translate(width, 0);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(input, 0, 0);
          } else if (route === "recortar-imagem") ctx.drawImage(input, -10, -20);
          else ctx.drawImage(input, 0, 0, width, height);
          out.drawImage(result, 0, 0);
          const a = ctx.getImageData(0, 0, width, height).data,
            b = out.getImageData(0, 0, width, height).data;
          let squared = 0,
            changedPixels = 0,
            changedBorderPixels = 0,
            nonOpaque = 0;
          for (let pixel = 0; pixel < width * height; pixel++) {
            const offset = pixel * 4;
            let changed = false;
            for (let channel = 0; channel < 3; channel++) {
              const delta = a[offset + channel] - b[offset + channel];
              squared += delta * delta;
              changed ||= delta !== 0;
            }
            if (changed) {
              changedPixels++;
              const x = pixel % width,
                y = Math.floor(pixel / width);
              if (x < 8 || y < 8 || x >= width - 8 || y >= height - 8) changedBorderPixels++;
            }
            if (b[offset + 3] !== 255) nonOpaque++;
          }
          input.close();
          result.close();
          const mse = squared / (width * height * 3);
          return {
            width,
            height,
            mse,
            psnr: mse === 0 ? null : 10 * Math.log10(255 ** 2 / mse),
            changedPixels,
            changedBorderPixels,
            nonOpaque,
          };
        },
        { source: [...source], output: [...output], route },
      );
      expect(metrics.nonOpaque).toBe(0);
      if (route === "converter-imagem" || route === "redimensionar-imagem") {
        if (route === "converter-imagem") expect(download.suggestedFilename()).toMatch(/\.jpg$/);
        // Pica no worker e Canvas da referência usam filtros distintos no redimensionamento.
        expect(metrics.psnr ?? Number.POSITIVE_INFINITY).toBeGreaterThanOrEqual(30);
      } else if (route === "marca-dagua-imagem") {
        expect(metrics.changedPixels).toBeGreaterThan(0);
        expect(metrics.changedPixels).toBeLessThan((metrics.width * metrics.height) / 4);
        expect(metrics.changedBorderPixels).toBe(0);
      } else expect(metrics.mse).toBeLessThanOrEqual(1);
      if (route === "comprimir-imagem") expect(output.length).toBeLessThanOrEqual(source.length);
      await info.attach("resultado-fotografico", {
        contentType: "application/json",
        body: JSON.stringify({
          sourceSha256: photo.hash,
          outputSha256: createHash("sha256").update(output).digest("hex"),
          outputBytes: output.length,
          metrics,
        }),
      });
    });
  }
