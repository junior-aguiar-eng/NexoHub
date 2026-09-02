import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { preview } from "vite";

const output = resolve(import.meta.dirname, "../../../docs/images");
await mkdir(output, { recursive: true });
const server = await preview({ preview: { host: "127.0.0.1", port: 4173, strictPort: true } });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 1,
  });
  await page.goto("http://127.0.0.1:4173/");
  await page.screenshot({ path: resolve(output, "launcher.png"), fullPage: true });
  await page.getByRole("button", { name: "Abrir Studio" }).click();
  await page.screenshot({ path: resolve(output, "studio.png"), fullPage: true });
} finally {
  await browser.close();
  await server.close();
}
