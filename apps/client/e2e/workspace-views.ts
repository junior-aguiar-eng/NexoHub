import type { Page } from "@playwright/test";

/** As abas móveis alternam a apresentação sem alterar documento ou revisão. */
export async function workspaceOptions(page: Page) {
  const button = page.getByRole("button", { name: "Opções", exact: true });
  if (await button.isVisible()) await button.click();
}
export async function workspaceDocument(page: Page) {
  const button = page.getByRole("button", { name: "Documento", exact: true });
  if (await button.isVisible()) await button.click();
}
