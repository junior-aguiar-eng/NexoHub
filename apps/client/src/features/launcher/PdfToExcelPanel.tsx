import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Table as TableIcon,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { translate } from "@/i18n";
import { getExcelColumnLetter, type SpreadsheetRegion } from "@/platform/excel-converter";

export interface PdfToExcelPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly thumbnailUrl?: string;
  readonly pageThumbnails?: readonly string[];
  readonly onPreviewPageChange?: (page: number) => void;
  readonly outputFormat: "xlsx" | "csv";
  readonly onOutputFormatChange: (format: "xlsx" | "csv") => void;
  readonly sheetMode: "per-page" | "single-sheet";
  readonly onSheetModeChange: (mode: "per-page" | "single-sheet") => void;
  readonly csvDelimiter: "," | ";" | "\t";
  readonly onCsvDelimiterChange: (del: "," | ";" | "\t") => void;
  readonly detectTablesOnly: boolean;
  readonly onDetectTablesOnlyChange: (val: boolean) => void;
  readonly previewRows?: Array<string[]>;
  readonly isConverting?: boolean;
  readonly previewError?: string;
  readonly previewPage?: number;
  readonly selectedPages?: readonly number[];
  readonly pagesText?: string;
  readonly onPagesTextChange?: (value: string) => void;
  readonly separatorsText?: string;
  readonly onSeparatorsTextChange?: (value: string) => void;
  readonly region?: SpreadsheetRegion;
  readonly onRegionChange?: (value: SpreadsheetRegion) => void;
  readonly preserveText?: boolean;
  readonly onPreserveTextChange?: (value: boolean) => void;
  readonly isRunning?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PdfToExcelPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  outputFormat,
  onOutputFormatChange,
  sheetMode,
  onSheetModeChange,
  csvDelimiter,
  onCsvDelimiterChange,
  detectTablesOnly,
  onDetectTablesOnlyChange,
  previewRows,
  isConverting = false,
  previewError,
  previewPage,
  selectedPages,
  pagesText = "",
  onPagesTextChange,
  separatorsText = "",
  onSeparatorsTextChange,
  region = { left: 0, top: 0, width: 1, height: 1 },
  onRegionChange,
  preserveText = true,
  onPreserveTextChange,
  isRunning = false,
}: PdfToExcelPanelProps) {
  const detectTablesInputId = useId();
  const [localPageIndex, setActivePageIndex] = useState<number>(0);
  const activePageIndex = previewPage === undefined ? localPageIndex : previewPage - 1;
  const navigationPages = selectedPages?.length
    ? selectedPages
    : Array.from({ length: totalPages }, (_, index) => index + 1);
  const navigationIndex = navigationPages.indexOf(activePageIndex + 1);
  function navigate(index: number) {
    setActivePageIndex(index);
    onPreviewPageChange?.(index + 1);
  }

  useEffect(() => {
    onPreviewPageChange?.(activePageIndex + 1);
  }, [onPreviewPageChange, activePageIndex]);

  const activeThumbnail =
    pageThumbnails?.[activePageIndex] ?? (activePageIndex === 0 ? thumbnailUrl : undefined);

  const displayRows = previewRows ?? [];

  return (
    <div className="pdf-excel-container" data-workspace-panel data-testid="pdf-to-excel-panel">
      {/* Coluna Lateral: Opções da Planilha */}
      <div className="pdf-excel-sidebar" data-workspace-part="options">
        <div className="pdf-excel-card">
          <div className="pdf-excel-header">
            <FileSpreadsheet className="text-emerald-500" size={20} />
            <h2>{translate("excel.optionsTitle")}</h2>
          </div>

          {onRegionChange && (
            <div className="pdf-excel-group pdf-excel-selection">
              <label>
                {translate("excel.pagesSelection")}
                <input
                  value={pagesText}
                  onChange={(event) => onPagesTextChange?.(event.target.value)}
                  disabled={isRunning}
                  placeholder={translate("excel.pagesSelectionHint")}
                />
              </label>
              <p>{translate("excel.logicalCoordinates")}</p>
              <div className="pdf-excel-region-fields">
                {(
                  [
                    ["left", "excel.regionLeft"],
                    ["top", "excel.regionTop"],
                    ["width", "excel.regionWidth"],
                    ["height", "excel.regionHeight"],
                  ] as const
                ).map(([field, key]) => (
                  <label key={field}>
                    {translate(key)}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={Number((region[field] * 100).toFixed(4))}
                      disabled={isRunning}
                      onChange={(event) =>
                        onRegionChange({ ...region, [field]: Number(event.target.value) / 100 })
                      }
                    />
                  </label>
                ))}
              </div>
              <label>
                {translate("excel.columnSeparators")}
                <input
                  value={separatorsText}
                  onChange={(event) => onSeparatorsTextChange?.(event.target.value)}
                  disabled={isRunning}
                  placeholder={translate("excel.columnSeparatorsHint")}
                />
              </label>
              <p>{translate("excel.selectionAppliesAll")}</p>
              <label className="pdf-excel-preserve-text">
                <input
                  type="checkbox"
                  checked={preserveText}
                  onChange={(event) => onPreserveTextChange?.(event.target.checked)}
                  disabled={isRunning}
                />
                {translate("excel.preserveText")}
              </label>
            </div>
          )}

          {/* Formato de Exportação */}
          <div className="pdf-excel-group">
            <span className="pdf-excel-label">{translate("excel.formatLabel")}</span>
            <div className="pdf-excel-format-grid">
              <button
                type="button"
                className={`pdf-excel-format-btn ${outputFormat === "xlsx" ? "active" : ""}`}
                onClick={() => onOutputFormatChange("xlsx")}
                aria-pressed={outputFormat === "xlsx"}
                data-testid="format-xlsx-btn"
                disabled={isRunning}
              >
                <div className="format-btn-header">
                  <FileSpreadsheet size={18} className="text-emerald-400" />
                  <span className="format-title">{translate("excel.formatXlsx")}</span>
                </div>
                <span className="format-desc">{translate("excel.formatXlsxHint")}</span>
              </button>

              <button
                type="button"
                className={`pdf-excel-format-btn ${outputFormat === "csv" ? "active" : ""}`}
                onClick={() => onOutputFormatChange("csv")}
                aria-pressed={outputFormat === "csv"}
                data-testid="format-csv-btn"
                disabled={isRunning}
              >
                <div className="format-btn-header">
                  <TableIcon size={18} className="text-amber-400" />
                  <span className="format-title">{translate("excel.formatCsv")}</span>
                </div>
                <span className="format-desc">{translate("excel.formatCsvHint")}</span>
              </button>
            </div>
          </div>

          {/* Organização das Planilhas */}
          <div className="pdf-excel-group">
            <span className="pdf-excel-label">{translate("excel.sheetModeLabel")}</span>
            <div className="pdf-excel-mode-buttons">
              <button
                type="button"
                className={`pdf-excel-mode-btn ${sheetMode === "per-page" ? "active" : ""}`}
                onClick={() => onSheetModeChange("per-page")}
                aria-pressed={sheetMode === "per-page"}
                data-testid="mode-per-page-btn"
                disabled={isRunning}
              >
                <Layers size={16} />
                <span>{translate("excel.sheetModePerPage")}</span>
              </button>
              <button
                type="button"
                className={`pdf-excel-mode-btn ${sheetMode === "single-sheet" ? "active" : ""}`}
                onClick={() => onSheetModeChange("single-sheet")}
                aria-pressed={sheetMode === "single-sheet"}
                data-testid="mode-single-btn"
                disabled={isRunning}
              >
                <Database size={16} />
                <span>{translate("excel.sheetModeSingle")}</span>
              </button>
            </div>
          </div>

          {/* Opções condicionais para CSV */}
          {outputFormat === "csv" && (
            <div className="pdf-excel-group">
              <span className="pdf-excel-label">{translate("excel.csvDelimiterLabel")}</span>
              <div className="pdf-excel-delimiters">
                <button
                  type="button"
                  className={`delimiter-btn ${csvDelimiter === ";" ? "active" : ""}`}
                  onClick={() => onCsvDelimiterChange(";")}
                  aria-pressed={csvDelimiter === ";"}
                  data-testid="delimiter-semicolon-btn"
                  disabled={isRunning}
                >
                  <span>;</span>
                  <small>{translate("excel.csvDelimiterSemicolon")}</small>
                </button>
                <button
                  type="button"
                  className={`delimiter-btn ${csvDelimiter === "," ? "active" : ""}`}
                  onClick={() => onCsvDelimiterChange(",")}
                  aria-pressed={csvDelimiter === ","}
                  data-testid="delimiter-comma-btn"
                  disabled={isRunning}
                >
                  <span>,</span>
                  <small>{translate("excel.csvDelimiterComma")}</small>
                </button>
                <button
                  type="button"
                  className={`delimiter-btn ${csvDelimiter === "\t" ? "active" : ""}`}
                  onClick={() => onCsvDelimiterChange("\t")}
                  aria-pressed={csvDelimiter === "\t"}
                  data-testid="delimiter-tab-btn"
                  disabled={isRunning}
                >
                  <span>Tab</span>
                  <small>{translate("excel.csvDelimiterTab")}</small>
                </button>
              </div>
            </div>
          )}

          {/* Switch de Filtro de Tabelas Apenas */}
          <div className="pdf-excel-group">
            <label htmlFor={detectTablesInputId} className="pdf-excel-checkbox-label">
              <input
                id={detectTablesInputId}
                type="checkbox"
                className="pdf-excel-checkbox"
                checked={detectTablesOnly}
                onChange={(e) => onDetectTablesOnlyChange(e.target.checked)}
                data-testid="detect-tables-only-checkbox"
                disabled={isRunning}
              />
              <div className="checkbox-text-block">
                <span className="checkbox-title">{translate("excel.detectTablesOnlyLabel")}</span>
                <span className="checkbox-hint">{translate("excel.detectTablesOnlyHint")}</span>
              </div>
            </label>
          </div>

          {/* Informativo de Tecnologia */}
          <div className="pdf-excel-info-card">
            <div className="info-card-header">
              <Sparkles size={16} className="text-emerald-400" />
              <span>{translate("excel.infoTitle")}</span>
            </div>
            <p className="info-card-text">{translate("excel.infoDescription")}</p>
          </div>
        </div>
      </div>

      {/* Coluna Central: Visualização e Prévia */}
      <div className="pdf-excel-main" data-workspace-part="document">
        {/* Cartão de Resumo do Arquivo */}
        <div className="pdf-excel-file-card">
          <div className="file-card-details">
            <div className="file-card-icon">
              {activeThumbnail ? (
                <img
                  src={activeThumbnail}
                  alt={fileName}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "6px" }}
                />
              ) : (
                <FileSpreadsheet size={28} className="text-emerald-400" />
              )}
            </div>
            <div className="file-card-meta">
              <span className="file-name">{fileName}</span>
              <div className="file-badges">
                <span className="file-badge">{formatSize(fileSizeBytes)}</span>
                <span className="file-badge">
                  {totalPages}{" "}
                  {translate(totalPages === 1 ? "unlock.pageSingular" : "unlock.pagePlural")}
                </span>
                <span className="file-badge file-badge-emerald">
                  {outputFormat === "xlsx" ? "XLSX OpenXML" : "CSV UTF-8"}
                </span>
              </div>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="file-pagination">
              <button
                type="button"
                className="page-nav-btn"
                aria-label={translate("unlock.previousPage")}
                disabled={navigationIndex <= 0}
                onClick={() =>
                  navigate((navigationPages[Math.max(0, navigationIndex - 1)] ?? 1) - 1)
                }
              >
                <ChevronLeft size={16} />
              </button>
              <span className="page-counter">
                {translate("redact.pageOfTotal")
                  .replace("{page}", String(activePageIndex + 1))
                  .replace("{total}", String(totalPages))}
              </span>
              <button
                type="button"
                className="page-nav-btn"
                aria-label={translate("unlock.nextPage")}
                disabled={navigationIndex >= navigationPages.length - 1}
                onClick={() =>
                  navigate(
                    (navigationPages[Math.min(navigationPages.length - 1, navigationIndex + 1)] ??
                      totalPages) - 1,
                  )
                }
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Prévia da Tabela Extraída */}
        <div className="pdf-excel-preview-card">
          <div className="preview-card-header">
            <div className="preview-title-block">
              <TableIcon size={18} className="text-emerald-400" />
              <h3>{translate("excel.tablePreviewTitle")}</h3>
            </div>
            <span className="preview-status-badge">
              {isConverting
                ? translate("excel.loadingPreview")
                : translate("excel.rowCount").replace("{count}", String(displayRows.length))}
            </span>
          </div>

          <p className="info-card-text" style={{ padding: "12px 18px", margin: 0 }}>
            {translate("excel.previewScope")}
            {previewPage !== undefined &&
              ` ${translate("excel.previewPage").replace("{page}", String(previewPage))}`}
          </p>
          <div className="preview-table-wrapper">
            {isConverting || previewError || displayRows.length === 0 ? (
              <div className="preview-empty-state">
                <AlertCircle size={32} className="text-slate-500" />
                <p role="status">
                  {previewError ??
                    translate(
                      isConverting
                        ? "excel.loadingPreview"
                        : previewRows === undefined
                          ? "excel.previewPending"
                          : "excel.emptyTable",
                    )}
                </p>
              </div>
            ) : (
              <table className="excel-preview-table" data-testid="excel-preview-table">
                <thead>
                  <tr>
                    <th className="excel-row-num">#</th>
                    {displayRows[0].map((headerCell, cIdx) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: matriz estática de cabeçalho
                      <th key={`th-${cIdx}-${headerCell}`}>
                        <div className="col-header-content">
                          <span className="col-letter">{getExcelColumnLetter(cIdx)}</span>
                          <span className="col-text">{headerCell}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.slice(1).map((row, rIdx) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: matriz estática de linhas
                    <tr key={`tr-${rIdx}-${row[0] ?? ""}`}>
                      <td className="excel-row-num">{rIdx + 1}</td>
                      {row.map((cell, cIdx) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: matriz estática de células
                        <td key={`td-${rIdx}-${cIdx}-${cell}`}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .pdf-excel-container .pdf-excel-selection { padding:12px; border:1px solid var(--color-border); border-radius:10px; background:var(--color-surface-raised); }
        .pdf-excel-selection label { display:flex; flex-direction:column; gap:6px; color:var(--color-ink); font-size:13px; }
        .pdf-excel-selection p { color:var(--color-ink-muted); font-size:12px; line-height:1.5; }
        .pdf-excel-selection input:not([type="checkbox"]), .pdf-excel-selection button { width:100%; min-height:44px; min-width:0; padding:8px; border:1px solid var(--color-border); border-radius:8px; background:var(--color-surface); color:var(--color-ink); }
        .pdf-excel-region-fields { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
        .pdf-excel-selection label.pdf-excel-preserve-text { flex-direction:row; align-items:center; min-height:44px; }
        .pdf-excel-selection :focus-visible { outline:2px solid var(--color-brand); outline-offset:2px; }
        .pdf-excel-container .page-nav-btn { min-width:44px; min-height:44px; }
        .pdf-excel-container {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 24px;
          width: 100%;
          max-width: 1280px;
          margin: 0 auto;
        }

        .pdf-excel-sidebar, .pdf-excel-main { min-width: 0; }
        .file-card-meta { min-width: 0; }
        .file-name { overflow-wrap: anywhere; }
        .file-badges { flex-wrap: wrap; }
        .pdf-excel-file-card { flex-wrap: wrap; gap: 12px; }
        .pdf-excel-container button:focus-visible { outline: 2px solid #38bdf8; outline-offset: 3px; }
        .pdf-excel-sidebar {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .pdf-excel-card {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .pdf-excel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 12px;
        }

        .pdf-excel-header h2 {
          font-size: 15px;
          font-weight: 600;
          color: #f8fafc;
          margin: 0;
        }

        .pdf-excel-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pdf-excel-label {
          font-size: 12px;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .pdf-excel-format-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        .pdf-excel-format-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 12px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .pdf-excel-format-btn:hover {
          background: #334155;
          border-color: #475569;
        }

        .pdf-excel-format-btn.active {
          background: rgba(16, 124, 65, 0.15);
          border-color: #107c41;
          box-shadow: 0 0 0 1px #107c41;
        }

        .format-btn-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .format-title {
          font-size: 14px;
          font-weight: 600;
          color: #f8fafc;
        }

        .format-desc {
          font-size: 11px;
          color: #94a3b8;
        }

        .pdf-excel-mode-buttons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .pdf-excel-mode-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 8px;
          font-size: 12px;
          font-weight: 500;
          color: #cbd5e1;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .pdf-excel-mode-btn:hover {
          background: #334155;
        }

        .pdf-excel-mode-btn.active {
          background: #107c41;
          color: #ffffff;
          border-color: #059669;
        }

        .pdf-excel-delimiters {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .delimiter-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 8px 4px;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .delimiter-btn span {
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
        }

        .delimiter-btn small {
          font-size: 10px;
          color: #94a3b8;
        }

        .delimiter-btn.active {
          background: rgba(16, 124, 65, 0.2);
          border-color: #107c41;
        }

        .delimiter-btn.active span {
          color: #34d399;
        }

        .pdf-excel-checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          background: #1e293b;
          padding: 12px;
          border-radius: 8px;
          border: 1px solid #334155;
        }

        .pdf-excel-checkbox {
          margin-top: 3px;
          accent-color: #107c41;
          cursor: pointer;
        }

        .checkbox-text-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .checkbox-title {
          font-size: 13px;
          font-weight: 600;
          color: #f1f5f9;
        }

        .checkbox-hint {
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
        }

        .pdf-excel-info-card {
          background: rgba(16, 124, 65, 0.08);
          border: 1px solid rgba(16, 124, 65, 0.2);
          border-radius: 8px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .info-card-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #34d399;
        }

        .info-card-text {
          font-size: 11px;
          color: #94a3b8;
          line-height: 1.4;
          margin: 0;
        }

        .pdf-excel-main {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .pdf-excel-file-card {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .file-card-details {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .file-card-icon {
          width: 44px;
          height: 44px;
          background: rgba(16, 124, 65, 0.15);
          border: 1px solid rgba(16, 124, 65, 0.3);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .file-card-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .file-name {
          font-size: 14px;
          font-weight: 600;
          color: #f8fafc;
        }

        .file-badges {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .file-badge {
          font-size: 11px;
          background: #1e293b;
          color: #94a3b8;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid #334155;
        }

        .file-badge-emerald {
          background: rgba(16, 124, 65, 0.2);
          color: #34d399;
          border-color: rgba(16, 124, 65, 0.4);
        }

        .file-pagination {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .page-nav-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          color: #94a3b8;
          cursor: pointer;
        }

        .page-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .page-counter {
          font-size: 12px;
          color: #cbd5e1;
        }

        .pdf-excel-preview-card {
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          min-height: 400px;
        }

        .preview-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: #1e293b;
          border-bottom: 1px solid #334155;
        }

        .preview-title-block {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .preview-title-block h3 {
          font-size: 13px;
          font-weight: 600;
          color: #f8fafc;
          margin: 0;
        }

        .preview-status-badge {
          font-size: 11px;
          color: #94a3b8;
          background: #0f172a;
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid #334155;
        }

        .preview-table-wrapper {
          overflow: auto;
          flex: 1;
          max-height: 520px;
        }

        .preview-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px 20px;
          color: #64748b;
        }

        .excel-preview-table {
          width: 100%;
          border-collapse: collapse;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
        }

        .excel-preview-table th {
          background: #1e293b;
          color: #e2e8f0;
          font-weight: 600;
          padding: 8px 12px;
          border-bottom: 1px solid #334155;
          border-right: 1px solid #334155;
          text-align: left;
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 10;
        }

        .col-header-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .col-letter {
          font-size: 10px;
          color: #34d399;
          font-weight: 700;
        }

        .col-text {
          font-size: 12px;
          color: #f8fafc;
        }

        .excel-preview-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #1e293b;
          border-right: 1px solid #1e293b;
          color: #cbd5e1;
          white-space: nowrap;
        }

        .excel-preview-table tbody tr:nth-child(even) {
          background: rgba(30, 41, 59, 0.4);
        }

        .excel-preview-table tbody tr:hover {
          background: rgba(16, 124, 65, 0.08);
        }

        .excel-row-num {
          background: #1e293b;
          color: #64748b;
          text-align: center;
          font-weight: 600;
          font-size: 11px;
          width: 40px;
          border-right: 1px solid #334155 !important;
          user-select: none;
        }

        @media (max-width: 900px) {
          .pdf-excel-container {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
