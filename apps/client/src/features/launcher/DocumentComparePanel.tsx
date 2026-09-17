import { diffText, type TextDiffResult } from "@nexohub/domain";
import { ArrowLeftRight, Columns, Download, FileDiff, FileText, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type DocumentComparePanelProps = {
  doc1Text: string;
  doc1Name?: string;
  onDoc1TextChange?: (val: string) => void;
  doc2Text: string;
  doc2Name?: string;
  onDoc2TextChange?: (val: string) => void;
  doc3Text?: string;
  doc3Name?: string;
  onDoc3TextChange?: (val: string) => void;
  showDoc3?: boolean;
  onToggleDoc3?: (show: boolean) => void;
  onDropFiles?: (files: File[]) => void;
};

export function DocumentComparePanel({
  doc1Text,
  doc1Name = "Documento 1 (Original)",
  onDoc1TextChange,
  doc2Text,
  doc2Name = "Documento 2 (Alterado)",
  onDoc2TextChange,
  doc3Text = "",
  doc3Name = "Documento 3 (Versão B)",
  onDoc3TextChange,
  showDoc3 = false,
  onToggleDoc3,
}: DocumentComparePanelProps) {
  const [viewMode, setViewMode] = useState<"side-by-side" | "unified">("side-by-side");
  const doc1Id = useId();
  const doc2Id = useId();
  const doc3Id = useId();

  // Calcula o diff real usando a biblioteca de domínio
  const diffResult1to2: TextDiffResult = useMemo(() => {
    try {
      return diffText(doc1Text || "", doc2Text || "");
    } catch {
      return {
        lines: [],
        stats: { additions: 0, deletions: 0, unchanged: 0 },
      };
    }
  }, [doc1Text, doc2Text]);

  const _diffResult1to3: TextDiffResult = useMemo(() => {
    if (!showDoc3 || !doc3Text) {
      return { lines: [], stats: { additions: 0, deletions: 0, unchanged: 0 } };
    }
    try {
      return diffText(doc1Text || "", doc3Text || "");
    } catch {
      return {
        lines: [],
        stats: { additions: 0, deletions: 0, unchanged: 0 },
      };
    }
  }, [doc1Text, doc3Text, showDoc3]);

  function handleExportDiff() {
    const summary1 = `RELATÓRIO DE COMPARAÇÃO DE DOCUMENTOS\n=====================================\nOriginal: ${doc1Name}\nAlterado: ${doc2Name}\n\nEstatísticas:\n- Adições: +${diffResult1to2.stats.additions}\n- Remoções: -${diffResult1to2.stats.deletions}\n- Inalteradas: ${diffResult1to2.stats.unchanged}\n\nLINHAS DE DIFERENÇA:\n${diffResult1to2.lines.map((l) => `${l.type === "added" ? "[+]" : l.type === "removed" ? "[-]" : "   "} ${l.content}`).join("\n")}`;

    const blob = new Blob([summary1], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comparacao_${doc1Name.replace(/\.[^/.]+$/, "")}_vs_${doc2Name.replace(/\.[^/.]+$/, "")}.diff.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const hasAnyText = Boolean(doc1Text.trim() || doc2Text.trim());

  return (
    <div className="document-compare-panel">
      {/* Header com Modos de Exibição e Estatísticas */}
      <div className="doc-compare-header">
        <div className="doc-compare-title-group">
          <FileDiff size={18} style={{ color: "var(--color-brand)" }} />
          <div>
            <h3 className="doc-compare-title">{translate("workspace.compare.title")}</h3>
            <p className="doc-compare-hint">{translate("workspace.compare.hint")}</p>
          </div>
        </div>

        <div className="doc-compare-controls">
          <Button
            variant={viewMode === "side-by-side" ? "primary" : "ghost"}
            size="compact"
            onClick={() => setViewMode("side-by-side")}
            title="Visualização lado a lado em colunas"
          >
            <Columns size={14} />
            <span>{translate("compare.viewSideBySide")}</span>
          </Button>

          <Button
            variant={viewMode === "unified" ? "primary" : "ghost"}
            size="compact"
            onClick={() => setViewMode("unified")}
            title="Visualização unificada de linhas"
          >
            <ArrowLeftRight size={14} />
            <span>{translate("compare.viewUnified")}</span>
          </Button>

          {!showDoc3 ? (
            <Button
              variant="secondary"
              size="compact"
              onClick={() => onToggleDoc3?.(true)}
              title="Comparar com um 3º arquivo ou versão"
            >
              <Plus size={14} />
              <span>{translate("workspace.compare.addDocument")}</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="compact"
              onClick={() => onToggleDoc3?.(false)}
              title="Remover 3º documento"
            >
              <Trash2 size={14} />
              <span>Remover 3º Doc</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="compact"
            onClick={handleExportDiff}
            disabled={!hasAnyText}
            title="Exportar relatório de diferenças"
          >
            <Download size={14} />
            <span>Exportar .diff</span>
          </Button>
        </div>
      </div>

      {/* Estatísticas do Diff */}
      {hasAnyText && (
        <div className="doc-compare-stats-bar">
          <div className="doc-compare-stat-item doc-compare-stat-item--added">
            <span className="doc-compare-stat-pill">+{diffResult1to2.stats.additions}</span>
            <span>{translate("workspace.compare.additions")}</span>
          </div>

          <div className="doc-compare-stat-item doc-compare-stat-item--removed">
            <span className="doc-compare-stat-pill">-{diffResult1to2.stats.deletions}</span>
            <span>{translate("workspace.compare.deletions")}</span>
          </div>

          <div className="doc-compare-stat-item doc-compare-stat-item--unchanged">
            <span className="doc-compare-stat-pill">{diffResult1to2.stats.unchanged}</span>
            <span>Inalteradas</span>
          </div>

          {diffResult1to2.stats.additions === 0 &&
            diffResult1to2.stats.deletions === 0 &&
            doc1Text.trim() !== "" && (
              <span className="doc-compare-identical-badge">
                ✓ Documentos idênticos (100% iguais)
              </span>
            )}
        </div>
      )}

      {/* Exibição Lado a Lado ou Unificada */}
      {viewMode === "side-by-side" ? (
        <div
          className={`doc-compare-columns ${
            showDoc3 ? "doc-compare-columns--three" : "doc-compare-columns--two"
          }`}
        >
          {/* Coluna 1: Documento Original */}
          <div className="doc-compare-column">
            <div className="doc-compare-col-header">
              <FileText size={15} />
              <span className="doc-compare-col-title" title={doc1Name}>
                {doc1Name}
              </span>
            </div>
            <textarea
              id={doc1Id}
              aria-label={doc1Name}
              className="doc-compare-textarea"
              value={doc1Text}
              onChange={(e) => onDoc1TextChange?.(e.target.value)}
              placeholder="Cole ou digite o texto do Documento 1 (Original)..."
              rows={14}
            />
          </div>

          {/* Coluna 2: Documento Alterado */}
          <div className="doc-compare-column">
            <div className="doc-compare-col-header">
              <FileText size={15} />
              <span className="doc-compare-col-title" title={doc2Name}>
                {doc2Name}
              </span>
            </div>
            <textarea
              id={doc2Id}
              aria-label={doc2Name}
              className="doc-compare-textarea"
              value={doc2Text}
              onChange={(e) => onDoc2TextChange?.(e.target.value)}
              placeholder="Cole ou digite o texto do Documento 2 (Alterado)..."
              rows={14}
            />
          </div>

          {/* Coluna 3: Documento 3 Opcional */}
          {showDoc3 && (
            <div className="doc-compare-column">
              <div className="doc-compare-col-header">
                <FileText size={15} />
                <span className="doc-compare-col-title" title={doc3Name}>
                  {doc3Name}
                </span>
              </div>
              <textarea
                id={doc3Id}
                aria-label={doc3Name}
                className="doc-compare-textarea"
                value={doc3Text}
                onChange={(e) => onDoc3TextChange?.(e.target.value)}
                placeholder="Cole ou digite o texto do Documento 3 (Versão B)..."
                rows={14}
              />
            </div>
          )}
        </div>
      ) : (
        /* Visualização Unificada de Linhas Coloridas */
        <div className="doc-compare-unified-board">
          <div className="doc-compare-lines-list">
            {diffResult1to2.lines.length === 0 ? (
              <div className="doc-compare-empty-lines">
                Digite ou carregue os textos para ver o comparativo linha por linha.
              </div>
            ) : (
              diffResult1to2.lines.map((line) => (
                <div
                  key={line.id}
                  className={`doc-compare-diff-line doc-compare-diff-line--${line.type}`}
                >
                  <span className="doc-compare-diff-marker">
                    {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                  </span>
                  <span className="doc-compare-diff-num">
                    {line.type === "removed"
                      ? line.originalLineNumber
                      : line.modifiedLineNumber || " "}
                  </span>
                  <span className="doc-compare-diff-content">{line.content || "\u00A0"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
