import { expect, test } from "@playwright/test";

test("abre o Launcher compartilhado com vitrine de ferramentas", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Olá, Boni, o que faremos hoje?",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Use todas as ferramentas de forma gratuita e ilimitada"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Organizar PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comprimir PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Juntar PDF" })).toBeVisible();
});

test("troca de suíte e filtra os cards", async ({ page }) => {
  await page.goto("/");
  const suiteNav = page.getByRole("navigation", { name: "Categorias de ferramentas" });
  await suiteNav.getByRole("button", { name: "Organizar PDF", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Organizar PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comparar textos" })).toHaveCount(0);
});

test("navega entre suítes pelo teclado", async ({ page }) => {
  await page.goto("/");
  const suiteNav = page.getByRole("navigation", { name: "Categorias de ferramentas" });
  await suiteNav.getByRole("button", { name: "Todas", exact: true }).focus();
  await page.keyboard.press("ArrowRight");

  await expect(
    suiteNav.getByRole("button", { name: "Organizar PDF", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Organizar PDF" })).toBeVisible();
});

test("abre e fecha a paleta de comandos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Buscar no NexoHub" })).toBeVisible();
  await page.keyboard.press("Control+k");

  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
  await expect(page.getByPlaceholder("Digite uma suíte ou ferramenta...")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toHaveCount(0);
});

test("abre a tela dedicada de Comprimir PDF e retorna ao Launcher", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Comprimir PDF" });
  await card.click();

  await expect(page.getByRole("heading", { name: "Comprimir PDF", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Selecionar arquivo PDF" })).toBeVisible();
  await expect(page.getByText("ou arraste e solte seus arquivos aqui")).toBeVisible();

  // Retorna ao Launcher via botão Voltar
  await page.getByRole("button", { name: "Todas as ferramentas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, Boni, o que faremos hoje?" })).toBeVisible();
});

test("abre a tela dedicada de Organizar PDF e retorna clicando no logo NexoHub", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Organizar PDF" });
  await card.click();

  await expect(page.getByRole("heading", { name: "Organizar PDF", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Selecionar arquivo PDF" })).toBeVisible();

  // Retorna clicando no Logo NexoHub no cabeçalho
  await page.getByRole("button", { name: "NexoHub - Página Inicial" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Boni, o que faremos hoje?" })).toBeVisible();
});

test("digita e compara textos na tela dedicada de Comparação", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Comparar textos" });
  await card.click();

  await expect(page.getByRole("heading", { name: "Comparar textos", level: 1 })).toBeVisible();

  const originalInput = page.getByPlaceholder(
    "Cole ou digite o texto do Documento 1 (Original)...",
  );
  await originalInput.fill("Primeira versão do texto.");
  await expect(originalInput).toHaveValue("Primeira versão do texto.");

  const modifiedInput = page.getByPlaceholder(
    "Cole ou digite o texto do Documento 2 (Alterado)...",
  );
  await modifiedInput.fill("Segunda versão alterada.");
  await expect(modifiedInput).toHaveValue("Segunda versão alterada.");
});

test("digita texto diretamente no Corretor Gramatical", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Revisar texto" });
  await card.click();

  await expect(page.getByRole("heading", { name: "Revisar texto", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Digitar Texto" }).click();

  const textInput = page.getByPlaceholder(
    "Digite ou cole o texto do documento aqui para processamento imediato...",
  );
  await textInput.fill("Texto para revisão rápida.");
  await expect(textInput).toHaveValue("Texto para revisão rápida.");
});

test("abre a tela dedicada de Reconhecimento OCR", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Reconhecer texto" });
  await card.click();

  await expect(page.getByRole("heading", { name: "Reconhecer texto", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Selecionar arquivo PDF" })).toBeVisible();
  await expect(page.getByText("ou arraste e solte seus arquivos aqui")).toBeVisible();
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
