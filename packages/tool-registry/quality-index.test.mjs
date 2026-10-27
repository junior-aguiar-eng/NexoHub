import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { coreToolManifests } from "./src/index.ts";
import { checkQualityIndex } from "./src/quality-check.ts";

// O adaptador Node pertence apenas ao teste; o pacote exporta somente src/index.ts.
it("confere o índice versionado contra o catálogo ativo e os bytes locais", () => {
  const root = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
  const local = (path) => {
    const target = realpathSync(resolve(root, path));
    if (!target.startsWith(`${root}${sep}`)) throw new Error("Q_C0_OUTSIDE_ROOT");
    return target;
  };
  const data = JSON.parse(readFileSync(resolve(root, "docs/quality/q-c0.json"), "utf8"));
  expect(() =>
    checkQualityIndex(
      data,
      coreToolManifests.map((tool) => tool.id),
      {
        exists: (path) => existsSync(resolve(root, path)) && Boolean(local(path)),
        sha256: (path) =>
          createHash("sha256")
            .update(readFileSync(local(path)))
            .digest("hex"),
      },
    ),
  ).not.toThrow();
});
