import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const page = await browser.newPage();
const root =
  process.env.NEXOHUB_CAPTURE_DIR ??
  path.resolve(import.meta.dirname, "../test-results/visual-modes");
await mkdir(root, { recursive: true });
const results = [];
for (const width of [390, 768, 1024, 1440, 1920])
  for (const mode of ["pdf", "img"]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:4173/${mode}`);
    await page.locator(".tool-card").first().waitFor();
    await page.waitForTimeout(600);
    results.push(
      await page.evaluate(
        ({ width, mode }) => ({
          width,
          mode,
          overflow: document.documentElement.scrollWidth > innerWidth,
          firstCardY: document.querySelector(".tool-card").getBoundingClientRect().top,
          columns: getComputedStyle(document.querySelector(".tool-grid")).gridTemplateColumns,
          cardHeight: document.querySelector(".tool-card").getBoundingClientRect().height,
          toggleWidth: document.querySelector(".zone-toggle").getBoundingClientRect().width,
        }),
        { width, mode },
      ),
    );
    await page.screenshot({ path: `${root}/${mode}-${width}.png`, fullPage: true });
  }
await writeFile(`${root}/medidas.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
await browser.close();
