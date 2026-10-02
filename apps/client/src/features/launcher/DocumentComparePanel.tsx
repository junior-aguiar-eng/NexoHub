import { type DiffLine, type DiffWord, diffText, type TextDiffResult } from "@nexohub/domain";
import {
  ArrowLeftRight,
  Columns,
  Download,
  Eye,
  FileDiff,
  FileText,
  Loader2,
  PenLine,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { type DragEvent, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { readDocumentText } from "@/platform/document-reader";

type DocumentComparePanelProps = {
  doc1Text: string;
  doc1Name?: string;
  onDoc1TextChange?: (val: string) => void;
  onDoc1NameChange?: (name: string) => void;
  doc2Text: string;
  doc2Name?: string;
  onDoc2TextChange?: (val: string) => void;
  onDoc2NameChange?: (name: string) => void;
  doc3Text?: string;
  doc3Name?: string;
  onDoc3TextChange?: (val: string) => void;
  onDoc3NameChange?: (name: string) => void;
  showDoc3?: boolean;
  onToggleDoc3?: (show: boolean) => void;
  onDropFiles?: (files: File[]) => void;
  onExportDiff?: () => void;
};

type AlignedDiffRow = {
  readonly id: string;
  readonly left?: DiffLine;
  readonly right?: DiffLine;
};

function alignDiffLines(lines: readonly DiffLine[]): AlignedDiffRow[] {
  const rows: AlignedDiffRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line) break;

    if (line.type === "unchanged") {
      rows.push({
        id: line.id,
        left: line,
        right: line,
      });
      i += 1;
      continue;
    }

    const changeBlock: DiffLine[] = [];
    while (i < lines.length && lines[i]?.type !== "unchanged") {
      const l = lines[i];
      if (l) changeBlock.push(l);
      i += 1;
    }

    const removedBlock = changeBlock.filter((l) => l.type === "removed");
    const addedBlock = changeBlock.filter((l) => l.type === "added");

    const count = Math.max(removedBlock.length, addedBlock.length);
    for (let k = 0; k < count; k++) {
      const left = removedBlock[k];
      const right = addedBlock[k];
      rows.push({
        id: `row-${left?.id || "void"}-${right?.id || "void"}-${k}`,
        left,
        right,
      });
    }
  }

  return rows;
}

export function DocumentComparePanel({
  doc1Text,
  doc1Name = "Documento 1 (Original)",
  onDoc1TextChange,
  onDoc1NameChange,
  doc2Text,
  doc2Name = "Documento 2 (Alterado)",
  onDoc2TextChange,
  onDoc2NameChange,
  doc3Text = "",
  doc3Name = "Documento 3 (Versão B)",
  onDoc3TextChange,
  onDoc3NameChange,
  showDoc3 = false,
  onToggleDoc3,
  onExportDiff,
}: DocumentComparePanelProps) {
  const [viewMode, setViewMode] = useState<"side-by-side" | "unified">("side-by-side");
  const [displayStyle, setDisplayStyle] = useState<"diff" | "edit">(() =>
    doc1Text.trim() && doc2Text.trim() ? "diff" : "edit",
  );
  const [activeDiffPair, setActiveDiffPair] = useState<"1-2" | "1-3">("1-2");

  const [isExtractingDoc1, setIsExtractingDoc1] = useState(false);
  const [isExtractingDoc2, setIsExtractingDoc2] = useState(false);
  const [isExtractingDoc3, setIsExtractingDoc3] = useState(false);

  const [dragOverDoc1, setDragOverDoc1] = useState(false);
  const [dragOverDoc2, setDragOverDoc2] = useState(false);
  const [dragOverDoc3, setDragOverDoc3] = useState(false);

  const doc1Id = useId();
  const doc2Id = useId();
  const doc3Id = useId();

  const fileInputRef1 = useRef<HTMLInputElement | null>(null);
  const fileInputRef2 = useRef<HTMLInputElement | null>(null);
  const fileInputRef3 = useRef<HTMLInputElement | null>(null);

  // Calcula o diff real usando a biblioteca de domínio (Doc 1 vs Doc 2)
  const diffResult1to2: TextDiffResult = useMemo(() => {
    try {
      return diffText(doc1Text || "", doc2Text || "");
    } catch {
      return {
        lines: [],
        stats: {
          additions: 0,
          deletions: 0,
          unchanged: 0,
          wordsAdded: 0,
          wordsDeleted: 0,
          similarityScore: 0,
        },
      };
    }
  }, [doc1Text, doc2Text]);

  // Calcula o diff real usando a biblioteca de domínio (Doc 1 vs Doc 3)
  const diffResult1to3: TextDiffResult = useMemo(() => {
    if (!showDoc3 || !doc3Text) {
      return {
        lines: [],
        stats: {
          additions: 0,
          deletions: 0,
          unchanged: 0,
          wordsAdded: 0,
          wordsDeleted: 0,
          similarityScore: 0,
        },
      };
    }
    try {
      return diffText(doc1Text || "", doc3Text || "");
    } catch {
      return {
        lines: [],
        stats: {
          additions: 0,
          deletions: 0,
          unchanged: 0,
          wordsAdded: 0,
          wordsDeleted: 0,
          similarityScore: 0,
        },
      };
    }
  }, [doc1Text, doc3Text, showDoc3]);

  const activeDiff = showDoc3 && activeDiffPair === "1-3" ? diffResult1to3 : diffResult1to2;

  const alignedRows1to2 = useMemo(() => {
    return alignDiffLines(diffResult1to2.lines);
  }, [diffResult1to2.lines]);

  const alignedRows1to3 = useMemo(() => {
    return alignDiffLines(diffResult1to3.lines);
  }, [diffResult1to3.lines]);

  const activeAlignedRows =
    showDoc3 && activeDiffPair === "1-3" ? alignedRows1to3 : alignedRows1to2;
  const activeRightName = showDoc3 && activeDiffPair === "1-3" ? doc3Name : doc2Name;
  const activeRightInputRef = showDoc3 && activeDiffPair === "1-3" ? fileInputRef3 : fileInputRef2;

  const hasAnyText = Boolean(doc1Text.trim() || doc2Text.trim() || doc3Text.trim());

  async function handleFileSelected(file: File, docIndex: 1 | 2 | 3) {
    if (docIndex === 1) setIsExtractingDoc1(true);
    if (docIndex === 2) setIsExtractingDoc2(true);
    if (docIndex === 3) setIsExtractingDoc3(true);

    try {
      const text = await readDocumentText(file);
      if (docIndex === 1) {
        onDoc1TextChange?.(text);
        onDoc1NameChange?.(file.name);
      } else if (docIndex === 2) {
        onDoc2TextChange?.(text);
        onDoc2NameChange?.(file.name);
      } else if (docIndex === 3) {
        onDoc3TextChange?.(text);
        onDoc3NameChange?.(file.name);
      }
      setDisplayStyle("diff");
    } catch (err) {
      console.error("Erro ao carregar arquivo no comparador:", err);
    } finally {
      if (docIndex === 1) setIsExtractingDoc1(false);
      if (docIndex === 2) setIsExtractingDoc2(false);
      if (docIndex === 3) setIsExtractingDoc3(false);
    }
  }

  function handleDropDoc(e: DragEvent<HTMLElement>, docIndex: 1 | 2 | 3) {
    e.preventDefault();
    e.stopPropagation();
    if (docIndex === 1) setDragOverDoc1(false);
    if (docIndex === 2) setDragOverDoc2(false);
    if (docIndex === 3) setDragOverDoc3(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file) {
        void handleFileSelected(file, docIndex);
      }
    }
  }

  function renderWords(words?: readonly DiffWord[], fallbackContent?: string) {
    if (!words || words.length === 0) {
      return fallbackContent || "\u00A0";
    }
    return words.map((w) => {
      if (w.type === "added") {
        return (
          <mark key={w.id} className="doc-word--added">
            {w.text}
          </mark>
        );
      }
      if (w.type === "removed") {
        return (
          <mark key={w.id} className="doc-word--deleted">
            {w.text}
          </mark>
        );
      }
      return <span key={w.id}>{w.text}</span>;
    });
  }

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
          {/* Alternar Visualizar Diferenças vs Editar */}
          <Button
            variant={displayStyle === "diff" ? "primary" : "ghost"}
            size="compact"
            onClick={() => setDisplayStyle("diff")}
            title="Visualizar diferenças com destaque de palavras e linhas"
          >
            <Eye size={14} />
            <span>{translate("workspace.compare.viewDiff")}</span>
          </Button>

          <Button
            variant={displayStyle === "edit" ? "primary" : "ghost"}
            size="compact"
            onClick={() => setDisplayStyle("edit")}
            title="Editar ou colar textos diretamente"
          >
            <PenLine size={14} />
            <span>{translate("workspace.compare.editContent")}</span>
          </Button>

          <div
            style={{
              width: "1px",
              height: "16px",
              background: "var(--color-border)",
              margin: "0 4px",
            }}
          />

          <Button
            variant={viewMode === "side-by-side" ? "secondary" : "ghost"}
            size="compact"
            onClick={() => setViewMode("side-by-side")}
            title="Visualização lado a lado em colunas alinhadas"
          >
            <Columns size={14} />
            <span>{translate("compare.viewSideBySide")}</span>
          </Button>

          <Button
            variant={viewMode === "unified" ? "secondary" : "ghost"}
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

          {showDoc3 && (
            <div style={{ display: "inline-flex", gap: "4px" }}>
              <Button
                variant={activeDiffPair === "1-2" ? "primary" : "ghost"}
                size="compact"
                onClick={() => setActiveDiffPair("1-2")}
                title="Comparar Documento 1 com Documento 2"
              >
                <span>Doc 1 × 2</span>
              </Button>
              <Button
                variant={activeDiffPair === "1-3" ? "primary" : "ghost"}
                size="compact"
                onClick={() => setActiveDiffPair("1-3")}
                title="Comparar Documento 1 com Documento 3"
              >
                <span>Doc 1 × 3</span>
              </Button>
            </div>
          )}

          <Button
            variant="secondary"
            size="compact"
            onClick={onExportDiff}
            disabled={!onExportDiff || !doc1Text.trim() || !doc2Text.trim()}
            title="Exportar relatório de diferenças completo"
          >
            <Download size={14} />
            <span>Exportar .diff</span>
          </Button>
        </div>
      </div>

      {/* Estatísticas do Diff e Similaridade */}
      {hasAnyText && (
        <div className="doc-compare-stats-bar">
          <div className="doc-compare-stat-item doc-compare-stat-item--added">
            <span className="doc-compare-stat-pill">+{activeDiff.stats.additions}</span>
            <span>
              {translate("workspace.compare.additions")}
              {activeDiff.stats.wordsAdded > 0 &&
                ` (+${activeDiff.stats.wordsAdded} ${translate("workspace.compare.wordsAdded").toLowerCase()})`}
            </span>
          </div>

          <div className="doc-compare-stat-item doc-compare-stat-item--removed">
            <span className="doc-compare-stat-pill">-{activeDiff.stats.deletions}</span>
            <span>
              {translate("workspace.compare.deletions")}
              {activeDiff.stats.wordsDeleted > 0 &&
                ` (-${activeDiff.stats.wordsDeleted} ${translate("workspace.compare.wordsDeleted").toLowerCase()})`}
            </span>
          </div>

          <div className="doc-compare-stat-item doc-compare-stat-item--unchanged">
            <span className="doc-compare-stat-pill">{activeDiff.stats.unchanged}</span>
            <span>{translate("workspace.compare.unchanged")}</span>
          </div>

          {activeDiff.stats.additions === 0 &&
          activeDiff.stats.deletions === 0 &&
          doc1Text.trim() !== "" ? (
            <span className="doc-compare-identical-badge">
              {translate("workspace.compare.identical")}
            </span>
          ) : (
            <span
              className={`doc-compare-similarity-badge doc-compare-similarity-badge--${
                activeDiff.stats.similarityScore >= 80
                  ? "high"
                  : activeDiff.stats.similarityScore >= 50
                    ? "medium"
                    : "low"
              }`}
            >
              {activeDiff.stats.similarityScore}% {translate("workspace.compare.similarity")}
            </span>
          )}
        </div>
      )}

      {/* Inputs de arquivo ocultos para cada documento */}
      <input
        ref={fileInputRef1}
        type="file"
        accept=".pdf,.txt,.md,.json,.csv,.rtf,.html"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFileSelected(f, 1);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInputRef2}
        type="file"
        accept=".pdf,.txt,.md,.json,.csv,.rtf,.html"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFileSelected(f, 2);
          e.target.value = "";
        }}
      />
      {showDoc3 && (
        <input
          ref={fileInputRef3}
          type="file"
          accept=".pdf,.txt,.md,.json,.csv,.rtf,.html"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFileSelected(f, 3);
            e.target.value = "";
          }}
        />
      )}

      {/* Modo Lado a Lado (Colunas) */}
      {viewMode === "side-by-side" ? (
        displayStyle === "edit" ? (
          /* Modo Edição direta / Colar */
          <div
            className={`doc-compare-columns ${
              showDoc3 ? "doc-compare-columns--three" : "doc-compare-columns--two"
            }`}
          >
            {/* Coluna 1: Documento Original */}
            <section
              aria-label={doc1Name}
              className={`doc-compare-column ${dragOverDoc1 ? "doc-compare-column--dragover" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDoc1(true);
              }}
              onDragLeave={() => setDragOverDoc1(false)}
              onDrop={(e) => handleDropDoc(e, 1)}
            >
              <div className="doc-compare-col-header">
                <FileText size={15} />
                <span className="doc-compare-col-title" title={doc1Name}>
                  {doc1Name}
                </span>
                <div className="doc-compare-col-actions">
                  <button
                    type="button"
                    className="doc-compare-upload-btn"
                    onClick={() => fileInputRef1.current?.click()}
                    title="Carregar arquivo PDF ou texto"
                  >
                    {isExtractingDoc1 ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    <span>
                      {isExtractingDoc1
                        ? translate("workspace.compare.extracting")
                        : translate("workspace.compare.loadFile")}
                    </span>
                  </button>
                  {doc1Text && (
                    <button
                      type="button"
                      className="doc-compare-upload-btn"
                      onClick={() => onDoc1TextChange?.("")}
                      title="Limpar texto"
                    >
                      {translate("workspace.compare.clear")}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id={doc1Id}
                aria-label={doc1Name}
                className="doc-compare-textarea"
                value={doc1Text}
                onChange={(e) => onDoc1TextChange?.(e.target.value)}
                placeholder="Cole ou digite o texto do Documento 1 (Original)..."
                rows={16}
              />
            </section>

            {/* Coluna 2: Documento Alterado */}
            <section
              aria-label={doc2Name}
              className={`doc-compare-column ${dragOverDoc2 ? "doc-compare-column--dragover" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDoc2(true);
              }}
              onDragLeave={() => setDragOverDoc2(false)}
              onDrop={(e) => handleDropDoc(e, 2)}
            >
              <div className="doc-compare-col-header">
                <FileText size={15} />
                <span className="doc-compare-col-title" title={doc2Name}>
                  {doc2Name}
                </span>
                <div className="doc-compare-col-actions">
                  <button
                    type="button"
                    className="doc-compare-upload-btn"
                    onClick={() => fileInputRef2.current?.click()}
                    title="Carregar arquivo PDF ou texto"
                  >
                    {isExtractingDoc2 ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    <span>
                      {isExtractingDoc2
                        ? translate("workspace.compare.extracting")
                        : translate("workspace.compare.loadFile")}
                    </span>
                  </button>
                  {doc2Text && (
                    <button
                      type="button"
                      className="doc-compare-upload-btn"
                      onClick={() => onDoc2TextChange?.("")}
                      title="Limpar texto"
                    >
                      {translate("workspace.compare.clear")}
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id={doc2Id}
                aria-label={doc2Name}
                className="doc-compare-textarea"
                value={doc2Text}
                onChange={(e) => onDoc2TextChange?.(e.target.value)}
                placeholder="Cole ou digite o texto do Documento 2 (Alterado)..."
                rows={16}
              />
            </section>

            {/* Coluna 3: Documento 3 Opcional */}
            {showDoc3 && (
              <section
                aria-label={doc3Name}
                className={`doc-compare-column ${dragOverDoc3 ? "doc-compare-column--dragover" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverDoc3(true);
                }}
                onDragLeave={() => setDragOverDoc3(false)}
                onDrop={(e) => handleDropDoc(e, 3)}
              >
                <div className="doc-compare-col-header">
                  <FileText size={15} />
                  <span className="doc-compare-col-title" title={doc3Name}>
                    {doc3Name}
                  </span>
                  <div className="doc-compare-col-actions">
                    <button
                      type="button"
                      className="doc-compare-upload-btn"
                      onClick={() => fileInputRef3.current?.click()}
                      title="Carregar arquivo PDF ou texto"
                    >
                      {isExtractingDoc3 ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Upload size={13} />
                      )}
                      <span>
                        {isExtractingDoc3
                          ? translate("workspace.compare.extracting")
                          : translate("workspace.compare.loadFile")}
                      </span>
                    </button>
                    {doc3Text && (
                      <button
                        type="button"
                        className="doc-compare-upload-btn"
                        onClick={() => onDoc3TextChange?.("")}
                        title="Limpar texto"
                      >
                        {translate("workspace.compare.clear")}
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  id={doc3Id}
                  aria-label={doc3Name}
                  className="doc-compare-textarea"
                  value={doc3Text}
                  onChange={(e) => onDoc3TextChange?.(e.target.value)}
                  placeholder="Cole ou digite o texto do Documento 3 (Versão B)..."
                  rows={16}
                />
              </section>
            )}
          </div>
        ) : (
          /* Modo Visualização de Diferenças Lado a Lado Alinhada */
          <div className="doc-compare-side-diff-board">
            <div className="doc-compare-side-diff-header">
              <div className="doc-compare-side-diff-header-col">
                <span className="doc-compare-col-title" title={doc1Name}>
                  {doc1Name}
                </span>
                <button
                  type="button"
                  className="doc-compare-upload-btn"
                  onClick={() => fileInputRef1.current?.click()}
                  title="Trocar arquivo"
                >
                  <Upload size={12} />
                  <span>{translate("workspace.compare.loadFile")}</span>
                </button>
              </div>
              <div className="doc-compare-side-diff-header-col">
                <span className="doc-compare-col-title" title={activeRightName}>
                  {activeRightName}
                </span>
                <button
                  type="button"
                  className="doc-compare-upload-btn"
                  onClick={() => activeRightInputRef.current?.click()}
                  title="Trocar arquivo"
                >
                  <Upload size={12} />
                  <span>{translate("workspace.compare.loadFile")}</span>
                </button>
              </div>
            </div>

            <div className="doc-compare-side-diff-rows-container">
              {activeAlignedRows.length === 0 ? (
                <div className="doc-compare-empty-lines">
                  Carregue os dois documentos para visualizar o quadro comparativo alinhado.
                </div>
              ) : (
                activeAlignedRows.map((row) => (
                  <div key={row.id} className="doc-compare-side-diff-row">
                    {/* Célula Esquerda (Original) */}
                    <div
                      className={`doc-compare-side-diff-cell doc-compare-side-diff-cell--left ${
                        !row.left
                          ? "doc-compare-side-diff-cell--empty"
                          : row.left.type === "removed"
                            ? "doc-compare-side-diff-cell--removed"
                            : ""
                      }`}
                    >
                      <span className="doc-compare-diff-num">
                        {row.left?.originalLineNumber || " "}
                      </span>
                      <span className="doc-compare-diff-content">
                        {row.left ? renderWords(row.left.words, row.left.content) : "\u00A0"}
                      </span>
                    </div>

                    {/* Célula Direita (Modificado) */}
                    <div
                      className={`doc-compare-side-diff-cell doc-compare-side-diff-cell--right ${
                        !row.right
                          ? "doc-compare-side-diff-cell--empty"
                          : row.right.type === "added"
                            ? "doc-compare-side-diff-cell--added"
                            : ""
                      }`}
                    >
                      <span className="doc-compare-diff-num">
                        {row.right?.modifiedLineNumber || " "}
                      </span>
                      <span className="doc-compare-diff-content">
                        {row.right ? renderWords(row.right.words, row.right.content) : "\u00A0"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      ) : (
        /* Visualização Unificada de Linhas Coloridas com Realce de Palavras */
        <div className="doc-compare-unified-board">
          <div className="doc-compare-lines-list">
            {activeDiff.lines.length === 0 ? (
              <div className="doc-compare-empty-lines">
                Digite ou carregue os textos para ver o comparativo linha por linha.
              </div>
            ) : (
              activeDiff.lines.map((line) => (
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
                  <span className="doc-compare-diff-content">
                    {renderWords(line.words, line.content)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
