import { describe, expect, it } from "vitest";
import { coreToolManifests, createCoreToolRegistry } from "./index";

describe("catálogo central de ferramentas", () => {
  it("registra todo manifesto nas superfícies Quick e Studio", () => {
    const registry = createCoreToolRegistry();
    expect(registry.list("quick")).toHaveLength(coreToolManifests.length);
    expect(registry.list("studio")).toHaveLength(coreToolManifests.length);
  });
});
