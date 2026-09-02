import { spawn } from "node:child_process";

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) {
  throw new Error("O executável do pnpm não foi identificado.");
}

function executarPnpm(argumentos) {
  return new Promise((resolve, reject) => {
    const processo = spawn(process.execPath, [pnpmCli, ...argumentos], {
      stdio: "inherit",
      windowsHide: true,
    });

    processo.once("error", reject);
    processo.once("exit", (codigo, sinal) => {
      if (sinal) {
        reject(new Error(`Build encerrado pelo sinal ${sinal}.`));
        return;
      }
      if (codigo !== 0) {
        reject(new Error(`Build encerrado com o código ${codigo ?? 1}.`));
        return;
      }
      resolve();
    });
  });
}

const somenteWindows = process.argv.includes("--windows");
if (somenteWindows && process.platform !== "win32") {
  throw new Error("O build desktop produtivo só pode ser executado no Windows.");
}

if (!somenteWindows) {
  await executarPnpm(["build:web"]);
}

if (process.platform === "win32") {
  await executarPnpm(["--filter", "@nexohub/desktop", somenteWindows ? "bundle" : "build"]);
} else {
  console.log("Build desktop ignorado: o alvo produtivo atual é Windows.");
}
