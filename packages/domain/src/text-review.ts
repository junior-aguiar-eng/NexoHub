export type ReviewRule =
  | "LANGUAGE_TOOL"
  | "DUPLICATE_WORD"
  | "SPACE_BEFORE_PUNCTUATION"
  | "REPEATED_WHITESPACE"
  | "TRAILING_WHITESPACE"
  | "PARONYM_CONTEXT"
  | "STYLE_SUGGESTION"
  | "SPELLING"
  | "GRAMMAR_AGREEMENT"
  | "CRASE_USAGE"
  | "ACCENTUATION"
  | "PLEONASM_REDUNDANCY";

export type ReviewFinding = {
  readonly id: string;
  readonly rule: ReviewRule;
  readonly severity: "warning" | "suggestion";
  readonly start: number;
  readonly end: number;
  readonly original: string;
  readonly replacement: string;
  readonly message: string;
  readonly suggestions?: readonly string[];
};

const MAX_REVIEW_LENGTH = 1_000_000;

function matchCase(source: string, target: string): string {
  if (!source || !target) return target;
  if (source === source.toUpperCase()) return target.toUpperCase();
  if (source[0] === source[0]?.toUpperCase()) {
    return target.charAt(0).toUpperCase() + target.slice(1);
  }
  return target;
}

const gerundToInfinitive: Readonly<Record<string, string>> = {
  fazendo: "fazer",
  enviando: "enviar",
  analisando: "analisar",
  verificando: "verificar",
  entrando: "entrar",
  conferindo: "conferir",
  revisando: "revisar",
};

type RuleDefinition = {
  rule: ReviewRule;
  severity: ReviewFinding["severity"];
  pattern: RegExp;
  replacement: (match: RegExpExecArray) => string;
  suggestions?: (match: RegExpExecArray) => readonly string[];
  message: string;
};

const rules: readonly RuleDefinition[] = [
  // 1. DUPLICATE_WORD
  {
    rule: "DUPLICATE_WORD",
    severity: "warning",
    pattern: /\b([\p{L}\p{N}][\p{L}\p{N}'’-]*)[ \t]+\1\b/giu,
    replacement: (match) => match[1] ?? "",
    suggestions: (match) => [match[1] ?? ""],
    message: "Palavra repetida em sequência imediata.",
  },

  // 2. ERROS ORTOGRÁFICOS FREQUENTES (SPELLING)
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bfas(er|endo|e|emos|em|ia|iam|erem)\b/giu,
    replacement: (match) => matchCase(match[0], `faz${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `faz${match[1]?.toLowerCase() ?? ""}`)],
    message: "O verbo 'fazer' e suas flexões grafam-se com 'z'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bfasso\b/giu,
    replacement: (match) => matchCase(match[0], "faço"),
    suggestions: (match) => [matchCase(match[0], "faço")],
    message: "A primeira pessoa do presente do indicativo do verbo fazer é 'faço' (com 'ç').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bfis\b/giu,
    replacement: (match) => matchCase(match[0], "fiz"),
    suggestions: (match) => [matchCase(match[0], "fiz")],
    message: "A primeira pessoa do pretérito perfeito do verbo fazer é 'fiz' (com 'z').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\btrabah(o|os|a|am|ar|ando|ou|ará|arão)\b/giu,
    replacement: (match) => matchCase(match[0], `trabalh${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `trabalh${match[1]?.toLowerCase() ?? ""}`)],
    message: "'Trabalho' e suas flexões verbais grafam-se com 'lh'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\besempl(o|os|ar|ares)\b/giu,
    replacement: (match) => matchCase(match[0], `exempl${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `exempl${match[1]?.toLowerCase() ?? ""}`)],
    message: "'Exemplo' e derivados grafam-se com 'x'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bcaz(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `cas${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `cas${match[1]?.toLowerCase() ?? ""}`)],
    message: "A moradia ou habitação grafa-se com 's': 'casa'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bgeit(o|os|oso|osa|inho)\b/giu,
    replacement: (match) => matchCase(match[0], `jeit${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `jeit${match[1]?.toLowerCase() ?? ""}`)],
    message: "'Jeito' e derivados grafam-se com 'j'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bmenas\b/giu,
    replacement: (match) => matchCase(match[0], "menos"),
    suggestions: (match) => [matchCase(match[0], "menos")],
    message: "A palavra 'menas' não existe na norma culta. A palavra 'menos' é invariável.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bseje(m)?\b/giu,
    replacement: (match) => matchCase(match[0], match[1] ? "sejam" : "seja"),
    suggestions: (match) => [matchCase(match[0], match[1] ? "sejam" : "seja")],
    message: "A forma correta do presente do subjuntivo é 'seja' / 'sejam' (não use 'seje').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\besteje(m)?\b/giu,
    replacement: (match) => matchCase(match[0], match[1] ? "estejam" : "esteja"),
    suggestions: (match) => [matchCase(match[0], match[1] ? "estejam" : "esteja")],
    message: "A forma correta do presente do subjuntivo é 'esteja' / 'estejam' (não use 'esteje').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bprevilégi(o|os)\b/giu,
    replacement: (match) => matchCase(match[0], `privilégi${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `privilégi${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta inicia com 'pri': 'privilégio'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bbeneficient(e|es)\b/giu,
    replacement: (match) => matchCase(match[0], `beneficent${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `beneficent${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'beneficente' (sem 'i' após a letra 'c').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bsombrancelh(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `sobrancelh${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `sobrancelh${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'sobrancelha' (sem 'm' na primeira sílaba).",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bestrup(o|os|ar|ou)\b/giu,
    replacement: (match) => matchCase(match[0], `estupr${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `estupr${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta do crime contra a dignidade sexual é 'estupro'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bmending(o|os)\b/giu,
    replacement: (match) => matchCase(match[0], `mendig${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `mendig${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'mendigo' (com 'd' na segunda sílaba).",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\breinvindic(ar|ação|ações|a|am|ou)\b/giu,
    replacement: (match) => matchCase(match[0], `reivindic${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `reivindic${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'reivindicar' (sem 'n' na primeira sílaba).",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bpararel(o|os|a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `paralel${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `paralel${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'paralelo' (com 'l' e não 'r').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bpoblem(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `problem${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `problem${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'problema' (com 'pr').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bmortandel(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `mortadel${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `mortadel${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'mortadela' (sem 'n' intercalado).",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\biorgut(e|es)\b/giu,
    replacement: (match) => matchCase(match[0], `iogurt${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `iogurt${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'iogurte'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bpesquiz(a|as|ar|ou|am)\b/giu,
    replacement: (match) => matchCase(match[0], `pesquis${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `pesquis${match[1]?.toLowerCase() ?? ""}`)],
    message: "A palavra 'pesquisa' e derivados grafam-se com 's'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\banaliz(ar|ação|ou|am)\b/giu,
    replacement: (match) => matchCase(match[0], `analis${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `analis${match[1]?.toLowerCase() ?? ""}`)],
    message: "O verbo 'analisar' deriva de 'análise' e grafa-se com 's'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bparaliz(ar|ação|ações|ou)\b/giu,
    replacement: (match) => matchCase(match[0], `paralis${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `paralis${match[1]?.toLowerCase() ?? ""}`)],
    message: "O verbo 'paralisar' e 'paralisação' grafam-se com 's'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bobcess(ão|ões|ado|ada)\b/giu,
    replacement: (match) => matchCase(match[0], `obsess${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `obsess${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'obsessão' (com 'b' e 'ss').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bexcess(ão|ões)\b/giu,
    replacement: (match) => matchCase(match[0], `exceç${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `exceç${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'exceção' (com 'x' e 'ç').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bestens(ão|ões)\b/giu,
    replacement: (match) => matchCase(match[0], `extens${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `extens${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'extensão' (com 'x').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bascenç(ão|ões)\b/giu,
    replacement: (match) => matchCase(match[0], `ascens${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `ascens${match[1]?.toLowerCase() ?? ""}`)],
    message: "A grafia correta é 'ascensão' (com 's').",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bconcerteza\b/giu,
    replacement: (match) => matchCase(match[0], "com certeza"),
    suggestions: (match) => [matchCase(match[0], "com certeza")],
    message: "A locução adverbial grafa-se separadamente: 'com certeza'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bderrepente\b/giu,
    replacement: (match) => matchCase(match[0], "de repente"),
    suggestions: (match) => [matchCase(match[0], "de repente")],
    message: "A locução adverbial grafa-se separadamente: 'de repente'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bporisso\b/giu,
    replacement: (match) => matchCase(match[0], "por isso"),
    suggestions: (match) => [matchCase(match[0], "por isso")],
    message: "A locução conjuntiva grafa-se separadamente: 'por isso'.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bapartir\s+de\b/giu,
    replacement: (match) => matchCase(match[0], "a partir de"),
    suggestions: (match) => [matchCase(match[0], "a partir de")],
    message: "A locução prepositiva grafa-se separada e sem crase: 'a partir de'.",
  },

  // 3. REGRA DE M ANTES DE P E B (SPELLING)
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\bcon\b/giu,
    replacement: (match) => matchCase(match[0], "com"),
    suggestions: (match) => [matchCase(match[0], "com")],
    message: "A preposição 'com' grafa-se com 'm'. Use 'm' antes de p e b e no final de palavras.",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\b(a)n([pb][\p{L}]+)\b/giu,
    replacement: (match) => matchCase(match[0], `am${match[2]}`),
    suggestions: (match) => [matchCase(match[0], `am${match[2]}`)],
    message: "Em português, usa-se 'm' antes de 'p' e 'b' (ex: amparo, também, campo).",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\b(i)n([pb][\p{L}]+)\b/giu,
    replacement: (match) => matchCase(match[0], `im${match[2]}`),
    suggestions: (match) => [matchCase(match[0], `im${match[2]}`)],
    message: "Em português, usa-se 'm' antes de 'p' e 'b' (ex: impossível, importante, impedir).",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\b(e)n([pb][\p{L}]+)\b/giu,
    replacement: (match) => matchCase(match[0], `em${match[2]}`),
    suggestions: (match) => [matchCase(match[0], `em${match[2]}`)],
    message: "Em português, usa-se 'm' antes de 'p' e 'b' (ex: embora, embaixo, embrulho).",
  },
  {
    rule: "SPELLING",
    severity: "warning",
    pattern: /\b(l)e(n)([pb][\p{L}]+)\b/giu,
    replacement: (match) => matchCase(match[0], `lem${match[3]}`),
    suggestions: (match) => [matchCase(match[0], `lem${match[3]}`)],
    message: "Em português, usa-se 'm' antes de 'p' e 'b' (ex: lembrança, lembrar).",
  },

  // 4. ACENTUAÇÃO GRÁFICA FALTANTE (ACCENTUATION)
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bortografic(o|os|a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `ortográfic${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `ortográfic${match[1]?.toLowerCase() ?? ""}`)],
    message: "Palavra proparoxítona: todas devem ser acentuadas graficamente ('ortográfico(a)').",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bvoc(e|es)\b/giu,
    replacement: (match) =>
      matchCase(match[0], `você${match[1]?.toLowerCase() === "es" ? "s" : ""}`),
    suggestions: (match) => [
      matchCase(match[0], `você${match[1]?.toLowerCase() === "es" ? "s" : ""}`),
    ],
    message: "Oxítona terminada em 'e' (seguida ou não de 's') leva acento circunflexo: 'você'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bnao\b/giu,
    replacement: (match) => matchCase(match[0], "não"),
    suggestions: (match) => [matchCase(match[0], "não")],
    message: "A palavra 'não' leva til.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\btambem\b/giu,
    replacement: (match) => matchCase(match[0], "também"),
    suggestions: (match) => [matchCase(match[0], "também")],
    message: "Oxítona terminada em '-em' com mais de uma sílaba leva acento agudo: 'também'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bate\b/giu,
    replacement: (match) => matchCase(match[0], "até"),
    suggestions: (match) => [matchCase(match[0], "até")],
    message: "Oxítona terminada em 'e' leva acento agudo: 'até'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bja\b/giu,
    replacement: (match) => matchCase(match[0], "já"),
    suggestions: (match) => [matchCase(match[0], "já")],
    message: "Monossílabo tônico terminado em 'a': 'já'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\btres\b/giu,
    replacement: (match) => matchCase(match[0], "três"),
    suggestions: (match) => [matchCase(match[0], "três")],
    message: "Monossílabo tônico terminado em 'e' seguido de 's': 'três'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bmes\b/giu,
    replacement: (match) => matchCase(match[0], "mês"),
    suggestions: (match) => [matchCase(match[0], "mês")],
    message: "Monossílabo tônico terminado em 'e' seguido de 's': 'mês'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bsaude\b/giu,
    replacement: (match) => matchCase(match[0], "saúde"),
    suggestions: (match) => [matchCase(match[0], "saúde")],
    message: "Hiato com 'u' tônico isolado na sílaba leva acento agudo: 'saúde'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bhistori(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `históri${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `históri${match[1]?.toLowerCase() ?? ""}`)],
    message: "Paroxítona terminada em ditongo crescente leva acento agudo: 'história'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\brelatori(o|os)\b/giu,
    replacement: (match) => matchCase(match[0], `relatóri${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `relatóri${match[1]?.toLowerCase() ?? ""}`)],
    message: "Paroxítona terminada em ditongo crescente: 'relatório'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bnegoci(o|os)\b/giu,
    replacement: (match) => matchCase(match[0], `negóci${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `negóci${match[1]?.toLowerCase() ?? ""}`)],
    message: "Paroxítona terminada em ditongo crescente: 'negócio'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bjuridic(o|os|a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `jurídic${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `jurídic${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'jurídico'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bpublic(o|os|a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `públic${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `públic${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'público'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\blogic(o|os|a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `lógic${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `lógic${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'lógica'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bduvid(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `dúvid${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `dúvid${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'dúvida'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\botim(o|os|a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `ótim${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `ótim${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'ótimo'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bfacil\b/giu,
    replacement: (match) => matchCase(match[0], "fácil"),
    suggestions: (match) => [matchCase(match[0], "fácil")],
    message: "Paroxítona terminada em 'l': 'fácil'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bdificil\b/giu,
    replacement: (match) => matchCase(match[0], "difícil"),
    suggestions: (match) => [matchCase(match[0], "difícil")],
    message: "Paroxítona terminada em 'l': 'difícil'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\brapid(o|os|a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `rápid${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `rápid${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'rápido'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bepoc(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `époc${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `époc${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'época'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bunic(o|os|a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `únic${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `únic${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'único'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bnumer(o|os)\b/giu,
    replacement: (match) => matchCase(match[0], `númer${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `númer${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'número'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bcodig(o|os)\b/giu,
    replacement: (match) => matchCase(match[0], `códig${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `códig${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'código'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bmodul(o|os)\b/giu,
    replacement: (match) => matchCase(match[0], `módul${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `módul${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'módulo'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\blingu(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `língu${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `língu${match[1]?.toLowerCase() ?? ""}`)],
    message: "Paroxítona terminada em ditongo: 'língua'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bpagin(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `págin${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `págin${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'página'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bclausul(a|as)\b/giu,
    replacement: (match) => matchCase(match[0], `cláusul${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `cláusul${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'cláusula'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bprejuiz(o|os)\b/giu,
    replacement: (match) => matchCase(match[0], `prejuíz${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `prejuíz${match[1]?.toLowerCase() ?? ""}`)],
    message: "Hiato com 'i' tônico na sílaba: 'prejuízo'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bveicul(o|os)\b/giu,
    replacement: (match) => matchCase(match[0], `veícul${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `veícul${match[1]?.toLowerCase() ?? ""}`)],
    message: "Proparoxítona: 'veículo'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bpossivel\b/giu,
    replacement: (match) => matchCase(match[0], "possível"),
    suggestions: (match) => [matchCase(match[0], "possível")],
    message: "Paroxítona terminada em 'l': 'possível'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bpossiveis\b/giu,
    replacement: (match) => matchCase(match[0], "possíveis"),
    suggestions: (match) => [matchCase(match[0], "possíveis")],
    message: "Paroxítona terminada em ditongo seguido de 's': 'possíveis'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bincrivel\b/giu,
    replacement: (match) => matchCase(match[0], "incrível"),
    suggestions: (match) => [matchCase(match[0], "incrível")],
    message: "Paroxítona terminada em 'l': 'incrível'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bsustentavel\b/giu,
    replacement: (match) => matchCase(match[0], "sustentável"),
    suggestions: (match) => [matchCase(match[0], "sustentável")],
    message: "Paroxítona terminada em 'l': 'sustentável'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bresponsavel\b/giu,
    replacement: (match) => matchCase(match[0], "responsável"),
    suggestions: (match) => [matchCase(match[0], "responsável")],
    message: "Paroxítona terminada em 'l': 'responsável'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\bresponsaveis\b/giu,
    replacement: (match) => matchCase(match[0], "responsáveis"),
    suggestions: (match) => [matchCase(match[0], "responsáveis")],
    message: "Paroxítona terminada em ditongo seguido de 's': 'responsáveis'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\butil\b/giu,
    replacement: (match) => matchCase(match[0], "útil"),
    suggestions: (match) => [matchCase(match[0], "útil")],
    message: "Paroxítona terminada em 'l': 'útil'.",
  },
  {
    rule: "ACCENTUATION",
    severity: "warning",
    pattern: /\binutil\b/giu,
    replacement: (match) => matchCase(match[0], "inútil"),
    suggestions: (match) => [matchCase(match[0], "inútil")],
    message: "Paroxítona terminada em 'l': 'inútil'.",
  },

  // 5. CONCORDÂNCIA E GRAMÁTICA (GRAMMAR_AGREEMENT)
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bhouveram\s+([\p{L}]+)\b/giu,
    replacement: (match) => `${matchCase("houveram", "houve")} ${match[1]}`,
    suggestions: (match) => [`${matchCase("houveram", "houve")} ${match[1]}`],
    message:
      "O verbo 'haver' no sentido de existir ou ocorrer é impessoal e não flexiona no plural ('houve problemas').",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern:
      /\bfazem\s+(\d+|dois|três|quatro|cinco|muitos|vários)\s+(anos?|meses?|dias?|semanas?)\b/giu,
    replacement: (match) => `${matchCase("fazem", "faz")} ${match[1]} ${match[2]}`,
    suggestions: (match) => [`${matchCase("fazem", "faz")} ${match[1]} ${match[2]}`],
    message:
      "O verbo 'fazer' indicando tempo decorrido é impessoal e permanece no singular ('faz dois anos').",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern:
      /\bpara\s+mim\s+(fazer|comprar|dizer|ver|ir|trazer|ler|pagar|escrever|analisar|estudar)\b/giu,
    replacement: (match) => `para eu ${match[1]}`,
    suggestions: (match) => [`para eu ${match[1]}`],
    message:
      "O pronome oblíquo 'mim' não conjuga verbo nem funciona como sujeito. Use o pronome reto 'eu'.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern:
      /\b(nós|nos)\s+(vai|foi|faz|fez|faria|iria|era|é|tem|tinha|está|tá|estava|tava|sabe|soube|quer|quis|pode|pôde|viu|falou|disse|chegou|saiu)\b/giu,
    replacement: (match) => {
      const v = match[2]?.toLowerCase() ?? "";
      let repl = "vamos";
      if (v === "foi") repl = "fomos";
      else if (v === "faz") repl = "fazemos";
      else if (v === "fez") repl = "fizemos";
      else if (v === "faria") repl = "faríamos";
      else if (v === "iria") repl = "iríamos";
      else if (v === "era") repl = "éramos";
      else if (v === "é") repl = "somos";
      else if (v === "tem") repl = "temos";
      else if (v === "tinha") repl = "tínhamos";
      else if (v === "está" || v === "tá") repl = "estamos";
      else if (v === "estava" || v === "tava") repl = "estávamos";
      else if (v === "sabe") repl = "sabemos";
      else if (v === "soube") repl = "soubemos";
      else if (v === "quer") repl = "queremos";
      else if (v === "quis") repl = "quisemos";
      else if (v === "pode") repl = "podemos";
      else if (v === "pôde") repl = "pudemos";
      else if (v === "viu") repl = "vimos";
      else if (v === "falou") repl = "falamos";
      else if (v === "disse") repl = "dissemos";
      else if (v === "chegou") repl = "chegamos";
      else if (v === "saiu") repl = "saímos";
      return matchCase(match[0], `nós ${repl}`);
    },
    suggestions: (match) => {
      const v = match[2]?.toLowerCase() ?? "";
      let repl = "vamos";
      if (v === "foi") repl = "fomos";
      else if (v === "faz") repl = "fazemos";
      else if (v === "fez") repl = "fizemos";
      else if (v === "faria") repl = "faríamos";
      else if (v === "iria") repl = "iríamos";
      else if (v === "era") repl = "éramos";
      else if (v === "é") repl = "somos";
      else if (v === "tem") repl = "temos";
      else if (v === "tinha") repl = "tínhamos";
      else if (v === "está" || v === "tá") repl = "estamos";
      else if (v === "estava" || v === "tava") repl = "estávamos";
      else if (v === "sabe") repl = "sabemos";
      else if (v === "soube") repl = "soubemos";
      else if (v === "quer") repl = "queremos";
      else if (v === "quis") repl = "quisemos";
      else if (v === "pode") repl = "podemos";
      else if (v === "pôde") repl = "pudemos";
      else if (v === "viu") repl = "vimos";
      else if (v === "falou") repl = "falamos";
      else if (v === "disse") repl = "dissemos";
      else if (v === "chegou") repl = "chegamos";
      else if (v === "saiu") repl = "saímos";
      return [matchCase(match[0], `nós ${repl}`)];
    },
    message: "Concordância incorreta entre o pronome 'nós' e o verbo no singular.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern:
      /\b(a\s+gente|agente)\s+(fomos|vamos|faremos|iremos|fizeram|fizemos|éramos|estamos|estivemos|tínhamos|sabemos|queremos|podemos|dissemos|vimos|chegamos)\b/giu,
    replacement: (match) => {
      const verb = match[2]?.toLowerCase() ?? "";
      let singularVerb = "vai";
      if (verb === "fomos") singularVerb = "foi";
      else if (verb === "fizeram" || verb === "fizemos") singularVerb = "fez";
      else if (verb === "faremos") singularVerb = "fará";
      else if (verb === "iremos") singularVerb = "irá";
      else if (verb === "vamos") singularVerb = "vai";
      else if (verb === "éramos") singularVerb = "era";
      else if (verb === "estamos") singularVerb = "está";
      else if (verb === "estivemos") singularVerb = "esteve";
      else if (verb === "tínhamos") singularVerb = "tinha";
      else if (verb === "sabemos") singularVerb = "sabe";
      else if (verb === "queremos") singularVerb = "quer";
      else if (verb === "podemos") singularVerb = "pode";
      else if (verb === "dissemos") singularVerb = "disse";
      else if (verb === "vimos") singularVerb = "viu";
      else if (verb === "chegamos") singularVerb = "chegou";
      return matchCase(match[0], `a gente ${singularVerb}`);
    },
    suggestions: (match) => {
      const verb = match[2]?.toLowerCase() ?? "";
      let singularVerb = "vai";
      let pluralOption = "nós fomos";
      if (verb === "fomos") {
        singularVerb = "foi";
        pluralOption = "nós fomos";
      } else if (verb === "fizeram" || verb === "fizemos") {
        singularVerb = "fez";
        pluralOption = "nós fizemos";
      } else if (verb === "faremos") {
        singularVerb = "fará";
        pluralOption = "nós faremos";
      } else if (verb === "iremos") {
        singularVerb = "irá";
        pluralOption = "nós iremos";
      } else if (verb === "vamos") {
        singularVerb = "vai";
        pluralOption = "nós vamos";
      } else if (verb === "éramos") {
        singularVerb = "era";
        pluralOption = "nós éramos";
      } else if (verb === "estamos") {
        singularVerb = "está";
        pluralOption = "nós estamos";
      } else if (verb === "estivemos") {
        singularVerb = "esteve";
        pluralOption = "nós estivemos";
      } else if (verb === "tínhamos") {
        singularVerb = "tinha";
        pluralOption = "nós tínhamos";
      } else if (verb === "sabemos") {
        singularVerb = "sabe";
        pluralOption = "nós sabemos";
      } else if (verb === "queremos") {
        singularVerb = "quer";
        pluralOption = "nós queremos";
      } else if (verb === "podemos") {
        singularVerb = "pode";
        pluralOption = "nós podemos";
      } else if (verb === "dissemos") {
        singularVerb = "disse";
        pluralOption = "nós dissemos";
      } else if (verb === "vimos") {
        singularVerb = "viu";
        pluralOption = "nós vimos";
      } else if (verb === "chegamos") {
        singularVerb = "chegou";
        pluralOption = "nós chegamos";
      }
      return [matchCase(match[0], `a gente ${singularVerb}`), matchCase(match[0], pluralOption)];
    },
    message:
      "A locução 'a gente' equivale semanticamente a nós, mas exige gramaticalmente verbo na 3ª pessoa do singular ('a gente foi') ou use 'nós fomos'.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern:
      /\bagente\s+(foi|vai|faz|fez|disse|diz|falou|fala|quer|quis|pode|pôde|tem|tinha|está|estava|tá|tava|sabe|soube|saiu|sai|chegou|chega|viu|vê|pensou|pensa|achou|acha|gostou|gosta|ficou|fica|precisa|precisou|consegue|conseguiu|entende|entendeu)\b/giu,
    replacement: (match) => matchCase(match[0], `a gente ${match[1]}`),
    suggestions: (match) => [matchCase(match[0], `a gente ${match[1]}`)],
    message:
      "'Agente' (junto) refere-se a profissão ou função (agente público). Quando o sentido for 'nós', grafe separado: 'a gente'.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern:
      /\b(eles|elas)\s+(vai|foi|faz|fez|era|é|está|tá|estava|tava|sabe|soube|quer|quis|pode|pôde|viu|falou|disse|chegou|saiu)\b/giu,
    replacement: (match) => {
      const pron = match[1]?.toLowerCase() ?? "eles";
      const v = match[2]?.toLowerCase() ?? "";
      let repl = "vão";
      if (v === "foi") repl = "foram";
      else if (v === "faz") repl = "fazem";
      else if (v === "fez") repl = "fizeram";
      else if (v === "era") repl = "eram";
      else if (v === "é") repl = "são";
      else if (v === "está" || v === "tá") repl = "estão";
      else if (v === "estava" || v === "tava") repl = "estavam";
      else if (v === "sabe") repl = "sabem";
      else if (v === "soube") repl = "souberam";
      else if (v === "quer") repl = "querem";
      else if (v === "quis") repl = "quiseram";
      else if (v === "pode") repl = "podem";
      else if (v === "pôde") repl = "puderam";
      else if (v === "viu") repl = "viram";
      else if (v === "falou") repl = "falaram";
      else if (v === "disse") repl = "disseram";
      else if (v === "chegou") repl = "chegaram";
      else if (v === "saiu") repl = "saíram";
      return matchCase(match[0], `${pron} ${repl}`);
    },
    suggestions: (match) => {
      const pron = match[1]?.toLowerCase() ?? "eles";
      const v = match[2]?.toLowerCase() ?? "";
      let repl = "vão";
      if (v === "foi") repl = "foram";
      else if (v === "faz") repl = "fazem";
      else if (v === "fez") repl = "fizeram";
      else if (v === "era") repl = "eram";
      else if (v === "é") repl = "são";
      else if (v === "está" || v === "tá") repl = "estão";
      else if (v === "estava" || v === "tava") repl = "estavam";
      else if (v === "sabe") repl = "sabem";
      else if (v === "soube") repl = "souberam";
      else if (v === "quer") repl = "querem";
      else if (v === "quis") repl = "quiseram";
      else if (v === "pode") repl = "podem";
      else if (v === "pôde") repl = "puderam";
      else if (v === "viu") repl = "viram";
      else if (v === "falou") repl = "falaram";
      else if (v === "disse") repl = "disseram";
      else if (v === "chegou") repl = "chegaram";
      else if (v === "saiu") repl = "saíram";
      return [matchCase(match[0], `${pron} ${repl}`)];
    },
    message:
      "Concordância verbal: o pronome no plural ('eles/elas') exige o verbo flexionado no plural.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern:
      /\b(os|as|esses|essas|estes|estas|aqueles|aquelas|meus|minhas|seus|suas|nossos|nossas)\s+(cara|pessoa|homem|mulher|menino|menina|garoto|garota|criança|amigo|amiga|documento|arquivo|foto|imagem|dia|mês|ano|problema|caso|fato|ponto|livro|carro|coisa|casa|conta|texto|item|produto)\b/giu,
    replacement: (match) => {
      const det = match[1] ?? "";
      const noun = match[2]?.toLowerCase() ?? "";
      let pluralNoun = `${noun}s`;
      if (noun === "homem") pluralNoun = "homens";
      else if (noun === "mulher") pluralNoun = "mulheres";
      else if (noun === "mês") pluralNoun = "meses";
      else if (noun === "item") pluralNoun = "itens";
      return matchCase(match[0], `${det} ${pluralNoun}`);
    },
    suggestions: (match) => {
      const det = match[1] ?? "";
      const noun = match[2]?.toLowerCase() ?? "";
      let pluralNoun = `${noun}s`;
      if (noun === "homem") pluralNoun = "homens";
      else if (noun === "mulher") pluralNoun = "mulheres";
      else if (noun === "mês") pluralNoun = "meses";
      else if (noun === "item") pluralNoun = "itens";
      return [matchCase(match[0], `${det} ${pluralNoun}`)];
    },
    message: "Concordância nominal: o substantivo deve acompanhar o determinante no plural.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bas\s+pessoas\s+(disse|falou|afirmou|pensou|fez)\b/giu,
    replacement: (match) =>
      matchCase(
        match[0],
        `as pessoas ${match[1]?.toLowerCase() === "disse" ? "disseram" : match[1]?.toLowerCase() === "fez" ? "fizeram" : `${match[1]?.slice(0, -2)}aram`}`,
      ),
    suggestions: (match) => [
      matchCase(
        match[0],
        `as pessoas ${match[1]?.toLowerCase() === "disse" ? "disseram" : match[1]?.toLowerCase() === "fez" ? "fizeram" : `${match[1]?.slice(0, -2)}aram`}`,
      ),
    ],
    message: "Concordância verbal: o sujeito no plural ('as pessoas') exige o verbo no plural.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bos\s+documentos\s+(comprova|mostra|indica|apresenta)\b/giu,
    replacement: (match) => matchCase(match[0], `os documentos ${match[1]?.toLowerCase()}m`),
    suggestions: (match) => [matchCase(match[0], `os documentos ${match[1]?.toLowerCase()}m`)],
    message: "Concordância verbal: o sujeito no plural ('os documentos') exige o verbo no plural.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bmeio-dia\s+e\s+meio\b/giu,
    replacement: (match) => matchCase(match[0], "meio-dia e meia"),
    suggestions: (match) => [matchCase(match[0], "meio-dia e meia")],
    message: "A forma correta é 'meio-dia e meia' (concordando com meia hora).",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bmeia\s+(cansada|nervosa|preocupada|atenta|chateada)\b/giu,
    replacement: (match) => `${matchCase("meia", "meio")} ${match[1]}`,
    suggestions: (match) => [`${matchCase("meia", "meio")} ${match[1]}`],
    message:
      "Como advérbio de intensidade (com sentido de 'um pouco'), 'meio' é invariável ('meio cansada').",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bassistir\s+o\s+(filme|jogo|vídeo|documento|espetáculo)\b/giu,
    replacement: (match) => `${matchCase("assistir", "assistir")} ao ${match[1]}`,
    suggestions: (match) => [`${matchCase("assistir", "assistir")} ao ${match[1]}`],
    message:
      "No sentido de ver ou presenciar, o verbo 'assistir' é transitivo indireto e rege a preposição 'a'.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bobedecer\s+o\s+([\p{L}]+)\b/giu,
    replacement: (match) => `${matchCase("obedecer", "obedecer")} ao ${match[1]}`,
    suggestions: (match) => [`${matchCase("obedecer", "obedecer")} ao ${match[1]}`],
    message: "O verbo 'obedecer' é transitivo indireto e exige a preposição 'a'.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bdesobedecer\s+o\s+([\p{L}]+)\b/giu,
    replacement: (match) => `${matchCase("desobedecer", "desobedecer")} ao ${match[1]}`,
    suggestions: (match) => [`${matchCase("desobedecer", "desobedecer")} ao ${match[1]}`],
    message: "O verbo 'desobedecer' é transitivo indireto e exige a preposição 'a'.",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bprefer(ir|o|e|em|imos)\s+([\p{L}]+)\s+do\s+que\b/giu,
    replacement: (match) => `prefer${match[1]} ${match[2]} a`,
    suggestions: (match) => [`prefer${match[1]} ${match[2]} a`],
    message: "Quem prefere, prefere uma coisa 'a' outra (não se usa 'do que').",
  },
  {
    rule: "GRAMMAR_AGREEMENT",
    severity: "warning",
    pattern: /\bnamorar\s+com\b/giu,
    replacement: (match) => matchCase(match[0], "namorar"),
    suggestions: (match) => [matchCase(match[0], "namorar")],
    message: "O verbo 'namorar' é transitivo direto: namora-se alguém (sem a preposição 'com').",
  },

  // 6. CRASE (CRASE_USAGE)
  {
    rule: "CRASE_USAGE",
    severity: "warning",
    pattern:
      /\bà\s+(partir|fazer|comparecer|discutir|ver|pagar|escrever|solicitar|requerer|ajuizar|cumprir)\b/giu,
    replacement: (match) => `a ${match[1]}`,
    suggestions: (match) => [`a ${match[1]}`],
    message: "Não ocorre crase antes de verbos.",
  },
  {
    rule: "CRASE_USAGE",
    severity: "warning",
    pattern:
      /\bà\s+(pé|prazo|cavalo|bordo|tempo|esmo|favor|respeito|critério|juízo|título|nível)\b/giu,
    replacement: (match) => `a ${match[1]}`,
    suggestions: (match) => [`a ${match[1]}`],
    message: "Não ocorre crase antes de palavras masculinas.",
  },
  {
    rule: "CRASE_USAGE",
    severity: "warning",
    pattern: /\b(dia|frente|passo|face|lado|ponto)\s+à\s+\1\b/giu,
    replacement: (match) => `${match[1]} a ${match[1]}`,
    suggestions: (match) => [`${match[1]} a ${match[1]}`],
    message: "Não ocorre crase entre palavras repetidas.",
  },
  {
    rule: "CRASE_USAGE",
    severity: "warning",
    pattern: /\bas\s+(vezes|noites|tardes|pressas|claras|escondidas|avessas)\b/giu,
    replacement: (match) => `às ${match[1]}`,
    suggestions: (match) => [`às ${match[1]}`],
    message: "Locuções adverbiais femininas exigem o acento grave indicativo de crase: 'às'.",
  },
  {
    rule: "CRASE_USAGE",
    severity: "warning",
    pattern:
      /\ba\s+(medida\s+que|proporção\s+que|noite|tarde|vista|toa|risca|revelia|vontade|espera\s+de)\b/giu,
    replacement: (match) => `à ${match[1]}`,
    suggestions: (match) => [`à ${match[1]}`],
    message: "Locuções prepositivas e adverbiais femininas exigem acento indicativo de crase: 'à'.",
  },
  {
    rule: "CRASE_USAGE",
    severity: "warning",
    pattern: /\bas\s+(\d{1,2})h\b/giu,
    replacement: (match) => `às ${match[1]}h`,
    suggestions: (match) => [`às ${match[1]}h`],
    message: "A indicação de horas exatas exige crase: 'às'.",
  },
  {
    rule: "CRASE_USAGE",
    severity: "warning",
    pattern: /\bas\s+(\d{1,2})\s+horas\b/giu,
    replacement: (match) => `às ${match[1]} horas`,
    suggestions: (match) => [`às ${match[1]} horas`],
    message: "A indicação de horas exatas exige crase: 'às'.",
  },

  // 7. PARÔNIMOS E CONTEXTO (PARONYM_CONTEXT)
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bvultuos(os?|as?)\b/giu,
    replacement: (match) => matchCase(match[0], `vultos${match[1]?.toLowerCase() ?? ""}`),
    suggestions: (match) => [matchCase(match[0], `vultos${match[1]?.toLowerCase() ?? ""}`)],
    message:
      "Atenção ao parônimo: 'vultoso' significa volumoso ou expressivo; 'vultuoso' refere-se ao rosto congestionado.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bmandato(\s+de\s+(?:prisão|busca|apreensão|soltura|condução|penhora))\b/giu,
    replacement: (match) =>
      `${matchCase(match[0]?.split(/\s+/)[0] ?? "mandato", "mandado")}${match[1]}`,
    suggestions: (match) => [
      `${matchCase(match[0]?.split(/\s+/)[0] ?? "mandato", "mandado")}${match[1]}`,
    ],
    message:
      "Ordem judicial é 'mandado'. 'Mandato' refere-se à representação política ou procuração.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bmandado(\s+(?:eletivo|presidencial|parlamentar|tampão))\b/giu,
    replacement: (match) =>
      `${matchCase(match[0]?.split(/\s+/)[0] ?? "mandado", "mandato")}${match[1]}`,
    suggestions: (match) => [
      `${matchCase(match[0]?.split(/\s+/)[0] ?? "mandado", "mandato")}${match[1]}`,
    ],
    message: "Exercício de cargo ou delegação de poderes é 'mandato'. 'Mandado' é ordem judicial.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bintervido\b/giu,
    replacement: (match) => matchCase(match[0], "intervindo"),
    suggestions: (match) => [matchCase(match[0], "intervindo")],
    message: "O particípio do verbo intervir (derivado de vir) é 'intervindo'.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bhaja\s+vistos?\b/giu,
    replacement: (match) => matchCase(match[0], "haja vista"),
    suggestions: (match) => [matchCase(match[0], "haja vista")],
    message: "A locução 'haja vista' permanece invariável na norma culta.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "suggestion",
    pattern: /\bao\s+ponto\s+de\b/giu,
    replacement: (match) => matchCase(match[0], "a ponto de"),
    suggestions: (match) => [matchCase(match[0], "a ponto de")],
    message: "Na norma culta, a locução consecutiva recomendada é 'a ponto de'.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bsob\s+judice\b/giu,
    replacement: (match) => matchCase(match[0], "sub judice"),
    suggestions: (match) => [matchCase(match[0], "sub judice")],
    message: "A grafia jurídica correta da locução latina é 'sub judice'.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bpor\s+que(?=[\s]*[?!.])/giu,
    replacement: (match) => matchCase(match[0], "por quê"),
    suggestions: (match) => [matchCase(match[0], "por quê")],
    message: "Em fim de frase ou antes de pontuação, grafa-se separado e com acento: 'por quê'.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\b(o|um|este|esse)\s+por\s+que\b/giu,
    replacement: (match) => `${match[1]} porquê`,
    suggestions: (match) => [`${match[1]} porquê`],
    message:
      "Quando substantivado (antecedido por artigo ou pronome), grafa-se junto e com circunflexo: 'porquê'.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bmal\s+(humor|humorado|exemplo|caráter|pressentimento)\b/giu,
    replacement: (match) => `${matchCase("mal", "mau")} ${match[1]}`,
    suggestions: (match) => [`${matchCase("mal", "mau")} ${match[1]}`],
    message: "Oposto de bom é 'mau' (adjetivo). 'Mal' é oposto de bem (advérbio).",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bmau\s+(educado|feito|intencionado|acabado|sucedido)\b/giu,
    replacement: (match) => `${matchCase("mau", "mal")} ${match[1]}`,
    suggestions: (match) => [`${matchCase("mau", "mal")} ${match[1]}`],
    message: "Oposto de bem é 'mal' (advérbio). 'Mau' é oposto de bom (adjetivo).",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\ba\s+(\d+|dois|três|quatro|cinco)\s+anos\s+atrás\b/giu,
    replacement: (match) => `há ${match[1]} anos`,
    suggestions: (match) => [`há ${match[1]} anos`, `${match[1]} anos atrás`],
    message: "'Há ... atrás' é redundante. Prefira simplesmente 'há X anos' ou 'X anos atrás'.",
  },

  // 8. PLEONASMOS VICIOSOS (PLEONASM_REDUNDANCY)
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bsubir\s+para\s+cima\b/giu,
    replacement: (match) => matchCase(match[0], "subir"),
    suggestions: (match) => [matchCase(match[0], "subir")],
    message: "Pleonasmo vicioso: 'subir' já indica movimento em direção ascendente.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bdescer\s+para\s+baixo\b/giu,
    replacement: (match) => matchCase(match[0], "descer"),
    suggestions: (match) => [matchCase(match[0], "descer")],
    message: "Pleonasmo vicioso: 'descer' já indica movimento em direção descendente.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bentrar\s+para\s+dentro\b/giu,
    replacement: (match) => matchCase(match[0], "entrar"),
    suggestions: (match) => [matchCase(match[0], "entrar")],
    message: "Pleonasmo vicioso: 'entrar' já expressa a ação de ir para dentro.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bsair\s+para\s+fora\b/giu,
    replacement: (match) => matchCase(match[0], "sair"),
    suggestions: (match) => [matchCase(match[0], "sair")],
    message: "Pleonasmo vicioso: 'sair' já expressa a ação de ir para fora.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\belo\s+de\s+ligação\b/giu,
    replacement: (match) => matchCase(match[0], "elo"),
    suggestions: (match) => [matchCase(match[0], "elo"), "ligação"],
    message: "Redundância: todo 'elo' é de ligação por definição.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bfato\s+real\b/giu,
    replacement: (match) => matchCase(match[0], "fato"),
    suggestions: (match) => [matchCase(match[0], "fato")],
    message: "Redundância: todo 'fato' é real.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bcerteza\s+absoluta\b/giu,
    replacement: (match) => matchCase(match[0], "certeza"),
    suggestions: (match) => [matchCase(match[0], "certeza")],
    message: "Redundância: a palavra 'certeza' já implica ausência de dúvida.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bmonopólio\s+exclusivo\b/giu,
    replacement: (match) => matchCase(match[0], "monopólio"),
    suggestions: (match) => [matchCase(match[0], "monopólio")],
    message: "Redundância: todo monopólio é de natureza exclusiva.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bacabamento\s+final\b/giu,
    replacement: (match) => matchCase(match[0], "acabamento"),
    suggestions: (match) => [matchCase(match[0], "acabamento")],
    message: "Redundância: o 'acabamento' já constitui a fase final.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bpequenos\s+detalhes\b/giu,
    replacement: (match) => matchCase(match[0], "detalhes"),
    suggestions: (match) => [matchCase(match[0], "detalhes")],
    message: "Redundância: 'detalhes' já expressam pormenores ou minúcias.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bpanorama\s+geral\b/giu,
    replacement: (match) => matchCase(match[0], "panorama"),
    suggestions: (match) => [matchCase(match[0], "panorama")],
    message: "Redundância: o termo 'panorama' já designa uma visão global ou geral.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bprotagonista\s+principal\b/giu,
    replacement: (match) => matchCase(match[0], "protagonista"),
    suggestions: (match) => [matchCase(match[0], "protagonista")],
    message: "Redundância: o 'protagonista' já é a figura principal de uma ação.",
  },
  {
    rule: "PLEONASM_REDUNDANCY",
    severity: "suggestion",
    pattern: /\bconclusão\s+final\b/giu,
    replacement: (match) => matchCase(match[0], "conclusão"),
    suggestions: (match) => [matchCase(match[0], "conclusão")],
    message: "Redundância: a 'conclusão' já encerra o raciocínio final.",
  },

  // 9. ESTILO E CLICHÊS (STYLE_SUGGESTION)
  {
    rule: "STYLE_SUGGESTION",
    severity: "suggestion",
    pattern: /\ba\s+n[ií]vel\s+de\b/giu,
    replacement: (match) => matchCase(match[0], "em termos de"),
    suggestions: (_match) => ["no âmbito de", "em termos de", "quanto a"],
    message:
      "A locução 'a nível de' é um modismo desaconselhado. Prefira 'no âmbito de', 'em termos de' ou 'quanto a'.",
  },
  {
    rule: "STYLE_SUGGESTION",
    severity: "suggestion",
    pattern: /\bvir\s+a\s+ser\b/giu,
    replacement: (match) => matchCase(match[0], "ser"),
    suggestions: (match) => [matchCase(match[0], "ser")],
    message: "Construção prolixa. Na maioria dos casos, substitua simplesmente pelo verbo 'ser'.",
  },
  {
    rule: "STYLE_SUGGESTION",
    severity: "suggestion",
    pattern:
      /\bvamos\s+estar\s+(fazendo|enviando|analisando|verificando|entrando|conferindo|revisando)\b/giu,
    replacement: (match) =>
      matchCase(match[0], `vamos ${gerundToInfinitive[match[1]?.toLowerCase() ?? ""]}`),
    suggestions: (match) => [
      matchCase(match[0], `vamos ${gerundToInfinitive[match[1]?.toLowerCase() ?? ""]}`),
    ],
    message:
      "Evite o gerundismo ('vamos estar fazendo'). Prefira o infinitivo ou o futuro do presente.",
  },
  {
    rule: "STYLE_SUGGESTION",
    severity: "suggestion",
    pattern:
      /\bvou\s+estar\s+(fazendo|enviando|analisando|verificando|entrando|conferindo|revisando)\b/giu,
    replacement: (match) =>
      matchCase(match[0], `vou ${gerundToInfinitive[match[1]?.toLowerCase() ?? ""]}`),
    suggestions: (match) => [
      matchCase(match[0], `vou ${gerundToInfinitive[match[1]?.toLowerCase() ?? ""]}`),
    ],
    message:
      "Evite o gerundismo ('vou estar enviando'). Prefira o infinitivo ou o futuro do presente.",
  },
  {
    rule: "STYLE_SUGGESTION",
    severity: "suggestion",
    pattern: /\bao\s+meu\s+ver\b/giu,
    replacement: (match) => matchCase(match[0], "a meu ver"),
    suggestions: (match) => [matchCase(match[0], "a meu ver")],
    message: "A expressão culta é 'a meu ver' (sem o artigo definido).",
  },
  {
    rule: "STYLE_SUGGESTION",
    severity: "suggestion",
    pattern: /\bsob\s+a\s+ótica\b/giu,
    replacement: (match) => matchCase(match[0], "sob a perspectiva"),
    suggestions: (_match) => ["sob a perspectiva", "sob o ponto de vista"],
    message:
      "'Ótica' refere-se ao sentido da visão. No sentido figurado, prefira 'sob a perspectiva' ou 'sob o ponto de vista'.",
  },
  {
    rule: "STYLE_SUGGESTION",
    severity: "suggestion",
    pattern:
      /\b(situação|situações|cenário|cenários|caso|casos|hipótese|hipóteses|momento|momentos|contexto|contextos|fase|fases)\s+onde\b/giu,
    replacement: (match) => `${match[1]} em que`,
    suggestions: (match) => [`${match[1]} em que`, `${match[1]} na qual`],
    message:
      "O pronome 'onde' deve referir-se a lugares físicos concretos. Para noções abstratas, prefira 'em que'.",
  },
  {
    rule: "STYLE_SUGGESTION",
    severity: "warning",
    pattern: /\b(cuj(?:o|a|os|as))\s+(?:o|a|os|as)\b/giu,
    replacement: (match) => match[1] ?? "",
    suggestions: (match) => [match[1] ?? ""],
    message: "Não se utiliza artigo definido após o pronome relativo cujo/cuja.",
  },

  // 10. ESPAÇAMENTO E PONTUAÇÃO (SPACE_BEFORE_PUNCTUATION, REPEATED_WHITESPACE, TRAILING_WHITESPACE)
  {
    rule: "SPACE_BEFORE_PUNCTUATION",
    severity: "suggestion",
    pattern: /[ \t]+(?=[,.;:!?])/g,
    replacement: () => "",
    suggestions: () => [""],
    message: "Espaço indevido antes da pontuação.",
  },
  {
    rule: "TRAILING_WHITESPACE",
    severity: "suggestion",
    pattern: /[ \t]+(?=\r?$)/gm,
    replacement: () => "",
    suggestions: () => [""],
    message: "Espaço excedente no fim da linha.",
  },
  {
    rule: "REPEATED_WHITESPACE",
    severity: "suggestion",
    pattern: /[ \t]{2,}/g,
    replacement: () => " ",
    suggestions: () => [" "],
    message: "Espaçamento horizontal repetido.",
  },
];

// \b do JavaScript é ASCII, mesmo sob /u: falha em "à", "é" e "você".
const unicodeBoundary = String.raw`(?:(?<=[\p{L}\p{M}\p{N}_])(?![\p{L}\p{M}\p{N}_])|(?<![\p{L}\p{M}\p{N}_])(?=[\p{L}\p{M}\p{N}_]))`;
const unicodeRules = rules.map((definition) => ({
  ...definition,
  pattern: new RegExp(
    definition.pattern.source.replaceAll("\\b", unicodeBoundary),
    definition.pattern.flags,
  ),
}));

function protectedRanges(text: string): { start: number; end: number }[] {
  return [
    ...text.matchAll(
      /https?:\/\/[^\s]+|www\.[^\s]+|[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}|\{\{[^{}]*\}\}|\$\{[^{}]*\}/g,
    ),
  ].map((match) => ({ start: match.index, end: match.index + match[0].length }));
}

function isContextuallyValid(
  text: string,
  start: number,
  original: string,
  rule: ReviewRule,
): boolean {
  const before = text.slice(0, start);
  if (
    rule === "ACCENTUATION" &&
    /^(negocios?|public[oa]s?|duvidas?|numeros?|modulos?|historias?|paginas?|veiculos?)$/i.test(
      original,
    )
  ) {
    // Homógrafos sem acento também são verbos válidos. Exige contexto nominal.
    return !/(?:^|[^\p{L}])(?:o|a|os|as|um|uma|uns|umas|este|esta|esse|essa|seu|sua|meu|minha|do|da|dos|das|no|na|pelo|pela|documento|escola|instituição|serviço|serviços)\s+$/iu.test(
      before,
    );
  }
  if (rule === "PARONYM_CONTEXT" && /^agente\s/i.test(original)) {
    return /(?:^|[^\p{L}])(?:o|um|este|esse|aquele|ao|do|pelo|seu|meu)\s+$/iu.test(before);
  }
  if (rule === "GRAMMAR_AGREEMENT" && /^nos\s/i.test(original)) {
    // "nos" é também pronome oblíquo; só infere "nós" em início de oração.
    return !/(?:^|[.!?:;]\s*)$/u.test(before);
  }
  if (rule === "GRAMMAR_AGREEMENT" && /^houveram\s/i.test(original)) {
    return /^houveram\s+por\s+bem\b/iu.test(text.slice(start));
  }
  return false;
}

export function reviewText(text: string): readonly ReviewFinding[] {
  if (text.length > MAX_REVIEW_LENGTH) {
    throw new Error("O texto para revisão excede 1.000.000 de caracteres.");
  }

  const accepted: ReviewFinding[] = [];
  const protectedSpans = protectedRanges(text);
  for (const definition of unicodeRules) {
    definition.pattern.lastIndex = 0;
    for (const match of text.matchAll(definition.pattern)) {
      const start = match.index;
      const original = match[0];
      const end = start + original.length;
      if (protectedSpans.some((span) => start < span.end && end > span.start)) continue;
      if (isContextuallyValid(text, start, original, definition.rule)) continue;
      if (accepted.some((finding) => start < finding.end && end > finding.start)) continue;
      accepted.push({
        id: `${definition.rule}:${start}:${end}`,
        rule: definition.rule,
        severity: definition.severity,
        start,
        end,
        original,
        replacement: definition.replacement(match),
        suggestions: definition.suggestions
          ? definition.suggestions(match)
          : [definition.replacement(match)],
        message: definition.message,
      });
    }
  }
  return accepted.sort((left, right) => left.start - right.start || left.end - right.end);
}

export function mergeReviewFindings(
  primary: readonly ReviewFinding[],
  secondary: readonly ReviewFinding[],
): readonly ReviewFinding[] {
  const sortedPrimary = [...primary].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  const accepted: ReviewFinding[] = [];

  for (const finding of sortedPrimary) {
    if (accepted.some((f) => finding.start < f.end && finding.end > f.start)) continue;
    accepted.push(finding);
  }

  for (const candidate of secondary) {
    if (accepted.some((f) => candidate.start < f.end && candidate.end > f.start)) continue;
    accepted.push(candidate);
  }

  return accepted.sort((left, right) => left.start - right.start || left.end - right.end);
}

export function applyReviewFindings(
  text: string,
  findings: readonly ReviewFinding[],
  selectedIds: ReadonlySet<string> = new Set(findings.map((finding) => finding.id)),
): string {
  const selected = findings
    .filter((finding) => selectedIds.has(finding.id))
    .sort((left, right) => right.start - left.start);
  let nextBoundary = text.length;
  let result = text;
  for (const finding of selected) {
    if (
      finding.start < 0 ||
      finding.end <= finding.start ||
      finding.end > nextBoundary ||
      text.slice(finding.start, finding.end) !== finding.original
    ) {
      throw new Error("Achado de revisão inválido ou sobreposto.");
    }
    result = `${result.slice(0, finding.start)}${finding.replacement}${result.slice(finding.end)}`;
    nextBoundary = finding.start;
  }
  return result;
}
