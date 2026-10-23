import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { preview } from "vite";

process.env.NEXOHUB_BASE_PATH = "/hub/";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const server = await preview({
  root,
  base: "/hub/",
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
});

try {
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [require.resolve("@playwright/test/cli"), "test", "hub-subpath.spec.ts", "--workers=2"],
      { cwd: root, stdio: "inherit", env: process.env },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Playwright interrompido: ${signal}`));
      else resolve(code ?? 1);
    });
  });
} finally {
  await server.close();
}
