import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

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
  await executarPnpm(["--filter", "@nexohub/desktop", "build"]);
  const executable = readFileSync(resolvePath("target/release/nexohub-desktop.exe"));
  const peOffset = executable.readUInt32LE(0x3c);
  const subsystem = executable.readUInt16LE(peOffset + 4 + 20 + 0x44);
  if (subsystem !== 2) {
    throw new Error(
      `O executável Windows deve usar o subsistema gráfico (2); encontrado: ${subsystem}.`,
    );
  }
  if (somenteWindows) {
    await new Promise((resolve, reject) => {
      const processo = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          "scripts/install-webview2-bootstrapper.ps1",
        ],
        {
          stdio: "inherit",
          windowsHide: true,
          env: {
            ...process.env,
            PSModulePath: resolvePath(
              process.env.WINDIR ?? "C:/Windows",
              "System32/WindowsPowerShell/v1.0/Modules",
            ),
          },
        },
      );
      processo.once("error", reject);
      processo.once("exit", (codigo) =>
        codigo === 0 ? resolve() : reject(new Error(`WebView2 bootstrapper: código ${codigo}.`)),
      );
    });
    await executarPnpm(["exec", "node", "scripts/empacotar-inno.mjs"]);
  }
} else {
  console.log("Build desktop ignorado: o alvo produtivo atual é Windows.");
}
