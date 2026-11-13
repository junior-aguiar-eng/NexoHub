import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Table as TableIcon,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
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

function parseSeparatorFractions(text: string): number[] {
  if (!text.trim()) return [];
  const values: number[] = [];
  for (const part of text.split(";")) {
    const trimmed = part.trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) continue;
    const fraction = Number(trimmed.replace(",", ".")) / 100;
    if (Number.isFinite(fraction) && fraction > 0 && fraction < 1) {
      values.push(fraction);
    }
  }
  return values.sort((a, b) => a - b);
}

function formatSeparatorPercent(fraction: number): string {
  const pct = Math.round(fraction * 1000) / 10;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}

function serializeSeparatorFractions(fractions: readonly number[]): string {
  return [...fractions]
    .sort((a, b) => a - b)
    .map(formatSeparatorPercent)
    .join("; ");
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

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const suppressNextClickRef = useRef(false);

  const parsedSeparators = useMemo(() => parseSeparatorFractions(separatorsText), [separatorsText]);

  const minAllowedFraction = Math.max(0.05, region.left + 0.01);
  const maxAllowedFraction = Math.min(0.95, region.left + region.width - 0.01);

  const updateSeparatorAt = (index: number, rawFraction: number) => {
    if (!onSeparatorsTextChange || isRunning) return;
    const prevBound = index > 0 ? parsedSeparators[index - 1] + 0.01 : minAllowedFraction;
    const nextBound =
      index < parsedSeparators.length - 1 ? parsedSeparators[index + 1] - 0.01 : maxAllowedFraction;
    if (prevBound >= nextBound) return;
    const clamped = Math.min(nextBound, Math.max(prevBound, rawFraction));
    const rounded = Math.round(clamped * 1000) / 1000;
    const next = parsedSeparators.map((value, idx) => (idx === index ? rounded : value));
    onSeparatorsTextChange(serializeSeparatorFractions(next));
  };

  const removeSeparatorAt = (index: number) => {
    if (!onSeparatorsTextChange || isRunning) return;
    const next = parsedSeparators.filter((_, idx) => idx !== index);
    onSeparatorsTextChange(serializeSeparatorFractions(next));
  };

  const handleStageClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isRunning || !onSeparatorsTextChange) return;
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    if ((event.target as HTMLElement).closest("[data-separator-control]")) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || minAllowedFraction >= maxAllowedFraction) return;
    const rawFraction = (event.clientX - rect.left) / rect.width;
    const clamped = Math.min(maxAllowedFraction, Math.max(minAllowedFraction, rawFraction));
    const rounded = Math.round(clamped * 1000) / 1000;
    if (parsedSeparators.some((existing) => Math.abs(existing - rounded) < 0.005)) return;
    onSeparatorsTextChange(serializeSeparatorFractions([...parsedSeparators, rounded]));
  };

  const handleHandlePointerDown = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (isRunning || !onSeparatorsTextChange || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingIndex(index);
  };

  const handleHandlePointerMove = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (draggingIndex !== index || isRunning || !onSeparatorsTextChange) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0) return;
    suppressNextClickRef.current = true;
    updateSeparatorAt(index, (event.clientX - rect.left) / rect.width);
  };

  const handleHandlePointerEnd = (index: number) => {
    if (draggingIndex === index) {
      setDraggingIndex(null);
    }
  };

  const handleHandleKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (isRunning || !onSeparatorsTextChange) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      updateSeparatorAt(index, parsedSeparators[index] - 0.01);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      updateSeparatorAt(index, parsedSeparators[index] + 0.01);
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSeparatorAt(index);
    }
  };

  const hasCustomRegion =
    region.left > 0.001 || region.top > 0.001 || region.width < 0.999 || region.height < 0.999;

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
                  <FileSpreadsheet size={18} className="text-emerald-600 dark:text-emerald-400" />
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
                  <TableIcon size={18} className="text-amber-600 dark:text-amber-400" />
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
              <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
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
                <FileSpreadsheet size={28} className="text-emerald-600 dark:text-emerald-400" />
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

        {/* Prévia Visual com Guias de Colunas */}
        {activeThumbnail && (
          <div className="pdf-excel-visual-card">
            <div className="preview-card-header">
              <div className="preview-title-block">
                <Layers size={18} className="text-emerald-600 dark:text-emerald-400" />
                <h3>{translate("excel.visualGuidesTitle")}</h3>
              </div>
              {parsedSeparators.length > 0 && onSeparatorsTextChange && (
                <button
                  type="button"
                  className="visual-clear-btn"
                  disabled={isRunning}
                  onClick={() => onSeparatorsTextChange("")}
                >
                  {translate("excel.clearSeparators")}
                </button>
              )}
            </div>
            <p className="info-card-text visual-guides-hint">
              {translate("excel.visualGuidesHint")}
            </p>
            <div className="visual-stage-wrapper">
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: os controles individuais dos separadores fornecem navegação por teclado e atalho de remoção */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: área de canvas interativa para posicionar separadores sobre a página */}
              <div
                ref={stageRef}
                className={`visual-stage-frame ${onSeparatorsTextChange && !isRunning ? "interactive" : ""}`}
                data-testid="pdf-excel-visual-preview"
                onClick={handleStageClick}
              >
                <img
                  src={activeThumbnail}
                  alt={translate("excel.visualPageAlt")
                    .replace("{page}", String(activePageIndex + 1))
                    .replace("{file}", fileName)}
                  className="visual-stage-image"
                  draggable={false}
                />
                {hasCustomRegion && (
                  <div
                    className="visual-region-box"
                    aria-hidden="true"
                    style={{
                      left: `${region.left * 100}%`,
                      top: `${region.top * 100}%`,
                      width: `${region.width * 100}%`,
                      height: `${region.height * 100}%`,
                    }}
                  />
                )}
                {parsedSeparators.map((sep, idx) => {
                  const percentLabel = formatSeparatorPercent(sep);
                  return (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: posição ordenada dos separadores
                      key={`sep-${idx}`}
                      className={`visual-separator-guide ${draggingIndex === idx ? "dragging" : ""}`}
                      style={{ left: `${sep * 100}%` }}
                      data-testid="column-separator-guide"
                      data-separator-control
                    >
                      <button
                        type="button"
                        role="slider"
                        className="visual-separator-handle"
                        aria-label={translate("excel.separatorHandleLabel").replace(
                          "{percent}",
                          percentLabel,
                        )}
                        aria-valuemin={Math.round(minAllowedFraction * 100)}
                        aria-valuemax={Math.round(maxAllowedFraction * 100)}
                        aria-valuenow={Math.round(sep * 100)}
                        disabled={isRunning || !onSeparatorsTextChange}
                        onPointerDown={(e) => handleHandlePointerDown(idx, e)}
                        onPointerMove={(e) => handleHandlePointerMove(idx, e)}
                        onPointerUp={() => handleHandlePointerEnd(idx)}
                        onPointerCancel={() => handleHandlePointerEnd(idx)}
                        onKeyDown={(e) => handleHandleKeyDown(idx, e)}
                        onClick={(e) => {
                          e.stopPropagation();
                          suppressNextClickRef.current = false;
                        }}
                      >
                        <span>{percentLabel}%</span>
                      </button>
                      {onSeparatorsTextChange && (
                        <button
                          type="button"
                          className="visual-separator-remove"
                          data-testid="remove-separator-btn"
                          aria-label={translate("excel.removeSeparator").replace(
                            "{percent}",
                            percentLabel,
                          )}
                          disabled={isRunning}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSeparatorAt(idx);
                          }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Prévia da Tabela Extraída */}
        <div className="pdf-excel-preview-card">
          <div className="preview-card-header">
            <div className="preview-title-block">
              <TableIcon size={18} className="text-emerald-600 dark:text-emerald-400" />
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
        .pdf-excel-container button:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
        .pdf-excel-sidebar {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .pdf-excel-card {
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .pdf-excel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          border-bottom: 1px solid var(--color-border);
          padding-bottom: 10px;
        }

        .pdf-excel-header h2 {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-ink);
          margin: 0;
        }

        .pdf-excel-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .pdf-excel-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-ink-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .pdf-excel-format-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .pdf-excel-format-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 10px 12px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
        }

        .pdf-excel-format-btn:hover {
          background: var(--color-surface-subtle);
          border-color: var(--color-border-strong);
        }

        .pdf-excel-format-btn.active {
          background: rgba(16, 124, 65, 0.1);
          border-color: #107c41;
          box-shadow: 0 0 0 1px #107c41;
        }

        .format-btn-header {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .format-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .format-desc {
          font-size: 11px;
          color: var(--color-ink-muted);
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
          padding: 9px 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--color-ink);
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }

        .pdf-excel-mode-btn:hover {
          background: var(--color-surface-subtle);
          border-color: var(--color-border-strong);
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
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .delimiter-btn span {
          font-size: 15px;
          font-weight: 700;
          color: var(--color-ink);
        }

        .delimiter-btn small {
          font-size: 10px;
          color: var(--color-ink-muted);
        }

        .delimiter-btn.active {
          background: rgba(16, 124, 65, 0.12);
          border-color: #107c41;
        }

        .delimiter-btn.active span {
          color: #059669;
        }

        .pdf-excel-checkbox-label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          cursor: pointer;
          background: var(--color-surface);
          padding: 10px 12px;
          border-radius: 8px;
          border: 1px solid var(--color-border);
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
          color: var(--color-ink);
        }

        .checkbox-hint {
          font-size: 11px;
          color: var(--color-ink-muted);
          line-height: 1.4;
        }

        .pdf-excel-info-card {
          background: rgba(16, 124, 65, 0.08);
          border: 1px solid rgba(16, 124, 65, 0.22);
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-card-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #047857;
        }

        [data-theme="dark"] .info-card-header,
        [data-theme="dark"] .delimiter-btn.active span,
        [data-theme="dark"] .col-letter {
          color: #34d399;
        }

        .info-card-text {
          font-size: 11px;
          color: var(--color-ink-muted);
          line-height: 1.4;
          margin: 0;
        }

        .pdf-excel-main {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
          flex: 1;
        }

        .pdf-excel-file-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex: 0 0 auto;
        }

        .file-card-details {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .file-card-icon {
          width: 40px;
          height: 40px;
          background: rgba(16, 124, 65, 0.1);
          border: 1px solid rgba(16, 124, 65, 0.25);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .file-card-meta {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .file-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-ink);
        }

        .file-badges {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .file-badge {
          font-size: 11px;
          background: var(--color-surface-subtle);
          color: var(--color-ink-muted);
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid var(--color-border);
        }

        .file-badge-emerald {
          background: rgba(16, 124, 65, 0.12);
          color: #047857;
          border-color: rgba(16, 124, 65, 0.3);
          font-weight: 600;
        }

        [data-theme="dark"] .file-badge-emerald {
          color: #34d399;
        }

        .file-pagination {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .page-nav-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-surface-subtle);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          color: var(--color-ink-muted);
          cursor: pointer;
        }

        .page-nav-btn:hover:not(:disabled) {
          border-color: var(--color-border-strong);
          color: var(--color-ink);
        }

        .page-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .page-counter {
          font-size: 12px;
          color: var(--color-ink-muted);
          font-weight: 600;
        }

        .pdf-excel-preview-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          flex: 1 1 0%;
          min-height: 220px;
          box-shadow: var(--shadow-sm);
        }

        .preview-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          background: var(--color-surface-subtle);
          border-bottom: 1px solid var(--color-border);
        }

        .preview-title-block {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .preview-title-block h3 {
          font-size: 13px;
          font-weight: 600;
          color: var(--color-ink);
          margin: 0;
        }

        .preview-status-badge {
          font-size: 11px;
          color: var(--color-ink-muted);
          background: var(--color-surface);
          padding: 2px 8px;
          border-radius: 4px;
          border: 1px solid var(--color-border);
        }

        .preview-table-wrapper {
          overflow: auto;
          flex: 1 1 0%;
          min-height: 0;
        }

        .preview-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 40px 20px;
          color: var(--color-ink-muted);
          text-align: center;
        }

        .excel-preview-table {
          width: 100%;
          border-collapse: collapse;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 12px;
        }

        .excel-preview-table th {
          background: var(--color-surface-subtle);
          color: var(--color-ink);
          font-weight: 600;
          padding: 7px 11px;
          border-bottom: 1px solid var(--color-border);
          border-right: 1px solid var(--color-border);
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
          color: #059669;
          font-weight: 700;
        }

        .col-text {
          font-size: 12px;
          color: var(--color-ink);
        }

        .excel-preview-table td {
          padding: 7px 11px;
          border-bottom: 1px solid var(--color-border);
          border-right: 1px solid var(--color-border);
          color: var(--color-ink);
          white-space: nowrap;
        }

        .excel-preview-table tbody tr:nth-child(even) {
          background: var(--color-surface-subtle);
        }

        .excel-preview-table tbody tr:hover {
          background: rgba(16, 124, 65, 0.08);
        }

        .excel-row-num {
          background: var(--color-surface-subtle);
          color: var(--color-ink-muted);
          text-align: center;
          font-weight: 600;
          font-size: 11px;
          width: 40px;
          border-right: 1px solid var(--color-border) !important;
          user-select: none;
        }

        .pdf-excel-visual-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          flex: 0 0 auto;
        }

        .visual-guides-hint {
          padding: 8px 14px;
          border-bottom: 1px solid var(--color-border);
        }

        .visual-clear-btn {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-ink);
          cursor: pointer;
        }

        .visual-clear-btn:hover:not(:disabled) {
          border-color: var(--color-border-strong);
          background: var(--color-surface-subtle);
        }

        .visual-stage-wrapper {
          padding: 12px;
          background: var(--color-surface-subtle);
          display: flex;
          justify-content: center;
          overflow: auto;
          max-height: 320px;
        }

        .visual-stage-frame {
          position: relative;
          display: inline-block;
          max-width: 100%;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          overflow: visible;
          user-select: none;
          background: #ffffff;
        }

        .visual-stage-frame.interactive {
          cursor: crosshair;
        }

        .visual-stage-image {
          display: block;
          max-width: 100%;
          max-height: 290px;
          height: auto;
          width: auto;
          border-radius: 6px;
        }

        .visual-region-box {
          position: absolute;
          border: 2px solid rgba(16, 124, 65, 0.7);
          background: rgba(16, 124, 65, 0.06);
          pointer-events: none;
          box-sizing: border-box;
        }

        .visual-separator-guide {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          transform: translateX(-50%);
          border-left: 2px dashed #059669;
          pointer-events: auto;
          z-index: 5;
        }

        .visual-separator-guide.dragging {
          border-left-style: solid;
          border-left-color: #10b981;
        }

        .visual-separator-handle {
          position: absolute;
          top: 4px;
          left: 50%;
          transform: translateX(-50%);
          padding: 2px 6px;
          font-size: 10px;
          font-weight: 700;
          line-height: 1.2;
          border-radius: 4px;
          border: 1px solid #047857;
          background: #107c41;
          color: #ffffff;
          cursor: ew-resize;
          white-space: nowrap;
        }

        .visual-separator-remove {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 22px;
          height: 22px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-ink);
          cursor: pointer;
          box-shadow: var(--shadow-sm);
        }

        .visual-separator-remove:hover:not(:disabled) {
          background: #fee2e2;
          border-color: #ef4444;
          color: #b91c1c;
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
