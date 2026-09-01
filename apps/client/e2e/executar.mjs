import { spawn } from "node:child_process";
import { preview } from "vite";

const servidor = await preview({
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
});

try {
  const codigoSaida = await new Promise((resolve, reject) => {
    const windows = process.platform === "win32";
    const comando = windows ? (process.env.ComSpec ?? "cmd.exe") : "pnpm";
    const argumentos = windows
      ? ["/d", "/s", "/c", "pnpm exec playwright test"]
      : ["exec", "playwright", "test"];
    const processo = spawn(comando, argumentos, {
      stdio: "inherit",
      windowsHide: true,
    });

    processo.once("error", reject);
    processo.once("exit", (codigo, sinal) => {
      if (sinal) {
        reject(new Error(`Playwright encerrado pelo sinal ${sinal}.`));
        return;
      }
      resolve(codigo ?? 1);
    });
  });

  process.exitCode = codigoSaida;
} finally {
  await servidor.close();
}
