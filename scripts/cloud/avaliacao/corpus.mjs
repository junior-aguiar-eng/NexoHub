// Carrega os corpora que o projeto já versiona (OCR-C1 e TR-C1) como itens do harness e cria
// "motores registrados", que repetem as saídas já medidas. Não são novas medições: servem de
// linha de base local e para exercitar o harness de ponta a ponta sem nenhum motor real.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../../../", import.meta.url));
const ler = (caminho) => readFileSync(`${raiz}${caminho}`);
const json = (caminho) => JSON.parse(ler(caminho).toString("utf8"));

const OCR_DIR = "apps/client/src/platform/__fixtures__/ocr-c1";
const OCR_MEDICOES = "docs/ocr-c1/medicoes-2026-10-26.json";

/** Itens de OCR: as quatro imagens sintéticas, conferidas contra o SHA-256 do manifesto. */
export function carregarCorpusOcr() {
  const manifesto = json(`${OCR_DIR}/manifest.json`);
  return manifesto.fixtures.map((f) => {
    const bytes = ler(`${OCR_DIR}/${f.kind}.png`);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== f.sha256) throw new Error(`CORPUS_ADULTERADO: ${f.kind}`);
    return {
      id: `ocr-${f.kind}`,
      tipo: "ocr",
      arquivo: `${OCR_DIR}/${f.kind}.png`,
      sha256,
      referenciaTexto: manifesto.expectedText,
      licenca: manifesto.license,
      privado: false,
    };
  });
}

function amostrasTraducao(arquivo) {
  const dados = json(`docs/evidencias/tr-c1/${arquivo}`);
  const porChave = new Map();
  for (const passe of dados.passes)
    for (const s of passe.samples) {
      const id = `${s.id}:${s.source}-${s.target}`;
      // Em caso de repetição entre passes (frio/quente) vale o último, que é o quente.
      porChave.set(id, { id, ...s });
    }
  return porChave;
}

/** Itens de tradução do corpus autoral fictício do TR-C1 (24 frases curtas e textos longos). */
export function carregarCorpusTraducao() {
  const itens = new Map();
  for (const arquivo of ["m2m100.json", "m2m100-segmented.json"])
    for (const [id, s] of amostrasTraducao(arquivo)) {
      const anterior = itens.get(id);
      if (anterior && anterior.texto !== s.input) throw new Error(`CORPUS_INCONSISTENTE: ${id}`);
      itens.set(id, {
        id,
        tipo: "traducao",
        texto: s.input,
        idiomaOrigem: s.source,
        idiomaDestino: s.target,
        nomes: s.names,
        numeros: s.numbers,
        licenca: "autoral fictício (TR-C1)",
        privado: false,
      });
    }
  return [...itens.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Motor local que repete as medições de OCR de 26/10/2026 (Tesseract.js, método "original"). */
export function motorOcrRegistrado() {
  const medicoes = json(OCR_MEDICOES);
  return {
    id: "tesseract-registrado",
    tipo: "local",
    registro: true,
    versao: `tesseract.js ${medicoes.tesseractVersion} (registro de ${medicoes.measuredAt.slice(0, 10)})`,
    tipos: ["ocr"],
    aceita: (item) =>
      medicoes.rows.some((r) => `ocr-${r.fixture}` === item.id && r.method === "original"),
    executar(item) {
      const kind = item.id.replace(/^ocr-/, "");
      const linhas = medicoes.rows.filter((r) => r.fixture === kind && r.method === "original");
      const linha = linhas.find((r) => r.temperature === "warm") ?? linhas[0];
      if (!linha) throw Object.assign(new Error("SEM_REGISTRO"), { code: "SEM_REGISTRO" });
      return { texto: linha.text, ms: linha.ms };
    },
  };
}

/** Motor local que repete as traduções do M2M100 já registradas (normal ou segmentado). */
export function motorTraducaoRegistrado({ segmentado = false } = {}) {
  const arquivo = segmentado ? "m2m100-segmented.json" : "m2m100.json";
  const registros = amostrasTraducao(arquivo);
  return {
    id: segmentado ? "m2m100-segmentado-registrado" : "m2m100-registrado",
    tipo: "local",
    registro: true,
    versao: `Xenova/m2m100_418M (registro TR-C1)`,
    tipos: ["traducao"],
    aceita: (item) => registros.has(item.id),
    executar(item) {
      const registro = registros.get(item.id);
      if (!registro) throw Object.assign(new Error("SEM_REGISTRO"), { code: "SEM_REGISTRO" });
      return { texto: registro.output, ms: registro.ms };
    },
  };
}

/** Planilha de revisão do TR-C1 (separador vírgula, aspas opcionais). */
export function lerQualidadeCsv() {
  const texto = ler("docs/evidencias/tr-c1/qualidade.csv").toString("utf8");
  const registros = [];
  let campo = "";
  let linha = [];
  let aspas = false;
  const fechaCampo = () => {
    linha.push(campo);
    campo = "";
  };
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === ",") fechaCampo();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fechaCampo();
      registros.push(linha);
      linha = [];
    } else campo += c;
  }
  if (campo || linha.length) {
    fechaCampo();
    registros.push(linha);
  }
  const [cabecalho, ...corpo] = registros.filter((r) => r.some((x) => x !== ""));
  return corpo.map((r) => Object.fromEntries(cabecalho.map((nome, i) => [nome, r[i] ?? ""])));
}
