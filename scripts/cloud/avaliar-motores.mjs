// Executa o harness de avaliação (Tarefa 8) com os motores LOCAIS já registrados no projeto.
// É a linha de base: repete medições existentes, sem rede e sem custo. Motores de nuvem entram
// aqui só depois de autorização explícita, projeto e credenciais, e sempre pelas travas do executor.
//
// Uso: node scripts/cloud/avaliar-motores.mjs [--saida <diretório>]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  carregarCorpusOcr,
  carregarCorpusTraducao,
  motorOcrRegistrado,
  motorTraducaoRegistrado,
} from "./avaliacao/corpus.mjs";
import { avaliar, relatorioMarkdown } from "./avaliacao/executor.mjs";

const indice = process.argv.indexOf("--saida");
const saida = indice >= 0 ? process.argv[indice + 1] : undefined;
if (indice >= 0 && !saida) throw new Error("--saida exige um diretório");

const resultado = await avaliar({
  itens: [...carregarCorpusOcr(), ...carregarCorpusTraducao()],
  motores: [
    motorOcrRegistrado(),
    motorTraducaoRegistrado(),
    motorTraducaoRegistrado({ segmentado: true }),
  ],
});
const markdown = relatorioMarkdown(resultado);

if (saida) {
  const pasta = resolve(saida);
  mkdirSync(pasta, { recursive: true });
  writeFileSync(resolve(pasta, "avaliacao.json"), `${JSON.stringify(resultado, null, 2)}\n`);
  writeFileSync(resolve(pasta, "avaliacao.md"), markdown);
  console.log(`Relatório gravado em ${pasta}`);
} else {
  process.stdout.write(markdown);
}
