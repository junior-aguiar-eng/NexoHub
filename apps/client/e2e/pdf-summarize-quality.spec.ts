import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { workspaceDocument, workspaceOptions } from "./workspace-views";

const base = process.env.NEXOHUB_BASE_PATH ?? "/";

async function createMultiPageContractPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const page1 = doc.addPage([595, 842]);
  page1.drawText("CONTRATO DE PRESTACAO DE SERVICOS - CLAUSULA 1", {
    x: 48,
    y: 760,
    size: 13,
    font,
  });
  page1.drawText(
    "Objeto: fornecimento de plataforma documental local com entrega em 30 dias uteis a partir de 01/12/2026.",
    {
      x: 48,
      y: 724,
      size: 10.5,
      font,
      maxWidth: 490,
    },
  );

  const page2 = doc.addPage([595, 842]);
  page2.drawText("CLAUSULA 2 - PRECO, PRAZOS E MULTA", {
    x: 48,
    y: 760,
    size: 13,
    font,
  });
  page2.drawText(
    "Valor total de R$ 24.000,00 com pagamento em duas parcelas mensais e multa de 2% em caso de atraso injustificado.",
    {
      x: 48,
      y: 724,
      size: 10.5,
      font,
      maxWidth: 490,
    },
  );

  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

async function createGraphicOnlyPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([420, 420]);
  page.drawRectangle({ x: 40, y: 40, width: 320, height: 320 });
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
]) {
  test(`Resumir PDF E2E (${viewport.width}x${viewport.height}): citações clicáveis [p. X], exportações e atalho OCR sem overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    // Worker SLM determinístico no CI: todo o parsing PDF.js, chunking, prévia e exportações continuam reais
    await page.addInitScript(() => {
      const OriginalWorker = window.Worker;
      class DeterministicSummarizeWorker {
        private messageListeners = new Set<(event: MessageEvent) => void>();
        private errorListeners = new Set<(event: ErrorEvent) => void>();

        addEventListener(type: string, listener: EventListener) {
          if (type === "message") {
            this.messageListeners.add(listener as (event: MessageEvent) => void);
          } else if (type === "error") {
            this.errorListeners.add(listener as (event: ErrorEvent) => void);
          }
        }

        removeEventListener(type: string, listener: EventListener) {
          if (type === "message") {
            this.messageListeners.delete(listener as (event: MessageEvent) => void);
          } else if (type === "error") {
            this.errorListeners.delete(listener as (event: ErrorEvent) => void);
          }
        }

        terminate() {
          // No-op determinístico
        }

        postMessage(request: { type?: string; requestId?: string; chunks?: unknown[] }) {
          if (request?.type !== "summarize" || !request.requestId) return;
          const requestId = request.requestId;
          const emit = (data: unknown) => {
            for (const fn of this.messageListeners) {
              fn({ data } as MessageEvent);
            }
          };

          window.setTimeout(() => {
            emit({
              type: "progress",
              requestId,
              progress: {
                phase: "downloading",
                progress: 26,
                loadedBytes: 130 * 1024 * 1024,
                totalBytes: 390 * 1024 * 1024,
                device: "wasm",
              },
            });
          }, 25);

          window.setTimeout(() => {
            emit({
              type: "progress",
              requestId,
              progress: {
                phase: "mapping",
                progress: 68,
                currentChunk: 1,
                totalChunks: Math.max(1, request.chunks?.length ?? 1),
                device: "wasm",
              },
            });
          }, 55);

          window.setTimeout(() => {
            emit({
              type: "result",
              requestId,
              summaryMarkdown:
                "## Síntese Executiva\n- Prazo de entrega de 30 dias úteis a partir de 01/12/2026 [p. 1].\n- Valor total R$ 24.000,00 com multa de 2% por atraso [p. 2].",
              deviceUsed: "wasm",
              modelId: "onnx-community/Qwen2.5-0.5B-Instruct",
            });
          }, 95);
        }
      }

      window.Worker = new Proxy(OriginalWorker, {
        construct(target, args, newTarget) {
          const scriptUrl = String(args[0] ?? "");
          if (scriptUrl.includes("pdf-summarize")) {
            return new DeterministicSummarizeWorker() as unknown as Worker;
          }
          return Reflect.construct(target, args, newTarget);
        },
      });
    });

    await page.goto(`${base}resumir-pdf`);
    await page.locator('input[type="file"]').setInputFiles({
      name: "contrato-local.pdf",
      mimeType: "application/pdf",
      buffer: await createMultiPageContractPdf(),
    });

    await workspaceOptions(page);
    await expect(page.getByText(/100% local — seu PDF nunca sai deste dispositivo/i)).toBeVisible();

    const runButton = page.getByRole("button", { name: "Resumir PDF localmente", exact: true });
    await expect(runButton).toBeEnabled();
    await runButton.click();

    const summaryOutput = page.getByTestId("pdf-summary-output");
    await summaryOutput.waitFor({ state: "visible", timeout: 25_000 });
    await expect(summaryOutput.getByText(/30 dias úteis/i)).toBeVisible();

    // Clica na citação [p. 2] e verifica navegação real na prévia do PDF
    await summaryOutput.getByRole("button", { name: /Ir para a página 2 na prévia/i }).click();
    await workspaceDocument(page);
    await expect(page.getByTestId("pdf-summarize-preview-page")).toHaveText("Página 2 de 2");

    // Baixa .md e .pdf gerados localmente
    await workspaceOptions(page);
    const mdDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Baixar \.md/i }).click();
    const mdDownload = await mdDownloadPromise;
    expect(mdDownload.suggestedFilename()).toBe("contrato-local_resumo.md");
    const mdText = await readFile(await mdDownload.path(), "utf8");
    expect(mdText).toContain("[p. 2]");

    const pdfDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Baixar \.pdf/i }).click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toBe("contrato-local_resumo.pdf");
    const outPdfBytes = new Uint8Array(await readFile(await pdfDownload.path()));
    const parsedOutPdf = await PDFDocument.load(outPdfBytes);
    expect(parsedOutPdf.getPageCount()).toBeGreaterThanOrEqual(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);

    // 2. Testa PDF puramente gráfico -> detecção honesta e atalho direto para /ocr-pdf
    await page.getByRole("button", { name: /Trocar arquivo/i }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: "sem-texto.pdf",
      mimeType: "application/pdf",
      buffer: await createGraphicOnlyPdf(),
    });
    await workspaceOptions(page);
    await page.getByRole("button", { name: "Resumir PDF localmente", exact: true }).click();

    await expect(page.getByText(/PDF sem texto selecionável detectado/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Abrir OCR PDF/i }).click();
    await expect(page).toHaveURL(/\/ocr-pdf/);
  });
}
