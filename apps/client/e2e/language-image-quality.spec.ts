import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";

test("corretor real preserva frases corretas e detecta erro fora das regras prontas", async ({
  page,
}) => {
  await page.goto("/revisar-texto");
  await page.getByRole("button", { name: "Digitar Texto", exact: true }).click();
  const input = page.locator("#dedicated-tool-direct-textarea");
  const correct =
    "O agente foi ao local. Isso nos faz felizes. Ele nos disse a verdade. Eu negocio contratos e publico relatórios.";
  await input.fill(correct);
  const run = page.getByRole("button", { name: "Revisar Texto", exact: true });
  await run.click();
  await expect(run).toBeEnabled();
  await expect(page.locator(".text-review-textarea")).toHaveValue(correct);
  await expect(page.locator(".text-review-findings-list")).toHaveCount(0);
  await input.fill("Este relatóriu está incorreto.");
  await run.click();
  await expect(run).toBeEnabled();
  await expect(page.locator(".text-review-findings-list")).toContainText("relatóriu");
  await expect(page.locator(".text-review-findings-list")).toContainText("relatório");
  await expect(page.locator(".text-review-textarea")).toHaveValue("Este relatóriu está incorreto.");
});

test("imagem para PDF conserva quantidade, proporção e formatos PNG/JPEG/WebP", async ({
  page,
}) => {
  await page.goto("/imagem-para-pdf");
  const images = await page.evaluate(async () => {
    const result: { mimeType: string; bytes: number[] }[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 48;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    context.fillStyle = "#e11d48";
    context.fillRect(0, 0, 48, 48);
    context.fillStyle = "#00875f";
    context.fillRect(48, 0, 48, 48);
    for (const mimeType of ["image/png", "image/jpeg", "image/webp"]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mimeType, 0.95),
      );
      if (!blob) throw new Error("Formato de imagem indisponível");
      result.push({ mimeType, bytes: [...new Uint8Array(await blob.arrayBuffer())] });
    }
    return result;
  });
  await page.locator('input[type="file"]').setInputFiles(
    images.map((image, index) => ({
      name: `imagem-${index}.${["png", "jpg", "webp"][index]}`,
      mimeType: image.mimeType,
      buffer: Buffer.from(image.bytes),
    })),
  );
  await page.getByRole("button", { name: "Ajustar à imagem", exact: true }).click();
  await page.getByRole("button", { name: "Sem margem", exact: true }).click();
  await page.locator(".ilovepdf-action-red-btn").click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  const pdf = await PDFDocument.load(await readFile(await (await download).path()));
  expect(pdf.getPageCount()).toBe(3);
  for (const sheet of pdf.getPages()) {
    expect(sheet.getWidth()).toBe(96);
    expect(sheet.getHeight()).toBe(48);
    const images = sheet.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
    expect(images?.keys().length).toBeGreaterThan(0);
  }
});
