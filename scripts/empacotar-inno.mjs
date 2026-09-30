import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

if (process.platform !== "win32") {
  throw new Error("O instalador Inno Setup só pode ser gerado no Windows.");
}

const root = resolve(import.meta.dirname, "..");
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const compilerCandidates = [
  process.env.INNO_SETUP_COMPILER,
  process.env.LOCALAPPDATA
    ? resolve(process.env.LOCALAPPDATA, "Programs/Inno Setup 6/ISCC.exe")
    : null,
  "C:/Program Files (x86)/Inno Setup 6/ISCC.exe",
  "C:/Program Files/Inno Setup 6/ISCC.exe",
  "C:/Program Files/Inno Setup 7/ISCC.exe",
].filter(Boolean);
const compiler = compilerCandidates.find((candidate) => existsSync(candidate));
if (!compiler) {
  throw new Error("ISCC.exe não encontrado. Instale o Inno Setup ou defina INNO_SETUP_COMPILER.");
}

const inputFiles = [
  "target/release/nexohub-desktop.exe",
  "target/release/THIRD_PARTY_LICENSES.md",
  "target/release/runtime/README.md",
  "target/release/runtime/MicrosoftEdgeWebview2Setup.exe",
];
for (const file of inputFiles) {
  if (!existsSync(resolve(root, file))) throw new Error(`Arquivo obrigatório ausente: ${file}`);
}

const result = await new Promise((resolveResult, reject) => {
  const process = spawn(
    compiler,
    [`/DAppVersion=${version}`, resolve(root, "installer/nexohub.iss")],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  process.once("error", reject);
  process.once("exit", (code) => resolveResult(code ?? 1));
});
if (result !== 0) throw new Error(`Inno Setup falhou com o código ${result}.`);
