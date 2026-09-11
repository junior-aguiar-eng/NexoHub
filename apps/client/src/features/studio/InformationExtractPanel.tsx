import type { ExtractInformationResult } from "@nexohub/contracts";
import type { ArtifactId, DocumentId } from "@nexohub/domain";
import { Check, Copy, FileText, Layers, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";

type InformationExtractPanelProps = {
  initialText?: string;
  documentCore?: DocumentCorePort;
  projectPath?: string;
  documentId?: DocumentId;
  artifactId?: ArtifactId;
  onSuccess?: () => void;
};

export function InformationExtractPanel({
  initialText = "",
  documentCore,
  projectPath,
  documentId,
  artifactId,
  onSuccess,
}: InformationExtractPanelProps) {
  const [text, setText] = useState(initialText);
  const [mode, setMode] = useState<string>("all");
  const [result, setResult] = useState<ExtractInformationResult | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "markdown" | "entities" | "keyValues" | "tables" | "rawJson"
  >("overview");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  async function handleExtract() {
    setIsExtracting(true);
    setStatusMessage(null);
    try {
      if (documentCore) {
        const response = await documentCore.invoke("extract_information", {
          projectPath,
          documentId,
          artifactId,
          text: text.trim() ? text : undefined,
          mode,
        });
        setResult(response);
        if (response.text && !text) {
          setText(response.text);
        }
      } else {
        setResult({
          text,
          mode,
          metrics: {
            charCount: text.length,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            lineCount: text.split("\n").length,
            pageCount: 1,
            language: "pt-BR",
          },
          entities: [],
          keyValues: {},
          tables: [],
          sections: [],
        });
      }
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : "Não foi possível executar a extração no documento.",
      );
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleSaveLayer() {
    if (!documentCore || !projectPath || !documentId || !result) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await documentCore.invoke("extract_information", {
        projectPath,
        documentId,
        artifactId,
        text: text.trim() ? text : undefined,
        mode: result.mode,
      });
      setStatusMessage(translate("extract.savedSuccess"));
      onSuccess?.();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Falha ao salvar a versão JSON.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCopyJson() {
    if (!result) return;
    const jsonStr = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCopyMarkdown() {
    const md = result?.markdown || result?.text;
    if (!md) return;
    navigator.clipboard.writeText(md).then(() => {
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2000);
    });
  }

  function getCategoryLabel(cat: string): string {
    switch (cat) {
      case "cpf":
        return translate("extract.category.cpf");
      case "cnpj":
        return translate("extract.category.cnpj");
      case "money":
        return translate("extract.category.money");
      case "date":
        return translate("extract.category.date");
      case "email":
        return translate("extract.category.email");
      case "phone":
        return translate("extract.category.phone");
      case "cep":
        return translate("extract.category.cep");
      default:
        return cat.toUpperCase();
    }
  }

  const filteredEntities = (result?.entities ?? []).filter((e) => {
    const matchesCat = categoryFilter === "all" || e.category === categoryFilter;
    const matchesSearch =
      !searchFilter ||
      e.value.toLowerCase().includes(searchFilter.toLowerCase()) ||
      e.normalizedValue.toLowerCase().includes(searchFilter.toLowerCase()) ||
      e.category.toLowerCase().includes(searchFilter.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const filteredKeyValues = Object.entries(result?.keyValues ?? {}).filter(([k, v]) => {
    if (!searchFilter) return true;
    const q = searchFilter.toLowerCase();
    return k.toLowerCase().includes(q) || v.toLowerCase().includes(q);
  });

  return (
    <section
      className="text-editor extract-panel"
      aria-labelledby="extract-title"
      style={{
        display: "flex",
        flexDirection: "column",
        margin: "1rem auto",
        width: "min(56rem, 100%)",
        background: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md, 8px)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}
    >
      {/* Barra de Ferramentas Padronizada */}
      <div className="text-editor__toolbar">
        <div>
          <h2 id="extract-title" style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
            {translate("tool.intelligenceExtract.title")}
          </h2>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem" }}
          >
            <span style={{ color: "var(--color-ink-muted)" }}>
              {translate("extract.mode.label")}:
            </span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              disabled={isExtracting}
              style={{
                background: "var(--color-surface)",
                color: "var(--color-ink)",
                border: "1px solid var(--color-border)",
                borderRadius: "var(--radius-sm, 4px)",
                padding: "0.25rem 0.5rem",
                fontSize: "0.82rem",
                outline: "none",
              }}
            >
              <option value="all">{translate("extract.mode.all")}</option>
              <option value="entities">{translate("extract.mode.entities")}</option>
              <option value="key_values">{translate("extract.mode.keyValues")}</option>
              <option value="tables">{translate("extract.mode.tables")}</option>
              <option value="sections">{translate("extract.mode.sections")}</option>
            </select>
          </label>

          <Button
            variant="secondary"
            onClick={handleExtract}
            disabled={isExtracting}
            style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            {isExtracting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {isExtracting ? translate("extract.running") : translate("extract.run")}
          </Button>

          {result && projectPath && documentId && (
            <Button
              variant="secondary"
              onClick={handleSaveLayer}
              disabled={isSaving}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              <Layers size={14} />
              {translate("extract.saveAsLayer")}
            </Button>
          )}

          {result && (
            <Button
              variant="secondary"
              onClick={handleCopyMarkdown}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              {copiedMarkdown ? <Check size={14} /> : <Copy size={14} />}
              {copiedMarkdown ? translate("extract.copied") : translate("extract.copyMarkdown")}
            </Button>
          )}

          {result && (
            <Button
              variant="secondary"
              onClick={handleCopyJson}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? translate("extract.copied") : translate("extract.copyJson")}
            </Button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            padding: "0.6rem 1rem",
            background: "var(--color-brand-soft, rgba(16, 185, 129, 0.1))",
            borderBottom: "1px solid var(--color-border)",
            fontSize: "0.82rem",
            color: "var(--color-ink)",
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Caixa de Texto do Documento */}
      <div style={{ borderBottom: result ? "1px solid var(--color-border)" : "none" }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={translate("extract.inputPlaceholder")}
          style={{
            display: "block",
            width: "100%",
            minHeight: result ? "9rem" : "16rem",
            padding: "1rem",
            resize: "vertical",
            color: "var(--color-ink)",
            background: "var(--color-surface-raised)",
            font: "0.85rem / 1.6 ui-monospace, monospace",
            border: 0,
            outline: 0,
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Painel de Resultados Estruturados */}
      {result && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* Métricas e Estatísticas Rápidas */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "0.75rem",
              padding: "0.85rem 1rem",
              background: "var(--color-surface)",
              borderBottom: "1px solid var(--color-border)",
            }}
          >
            <div style={{ padding: "0.4rem 0" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--color-ink-muted)" }}>
                {translate("extract.entitiesFound")}
              </div>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 700,
                  color: "var(--color-brand, #2563eb)",
                }}
              >
                {result.entities.length}
              </div>
            </div>

            <div style={{ padding: "0.4rem 0" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--color-ink-muted)" }}>
                {translate("extract.keyValuesFound")}
              </div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--color-ink)" }}>
                {Object.keys(result.keyValues).length}
              </div>
            </div>

            <div style={{ padding: "0.4rem 0" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--color-ink-muted)" }}>
                {translate("extract.tablesFound")}
              </div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--color-ink)" }}>
                {result.tables.length}
              </div>
            </div>

            <div style={{ padding: "0.4rem 0" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--color-ink-muted)" }}>
                Palavras / Linhas
              </div>
              <div
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 600,
                  marginTop: "0.2rem",
                  color: "var(--color-ink)",
                }}
              >
                {result.metrics.wordCount} / {result.metrics.lineCount}
              </div>
            </div>
          </div>

          {/* Abas de Navegação */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              padding: "0 1rem",
              gap: "0.25rem",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              style={{
                padding: "0.6rem 0.8rem",
                border: "none",
                background: "transparent",
                borderBottom:
                  activeTab === "overview"
                    ? "2px solid var(--color-brand, #2563eb)"
                    : "2px solid transparent",
                color:
                  activeTab === "overview"
                    ? "var(--color-brand, #2563eb)"
                    : "var(--color-ink-muted)",
                fontWeight: activeTab === "overview" ? 600 : 400,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {translate("extract.tabs.overview")}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("markdown")}
              style={{
                padding: "0.6rem 0.8rem",
                border: "none",
                background: "transparent",
                borderBottom:
                  activeTab === "markdown"
                    ? "2px solid var(--color-brand, #2563eb)"
                    : "2px solid transparent",
                color:
                  activeTab === "markdown"
                    ? "var(--color-brand, #2563eb)"
                    : "var(--color-ink-muted)",
                fontWeight: activeTab === "markdown" ? 600 : 400,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {translate("extract.tabs.markdown")}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("entities")}
              style={{
                padding: "0.6rem 0.8rem",
                border: "none",
                background: "transparent",
                borderBottom:
                  activeTab === "entities"
                    ? "2px solid var(--color-brand, #2563eb)"
                    : "2px solid transparent",
                color:
                  activeTab === "entities"
                    ? "var(--color-brand, #2563eb)"
                    : "var(--color-ink-muted)",
                fontWeight: activeTab === "entities" ? 600 : 400,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {translate("extract.tabs.entities")} ({result.entities.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("keyValues")}
              style={{
                padding: "0.6rem 0.8rem",
                border: "none",
                background: "transparent",
                borderBottom:
                  activeTab === "keyValues"
                    ? "2px solid var(--color-brand, #2563eb)"
                    : "2px solid transparent",
                color:
                  activeTab === "keyValues"
                    ? "var(--color-brand, #2563eb)"
                    : "var(--color-ink-muted)",
                fontWeight: activeTab === "keyValues" ? 600 : 400,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {translate("extract.tabs.keyValues")} ({Object.keys(result.keyValues).length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("tables")}
              style={{
                padding: "0.6rem 0.8rem",
                border: "none",
                background: "transparent",
                borderBottom:
                  activeTab === "tables"
                    ? "2px solid var(--color-brand, #2563eb)"
                    : "2px solid transparent",
                color:
                  activeTab === "tables" ? "var(--color-brand, #2563eb)" : "var(--color-ink-muted)",
                fontWeight: activeTab === "tables" ? 600 : 400,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {translate("extract.tabs.tables")} ({result.tables.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("rawJson")}
              style={{
                padding: "0.6rem 0.8rem",
                border: "none",
                background: "transparent",
                borderBottom:
                  activeTab === "rawJson"
                    ? "2px solid var(--color-brand, #2563eb)"
                    : "2px solid transparent",
                color:
                  activeTab === "rawJson"
                    ? "var(--color-brand, #2563eb)"
                    : "var(--color-ink-muted)",
                fontWeight: activeTab === "rawJson" ? 600 : 400,
                fontSize: "0.82rem",
                cursor: "pointer",
              }}
            >
              {translate("extract.tabs.rawJson")}
            </button>
          </div>

          {/* Conteúdo da Aba */}
          <div style={{ padding: "1rem" }}>
            {/* 1. VISÃO GERAL */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                <div>
                  <h3
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      margin: "0 0 0.35rem 0",
                      color: "var(--color-ink)",
                    }}
                  >
                    Resumo do Documento
                  </h3>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.82rem",
                      color: "var(--color-ink-muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    O documento contém {result.metrics.wordCount} palavras e{" "}
                    {result.metrics.lineCount} linhas (idioma identificado:{" "}
                    <strong>{result.metrics.language}</strong>). Foram detectadas{" "}
                    {result.entities.length} entidades, {Object.keys(result.keyValues).length}{" "}
                    campos chave-valor e {result.tables.length} tabelas.
                  </p>
                </div>

                {result.sections.length > 0 && (
                  <div style={{ marginTop: "0.5rem" }}>
                    <h3
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        margin: "0 0 0.5rem 0",
                        color: "var(--color-ink)",
                      }}
                    >
                      Estrutura de Seções Detectadas
                    </h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                      {result.sections.map((sec) => (
                        <div
                          key={`${sec.lineNumber}-${sec.title}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            fontSize: "0.82rem",
                            paddingLeft: `${(sec.level - 1) * 1}rem`,
                            color: "var(--color-ink)",
                          }}
                        >
                          <span style={{ color: "var(--color-ink-muted)", fontSize: "0.75rem" }}>
                            L{sec.lineNumber}
                          </span>
                          <span>{sec.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA MARKDOWN ESTRUTURADO */}
            {activeTab === "markdown" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontSize: "0.82rem", color: "var(--color-ink-muted)" }}>
                    Documento estruturado com hierarquia e tabelas normalizadas
                  </span>
                  <Button
                    variant="secondary"
                    onClick={handleCopyMarkdown}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.78rem",
                    }}
                  >
                    {copiedMarkdown ? <Check size={13} /> : <Copy size={13} />}
                    {copiedMarkdown
                      ? translate("extract.copied")
                      : translate("extract.copyMarkdown")}
                  </Button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: "0.85rem",
                    borderRadius: "var(--radius-sm, 6px)",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-ink)",
                    fontSize: "0.82rem",
                    fontFamily: "ui-monospace, monospace",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: "420px",
                    overflowY: "auto",
                    lineHeight: 1.6,
                  }}
                >
                  {result.markdown || result.text}
                </pre>
              </div>
            )}

            {/* 2. ENTIDADES */}
            {activeTab === "entities" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div
                  style={{
                    display: "flex",
                    gap: "0.35rem",
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {["all", "cpf", "cnpj", "money", "date", "email", "phone", "cep"].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      style={{
                        padding: "0.2rem 0.55rem",
                        borderRadius: "12px",
                        fontSize: "0.75rem",
                        border: "1px solid var(--color-border)",
                        background:
                          categoryFilter === cat
                            ? "var(--color-brand, #2563eb)"
                            : "var(--color-surface)",
                        color: categoryFilter === cat ? "#fff" : "var(--color-ink)",
                        cursor: "pointer",
                      }}
                    >
                      {cat === "all" ? "Todos" : getCategoryLabel(cat)}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder={translate("extract.filterPlaceholder")}
                    style={{
                      marginLeft: "auto",
                      padding: "0.25rem 0.5rem",
                      borderRadius: "var(--radius-sm, 4px)",
                      border: "1px solid var(--color-border)",
                      background: "var(--color-surface)",
                      color: "var(--color-ink)",
                      fontSize: "0.78rem",
                      outline: "none",
                    }}
                  />
                </div>

                {filteredEntities.length === 0 ? (
                  <div
                    style={{
                      padding: "1.5rem",
                      textAlign: "center",
                      color: "var(--color-ink-muted)",
                      fontSize: "0.82rem",
                    }}
                  >
                    Nenhuma entidade encontrada para o filtro selecionado.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                      gap: "0.6rem",
                    }}
                  >
                    {filteredEntities.map((ent) => (
                      <div
                        key={`${ent.category}-${ent.value}-${ent.normalizedValue}`}
                        style={{
                          padding: "0.6rem 0.75rem",
                          borderRadius: "var(--radius-sm, 6px)",
                          background: "var(--color-surface)",
                          border: "1px solid var(--color-border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.2rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "0.1rem 0.35rem",
                              borderRadius: "3px",
                              background: "var(--color-surface-raised)",
                              border: "1px solid var(--color-border)",
                              color: "var(--color-brand, #2563eb)",
                            }}
                          >
                            {getCategoryLabel(ent.category)}
                          </span>

                          <span
                            style={{
                              fontSize: "0.7rem",
                              color:
                                ent.confidence === 1.0
                                  ? "var(--color-success, #16a34a)"
                                  : "var(--color-ink-muted)",
                            }}
                          >
                            {ent.confidence === 1.0
                              ? translate("extract.badge.validated")
                              : translate("extract.badge.uncertain")}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: "0.88rem",
                            fontWeight: 600,
                            wordBreak: "break-all",
                            color: "var(--color-ink)",
                          }}
                        >
                          {ent.value}
                        </div>

                        {ent.normalizedValue !== ent.value && (
                          <div style={{ fontSize: "0.72rem", color: "var(--color-ink-muted)" }}>
                            Normalizado: {ent.normalizedValue}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. CHAVE-VALOR */}
            {activeTab === "keyValues" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Pesquisar campos..."
                  style={{
                    padding: "0.3rem 0.5rem",
                    borderRadius: "var(--radius-sm, 4px)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    color: "var(--color-ink)",
                    fontSize: "0.82rem",
                    maxWidth: "280px",
                    outline: "none",
                  }}
                />

                {filteredKeyValues.length === 0 ? (
                  <div
                    style={{
                      padding: "1.5rem",
                      textAlign: "center",
                      color: "var(--color-ink-muted)",
                      fontSize: "0.82rem",
                    }}
                  >
                    Nenhum par chave-valor detectado.
                  </div>
                ) : (
                  <div
                    style={{
                      borderRadius: "var(--radius-sm, 6px)",
                      overflow: "hidden",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    <table
                      style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}
                    >
                      <thead>
                        <tr style={{ background: "var(--color-surface)", textAlign: "left" }}>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              width: "35%",
                              borderBottom: "1px solid var(--color-border)",
                              color: "var(--color-ink-muted)",
                            }}
                          >
                            Campo / Chave
                          </th>
                          <th
                            style={{
                              padding: "0.5rem 0.75rem",
                              borderBottom: "1px solid var(--color-border)",
                              color: "var(--color-ink-muted)",
                            }}
                          >
                            Valor
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredKeyValues.map(([k, v], idx) => (
                          <tr
                            key={k}
                            style={{
                              background: idx % 2 === 0 ? "transparent" : "var(--color-surface)",
                              borderBottom: "1px solid var(--color-border)",
                            }}
                          >
                            <td
                              style={{
                                padding: "0.45rem 0.75rem",
                                fontWeight: 600,
                                color: "var(--color-brand, #2563eb)",
                              }}
                            >
                              {k}
                            </td>
                            <td
                              style={{
                                padding: "0.45rem 0.75rem",
                                wordBreak: "break-word",
                                color: "var(--color-ink)",
                              }}
                            >
                              {v}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 4. TABELAS */}
            {activeTab === "tables" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                {result.tables.length === 0 ? (
                  <div
                    style={{
                      padding: "1.5rem",
                      textAlign: "center",
                      color: "var(--color-ink-muted)",
                      fontSize: "0.82rem",
                    }}
                  >
                    Nenhuma tabela detectada no documento.
                  </div>
                ) : (
                  result.tables.map((tbl) => (
                    <div
                      key={`table-${tbl.title ?? tbl.headers.join("-")}`}
                      style={{
                        borderRadius: "var(--radius-sm, 6px)",
                        overflow: "hidden",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <table
                        style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}
                      >
                        <thead>
                          <tr style={{ background: "var(--color-surface)", textAlign: "left" }}>
                            {tbl.headers.map((h) => (
                              <th
                                key={`h-${h}`}
                                style={{
                                  padding: "0.5rem 0.75rem",
                                  borderBottom: "1px solid var(--color-border)",
                                  fontWeight: 600,
                                  color: "var(--color-ink)",
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tbl.rows.map((row) => (
                            <tr
                              key={`r-${row.join("-")}`}
                              style={{
                                background: "transparent",
                                borderBottom: "1px solid var(--color-border)",
                              }}
                            >
                              {row.map((cell, cIdx) => (
                                <td
                                  key={`c-${tbl.headers[cIdx] ?? "col"}-${cell}`}
                                  style={{ padding: "0.45rem 0.75rem", color: "var(--color-ink)" }}
                                >
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 5. JSON BRUTO */}
            {activeTab === "rawJson" && (
              <pre
                style={{
                  margin: 0,
                  padding: "0.85rem",
                  borderRadius: "var(--radius-sm, 6px)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-ink)",
                  fontSize: "0.78rem",
                  fontFamily: "ui-monospace, monospace",
                  overflowX: "auto",
                  maxHeight: "400px",
                }}
              >
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
