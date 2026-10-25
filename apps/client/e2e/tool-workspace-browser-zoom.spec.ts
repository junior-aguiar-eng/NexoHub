import { writeFile } from "node:fs/promises";
import { chromium, expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { workspaceOptions } from "./workspace-views";

test("mesas mantêm ações acessíveis com zoom real do navegador a 200%", async () => {
  const info = test.info();
  test.setTimeout(90000);
  const context = await chromium.launchPersistentContext(info.outputPath("browser-profile"), {
    channel: "chromium",
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    viewport: null,
    reducedMotion: "reduce",
    args: ["--window-size=1366,768", "--force-device-scale-factor=1"],
  });
  try {
    const page = await context.newPage();
    const root = `${info.project.use.baseURL}${process.env.NEXOHUB_BASE_PATH ?? "/"}`;
    await page.goto(`${root}comprimir-pdf`);
    const original = await page.evaluate(() => ({
      width: innerWidth,
      outer: outerWidth,
      scale: devicePixelRatio,
    }));
    expect(original.scale).toBe(1);
    const settings = await context.newPage();
    await settings.goto("chrome://settings/appearance");
    await settings.locator("select#zoomLevel").selectOption("2");
    await expect(settings.locator("select#zoomLevel")).toHaveValue("2");
    await settings.close();
    await page.reload();
    const scaled = await page.evaluate(() => ({
      width: innerWidth,
      outer: outerWidth,
      scale: devicePixelRatio,
    }));
    expect(scaled.outer).toBe(original.outer);
    expect(scaled.scale).toBe(2);
    expect(Math.abs(scaled.width * 2 - original.width)).toBeLessThanOrEqual(2);
    await writeFile(
      info.outputPath("zoom-real.json"),
      `${JSON.stringify({ original, scaled }, null, 2)}\n`,
    );
    await info.attach("zoom-real", {
      body: JSON.stringify({ original, scaled }),
      contentType: "application/json",
    });
    const pdf = await PDFDocument.create();
    pdf
      .addPage([400, 600])
      .drawText("Documento para conferir zoom real", { x: 30, y: 500, size: 16 });
    const file = {
      name: "documento-zoom.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    };
    for (const route of ["comprimir-pdf", "editar-pdf", "comparar-pdf"]) {
      await page.goto(`${root}${route}`);
      if (route === "comparar-pdf") {
        await page.getByLabel("PDF original", { exact: true }).setInputFiles(file);
        await page.getByLabel("PDF revisado", { exact: true }).setInputFiles(file);
        await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
        const report = page.getByRole("button", { name: "Baixar relatório PDF", exact: true });
        await report.waitFor({ state: "visible" });
        await expect(report).toBeVisible();
      } else await page.locator('input[type="file"]').first().setInputFiles(file);
      await workspaceOptions(page);
      const action =
        route === "editar-pdf"
          ? page.getByRole("button", { name: "Salvar alterações", exact: true })
          : route === "comparar-pdf"
            ? page.getByRole("button", { name: "Baixar relatório PDF", exact: true })
            : page.locator(".dedicated-tool-bottom-bar .ilovepdf-action-red-btn");
      await expect(action).toBeEnabled();
      await expect(action).toBeInViewport({ ratio: 1 });
      await action.click({ trial: true });
      await action.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(action).toBeFocused();
      await expect(action).toBeInViewport({ ratio: 1 });
      const headerBounds = await page.locator(".app-header").evaluate((header) => {
        const bounds = header.getBoundingClientRect();
        return {
          bottom: bounds.bottom,
          childrenBottom: Math.max(
            ...Array.from(header.children, (child) => child.getBoundingClientRect().bottom),
          ),
        };
      });
      expect(headerBounds.childrenBottom).toBeLessThanOrEqual(headerBounds.bottom + 1);
      const metrics = await page.evaluate(() => ({
        height: document.documentElement.scrollHeight,
        viewport: innerHeight,
        width: document.documentElement.scrollWidth,
        available: innerWidth,
        scale: devicePixelRatio,
      }));
      expect(metrics.scale).toBe(2);
      expect(metrics.height).toBeLessThanOrEqual(metrics.viewport);
      expect(metrics.width).toBeLessThanOrEqual(metrics.available);
      const captureSession = await context.newCDPSession(page);
      try {
        const { data } = await captureSession.send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: false,
        });
        const capture = Buffer.from(data, "base64");
        expect(
          Math.abs(capture.readUInt32BE(16) - metrics.available * metrics.scale),
        ).toBeLessThanOrEqual(2);
        expect(
          Math.abs(capture.readUInt32BE(20) - metrics.viewport * metrics.scale),
        ).toBeLessThanOrEqual(2);
        await writeFile(info.outputPath(`${route}-200.png`), capture);
      } finally {
        await captureSession.detach();
      }
    }
  } finally {
    await context.close();
  }
});
