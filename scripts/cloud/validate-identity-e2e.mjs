import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../apps/client/", import.meta.url));
const require = createRequire(new URL("../../apps/client/package.json", import.meta.url));
const { preview } = await import(pathToFileURL(require.resolve("vite")).href);
const server = await preview({
  root,
  base: process.env.NEXOHUB_BASE_PATH ?? "/",
  preview: { host: "127.0.0.1", port: 4189, strictPort: true },
});
try {
  process.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        require.resolve("@playwright/test/cli"),
        "test",
        "cloud-account.spec.ts",
        "--workers=1",
        `--output=../../target/qa/hybrid-300/e2e-${process.env.NEXOHUB_BASE_PATH ? "hub" : "root"}`,
      ],
      { cwd: root, env: { ...process.env, NEXOHUB_E2E_PORT: "4189" }, stdio: "inherit" },
    );
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await server.close();
}
