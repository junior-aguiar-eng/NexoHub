import type { ArtifactId, DocumentId } from "@nexohub/domain";
import { type DiffLine, diffText, type TextDiffResult } from "@nexohub/domain";
import { Check, Columns2, Edit3, GitCompareArrows, Link2, Rows } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";

type TextComparePanelProps = {
  initialOriginal?: string;
  initialModified?: string;
  documentCore?: DocumentCorePort;
  projectPath?: string;
  documentId?: DocumentId;
  artifactId?: ArtifactId;
  onAnchorCreated?: () => void;
};

export function TextComparePanel({
  initialOriginal = "",
  initialModified = "",
  documentCore,
  projectPath,
  documentId,
  artifactId,
  onAnchorCreated,
}: TextComparePanelProps) {
  const [original, setOriginal] = useState(initialOriginal);
  const [modified, setModified] = useState(initialModified);
  const [diffResult, setDiffResult] = useState<TextDiffResult | null>(null);
  const [viewMode, setViewMode] = useState<"side-by-side" | "unified">("side-by-side");
  const [anchoredLines, setAnchoredLines] = useState<Record<number, boolean>>({});
  const [isEditing, setIsEditing] = useState(true);

  function handleCompare() {
    const result = diffText(original, modified);
    setDiffResult(result);
    setIsEditing(false);
  }

  async function handleCreateAnchor(line: DiffLine, index: number) {
    if (!documentCore || !projectPath || !documentId || !artifactId) return;
    try {
      await documentCore.invoke("create_anchor", {
        projectPath,
        artifactId,
        selector: {
          type: "TEXT_RANGE",
          start: line.originalLineNumber ?? line.modifiedLineNumber ?? index,
          end: (line.originalLineNumber ?? line.modifiedLineNumber ?? index) + 1,
        },
        quote: line.content,
      });
      setAnchoredLines((prev) => ({ ...prev, [index]: true }));
      onAnchorCreated?.();
    } catch {
      // Grafo de âncoras local
    }
  }

  return (
    <section className="text-editor text-compare-panel" aria-labelledby="compare-title">
      <div className="text-editor__toolbar">
        <div>
          <p className="eyebrow">{translate("compare.eyebrow")}</p>
          <h2 id="compare-title">{translate("compare.title")}</h2>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {diffResult && !isEditing && (
            <div className="text-compare-view-toggle">
              <Button
                variant={viewMode === "side-by-side" ? "secondary" : "ghost"}
                size="compact"
                onClick={() => setViewMode("side-by-side")}
                title={translate("compare.viewSideBySide")}
              >
                <Columns2 size={14} aria-hidden="true" />
              </Button>
              <Button
                variant={viewMode === "unified" ? "secondary" : "ghost"}
                size="compact"
                onClick={() => setViewMode("unified")}
                title={translate("compare.viewUnified")}
              >
                <Rows size={14} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => setIsEditing(true)}
                title="Editar textos"
              >
                <Edit3 size={14} aria-hidden="true" />
              </Button>
            </div>
          )}
          <Button variant="secondary" onClick={handleCompare}>
            <GitCompareArrows size={16} aria-hidden="true" />
            {translate("compare.run")}
          </Button>
        </div>
      </div>

      {isEditing || !diffResult ? (
        <div className="text-compare-inputs">
          <div className="text-compare-input-group">
            <label htmlFor="compare-original-input">
              <span>{translate("compare.original")}</span>
              <textarea
                id="compare-original-input"
                value={original}
                onChange={(e) => setOriginal(e.target.value)}
                placeholder={translate("compare.placeholderOriginal")}
              />
            </label>
          </div>
          <div className="text-compare-input-group">
            <label htmlFor="compare-modified-input">
              <span>{translate("compare.modified")}</span>
              <textarea
                id="compare-modified-input"
                value={modified}
                onChange={(e) => setModified(e.target.value)}
                placeholder={translate("compare.placeholderModified")}
              />
            </label>
          </div>
        </div>
      ) : (
        <div className="text-compare-results">
          <div className="text-compare-stats">
            <span className="diff-stat diff-stat--added">
              +{diffResult.stats.additions} {translate("compare.additions")}
            </span>
            <span className="diff-stat diff-stat--removed">
              -{diffResult.stats.deletions} {translate("compare.deletions")}
            </span>
            {diffResult.stats.additions === 0 && diffResult.stats.deletions === 0 && (
              <span className="diff-stat diff-stat--identical">
                {translate("compare.noChanges")}
              </span>
            )}
          </div>

          {viewMode === "unified" ? (
            <div className="diff-unified-view">
              <table className="diff-table">
                <tbody>
                  {diffResult.lines.map((line) => (
                    <tr key={line.id} className={`diff-row diff-row--${line.type}`}>
                      <td className="diff-cell-gutter">
                        {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                      </td>
                      <td className="diff-cell-num diff-cell-num--orig">
                        {line.originalLineNumber ?? ""}
                      </td>
                      <td className="diff-cell-num diff-cell-num--mod">
                        {line.modifiedLineNumber ?? ""}
                      </td>
                      <td className="diff-cell-content">
                        <code>{line.content || " "}</code>
                      </td>
                      {line.type !== "unchanged" && documentCore && artifactId && (
                        <td className="diff-cell-action">
                          <Button
                            variant="ghost"
                            size="compact"
                            onClick={() =>
                              handleCreateAnchor(
                                line,
                                line.originalLineNumber ?? line.modifiedLineNumber ?? 0,
                              )
                            }
                            title={translate("compare.createAnchor")}
                            disabled={
                              anchoredLines[line.originalLineNumber ?? line.modifiedLineNumber ?? 0]
                            }
                          >
                            {anchoredLines[
                              line.originalLineNumber ?? line.modifiedLineNumber ?? 0
                            ] ? (
                              <Check size={12} color="var(--color-success, #22c55e)" />
                            ) : (
                              <Link2 size={12} />
                            )}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="diff-side-by-side-view">
              <div className="diff-split-container">
                <div className="diff-split-pane diff-split-pane--orig">
                  <div className="diff-pane-header">{translate("compare.original")}</div>
                  <table className="diff-table">
                    <tbody>
                      {diffResult.lines.map((line) => {
                        if (line.type === "added") {
                          return (
                            <tr key={`empty-orig-${line.id}`} className="diff-row diff-row--empty">
                              <td className="diff-cell-num" />
                              <td className="diff-cell-content">&nbsp;</td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={`orig-${line.id}`} className={`diff-row diff-row--${line.type}`}>
                            <td className="diff-cell-num">{line.originalLineNumber ?? ""}</td>
                            <td className="diff-cell-content">
                              <code>{line.content || " "}</code>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="diff-split-pane diff-split-pane--mod">
                  <div className="diff-pane-header">{translate("compare.modified")}</div>
                  <table className="diff-table">
                    <tbody>
                      {diffResult.lines.map((line) => {
                        if (line.type === "removed") {
                          return (
                            <tr key={`empty-mod-${line.id}`} className="diff-row diff-row--empty">
                              <td className="diff-cell-num" />
                              <td className="diff-cell-content">&nbsp;</td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={`mod-${line.id}`} className={`diff-row diff-row--${line.type}`}>
                            <td className="diff-cell-num">{line.modifiedLineNumber ?? ""}</td>
                            <td className="diff-cell-content">
                              <code>{line.content || " "}</code>
                            </td>
                            {line.type === "added" && documentCore && artifactId && (
                              <td className="diff-cell-action">
                                <Button
                                  variant="ghost"
                                  size="compact"
                                  onClick={() =>
                                    handleCreateAnchor(line, line.modifiedLineNumber ?? 0)
                                  }
                                  title={translate("compare.createAnchor")}
                                  disabled={anchoredLines[line.modifiedLineNumber ?? 0]}
                                >
                                  {anchoredLines[line.modifiedLineNumber ?? 0] ? (
                                    <Check size={12} color="var(--color-success, #22c55e)" />
                                  ) : (
                                    <Link2 size={12} />
                                  )}
                                </Button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <footer>
        <span>
          {original.split(/\r?\n/).length} linhas (original) · {modified.split(/\r?\n/).length}{" "}
          linhas (modificado)
        </span>
        {documentCore && artifactId && <span>Âncoras habilitadas para referências estáveis</span>}
      </footer>
    </section>
  );
}
