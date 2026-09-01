import { expect, test } from "@playwright/test";

test("abre o client compartilhado", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "NexoHub" })).toBeVisible();
});
