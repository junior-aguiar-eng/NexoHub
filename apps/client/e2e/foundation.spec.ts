import { expect, test } from "@playwright/test";

test("abre o Launcher compartilhado", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Documentos jurídicos|Documentos complexos/i }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comece por uma tarefa" })).toBeVisible();
});

test("troca de suíte e filtra os cards", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Processamento" }).click();

  await expect(page.getByText("Organizar PDF")).toBeVisible();
  await expect(page.getByText("Comparar textos")).toHaveCount(0);
});

test("navega entre suítes pelo teclado", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Todas" }).focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("button", { name: "Processamento" })).toHaveAttribute(
    "aria-current",
    "page",
  );
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
  await page.getByRole("button", { name: "Abrir Studio" }).first().click();

  await expect(
    page.getByRole("heading", { name: "Seu documento, com contexto preservado" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Auditor|Inspector/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Âncoras|Anchors/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Criar âncora|Criar anchor/i })).toBeDisabled();

  await page.getByRole("button", { name: "Voltar ao Launcher" }).click();
  await expect(
    page.getByRole("heading", { name: /Documentos jurídicos|Documentos complexos/i }),
  ).toBeVisible();
});

test("promove uma Quick Tool para um NexoFlow no Studio", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Comprimir PDF" });
  await card.getByRole("button", { name: "Continuar no Studio" }).click();

  await expect(page.getByRole("heading", { name: "NexoFlow" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "NexoFlow" })
      .getByRole("listitem")
      .filter({ hasText: /^pdf-compress$/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nexo Layers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Overlay PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adicionar overlay" })).toBeDisabled();
});

test("edita um rascunho textual sem simular persistência", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Comparar textos" });
  await card.getByRole("button", { name: "Continuar no Studio" }).click();

  const editor = page.getByRole("textbox", { name: "Texto original" });
  await editor.fill("Texto jurídico em UTF-8");
  await expect(editor).toHaveValue("Texto jurídico em UTF-8");
  await expect(page.getByRole("button", { name: "Comparar", exact: true })).toBeVisible();
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

test("gerencia ciclo de vida dos superpoderes documentais no modal", async ({ page }) => {
  await page.goto("/");
  const superpowersBtn = page.getByRole("button", { name: /Superpoderes/i });
  await expect(superpowersBtn).toBeVisible();
  await superpowersBtn.click();

  await expect(page.getByRole("heading", { name: "Superpoderes Documentais" })).toBeVisible();
  await expect(page.getByText("Tradutor de Documentos com Inteligência Privada")).toBeVisible();
  await expect(page.getByText("Leitor de Documentos Digitalizados (OCR)")).toBeVisible();
  await expect(page.getByText("Revisor Gramatical Profundo")).toBeVisible();
  await expect(page.getByText("Super-Compactador de PDFs")).toBeVisible();

  // Fecha o modal
  await page.getByRole("button", { name: "Fechar" }).last().click();
  await expect(page.getByRole("heading", { name: "Superpoderes Documentais" })).toHaveCount(0);
});
