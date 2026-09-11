export type ReviewRule =
  | "LANGUAGE_TOOL"
  | "DUPLICATE_WORD"
  | "SPACE_BEFORE_PUNCTUATION"
  | "REPEATED_WHITESPACE"
  | "TRAILING_WHITESPACE"
  | "PARONYM_CONTEXT"
  | "STYLE_SUGGESTION";

export type ReviewFinding = {
  readonly id: string;
  readonly rule: ReviewRule;
  readonly severity: "warning" | "suggestion";
  readonly start: number;
  readonly end: number;
  readonly original: string;
  readonly replacement: string;
  readonly message: string;
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

type RuleDefinition = {
  rule: ReviewRule;
  severity: ReviewFinding["severity"];
  pattern: RegExp;
  replacement: (match: RegExpExecArray) => string;
  message: string;
};

const rules: readonly RuleDefinition[] = [
  {
    rule: "DUPLICATE_WORD",
    severity: "warning",
    pattern: /\b([\p{L}\p{N}][\p{L}\p{N}'’-]*)[ \t]+\1\b/giu,
    replacement: (match) => match[1] ?? "",
    message: "Palavra repetida em sequência.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bvultuos(os?|as?)\b/giu,
    replacement: (match) => matchCase(match[0], `vultos${match[1]?.toLowerCase() ?? ""}`),
    message:
      "Atenção ao parônimo: 'vultoso' significa volumoso, de grande vulto ou expressivo; 'vultuoso' refere-se ao rosto congestionado ou inchado por enfermidade.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bmandato(\s+de\s+(?:prisão|busca|apreensão|soltura|condução|penhora))\b/giu,
    replacement: (match) =>
      `${matchCase(match[0]?.split(/\s+/)[0] ?? "mandato", "mandado")}${match[1]}`,
    message:
      "Ordem judicial é 'mandado'. 'Mandato' refere-se à representação política ou procuração.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bmandado(\s+(?:eletivo|presidencial|parlamentar|tampão))\b/giu,
    replacement: (match) =>
      `${matchCase(match[0]?.split(/\s+/)[0] ?? "mandado", "mandato")}${match[1]}`,
    message: "Exercício de cargo ou delegação de poderes é 'mandato'. 'Mandado' é ordem judicial.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bintervido\b/giu,
    replacement: (match) => matchCase(match[0], "intervindo"),
    message: "O particípio do verbo intervir (derivado de vir) é 'intervindo'.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bhaja\s+vistos?\b/giu,
    replacement: (match) => matchCase(match[0], "haja vista"),
    message: "A locução 'haja vista' permanece invariável na norma culta.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "suggestion",
    pattern: /\bao\s+ponto\s+de\b/giu,
    replacement: (match) => matchCase(match[0], "a ponto de"),
    message: "Na norma culta, a locução consecutiva recomendada é 'a ponto de'.",
  },
  {
    rule: "PARONYM_CONTEXT",
    severity: "warning",
    pattern: /\bsob\s+judice\b/giu,
    replacement: (match) => matchCase(match[0], "sub judice"),
    message: "A grafia jurídica correta da locução latina é 'sub judice'.",
  },
  {
    rule: "STYLE_SUGGESTION",
    severity: "suggestion",
    pattern:
      /\b(situação|situações|cenário|cenários|caso|casos|hipótese|hipóteses|momento|momentos|contexto|contextos|fase|fases)\s+onde\b/giu,
    replacement: (match) => `${match[1]} em que`,
    message:
      "O pronome 'onde' deve referir-se a lugares físicos concretos. Para noções abstratas ou circunstâncias, prefira 'em que' ou 'no qual/na qual'.",
  },
  {
    rule: "STYLE_SUGGESTION",
    severity: "warning",
    pattern: /\b(cuj(?:o|a|os|as))\s+(?:o|a|os|as)\b/giu,
    replacement: (match) => match[1] ?? "",
    message: "Não se utiliza artigo definido após o pronome relativo cujo/cuja.",
  },
  {
    rule: "SPACE_BEFORE_PUNCTUATION",
    severity: "suggestion",
    pattern: /[ \t]+(?=[,.;:!?])/g,
    replacement: () => "",
    message: "Espaço indevido antes da pontuação.",
  },
  {
    rule: "TRAILING_WHITESPACE",
    severity: "suggestion",
    pattern: /[ \t]+(?=\r?$)/gm,
    replacement: () => "",
    message: "Espaço excedente no fim da linha.",
  },
  {
    rule: "REPEATED_WHITESPACE",
    severity: "suggestion",
    pattern: /[ \t]{2,}/g,
    replacement: () => " ",
    message: "Espaçamento horizontal repetido.",
  },
];

export function reviewText(text: string): readonly ReviewFinding[] {
  if (text.length > MAX_REVIEW_LENGTH) {
    throw new Error("O texto para revisão excede 1.000.000 de caracteres.");
  }

  const accepted: ReviewFinding[] = [];
  for (const definition of rules) {
    definition.pattern.lastIndex = 0;
    for (const match of text.matchAll(definition.pattern)) {
      const start = match.index;
      const original = match[0];
      const end = start + original.length;
      if (accepted.some((finding) => start < finding.end && end > finding.start)) continue;
      accepted.push({
        id: `${definition.rule}:${start}:${end}`,
        rule: definition.rule,
        severity: definition.severity,
        start,
        end,
        original,
        replacement: definition.replacement(match),
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
