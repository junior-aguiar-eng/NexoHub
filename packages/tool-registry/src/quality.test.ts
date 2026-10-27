import { describe, expect, it, vi } from "vitest";
import { checkQualityIndex } from "./quality-check";

const hash = "a".repeat(64);
const valid = () => ({
  schemaVersion: 1,
  scope: "web-local-evidence",
  limitations: ["Índice de evidência, sem homologação instalada."],
  corpora: [
    {
      id: "pdf",
      origin: "Sintético autoral",
      license: "MPL-2.0; bibliotecas mantêm licenças próprias",
      artifacts: [{ path: "fixtures/source.ts", sha256: hash, kind: "generator" }],
    },
  ],
  tools: [
    {
      toolId: "pdf-merge",
      level: "regression",
      corpora: ["pdf"],
      supported: ["Junção de duas páginas textuais"],
      refused: ["PDF inválido"],
      unmeasured: ["Formulários arbitrários"],
      docs: ["docs/TOOL-SPEC.md"],
      tests: ["test/merge.test.ts"],
    },
  ],
});
const files = () => ({ exists: vi.fn(() => true), sha256: vi.fn(() => hash) });

describe("índice Q-C0", () => {
  it("exige justificativa para exclusão explícita sem duplicar perfil homologado", () => {
    const data = {
      ...valid(),
      exclusions: [
        { toolId: "pdf-to-word", reason: "DOC-C2 fora do escopo", docs: ["docs/TOOL-SPEC.md"] },
      ],
    };
    expect(() => checkQualityIndex(data, ["pdf-merge", "pdf-to-word"], files())).not.toThrow();
    expect(() =>
      checkQualityIndex(
        { ...data, exclusions: [{ ...data.exclusions[0], reason: "" }] },
        ["pdf-merge", "pdf-to-word"],
        files(),
      ),
    ).toThrow(/TEXT_REQUIRED/);
    expect(() =>
      checkQualityIndex(
        { ...data, exclusions: [{ ...data.exclusions[0], toolId: "pdf-merge" }] },
        ["pdf-merge"],
        files(),
      ),
    ).toThrow(/DUPLICATE/);
    expect(() => checkQualityIndex(data, ["pdf-merge"], files())).toThrow(/TOOL_COVERAGE/);
  });
  it("aceita registros íntegros sem executar a ferramenta", () => {
    expect(() => checkQualityIndex(valid(), ["pdf-merge"], files())).not.toThrow();
  });
  it("recusa ferramenta ativa sem registro e ferramenta planejada no índice", () => {
    expect(() => checkQualityIndex(valid(), ["pdf-merge", "pdf-split"], files())).toThrow(
      /TOOL_COVERAGE/,
    );
    expect(() => checkQualityIndex(valid(), [], files())).toThrow(/TOOL_COVERAGE/);
  });
  it("recusa hash divergente ou referência ausente", () => {
    const io = files();
    io.sha256.mockReturnValue("b".repeat(64));
    expect(() => checkQualityIndex(valid(), ["pdf-merge"], io)).toThrow(/HASH_MISMATCH/);
    const missing = files();
    missing.exists.mockReturnValue(false);
    expect(() => checkQualityIndex(valid(), ["pdf-merge"], missing)).toThrow(/FILE_MISSING/);
  });
  it("recusa corpus não declarado e registros duplicados", () => {
    const data = valid();
    data.tools[0].corpora = ["missing"];
    expect(() => checkQualityIndex(data, ["pdf-merge"], files())).toThrow(/CORPUS_REFERENCE/);
    const duplicate = valid();
    duplicate.tools.push(duplicate.tools[0]);
    expect(() => checkQualityIndex(duplicate, ["pdf-merge"], files())).toThrow(/DUPLICATE/);
  });
  it("recusa path fora do workspace antes de solicitar leitura", () => {
    const data = valid();
    data.corpora[0].artifacts[0].path = "../outside";
    const io = files();
    expect(() => checkQualityIndex(data, ["pdf-merge"], io)).toThrow(/PATH_INVALID/);
    expect(io.sha256).not.toHaveBeenCalled();
  });
  it("recusa ausência de licença, limites ou tentativa de certificação por metadado", () => {
    const data = valid();
    data.corpora[0].license = "";
    expect(() => checkQualityIndex(data, ["pdf-merge"], files())).toThrow(/TEXT_REQUIRED/);
    const noLimits = valid();
    noLimits.tools[0].unmeasured = [];
    expect(() => checkQualityIndex(noLimits, ["pdf-merge"], files())).toThrow(/LIST_REQUIRED/);
    expect(() =>
      checkQualityIndex({ ...valid(), commercialApproval: true }, ["pdf-merge"], files()),
    ).toThrow(/UNKNOWN_FIELD/);
  });
});
