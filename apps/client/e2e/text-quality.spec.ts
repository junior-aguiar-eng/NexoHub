import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  comparisonReference,
  reviewReference,
} from "../src/platform/__fixtures__/q-c0-text/corpus";

const base = process.env.NEXOHUB_BASE_PATH === "/hub/" ? "/hub" : "";

test("comparação não recupera arquivo de outra coluna após apagar o texto selecionado", async ({
  page,
}) => {
  await page.goto(`${base}/comparar-textos`);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      ["Original 00123", "Segundo 00999", "Terceiro 00456"].map((text, index) => ({
        name: `controle-${index}.txt`,
        mimeType: "text/plain",
        buffer: Buffer.from(text),
      })),
    );
  await page.getByRole("button", { name: "Doc 1 × 3" }).click();
  await page.getByRole("button", { name: /Editar \/ Digitar/i }).click();
  await page.locator(".doc-compare-textarea").nth(2).fill("");
  await expect(page.getByRole("button", { name: /Exportar/i })).toBeDisabled();
  const run = page.getByRole("button", { name: "Comparar Textos", exact: true });
  await expect(run).toBeDisabled();
  await page.getByRole("button", { name: "Doc 1 × 2" }).click();
  await run.click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar arquivo gerado", exact: true }).click();
  const report = await readFile(await (await download).path(), "utf8");
  expect(report).toContain("+ Segundo 00999");
  expect(report).not.toContain("Terceiro 00456");
});

test("comparação exporta o par visível e preserva conteúdo literal no relatório", async ({
  page,
}) => {
  await page.goto(`${base}/comparar-textos`);
  const editors = page.locator(".doc-compare-textarea");
  await editors.nth(0).fill(comparisonReference.original);
  await editors.nth(1).fill("Segundo 00999");
  await page.getByRole("button", { name: /Adicionar 3º Documento/i }).click();
  await editors.nth(2).fill(comparisonReference.modified);
  await page.getByRole("button", { name: "Doc 1 × 3" }).click();
  await page.getByRole("button", { name: /Exportar/i }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar arquivo gerado", exact: true }).click();
  const report = await readFile(await (await download).path(), "utf8");
  expect(report).toContain("Linhas adicionadas: +2");
  expect(report).toContain("Linhas removidas: -1");
  expect(report).toContain("- Código 00123 — valor R$ 1.234,56.");
  expect(report).toContain("+ Código 00124 — valor R$ 0,50.");
  expect(report).toContain("<script>globalThis.__qC0 = 1</script>");
  expect(report).not.toContain("Segundo 00999");
  expect(await page.evaluate(() => Reflect.get(globalThis, "__qC0"))).toBeUndefined();
});

test("comparador recusa excesso de linhas e recupera após edição", async ({ page }) => {
  await page.goto(`${base}/comparar-textos`);
  const editors = page.locator(".doc-compare-textarea");
  await editors.nth(1).fill("Outro texto");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "limite.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("linha\n".repeat(10_001)),
    });
  await expect(page.getByRole("alert")).toContainText("10.000 linhas");
  await expect(page.getByRole("button", { name: /Exportar/i })).toBeDisabled();
  await page.getByRole("button", { name: /Editar \/ Digitar/i }).click();
  await editors.nth(0).fill("Texto válido");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Exportar/i })).toBeEnabled();
});

test("dicionário indisponível não gera relatório de revisão bem-sucedida", async ({ page }) => {
  await page.route("**/dictionaries/**", (route) => route.abort());
  await page.goto(`${base}/revisar-texto`);
  await page.getByRole("button", { name: "Digitar Texto", exact: true }).click();
  await page.locator("#dedicated-tool-direct-textarea").fill("Este relatóriu está incorreto.");
  await page.getByRole("button", { name: "Revisar Texto", exact: true }).click();
  await expect(page.getByText(/Não foi possível carregar o corretor de português/i)).toBeVisible();
  await expect(
    page.getByText("Nenhum problema ortográfico ou gramatical encontrado!", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Baixar arquivo gerado", exact: true })).toHaveCount(
    0,
  );
});

test("revisor real aguarda aplicação e baixa texto corrigido preservando identificadores", async ({
  page,
}) => {
  await page.goto(`${base}/revisar-texto`);
  await page.getByRole("button", { name: "Digitar Texto", exact: true }).click();
  await page.locator("#dedicated-tool-direct-textarea").fill(reviewReference.original);
  const run = page.getByRole("button", { name: "Revisar Texto", exact: true });
  await run.click();
  const editor = page.locator(".text-review-textarea");
  await expect(page.locator(".text-review-findings-list")).toContainText("relatório");
  await expect(editor).toHaveValue(reviewReference.original);
  await page.getByRole("button", { name: "Aplicar Todas as Correções", exact: true }).click();
  await expect(editor).toHaveValue(reviewReference.corrected);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar Arquivo .txt", exact: true }).click();
  expect(await readFile(await (await download).path(), "utf8")).toBe(reviewReference.corrected);
  await editor.fill("🙂 Texto editado manualmente: 00123.");
  await expect(page.locator(".text-review-findings-list")).toHaveCount(0);
  const manual = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar Arquivo .txt", exact: true }).click();
  expect(await readFile(await (await manual).path(), "utf8")).toBe(
    "🙂 Texto editado manualmente: 00123.",
  );
});
