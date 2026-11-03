// Métricas de qualidade para comparar motores locais e de nuvem. Funções puras, sem I/O.
// CER/WER reproduzem exatamente a definição de scripts/medir-ocr-c1.mjs: NFC, espaços colapsados,
// distância de edição por pontos de código (CER) e por palavras separadas por espaço (WER).

export const normalize = (text) => text.normalize("NFC").replace(/\s+/g, " ").trim();

export function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

export function cer(reference, output) {
  const ref = [...normalize(reference)];
  if (!ref.length) throw new Error("REFERENCIA_VAZIA");
  return distance(ref, [...normalize(output)]) / ref.length;
}

export function wer(reference, output) {
  const ref = normalize(reference).split(" ");
  if (!normalize(reference)) throw new Error("REFERENCIA_VAZIA");
  return distance(ref, normalize(output).split(" ")) / ref.length;
}

/** Grupos de dígitos do texto: "1.234,56" e "1,234.56" geram os mesmos grupos (1, 234, 56). */
export function digitGroups(text) {
  return text.normalize("NFC").match(/\d+/gu) ?? [];
}

/** Números esperados que não aparecem como grupo de dígitos na saída (semântica de conjunto). */
export function numbersMissing(expected, output) {
  const present = new Set(digitGroups(output));
  return [...new Set(expected)].filter((n) => !present.has(n));
}

/** Nomes que devem aparecer literalmente (NFC, diferencia caixa e acentos) na saída. */
export function namesMissing(names, output) {
  const text = output.normalize("NFC");
  return names.filter((name) => !text.includes(name.normalize("NFC")));
}

const NEGATIONS = {
  pt: ["não", "nunca", "nem", "jamais", "sem", "nenhum", "nenhuma", "ninguém", "nada"],
  en: ["not", "no", "never", "cannot", "without", "neither", "nor", "none", "nothing", "nobody"],
  es: [
    "no",
    "nunca",
    "ni",
    "jamás",
    "sin",
    "ningún",
    "ninguno",
    "ninguna",
    "nadie",
    "nada",
    "tampoco",
  ],
};

function negationCount(text, language) {
  const markers = NEGATIONS[language];
  if (!markers) return undefined;
  const words = text
    .normalize("NFC")
    .toLowerCase()
    .split(/[^\p{L}\p{M}'’]+/u);
  let count = words.filter((w) => markers.includes(w)).length;
  if (language === "en") count += words.filter((w) => /n['’]t$/u.test(w)).length;
  return count;
}

/**
 * Heurística de marcador de negação. NÃO prova que o sentido foi preservado: só aponta, para
 * revisão humana, saídas que perderam todo marcador quando a fonte tinha algum.
 */
export function negationStatus(source, sourceLanguage, output, targetLanguage) {
  const inSource = negationCount(source, sourceLanguage);
  const inOutput = negationCount(output, targetLanguage);
  if (inSource === undefined || inOutput === undefined) return "idioma-nao-avaliado";
  if (inSource === 0) return "ausente-na-fonte";
  return inOutput > 0 ? "marcador-presente" : "marcador-ausente";
}

/** Fidelidade do PDF convertido contra uma referência já extraída (páginas, texto, fontes). */
export function compareOffice(reference, output) {
  const referenceFonts = new Set(reference.fontes ?? []);
  const outputFonts = new Set(output.fontes ?? []);
  return {
    paginasReferencia: reference.paginas,
    paginasSaida: output.paginas,
    paginasIguais: reference.paginas === output.paginas,
    cer: cer(reference.texto, output.texto),
    wer: wer(reference.texto, output.texto),
    fontesAusentes: [...referenceFonts].filter((f) => !outputFonts.has(f)).sort(),
    tabelasDiferenca:
      reference.tabelas === undefined || output.tabelas === undefined
        ? undefined
        : output.tabelas - reference.tabelas,
  };
}

export function mean(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}

/** Percentil por posto mais próximo (sem interpolação), para tempos. */
export function percentile(values, p) {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}
