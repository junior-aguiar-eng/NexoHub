import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Validação externa opcional via veraPDF CLI (Task 3A.3, ADR-021).
 * Quando o binário `verapdf` não está instalado no PATH, informa explicitamente
 * a ausência sem mascarar o resultado nem falhar o ambiente local de desenvolvimento.
 */
const args = process.argv.slice(2);
const targetFile = args[0] ? resolve(process.cwd(), args[0]) : null;
const profile = args[1] ?? "2b";

const probe = spawnSync("verapdf", ["--version"], { encoding: "utf8" });
if (probe.error || probe.status !== 0) {
  console.warn(
    "AVISO: binário externo 'verapdf' não encontrado no PATH. Conformidade ISO 19005 estrita permanece dependente de validação externa por veraPDF (consultar docs/quality/PDFA-C1.md).",
  );
  process.exit(0);
}

if (!targetFile || !existsSync(targetFile)) {
  console.error("Uso: node scripts/quality/validar-pdfa-verapdf.mjs <arquivo.pdf> [flavour=2b|1b]");
  process.exit(1);
}

const run = spawnSync("verapdf", ["--flavour", profile, targetFile], {
  stdio: "inherit",
});
process.exit(run.status ?? 1);
