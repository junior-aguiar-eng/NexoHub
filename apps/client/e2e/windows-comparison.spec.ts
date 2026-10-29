import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium, expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test("o aplicativo Windows executa comparação, reparo, editor e ferramentas de imagem", async () => {
  test.setTimeout(
    process.env.NEXOHUB_TRANSLATION_REAL === "1" || process.env.NEXOHUB_OCR_REAL === "1"
      ? 900000
      : 180000,
  );
  const executable = process.env.NEXOHUB_DESKTOP_EXE;
  if (process.platform !== "win32" || !executable) {
    test.skip(true, "Informe NEXOHUB_DESKTOP_EXE no Windows");
    return;
  }
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Porta indisponível");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  const profile = await mkdtemp(path.join(os.tmpdir(), "nexohub-e2e-"));
  const processHandle = spawn(executable, [], {
    windowsHide: true,
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: profile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    },
  });
  try {
    const endpoint = `http://127.0.0.1:${port}`;
    await expect
      .poll(
        async () => {
          try {
            return (await fetch(`${endpoint}/json/version`)).ok;
          } catch {
            return false;
          }
        },
        { timeout: 20000 },
      )
      .toBe(true);
    const browser = await chromium.connectOverCDP(endpoint);
    try {
      const page = browser.contexts()[0].pages()[0];
      const failedAssets: string[] = [];
      const blockedResources: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error" && message.text().includes("Content Security Policy")) {
          blockedResources.push(message.text());
        }
      });
      page.on("response", (response) => {
        if (response.url().startsWith("http://tauri.localhost/") && response.status() >= 400) {
          failedAssets.push(response.url());
        }
      });
      await page.getByRole("button", { name: "Todas as ferramentas PDF" }).click();
      const editGroup = page
        .locator(".megamenu-column")
        .filter({ hasText: "Editar e comparar PDF" });
      for (const name of ["Editar PDF", "Comparar PDF", "Preencher Formulário PDF"]) {
        await expect(editGroup.getByRole("button", { name, exact: true })).toBeVisible();
      }
      const misplaced = await page.locator(".megamenu-item").evaluateAll((items) =>
        items.flatMap((item) => {
          const text = item.querySelector("span")?.getBoundingClientRect();
          const column = item.closest(".megamenu-column")?.getBoundingClientRect();
          return text && column && (text.left < column.left - 1 || text.right > column.right + 1)
            ? [item.textContent]
            : [];
        }),
      );
      expect(misplaced).toEqual([]);
      await page.getByRole("button", { name: "Todas as ferramentas PDF" }).click();
      await page.getByRole("button", { name: "Comparar PDF", exact: true }).click();
      const fixture = path.resolve("src/platform/__fixtures__/r-c1/integro.pdf");
      await page.getByLabel("PDF original", { exact: true }).setInputFiles(fixture);
      await page.getByLabel("PDF revisado", { exact: true }).setInputFiles(fixture);
      await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Baixar relatório PDF", exact: true }),
      ).toBeVisible({ timeout: 20000 });
      // Captura os bytes imediatamente antes do diálogo nativo, sem abrir a caixa modal.
      await page.evaluate(() => {
        const target = window as unknown as {
          __reportBytes?: number[];
        };
        const original = Blob.prototype.arrayBuffer;
        Blob.prototype.arrayBuffer = async function () {
          const bytes = await original.call(this);
          target.__reportBytes = Array.from(new Uint8Array(bytes));
          throw new Error("CAPTURA_E2E_RELATORIO");
        };
      });
      await page.getByRole("button", { name: "Baixar relatório PDF", exact: true }).click();
      await expect
        .poll(
          () =>
            page.evaluate(
              () => (window as unknown as { __reportBytes?: number[] }).__reportBytes?.length ?? 0,
            ),
          { timeout: 30000 },
        )
        .toBeGreaterThan(0);
      const reportBytes = await page.evaluate(
        () => (window as unknown as { __reportBytes: number[] }).__reportBytes,
      );
      expect((await PDFDocument.load(new Uint8Array(reportBytes))).getPageCount()).toBeGreaterThan(
        0,
      );
      expect(failedAssets).toEqual([]);
      await page.goto("http://tauri.localhost/reparar-pdf");
      const damaged = path.resolve("src/platform/__fixtures__/r-c1/prefixo.pdf");
      await page.locator('input[type="file"]').first().setInputFiles(damaged);
      await page
        .getByTestId("pdf-repair-idle")
        .getByRole("button", { name: "Reparar PDF" })
        .click();
      await expect(page.getByTestId("pdf-repair-success")).toBeVisible({ timeout: 20000 });
      await page.goto("http://tauri.localhost/ocr-pdf");
      await expect(page.getByRole("button", { name: "Selecionar PDF ou imagem" })).toBeVisible();
      await page.goto("http://tauri.localhost/pdf");
      await page.getByRole("button", { name: "Editar PDF", exact: true }).click();
      await page.getByLabel("Selecionar PDF", { exact: true }).setInputFiles(fixture);
      await expect(page.getByRole("button", { name: "Editar texto existente" })).toBeEnabled({
        timeout: 30000,
      });
      await expect
        .poll(() =>
          page.locator(".pdf-editor-stage").evaluate((stage) => {
            const viewport = stage.closest(".pdf-editor-scroll");
            if (!viewport) return false;
            const image = stage.getBoundingClientRect(),
              bounds = viewport.getBoundingClientRect();
            return (
              image.top >= bounds.top &&
              image.bottom <= bounds.bottom &&
              image.left >= bounds.left &&
              image.right <= bounds.right
            );
          }),
        )
        .toBe(true);
      const portrait = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 20;
        canvas.height = 300;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas indisponível");
        context.fillStyle = "red";
        context.fillRect(0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/png").split(",")[1];
      });
      await page
        .locator('input[type="file"]')
        .and(page.getByLabel("Inserir imagem", { exact: true }))
        .setInputFiles({
          name: "vertical.png",
          mimeType: "image/png",
          buffer: Buffer.from(portrait, "base64"),
        });
      const inserted = page.getByRole("button", { name: "Selecionar elemento: Inserir imagem" });
      await expect(inserted).toBeVisible();
      const imageBounds = await inserted.locator("..").boundingBox();
      if (!imageBounds) throw new Error("Imagem inserida ausente");
      expect(imageBounds.width / imageBounds.height).toBeCloseTo(20 / 300, 2);
      await page.getByRole("button", { name: "Adicionar texto", exact: true }).click();
      await expect(page.getByRole("button", { name: "Adicionar texto", exact: true })).toBeEnabled({
        timeout: 20000,
      });
      await expect(
        page.getByRole("button", { name: "Selecionar elemento: Adicionar texto" }),
      ).toBeVisible();
      page.once("dialog", (dialog) => void dialog.accept());
      await page.goto("http://tauri.localhost/redimensionar-imagem");
      const headerLayout = await page.locator(".app-header").evaluate((header) => {
        const navigation = header.querySelector(".header-main-nav")?.getBoundingClientRect();
        const items = [
          ...header.querySelectorAll(
            ".header-main-nav > button, .header-main-nav .nav-dropdown-wrapper",
          ),
        ].map((item) => item.getBoundingClientRect());
        const search = header.querySelector(".header-actions")?.getBoundingClientRect();
        return {
          noOverlap:
            !!navigation &&
            !!search &&
            navigation.right <= search.left + 1 &&
            items.every((item) => item.right <= search.left + 1),
          width: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        };
      });
      expect(headerLayout.noOverlap, JSON.stringify(headerLayout)).toBe(true);
      expect(headerLayout.width).toBeLessThanOrEqual(headerLayout.viewport);
      const image = path.resolve("src/platform/__fixtures__/q-c0-photos/coffee.png");
      await page.locator('input[type="file"]').first().setInputFiles(image);
      await expect(page.getByRole("region", { name: "Imagens do lote" })).toBeVisible();
      await page.locator(".ilovepdf-action-red-btn").click();
      await expect(page.getByRole("region", { name: "Resultado das imagens" })).toContainText(
        "300 × 200 px",
      );
      await expect(page.getByRole("button", { name: /Baixar arquivo gerado/ })).toBeVisible({
        timeout: 30000,
      });
      for (const route of [
        "comprimir-imagem",
        "recortar-imagem",
        "converter-imagem",
        "girar-imagem",
        "marca-dagua-imagem",
      ]) {
        await page.goto(`http://tauri.localhost/${route}`);
        await page.locator('input[type="file"]').first().setInputFiles(image);
        await expect(page.getByRole("region", { name: "Imagens do lote" })).toBeVisible();
        const execute = page.locator(".ilovepdf-action-red-btn");
        await expect(execute).toBeEnabled({ timeout: 30000 });
        await execute.click();
        await expect(
          page.getByRole("button", { name: /Baixar arquivo gerado/ }),
          route,
        ).toBeVisible({
          timeout: 30000,
        });
      }
      await page.goto("http://tauri.localhost/traduzir-texto");
      await page.getByRole("button", { name: "Digitar Texto" }).click();
      await page.locator("#dedicated-tool-direct-textarea").fill("{{TESTE}}");
      await page.getByRole("button", { name: "Executar agora", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await page.locator(".text-translate-output-textarea").inputValue()) ||
            (await page.getByRole("alert").allTextContents()).join(" "),
          { timeout: 30000 },
        )
        .toBe("{{TESTE}}");
      await expect(page.locator(".text-translate-output-textarea")).toHaveValue("{{TESTE}}", {
        timeout: 30000,
      });
      if (process.env.NEXOHUB_TRANSLATION_REAL === "1") {
        await page.locator("#dedicated-tool-direct-textarea").fill("Hello, how are you?");
        await page.getByRole("button", { name: "Executar agora", exact: true }).click();
        await expect
          .poll(
            async () =>
              (await page.locator(".text-translate-output-textarea").inputValue()) ||
              (await page.getByRole("alert").allTextContents()).join(" "),
            { timeout: 720000 },
          )
          .not.toBe("");
        expect(
          await page.locator(".text-translate-output-textarea").inputValue(),
          (await page.getByRole("alert").allTextContents()).join(" "),
        ).toMatch(/olá|como/i);
      }
      if (process.env.NEXOHUB_OCR_REAL === "1") {
        await page.goto("http://tauri.localhost/ocr-pdf");
        const png = await page.evaluate(() => {
          const canvas = document.createElement("canvas");
          canvas.width = 900;
          canvas.height = 250;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas indisponível");
          context.fillStyle = "white";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "black";
          context.font = "bold 70px sans-serif";
          context.fillText("DOCUMENTO TESTE 123", 25, 140);
          return canvas.toDataURL("image/png").split(",")[1];
        });
        await page
          .locator('input[type="file"]')
          .first()
          .setInputFiles({
            name: "ocr-teste.png",
            mimeType: "image/png",
            buffer: Buffer.from(png, "base64"),
          });
        await page.getByRole("button", { name: /Inglês/i }).click();
        await page.locator(".ilovepdf-action-red-btn").click();
        await expect
          .poll(
            async () =>
              (await page.locator(".ocr-result-textarea").inputValue()) ||
              (await page.getByRole("alert").allTextContents()).join(" "),
            { timeout: 180000 },
          )
          .not.toBe("");
        expect(
          await page.locator(".ocr-result-textarea").inputValue(),
          (await page.getByRole("alert").allTextContents()).join(" "),
        ).toMatch(/DOCUMENTO\s+TESTE\s+123/i);
        // A persistência seguinte abre um seletor nativo; o ensaio termina após o reconhecimento.
        processHandle.kill();
      }
      if (process.env.NEXOHUB_OCR_REAL !== "1") {
        for (const [route, title] of [
          ["editar-pdf", "Editar PDF"],
          ["comparar-pdf", "Comparar PDF"],
          ["organizar-pdf", "Organizar PDF"],
          ["juntar-pdf", "Juntar PDF"],
          ["dividir-pdf", "Dividir PDF"],
          ["rotacionar-pdf", "Rotacionar PDF"],
          ["recortar-pdf", "Recortar PDF"],
          ["comprimir-pdf", "Comprimir PDF"],
          ["reparar-pdf", "Reparar PDF"],
          ["imagem-para-pdf", "Imagem para PDF"],
          ["pdf-para-jpg", "PDF para JPG"],
          ["marca-dagua", "Inserir Marca"],
          ["numeros-de-pagina", "Número de Páginas"],
          ["ocr-pdf", "Reconhecer texto"],
          ["proteger-pdf", "Proteger PDF"],
          ["extrair-imagens", "Extrair Imagens"],
          ["comparar-textos", "Comparar textos"],
          ["revisar-texto", "Revisar texto"],
          ["traduzir-texto", "Traduzir Texto"],
          ["pdf-para-markdown", "PDF para Markdown"],
          ["assinar-pdf", "Assinar PDF"],
          ["preencher-formulario", "Preencher Formulário PDF"],
          ["desbloquear-pdf", "Desbloquear PDF"],
          ["ocultar-pdf", "Ocultar PDF"],
          ["pdf-para-excel", "PDF para Excel"],
          ["remover-paginas", "Remover Páginas"],
          ["extrair-paginas", "Extrair Páginas"],
          ["html-para-pdf", "HTML para PDF"],
          ["digitalizar-pdf", "Digitalizar para PDF"],
          ["pdf-para-word", "PDF para Word"],
          ["comprimir-imagem", "Comprimir imagem"],
          ["redimensionar-imagem", "Redimensionar imagem"],
          ["recortar-imagem", "Recortar imagem"],
          ["converter-imagem", "Converter imagem"],
          ["girar-imagem", "Girar imagem"],
          ["marca-dagua-imagem", "Marca d’água em imagem"],
        ]) {
          await page.goto(`http://tauri.localhost/${route}`);
          await expect(page.locator("main"), route).toContainText(title);
        }
      }
      expect(failedAssets).toEqual([]);
      expect(blockedResources).toEqual([]);
    } finally {
      if (process.env.NEXOHUB_OCR_REAL === "1") await browser.close().catch(() => {});
      else await browser.close();
    }
  } finally {
    processHandle.kill();
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  }
});
