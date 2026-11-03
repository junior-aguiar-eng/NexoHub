import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  carregarCorpusOcr,
  carregarCorpusTraducao,
  lerQualidadeCsv,
  motorOcrRegistrado,
  motorTraducaoRegistrado,
} from "./avaliacao/corpus.mjs";
import {
  avaliar,
  comparar,
  ORCAMENTO_PADRAO_MICROS,
  relatorioMarkdown,
} from "./avaliacao/executor.mjs";
import {
  cer,
  compareOffice,
  digitGroups,
  namesMissing,
  negationStatus,
  normalize,
  numbersMissing,
  percentile,
  wer,
} from "./avaliacao/metricas.mjs";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const FIXO = "2026-11-03T00:00:00.000Z";

// ------------------------------------------------------------------ métricas

test("CER e WER seguem a definição do projeto", () => {
  assert.equal(cer("abc", "abd"), 1 / 3);
  assert.equal(wer("a b c", "a x c"), 1 / 3);
  assert.equal(cer("ação", "ação"), 0);
  // NFC e espaços não contam como erro
  assert.equal(cer("á", "á"), 0);
  assert.equal(wer("um  dois\n três", "um dois três"), 0);
  assert.equal(normalize("  a \t b\n"), "a b");
  // acento e caixa contam
  assert.ok(cer("São Luís", "Sao Luis") > 0);
  assert.ok(cer("Maria", "maria") > 0);
  assert.throws(() => cer("  ", "x"), /REFERENCIA_VAZIA/);
  assert.throws(() => wer("", "x"), /REFERENCIA_VAZIA/);
});

test("números: separadores de milhar/decimal não mudam os grupos de dígitos", () => {
  assert.deepEqual(digitGroups("R$ 1.234,56 em 25/10/2026"), [
    "1",
    "234",
    "56",
    "25",
    "10",
    "2026",
  ]);
  assert.deepEqual(numbersMissing(digitGroups("1.234,56"), "1,234.56"), []);
  assert.deepEqual(numbersMissing(["125", "30"], "pagou 125 euros"), ["30"]);
  assert.deepEqual(numbersMissing(["12"], "123"), ["12"]); // "12" não é "123"
});

test("nomes exigem correspondência literal", () => {
  assert.deepEqual(namesMissing(["Maria Silva"], "María Silva autorizó"), ["Maria Silva"]);
  assert.deepEqual(namesMissing(["Maria Silva", "João Costa"], "Maria Silva e João Costa"), []);
  assert.deepEqual(namesMissing(["João"], "João".normalize("NFD")), []); // NFC antes de comparar
});

test("marcador de negação é só uma heurística para revisão", () => {
  assert.equal(
    negationStatus("Ele não pagou.", "pt", "He did not pay.", "en"),
    "marcador-presente",
  );
  assert.equal(negationStatus("Ele não pagou.", "pt", "He didn't pay.", "en"), "marcador-presente");
  assert.equal(negationStatus("Ele não pagou.", "pt", "He paid.", "en"), "marcador-ausente");
  assert.equal(negationStatus("Ele pagou.", "pt", "He paid.", "en"), "ausente-na-fonte");
  assert.equal(negationStatus("Ele pagou.", "xx", "He paid.", "en"), "idioma-nao-avaliado");
});

test("fidelidade do Office: páginas, texto, fontes e tabelas", () => {
  const r = compareOffice(
    { paginas: 3, texto: "um dois", fontes: ["Arial", "Calibri"], tabelas: 2 },
    { paginas: 4, texto: "um dois", fontes: ["Arial"], tabelas: 1 },
  );
  assert.equal(r.paginasIguais, false);
  assert.equal(r.cer, 0);
  assert.deepEqual(r.fontesAusentes, ["Calibri"]);
  assert.equal(r.tabelasDiferenca, -1);
});

test("percentil por posto mais próximo", () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10);
  assert.equal(percentile([], 50), undefined);
});

// ------------------------------------------- paridade com o que o projeto já mediu

test("paridade: CER/WER batem com as 40 medições de OCR já registradas", () => {
  const dados = JSON.parse(readFileSync(`${raiz}docs/ocr-c1/medicoes-2026-10-26.json`, "utf8"));
  const linhas = dados.rows.filter((r) => r.text !== undefined);
  assert.ok(linhas.length >= 20, `esperava dezenas de linhas, vieram ${linhas.length}`);
  for (const linha of linhas) {
    assert.ok(
      Math.abs(cer(dados.expected, linha.text) - linha.cer) < 1e-12,
      `CER ${linha.fixture}/${linha.method}`,
    );
    assert.ok(
      Math.abs(wer(dados.expected, linha.text) - linha.wer) < 1e-12,
      `WER ${linha.fixture}/${linha.method}`,
    );
  }
});

test("corpus de OCR confere com o SHA-256 do manifesto", () => {
  const itens = carregarCorpusOcr();
  assert.equal(itens.length, 4);
  assert.ok(itens.every((i) => i.sha256.length === 64 && !i.privado));
});

test("paridade: nomes e números ausentes batem com a revisão do TR-C1", () => {
  const corpus = new Map(carregarCorpusTraducao().map((i) => [i.id, i]));
  const revisao = lerQualidadeCsv().filter((r) =>
    ["m2m100", "m2m100-segmented"].includes(r.perfil),
  );
  assert.ok(revisao.length >= 30);
  const registrados = {
    m2m100: motorTraducaoRegistrado(),
    "m2m100-segmented": motorTraducaoRegistrado({ segmentado: true }),
  };
  for (const linha of revisao) {
    const item = corpus.get(`${linha.caso}:${linha.par}`);
    assert.ok(item, `item ${linha.caso}:${linha.par}`);
    const { texto } = registrados[linha.perfil].executar(item);
    const nomes = namesMissing(item.nomes, texto).sort();
    const esperadosNomes = linha.nomes_ausentes_literais
      ? linha.nomes_ausentes_literais
          .split(";")
          .map((s) => s.trim())
          .sort()
      : [];
    assert.deepEqual(nomes, esperadosNomes, `nomes ${linha.perfil} ${linha.caso} ${linha.par}`);
    const numeros = numbersMissing(item.numeros, texto).sort();
    const esperadosNumeros = linha.numeros_ausentes
      ? linha.numeros_ausentes
          .split(";")
          .map((s) => s.trim())
          .sort()
      : [];
    assert.deepEqual(
      numeros,
      esperadosNumeros,
      `números ${linha.perfil} ${linha.caso} ${linha.par}`,
    );
  }
});

test("paridade: a heurística de negação concorda com a revisão humana do TR-C1", () => {
  const corpus = new Map(carregarCorpusTraducao().map((i) => [i.id, i]));
  const registrados = {
    m2m100: motorTraducaoRegistrado(),
    "m2m100-segmented": motorTraducaoRegistrado({ segmentado: true }),
  };
  for (const linha of lerQualidadeCsv().filter((r) => registrados[r.perfil])) {
    const item = corpus.get(`${linha.caso}:${linha.par}`);
    const { texto } = registrados[linha.perfil].executar(item);
    const status = negationStatus(item.texto, item.idiomaOrigem, texto, item.idiomaDestino);
    if (linha.negacao === "ausente na fonte")
      assert.equal(status, "ausente-na-fonte", `${linha.caso} ${linha.par}`);
    if (linha.negacao === "preservada em revisão do corpus")
      assert.equal(status, "marcador-presente", `${linha.caso} ${linha.par}`);
  }
});

// ---------------------------------------------------------------- executor

const itemOcr = (id, extra = {}) => ({
  id,
  tipo: "ocr",
  referenciaTexto: "Valor R$ 1.234,56",
  licenca: "teste",
  privado: false,
  ...extra,
});
const motorNuvem = (extra = {}) => {
  const chamadas = [];
  return {
    chamadas,
    id: "nuvem-falsa",
    tipo: "nuvem",
    versao: "0",
    tipos: ["ocr"],
    estimarCustoMicros: () => 2_000_000,
    executar(item) {
      chamadas.push(item.id);
      return { texto: "Valor R$ 1.234,56", ms: 10 };
    },
    ...extra,
  };
};

test("item privado nunca chega ao motor de nuvem sem autorização explícita", async () => {
  const nuvem = motorNuvem();
  const itens = [itemOcr("a"), itemOcr("foto", { privado: true })];
  const r = await avaliar({ itens, motores: [nuvem], geradoEm: FIXO });
  assert.deepEqual(nuvem.chamadas, ["a"]);
  assert.equal(r.resultados.find((x) => x.item === "foto").motivo, "ITEM_PRIVADO");
  const permitido = motorNuvem();
  await avaliar({ itens, motores: [permitido], permitirPrivados: true, geradoEm: FIXO });
  assert.deepEqual(permitido.chamadas, ["a", "foto"]);
});

test("motor local processa item privado sem restrição", async () => {
  const local = { ...motorNuvem(), id: "local", tipo: "local", estimarCustoMicros: undefined };
  const r = await avaliar({
    itens: [itemOcr("foto", { privado: true })],
    motores: [local],
    geradoEm: FIXO,
  });
  assert.equal(r.resultados[0].status, "ok");
  assert.equal(r.orcamento.gastoMicros, 0);
});

test("motor de nuvem sem estimativa de custo não é chamado", async () => {
  const nuvem = motorNuvem({ estimarCustoMicros: undefined });
  const r = await avaliar({ itens: [itemOcr("a")], motores: [nuvem], geradoEm: FIXO });
  assert.equal(nuvem.chamadas.length, 0);
  assert.equal(r.resultados[0].motivo, "SEM_ESTIMATIVA_DE_CUSTO");
  const invalida = motorNuvem({ estimarCustoMicros: () => Number.NaN });
  const r2 = await avaliar({ itens: [itemOcr("a")], motores: [invalida], geradoEm: FIXO });
  assert.equal(r2.resultados[0].motivo, "ESTIMATIVA_INVALIDA");
});

test("o teto de gasto interrompe as chamadas antes de ultrapassá-lo", async () => {
  assert.equal(ORCAMENTO_PADRAO_MICROS, 5_000_000);
  const nuvem = motorNuvem(); // 2.000.000 por item; limite padrão 5.000.000
  const itens = ["a", "b", "c", "d"].map((id) => itemOcr(id));
  const r = await avaliar({ itens, motores: [nuvem], geradoEm: FIXO });
  assert.deepEqual(nuvem.chamadas, ["a", "b"]);
  assert.deepEqual(
    r.resultados.filter((x) => x.status === "ignorado").map((x) => x.motivo),
    ["ORCAMENTO", "ORCAMENTO"],
  );
  assert.equal(r.orcamento.gastoMicros, 4_000_000);
  assert.equal(r.orcamento.excedido, false);
});

test("o custo real vale mais que a estimativa e o excesso é sinalizado", async () => {
  const caro = motorNuvem({
    executar: () => ({ texto: "Valor R$ 1.234,56", ms: 1, custoMicros: 6_000_000 }),
  });
  const r = await avaliar({ itens: [itemOcr("a"), itemOcr("b")], motores: [caro], geradoEm: FIXO });
  assert.equal(r.orcamento.gastoMicros, 6_000_000);
  assert.equal(r.orcamento.excedido, true);
  assert.equal(r.resultados.filter((x) => x.status === "ok").length, 1); // o segundo foi barrado
});

test("erros guardam só o código, nunca a mensagem (pode ter trecho do documento)", async () => {
  const motor = motorNuvem({
    executar() {
      throw new Error("trecho sensível do documento do usuário");
    },
  });
  const r = await avaliar({ itens: [itemOcr("a")], motores: [motor], geradoEm: FIXO });
  assert.equal(r.resultados[0].status, "erro");
  assert.equal(r.resultados[0].codigo, "ERRO");
  assert.ok(!JSON.stringify(r).includes("sensível"));
  const comCodigo = motorNuvem({
    executar() {
      throw Object.assign(new Error("x"), { code: "TEMPO_ESGOTADO" });
    },
  });
  const r2 = await avaliar({ itens: [itemOcr("a")], motores: [comCodigo], geradoEm: FIXO });
  assert.equal(r2.resultados[0].codigo, "TEMPO_ESGOTADO");
});

test("o relatório não carrega texto de documentos nem das saídas", async () => {
  const r = await avaliar({ itens: [itemOcr("a")], motores: [motorNuvem()], geradoEm: FIXO });
  const bruto = JSON.stringify(r) + relatorioMarkdown(r);
  assert.ok(!bruto.includes("1.234,56"));
});

test("só a primeira chamada de cada motor é a fria", async () => {
  const local = { ...motorNuvem(), id: "local", tipo: "local" };
  const r = await avaliar({
    itens: [itemOcr("a"), itemOcr("b"), itemOcr("c")],
    motores: [local],
    geradoEm: FIXO,
  });
  assert.deepEqual(
    r.resultados.map((x) => x.frio),
    [true, false, false],
  );
  assert.equal(r.resumo[0].tempoFrioMs, 10);
  assert.equal(r.resumo[0].tempoQuenteP50Ms, 10);
});

test("motor só recebe tipos de item que declara suportar", async () => {
  const nuvem = motorNuvem();
  const traducao = {
    id: "t",
    tipo: "traducao",
    texto: "x",
    idiomaOrigem: "pt",
    idiomaDestino: "en",
    licenca: "t",
  };
  const r = await avaliar({ itens: [traducao], motores: [nuvem], geradoEm: FIXO });
  assert.equal(r.resultados.length, 0);
  assert.equal(nuvem.chamadas.length, 0);
});

// -------------------------------------------------------------- comparação

function resultadoSintetico(cerBase, cerCand, n = 12, extra = {}) {
  const resultados = [];
  for (let i = 0; i < n; i++)
    for (const [motor, c] of [
      ["base", cerBase],
      ["cand", cerCand],
    ])
      resultados.push({
        motor,
        item: `i${String(i).padStart(2, "0")}`,
        tipo: "ocr",
        status: "ok",
        metricas: { cer: c, wer: c, numerosAusentes: [], ...(motor === "cand" ? extra : {}) },
      });
  return { resultados };
}
const cmp = (res, opcoes = {}) =>
  comparar(res, { base: "base", candidato: "cand", tipo: "ocr", ...opcoes });

test("comparação: amostra pequena é inconclusiva", () => {
  const r = cmp(resultadoSintetico(0.1, 0.01, 4));
  assert.equal(r.veredito, "inconclusivo");
  assert.match(r.motivo, /amostra pequena/);
});

test("comparação: melhor, equivalente e pior", () => {
  assert.equal(cmp(resultadoSintetico(0.1, 0.05)).veredito, "melhor");
  assert.equal(cmp(resultadoSintetico(0.1, 0.095)).veredito, "equivalente"); // ganho abaixo de 20%
  assert.equal(cmp(resultadoSintetico(0.1, 0.2)).veredito, "pior");
  // ganho de CER não compensa perder números
  assert.equal(
    cmp(resultadoSintetico(0.1, 0.05, 12, { numerosAusentes: ["30"] })).veredito,
    "pior",
  );
});

test("comparação: base perfeita nunca vira 'melhor'", () => {
  assert.equal(cmp(resultadoSintetico(0, 0)).veredito, "equivalente");
  assert.equal(cmp(resultadoSintetico(0, 0.05)).veredito, "pior");
});

test("comparação nunca homologa e sempre pede revisão humana", () => {
  for (const r of [cmp(resultadoSintetico(0.1, 0.01)), cmp(resultadoSintetico(0.1, 0.01, 2))]) {
    assert.equal(r.homologado, false);
    assert.equal(r.exigeRevisaoHumana, true);
  }
});

test("comparação de tradução conta defeitos detectáveis, não fluência", () => {
  const resultados = [];
  for (let i = 0; i < 12; i++) {
    const id = `t${String(i).padStart(2, "0")}`;
    resultados.push({
      motor: "base",
      item: id,
      tipo: "traducao",
      status: "ok",
      metricas: { nomesAusentes: i < 5 ? ["Maria Silva"] : [], numerosAusentes: [] },
    });
    resultados.push({
      motor: "cand",
      item: id,
      tipo: "traducao",
      status: "ok",
      metricas: { nomesAusentes: i < 1 ? ["Maria Silva"] : [], numerosAusentes: [] },
    });
  }
  const r = comparar({ resultados }, { base: "base", candidato: "cand", tipo: "traducao" });
  assert.equal(r.veredito, "melhor");
  assert.equal(r.detalhes.falhasBase, 5);
  assert.equal(r.detalhes.falhasCandidato, 1);
});

// ------------------------------------------------- ponta a ponta (linha de base)

test("linha de base local reproduz o corpus do projeto sem erros", async () => {
  const itens = [...carregarCorpusOcr(), ...carregarCorpusTraducao()];
  const motores = [
    motorOcrRegistrado(),
    motorTraducaoRegistrado(),
    motorTraducaoRegistrado({ segmentado: true }),
  ];
  const r = await avaliar({ itens, motores, geradoEm: FIXO });
  assert.equal(r.resultados.filter((x) => x.status === "erro").length, 0);
  const ocr = r.resumo.find((x) => x.tipo === "ocr");
  assert.equal(ocr.ok, 4);
  assert.ok(ocr.cerMedio >= 0 && ocr.cerMedio < 0.1);
  assert.equal(r.orcamento.gastoMicros, 0);
  const md = relatorioMarkdown(r);
  assert.match(md, /não homologa/);
  assert.match(md, /tesseract-registrado/);
  assert.match(md, /repetem medições antigas/);
  assert.ok(r.resumo.every((x) => x.tempoFrioMs === undefined)); // registro não tem tempo frio
  assert.ok(r.motores.every((m) => m.registro));
  // determinístico para o mesmo instante
  assert.equal(md, relatorioMarkdown(await avaliar({ itens, motores, geradoEm: FIXO })));
});
