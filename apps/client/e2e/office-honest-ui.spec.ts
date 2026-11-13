import { expect, test } from "@playwright/test";
import { workspaceOptions } from "./workspace-views";

const base = process.env.NEXOHUB_BASE_PATH ?? "/";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
]) {
  test(`Suíte Office E2E (${viewport.width}x${viewport.height}): offline honesto e Desktop simulado sem overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    // 1. No navegador offline, /word-para-pdf explica honestamente a exigência Desktop/Nuvem sem botão falso
    await page.goto(`${base}word-para-pdf`);
    await workspaceOptions(page);
    await expect(page.getByTestId("office-offline-notice")).toBeVisible();
    await expect(page.getByRole("button", { name: "Converter Word para PDF" })).toHaveCount(0);

    const offlineOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(offlineOverflow).toBe(false);

    // 2. Com Tauri IPC simulado no Desktop, executa convert_office_document end-to-end
    await page.addInitScript(() => {
      const pdfBytes = Array.from(
        new TextEncoder().encode("%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"),
      );
      (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === "list_capabilities") {
            return {
              capabilities: [
                {
                  id: "office.suite",
                  title: "Suíte Office NexoHub",
                  summary: "Motor portátil",
                  benefit: "Offline",
                  category: "office",
                  diskSizeBytes: 293601280,
                  status: "installed",
                  isOptional: true,
                },
              ],
            };
          }
          if (cmd === "convert_office_document") {
            return {
              fileName: "proposta.pdf",
              mimeType: "application/pdf",
              bytes: pdfBytes,
              outputBytesLen: pdfBytes.length,
              durationMs: 185,
            };
          }
          if (cmd === "pick_project_folder") {
            return { path: "C:/FakeProject", name: "FakeProject" };
          }
          return null;
        },
      };
    });

    await page.goto(`${base}excel-para-pdf`);
    await page.locator('input[type="file"]').setInputFiles({
      name: "proposta.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("PK\x03\x04mock-xlsx"),
    });

    await workspaceOptions(page);
    await expect(page.getByTestId("office-desktop-capability")).toContainText(
      /Superpoder Suíte Office ativo/i,
    );

    const convertBtn = page.getByRole("button", { name: "Converter Excel para PDF" });
    await expect(convertBtn).toBeEnabled();
    await convertBtn.click();

    await expect(page.getByText(/Conversão Office concluída/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Baixar arquivo convertido/i })).toBeVisible();

    const desktopOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desktopOverflow).toBe(false);
  });
}
