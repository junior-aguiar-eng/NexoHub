import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { workspaceOptions } from "./workspace-views";

test("seleção da compressão mantém círculo e check sem deformação", async ({ page }) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]).drawText("Documento", { x: 40, y: 500 });
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}comprimir-pdf`);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  const selected = page.locator(".ilovepdf-level-card--selected");
  await expect(selected).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
    for (const width of [390, 768, 1024, 1366]) {
      await page.setViewportSize({ width, height: 844 });
      await workspaceOptions(page);
      const circle = await selected.locator(".ilovepdf-level-check").boundingBox();
      const check = await selected.locator(".ilovepdf-level-check svg").boundingBox();
      const text = await selected.locator(".ilovepdf-level-info").boundingBox();
      // O layout fracionário do navegador pode somar frações de subpixel (22,00003 px em um
      // runner da CI). A deformação que importa é de pixels inteiros, então compara com 0,05 px.
      expect(circle?.width).toBeCloseTo(22, 1);
      expect(circle?.height).toBeCloseTo(22, 1);
      expect(check?.width).toBeCloseTo(14, 1);
      expect(check?.height).toBeCloseTo(14, 1);
      expect(text && circle && text.x + text.width + 8).toBeLessThanOrEqual(circle?.x ?? 0);
    }
  }
  await selected.screenshot({ path: test.info().outputPath("selecao-corrigida.png") });
});
