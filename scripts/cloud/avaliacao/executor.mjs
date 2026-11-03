// Executor do harness de avaliação (Tarefa 8). Roda motores sobre um corpus, mede qualidade, tempo
// e custo, e compara motor local com motor de nuvem. Nunca chama a nuvem por conta própria: os
// motores são injetados, e as travas abaixo valem para qualquer um deles.
import {
  cer,
  compareOffice,
  digitGroups,
  mean,
  namesMissing,
  negationStatus,
  numbersMissing,
  percentile,
  wer,
} from "./metricas.mjs";

/** Teto do piloto: suborçamento de US$ 5 retirado do pool, em micro-USD. */
export const ORCAMENTO_PADRAO_MICROS = 5_000_000;

function pontuar(item, saida) {
  if (item.tipo === "ocr") {
    const texto = saida.texto ?? "";
    return {
      cer: cer(item.referenciaTexto, texto),
      wer: wer(item.referenciaTexto, texto),
      numerosAusentes: numbersMissing(digitGroups(item.referenciaTexto), texto),
    };
  }
  if (item.tipo === "traducao") {
    const texto = saida.texto ?? "";
    return {
      nomesAusentes: namesMissing(item.nomes ?? [], texto),
      numerosAusentes: numbersMissing(item.numeros ?? digitGroups(item.texto), texto),
      negacao: negationStatus(item.texto, item.idiomaOrigem, texto, item.idiomaDestino),
    };
  }
  if (item.tipo === "office") {
    if (!saida.office)
      throw Object.assign(new Error("SAIDA_OFFICE_AUSENTE"), { code: "SAIDA_OFFICE_AUSENTE" });
    return compareOffice(item.referencia, saida.office);
  }
  throw Object.assign(new Error("TIPO_DESCONHECIDO"), { code: "TIPO_DESCONHECIDO" });
}

/**
 * itens:  [{ id, tipo: "ocr"|"traducao"|"office", privado?, licenca, ... referências ... }]
 * motores: [{ id, tipo: "local"|"nuvem"|"falso", versao, tipos: [...], aceita?(item),
 *             estimarCustoMicros?(item),
 *             executar(item) -> { texto?, office?, bytesSaida?, unidades?, custoMicros?, ms? } }]
 */
export async function avaliar({
  itens,
  motores,
  orcamentoMicros = ORCAMENTO_PADRAO_MICROS,
  permitirPrivados = false,
  geradoEm = new Date().toISOString(),
}) {
  const resultados = [];
  let gastoMicros = 0;
  let orcamentoExcedido = false;

  for (const motor of motores) {
    let frio = true;
    const nuvem = motor.tipo === "nuvem";
    const aplicaveis = itens.filter(
      (i) => motor.tipos.includes(i.tipo) && (motor.aceita?.(i) ?? true),
    );
    for (const item of aplicaveis) {
      const base = { motor: motor.id, item: item.id, tipo: item.tipo };
      const ignorar = (motivo) => resultados.push({ ...base, status: "ignorado", motivo });

      if (nuvem && item.privado && !permitirPrivados) {
        ignorar("ITEM_PRIVADO"); // nada é enviado: nem chega a chamar o motor
        continue;
      }
      let estimativa = 0;
      if (nuvem) {
        if (typeof motor.estimarCustoMicros !== "function") {
          ignorar("SEM_ESTIMATIVA_DE_CUSTO"); // falha fechada: sem estimativa, sem chamada
          continue;
        }
        estimativa = motor.estimarCustoMicros(item);
        if (!Number.isFinite(estimativa) || estimativa < 0) {
          ignorar("ESTIMATIVA_INVALIDA");
          continue;
        }
        if (gastoMicros + estimativa > orcamentoMicros) {
          ignorar("ORCAMENTO");
          continue;
        }
      }

      const inicio = performance.now();
      try {
        const saida = await motor.executar(item);
        const ms = saida.ms ?? performance.now() - inicio;
        const custo = nuvem ? (saida.custoMicros ?? estimativa) : 0;
        gastoMicros += custo;
        if (gastoMicros > orcamentoMicros) orcamentoExcedido = true;
        resultados.push({
          ...base,
          status: "ok",
          frio,
          ms,
          custoMicros: custo,
          bytesSaida: saida.bytesSaida,
          unidades: saida.unidades,
          metricas: pontuar(item, saida),
        });
      } catch (erro) {
        // Só o código: a mensagem pode carregar trecho do documento.
        resultados.push({ ...base, status: "erro", frio, codigo: erro?.code ?? "ERRO" });
      }
      frio = false;
    }
  }

  resultados.sort((a, b) => a.motor.localeCompare(b.motor) || a.item.localeCompare(b.item));
  return {
    geradoEm,
    motores: motores.map(({ id, tipo, versao, registro }) => ({
      id,
      tipo,
      versao,
      registro: Boolean(registro),
    })),
    itens: itens.map(({ id, tipo, licenca, privado }) => ({
      id,
      tipo,
      licenca,
      privado: Boolean(privado),
    })),
    orcamento: { limiteMicros: orcamentoMicros, gastoMicros, excedido: orcamentoExcedido },
    resultados,
    resumo: resumir(resultados, new Set(motores.filter((m) => m.registro).map((m) => m.id))),
  };
}

const taxa = (itens, teste) => itens.filter(teste).length;

function resumir(resultados, registrados) {
  const grupos = new Map();
  for (const r of resultados) {
    const chave = `${r.motor}\u0000${r.tipo}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(r);
  }
  return [...grupos.entries()].map(([chave, lista]) => {
    const [motor, tipo] = chave.split("\u0000");
    const ok = lista.filter((r) => r.status === "ok");
    const m = ok.map((r) => r.metricas);
    const quentes = ok.filter((r) => !r.frio).map((r) => r.ms);
    return {
      motor,
      tipo,
      total: lista.length,
      ok: ok.length,
      erros: lista.filter((r) => r.status === "erro").length,
      ignorados: lista.filter((r) => r.status === "ignorado").length,
      cerMedio: mean(m.filter((x) => x.cer !== undefined).map((x) => x.cer)),
      werMedio: mean(m.filter((x) => x.wer !== undefined).map((x) => x.wer)),
      comNomeAusente: taxa(m, (x) => x.nomesAusentes?.length > 0),
      comNumeroAusente: taxa(m, (x) => x.numerosAusentes?.length > 0),
      comNegacaoAusente: taxa(m, (x) => x.negacao === "marcador-ausente"),
      paginasDiferentes: taxa(m, (x) => x.paginasIguais === false),
      // Motor registrado repete tempos da época: a primeira linha não é uma medição fria.
      tempoFrioMs: registrados.has(motor) ? undefined : ok.find((r) => r.frio)?.ms,
      tempoQuenteP50Ms: percentile(quentes, 50),
      tempoQuenteP95Ms: percentile(quentes, 95),
      custoMicros: ok.reduce((s, r) => s + (r.custoMicros ?? 0), 0),
    };
  });
}

const falhas = (m) =>
  Number(m.nomesAusentes?.length > 0) +
  Number(m.numerosAusentes?.length > 0) +
  Number(m.negacao === "marcador-ausente") +
  Number(m.paginasIguais === false);

/**
 * Compara dois motores nos itens em que ambos funcionaram. O veredito é conservador e NUNCA
 * homologa: serve para decidir se vale a revisão humana, não para dispensá-la.
 */
export function comparar(resultado, { base, candidato, tipo, minItens = 10, ganhoMinimo = 0.2 }) {
  const por = (motor) =>
    new Map(
      resultado.resultados
        .filter((r) => r.motor === motor && r.tipo === tipo && r.status === "ok")
        .map((r) => [r.item, r.metricas]),
    );
  const a = por(base);
  const b = por(candidato);
  const comuns = [...a.keys()].filter((id) => b.has(id)).sort();
  const saida = {
    tipo,
    base,
    candidato,
    n: comuns.length,
    exigeRevisaoHumana: true,
    homologado: false,
  };
  if (comuns.length < minItens)
    return {
      ...saida,
      veredito: "inconclusivo",
      motivo: `amostra pequena (${comuns.length} itens em comum; mínimo ${minItens})`,
    };

  const soma = (mapa, f) => comuns.reduce((s, id) => s + f(mapa.get(id)), 0);
  const falhasBase = soma(a, falhas);
  const falhasCand = soma(b, falhas);
  const detalhes = { falhasBase, falhasCandidato: falhasCand };

  if (tipo === "ocr" || tipo === "office") {
    const cerBase = soma(a, (m) => m.cer) / comuns.length;
    const cerCand = soma(b, (m) => m.cer) / comuns.length;
    const werBase = soma(a, (m) => m.wer) / comuns.length;
    const werCand = soma(b, (m) => m.wer) / comuns.length;
    Object.assign(detalhes, { cerBase, cerCandidato: cerCand, werBase, werCandidato: werCand });
    let veredito = "equivalente";
    if (cerCand > cerBase * 1.1 + 1e-12 || falhasCand > falhasBase) veredito = "pior";
    else if (cerBase > 0 && cerCand <= cerBase * (1 - ganhoMinimo) && werCand <= werBase)
      veredito = "melhor";
    return { ...saida, veredito, detalhes };
  }
  // Tradução: estas verificações só pegam certos defeitos (nome, número, negação); não medem
  // fluência nem sentido. "melhor" aqui significa apenas "menos defeitos detectáveis".
  let veredito = "equivalente";
  if (falhasCand > falhasBase) veredito = "pior";
  else if (falhasBase > 0 && falhasCand <= falhasBase * (1 - ganhoMinimo)) veredito = "melhor";
  return { ...saida, veredito, detalhes };
}

const pct = (v) => (v === undefined ? "—" : `${(v * 100).toFixed(2)}%`);
const ms = (v) => (v === undefined ? "—" : `${Math.round(v)} ms`);

export function relatorioMarkdown(resultado, comparacoes = []) {
  const linhas = [
    "# Relatório de avaliação de motores",
    "",
    `Gerado em ${resultado.geradoEm}. Este relatório **não homologa** nenhum motor: o veredito automático só indica se vale a revisão humana.`,
    "",
    "## Resumo por motor e tipo",
    "",
    "| Motor | Tipo | Itens ok/erro/ignorados | CER médio | WER médio | Nomes ausentes | Números ausentes | Sem marcador de negação | Págs. diferentes | Tempo frio | p50 quente | p95 quente | Custo (µUS$) |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...resultado.resumo.map(
      (r) =>
        `| ${r.motor} | ${r.tipo} | ${r.ok}/${r.erros}/${r.ignorados} | ${pct(r.cerMedio)} | ${pct(r.werMedio)} | ${r.comNomeAusente} | ${r.comNumeroAusente} | ${r.comNegacaoAusente} | ${r.paginasDiferentes} | ${ms(r.tempoFrioMs)} | ${ms(r.tempoQuenteP50Ms)} | ${ms(r.tempoQuenteP95Ms)} | ${r.custoMicros} |`,
    ),
    "",
    ...(resultado.motores.some((m) => m.registro)
      ? [
          "",
          `Motores registrados (${resultado.motores
            .filter((m) => m.registro)
            .map((m) => m.id)
            .join(
              ", ",
            )}) repetem medições antigas: os tempos são os da época, sem separação frio/quente.`,
        ]
      : []),
    "",
    `Orçamento: gasto ${resultado.orcamento.gastoMicros} de ${resultado.orcamento.limiteMicros} micro-USD${resultado.orcamento.excedido ? " — **EXCEDIDO**" : ""}.`,
  ];
  const motivos = new Map();
  for (const r of resultado.resultados.filter((x) => x.status === "ignorado"))
    motivos.set(r.motivo, (motivos.get(r.motivo) ?? 0) + 1);
  if (motivos.size)
    linhas.push(
      "",
      "## Itens ignorados",
      "",
      ...[...motivos].map(([motivo, n]) => `- ${motivo}: ${n}`),
    );
  if (comparacoes.length)
    linhas.push(
      "",
      "## Comparações",
      "",
      "| Tipo | Base | Candidato | Itens | Veredito | Observação |",
      "| --- | --- | --- | ---: | --- | --- |",
      ...comparacoes.map(
        (c) =>
          `| ${c.tipo} | ${c.base} | ${c.candidato} | ${c.n} | ${c.veredito} | ${c.motivo ?? "exige revisão humana"} |`,
      ),
    );
  return `${linhas.join("\n")}\n`;
}
