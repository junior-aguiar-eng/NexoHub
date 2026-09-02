import { expect, test } from "@playwright/test";

test("abre o Launcher compartilhado", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Documentos complexos/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comece por uma tarefa" })).toBeVisible();
});

test("troca de suíte e filtra os cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PDF" }).click();

  await expect(page.getByText("Organizar PDF")).toBeVisible();
  await expect(page.getByText("Comparar textos")).toHaveCount(0);
});

test("navega entre suítes pelo teclado", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Início" }).focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("button", { name: "PDF" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Organizar PDF")).toBeVisible();
});

test("abre e fecha a paleta de comandos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Buscar no NexoHub/i })).toBeVisible();
  await page.keyboard.press("Control+k");

  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
  await expect(page.getByPlaceholder("Digite uma suíte ou ferramenta...")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toHaveCount(0);
});

test("abre o Studio e retorna ao Launcher", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Studio" }).click();

  await expect(
    page.getByRole("heading", { name: "Seu documento, com contexto preservado" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Anchors" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar anchor" })).toBeDisabled();

  await page.getByRole("button", { name: "Voltar ao Launcher" }).click();
  await expect(page.getByRole("heading", { name: /Documentos complexos/i })).toBeVisible();
});

test("promove uma Quick Tool para um NexoFlow no Studio", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Comprimir PDF" });
  await card.getByRole("button", { name: "Continuar no Studio" }).click();

  await expect(page.getByRole("heading", { name: "NexoFlow" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "NexoFlow" }).getByText("pdf-compress", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nexo Layers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overlay PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adicionar overlay" })).toBeDisabled();
});

test("edita um rascunho textual sem simular persistência", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Comparar textos" });
  await card.getByRole("button", { name: "Continuar no Studio" }).click();

  const editor = page.getByRole("textbox", { name: "Conteúdo textual" });
  await editor.fill("Texto jurídico em UTF-8");
  await expect(editor).toHaveValue("Texto jurídico em UTF-8");
  await expect(page.getByRole("button", { name: "Criar revisão" })).toBeDisabled();
});

test("exige o LanguageTool Community para revisar texto", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Revisar texto" });
  await card.getByRole("button", { name: "Continuar no Studio" }).click();

  await expect(page.getByText(/LanguageTool Community pt-BR é obrigatório/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Analisar texto" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Criar revisão" })).toBeDisabled();
});

test("apresenta o OCR como processamento local condicionado a artifact", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Reconhecer texto" });
  await card.getByRole("button", { name: "Continuar no Studio" }).click();

  await expect(
    page.getByRole("heading", { name: "Reconhecimento óptico de caracteres" }),
  ).toBeVisible();
  await expect(page.getByText(/Processamento offline/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Executar OCR" })).toBeDisabled();
});
