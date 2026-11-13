import { Check, FileImage } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { translate } from "@/i18n";
import { PdfViewport } from "./PdfViewport";
import { parsePageRange } from "./page-range-input";

export type PdfToJpgDpi = 72 | 150 | 300;
export type PdfToJpgPageMode = "all" | "range";

export type PdfToJpgPanelProps = {
  fileName: string;
  fileSizeBytes: number;
  totalPages: number;
  thumbnailUrl?: string;
  pageThumbnails?: readonly string[];
  onPreviewPageChange?: (page: number) => void;
  dpi?: PdfToJpgDpi;
  onDpiChange?: (dpi: PdfToJpgDpi) => void;
  pageMode?: PdfToJpgPageMode;
  onPageModeChange?: (mode: PdfToJpgPageMode) => void;
  pageRangeText?: string;
  onPageRangeTextChange?: (value: string) => void;
  onRangeValidityChange?: (valid: boolean) => void;
};

const DPI_OPTIONS: ReadonlyArray<{
  readonly value: PdfToJpgDpi;
  readonly labelKey:
    | "workspace.pdfToJpg.resolutionWeb"
    | "workspace.pdfToJpg.resolutionHigh"
    | "workspace.pdfToJpg.resolutionPrint";
}> = [
  { value: 72, labelKey: "workspace.pdfToJpg.resolutionWeb" },
  { value: 150, labelKey: "workspace.pdfToJpg.resolutionHigh" },
  { value: 300, labelKey: "workspace.pdfToJpg.resolutionPrint" },
];

export function PdfToJpgPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  dpi,
  onDpiChange,
  pageMode,
  onPageModeChange,
  pageRangeText,
  onPageRangeTextChange,
  onRangeValidityChange,
}: PdfToJpgPanelProps) {
  const rangeInputId = useId();
  const [previewPage, setPreviewPage] = useState(1);
  const [localDpi, setLocalDpi] = useState<PdfToJpgDpi>(150);
  const [localPageMode, setLocalPageMode] = useState<PdfToJpgPageMode>("all");
  const [localRangeText, setLocalRangeText] = useState("");

  const activeDpi = dpi ?? localDpi;
  const activePageMode = pageMode ?? localPageMode;
  const activeRangeText = pageRangeText ?? localRangeText;

  const parsedRange = parsePageRange(activeRangeText, Math.max(1, totalPages));
  const isRangeValid =
    activePageMode === "all" || (parsedRange.valid && parsedRange.pages.length > 0);
  const selectedCount =
    activePageMode === "range" && parsedRange.valid && parsedRange.pages.length > 0
      ? parsedRange.pages.length
      : totalPages;

  useEffect(() => {
    onPreviewPageChange?.(previewPage);
  }, [onPreviewPageChange, previewPage]);

  useEffect(() => {
    onRangeValidityChange?.(isRangeValid);
  }, [isRangeValid, onRangeValidityChange]);

  const activeThumbnail =
    pageThumbnails?.[previewPage - 1] || (previewPage === 1 ? thumbnailUrl : undefined);

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function handleSelectDpi(nextDpi: PdfToJpgDpi) {
    setLocalDpi(nextDpi);
    onDpiChange?.(nextDpi);
  }

  function handleSelectPageMode(nextMode: PdfToJpgPageMode) {
    setLocalPageMode(nextMode);
    onPageModeChange?.(nextMode);
  }

  function handleRangeInputChange(value: string) {
    setLocalRangeText(value);
    onPageRangeTextChange?.(value);
  }

  return (
    <div className="ilovepdf-compress-container" data-workspace-panel>
      {/* Centro: Miniatura do PDF com número de páginas */}
      <div className="ilovepdf-compress-preview-area" data-workspace-part="document">
        <div className="ilovepdf-file-card-center">
          <PdfViewport page={previewPage} pageCount={totalPages} onPageChange={setPreviewPage}>
            <div className="ilovepdf-file-thumb-wrapper">
              {activeThumbnail ? (
                <img
                  src={activeThumbnail}
                  alt={`Miniatura de ${fileName}`}
                  className="ilovepdf-file-thumb-img"
                />
              ) : (
                <div className="ilovepdf-file-thumb-placeholder">PDF</div>
              )}
              <span
                style={{
                  position: "absolute",
                  bottom: "8px",
                  right: "8px",
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "4px",
                }}
              >
                {totalPages} {totalPages === 1 ? "página" : "páginas"}
              </span>
            </div>
          </PdfViewport>

          <span className="ilovepdf-file-card-name" title={fileName}>
            {fileName}
          </span>
          <span className="ilovepdf-file-card-size">{formatSize(fileSizeBytes)}</span>
        </div>
      </div>

      {/* Lateral: Configurações e Orientações */}
      <aside className="ilovepdf-compress-options-sidebar" data-workspace-part="options">
        <h3 className="ilovepdf-sidebar-title">{translate("workspace.pdfToJpg.title")}</h3>
        <p
          className="ilovepdf-control-hint"
          style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}
        >
          {translate("workspace.pdfToJpg.desc")}
        </p>

        {/* Seletor de Resolução (DPI) */}
        <div style={{ marginTop: "1rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            {translate("workspace.pdfToJpg.resolution")}
          </span>
          <div className="ilovepdf-compress-levels-list">
            {DPI_OPTIONS.map((opt) => {
              const selected = activeDpi === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`ilovepdf-level-card ${selected ? "ilovepdf-level-card--selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => handleSelectDpi(opt.value)}
                >
                  <div
                    className="ilovepdf-level-info"
                    style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
                  >
                    <FileImage size={18} style={{ color: "#EAB308" }} />
                    <strong className="ilovepdf-level-name">{translate(opt.labelKey)}</strong>
                  </div>
                  {selected && (
                    <div className="ilovepdf-level-check">
                      <Check size={14} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Seletor de Páginas */}
        <div style={{ marginTop: "1rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            {translate("workspace.pdfToJpg.pagesModeLabel")}
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className={`ilovepdf-level-card ${activePageMode === "all" ? "ilovepdf-level-card--selected" : ""}`}
              style={{ flex: 1, justifyContent: "center", padding: "0.5rem 0.65rem" }}
              aria-pressed={activePageMode === "all"}
              onClick={() => handleSelectPageMode("all")}
            >
              <strong className="ilovepdf-level-name" style={{ fontSize: "0.8rem" }}>
                {translate("workspace.pdfToJpg.pagesAll").replace("{count}", String(totalPages))}
              </strong>
            </button>
            <button
              type="button"
              className={`ilovepdf-level-card ${activePageMode === "range" ? "ilovepdf-level-card--selected" : ""}`}
              style={{ flex: 1, justifyContent: "center", padding: "0.5rem 0.65rem" }}
              aria-pressed={activePageMode === "range"}
              onClick={() => handleSelectPageMode("range")}
            >
              <strong className="ilovepdf-level-name" style={{ fontSize: "0.8rem" }}>
                {translate("workspace.pdfToJpg.pagesRange")}
              </strong>
            </button>
          </div>

          {activePageMode === "range" && (
            <div style={{ marginTop: "0.6rem" }}>
              <label htmlFor={rangeInputId} className="sr-only">
                {translate("workspace.pdfToJpg.pagesRange")}
              </label>
              <input
                id={rangeInputId}
                type="text"
                value={activeRangeText}
                onChange={(e) => handleRangeInputChange(e.target.value)}
                placeholder={translate("workspace.pdfToJpg.rangePlaceholder")}
                aria-invalid={!isRangeValid}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "8px",
                  border: `1px solid ${!isRangeValid ? "#e11d48" : "var(--color-border, #cbd5e1)"}`,
                  background: "var(--color-surface-raised, #ffffff)",
                  color: "var(--color-ink, #0f172a)",
                  fontSize: "0.85rem",
                }}
              />
              {!isRangeValid && (
                <p
                  role="alert"
                  style={{
                    margin: "0.35rem 0 0",
                    fontSize: "0.78rem",
                    color: "#e11d48",
                  }}
                >
                  {translate("workspace.pdfToJpg.rangeInvalid").replace(
                    "{total}",
                    String(totalPages),
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Aviso de Download */}
        <div
          style={{
            marginTop: "1rem",
            padding: "0.85rem",
            backgroundColor: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.2)",
            borderRadius: "8px",
            fontSize: "0.82rem",
            color: "#854d0e",
            lineHeight: 1.45,
          }}
        >
          {selectedCount === 1
            ? translate("workspace.pdfToJpg.singleNotice")
            : translate("workspace.pdfToJpg.multipleNotice")}
        </div>

        {/* Resumo */}
        <div className="ilovepdf-merge-stats-card" style={{ marginTop: "1.25rem" }}>
          <div className="ilovepdf-merge-stat-item">
            <span>
              {activePageMode === "range"
                ? translate("workspace.pdfToJpg.selectedPagesCount")
                : translate("workspace.pdfToJpg.pagesCount")}
            </span>
            <strong>{selectedCount}</strong>
          </div>
          <div className="ilovepdf-merge-stat-item">
            <span>{translate("workspace.pdfToJpg.fileSize")}</span>
            <strong>{formatSize(fileSizeBytes)}</strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
