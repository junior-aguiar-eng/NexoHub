import { expect, type Page, test } from "@playwright/test";

async function openTranslator(page: Page) {
  await page.goto("/traduzir-texto");
  await page.getByRole("button", { name: "Digitar Texto" }).click();
  await page.locator("#dedicated-tool-direct-textarea").fill("Hello, how are you?");
}

test("rede parada não bloqueia a interface; cancelar encerra o worker e permite tentar de novo", async ({
  page,
  context,
}) => {
  let requests = 0;
  await context.route("https://huggingface.co/**", async () => {
    requests++;
    await new Promise<void>(() => {});
  });
  await openTranslator(page);
  const started = page.waitForEvent("worker");
  await page.getByRole("button", { name: "Executar agora", exact: true }).click();
  const worker = await started;
  await expect.poll(() => requests).toBeGreaterThan(0);
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancelar tradução" })).toBeEnabled();
  const closed = worker.waitForEvent("close");
  await page.getByRole("button", { name: "Cancelar tradução" }).click();
  await closed;
  await expect(page.getByRole("button", { name: "Executar agora", exact: true })).toBeEnabled();
  await expect(page.getByRole("alert")).toHaveCount(0);

  const restarted = page.waitForEvent("worker");
  await page.getByRole("button", { name: "Executar agora", exact: true }).click();
  const next = await restarted;
  expect(next).not.toBe(worker);
  const nextClosed = next.waitForEvent("close");
  await page.locator("#dedicated-tool-direct-textarea").fill("Another text.");
  await nextClosed;
  await expect(page.getByRole("button", { name: "Executar agora", exact: true })).toBeEnabled();
});

test("falha ao baixar modelo tem mensagem legível e libera nova tentativa", async ({
  page,
  context,
}) => {
  let requests = 0;
  await context.route("https://huggingface.co/**", async (route) => {
    requests++;
    await route.abort("failed");
  });
  await openTranslator(page);
  await page.getByRole("button", { name: "Executar agora", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível baixar os recursos da tradução",
    { timeout: 15_000 },
  );
  const previous = requests;
  await page.getByRole("button", { name: "Executar agora", exact: true }).click();
  await expect.poll(() => requests).toBeGreaterThan(previous);
  await expect(page.getByRole("alert")).toContainText(
    "Não foi possível baixar os recursos da tradução",
  );
});
