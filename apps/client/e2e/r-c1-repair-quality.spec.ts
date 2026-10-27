import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFArray, PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { createRepairCorpus } from "../src/platform/__fixtures__/r-c1/corpus";
import { workspaceDocument, workspaceOptions } from "./workspace-views";

test("R-C1: recusa perda de metadados em vez de entregar recuperação silenciosa", async ({
  page,
}) => {
  const item = (await createRepairCorpus()).find((item) => item.id === "sem-xref-trailer");
  if (!item) throw new Error("Corpus ausente");
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}reparar-pdf`);
  await page.locator('input[type="file"]').setInputFiles({
    name: "truncado.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(item.bytes),
  });
  await page.getByRole("button", { name: "Reparar PDF", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Falha na Recuperação");
  await workspaceOptions(page);
  await expect(
    page.getByText(
      "Não foi possível reparar este arquivo sem perder informações. O original foi preservado.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar PDF Reparado" })).toHaveCount(0);
});

test("R-C1: repara em worker e preserva formulário, anexo e metadados no download", async ({
  page,
}) => {
  const item = (await createRepairCorpus()).find((item) => item.id === "prefixo");
  if (!item) throw new Error("Corpus ausente");
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}reparar-pdf`);
  await page.locator('input[type="file"]').setInputFiles({
    name: "corpus.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(item.bytes),
  });
  await page.getByRole("button", { name: "Reparar PDF", exact: true }).click();
  await page.getByTestId("pdf-repair-success").waitFor();
  await workspaceDocument(page);
  await expect(page.getByAltText("Prévia da página 1 do arquivo reparado")).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Área do documento" })
      .getByText("corpus_reparado.pdf", { exact: true }),
  ).toBeVisible();
  await workspaceOptions(page);
  const wait = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar PDF Reparado" }).click();
  const download = await wait;
  const path = await download.path();
  if (!path) throw new Error("Download ausente");
  const doc = await PDFDocument.load(await readFile(path), { updateMetadata: false });
  expect(doc.getPageCount()).toBe(2);
  expect(doc.getForm().getTextField("nome").getText()).toBe("Maria Silva");
  expect(doc.getTitle()).toBe("Relatório autoral R-C1");
  const names = doc.catalog.lookup(PDFName.of("Names"), PDFDict);
  expect(
    names.lookup(PDFName.of("EmbeddedFiles"), PDFDict).lookup(PDFName.of("Names"), PDFArray).size(),
  ).toBe(2);
});

test("R-C1: cancelar durante inicialização termina worker e impede download tardio", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Worker = new Proxy(window.Worker, {
      construct(Target, args: ConstructorParameters<typeof Worker>) {
        const worker = Reflect.construct(Target, args) as Worker;
        // Segura somente a entrada do job; o worker real continua carregando e pode ser terminado.
        if (String(args[0]).includes("pdf-repair.worker-")) worker.postMessage = () => {};
        return worker;
      },
    });
  });
  const doc = await PDFDocument.create();
  doc.addPage();
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}reparar-pdf`);
  await page.locator('input[type="file"]').setInputFiles({
    name: "original.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await doc.save()),
  });
  await expect(page.getByAltText(/^Prévia da página 1 do original/)).toBeVisible();
  const started = page.waitForEvent("worker", {
    predicate: (worker) => worker.url().includes("pdf-repair.worker-"),
  });
  await page.getByRole("button", { name: "Reparar PDF", exact: true }).click();
  const worker = await started;
  const closed = worker.waitForEvent("close");
  await page.getByRole("button", { name: "Cancelar reparo", exact: true }).click();
  await closed;
  await expect(page.getByRole("link", { name: "Baixar PDF Reparado" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reparar PDF", exact: true })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
