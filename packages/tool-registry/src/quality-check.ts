/** Verifica metadados de evidência; não executa engines nem certifica conteúdo exportado. */
export interface QualityFiles {
  exists(path: string): boolean;
  sha256(path: string): string;
}

function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Q_C0_OBJECT_REQUIRED");
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record))
    if (!allowed.includes(key)) throw new Error(`Q_C0_UNKNOWN_FIELD: ${key}`);
  return record;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Q_C0_TEXT_REQUIRED");
  return value;
}

function rows(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("Q_C0_LIST_REQUIRED");
  return value;
}

function strings(value: unknown): string[] {
  return rows(value).map(text);
}

function relativeFile(value: unknown): string {
  const path = text(value),
    parts = path.split("/");
  if (
    path.includes("\\") ||
    path.includes(":") ||
    parts.some(
      (part) => !part || [".", "..", ".git", ".superpowers", "node_modules"].includes(part),
    )
  )
    throw new Error(`Q_C0_PATH_INVALID: ${path}`);
  return path;
}

export function checkQualityIndex(
  value: unknown,
  activeIds: readonly string[],
  files: QualityFiles,
): void {
  const index = object(value, ["schemaVersion", "scope", "limitations", "corpora", "tools"]);
  if (index.schemaVersion !== 1 || index.scope !== "web-local-evidence")
    throw new Error("Q_C0_SCHEMA_UNSUPPORTED");
  strings(index.limitations);
  const exists = (value: unknown) => {
    const path = relativeFile(value);
    if (!files.exists(path)) throw new Error(`Q_C0_FILE_MISSING: ${path}`);
    return path;
  };
  const corpusIds = new Set<string>();
  for (const raw of rows(index.corpora)) {
    const corpus = object(raw, ["id", "origin", "license", "artifacts"]);
    const id = text(corpus.id);
    if (corpusIds.has(id)) throw new Error(`Q_C0_DUPLICATE: ${id}`);
    corpusIds.add(id);
    text(corpus.origin);
    text(corpus.license);
    for (const rawArtifact of rows(corpus.artifacts)) {
      const artifact = object(rawArtifact, ["path", "sha256", "kind"]);
      const path = exists(artifact.path),
        expected = text(artifact.sha256);
      if (!["file", "generator", "manifest"].includes(text(artifact.kind)))
        throw new Error(`Q_C0_HASH_KIND: ${path}`);
      if (!/^[a-f0-9]{64}$/.test(expected)) throw new Error(`Q_C0_HASH_INVALID: ${path}`);
      if (files.sha256(path) !== expected) throw new Error(`Q_C0_HASH_MISMATCH: ${path}`);
    }
  }
  const tools = new Set<string>();
  for (const raw of rows(index.tools)) {
    const tool = object(raw, [
      "toolId",
      "level",
      "corpora",
      "supported",
      "refused",
      "unmeasured",
      "docs",
      "tests",
    ]);
    const id = text(tool.toolId);
    if (tools.has(id)) throw new Error(`Q_C0_DUPLICATE: ${id}`);
    tools.add(id);
    if (!["regression", "restricted-profile"].includes(text(tool.level)))
      throw new Error(`Q_C0_LEVEL_INVALID: ${id}`);
    for (const corpus of strings(tool.corpora))
      if (!corpusIds.has(corpus)) throw new Error(`Q_C0_CORPUS_REFERENCE: ${id}/${corpus}`);
    strings(tool.supported);
    strings(tool.refused);
    strings(tool.unmeasured);
    strings(tool.docs).forEach(exists);
    strings(tool.tests).forEach(exists);
  }
  if (
    new Set(activeIds).size !== activeIds.length ||
    tools.size !== activeIds.length ||
    activeIds.some((id) => !tools.has(id))
  )
    throw new Error("Q_C0_TOOL_COVERAGE");
}
