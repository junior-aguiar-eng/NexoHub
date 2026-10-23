import { expect, it } from "vitest";
import { allowToolNavigation, registerToolNavigationGuard } from "./tool-navigation-guard";

it("preserva o guard específico ao registrar e remover um guard pai", () => {
  const child = registerToolNavigationGuard(() => false);
  const parent = registerToolNavigationGuard(() => true);
  try {
    expect(allowToolNavigation()).toBe(false);
    parent();
    expect(allowToolNavigation()).toBe(false);
  } finally {
    parent();
    child();
  }
  expect(allowToolNavigation()).toBe(true);
});
