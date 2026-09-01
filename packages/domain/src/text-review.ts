export type ReviewRule =
  | "LANGUAGE_TOOL"
  | "DUPLICATE_WORD"
  | "SPACE_BEFORE_PUNCTUATION"
  | "REPEATED_WHITESPACE"
  | "TRAILING_WHITESPACE";

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
