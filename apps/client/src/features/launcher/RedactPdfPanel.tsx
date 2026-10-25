import { AlertCircle, EyeOff, Plus, ShieldAlert, Trash2 } from "lucide-react";
import type React from "react";
import { useEffect, useId, useRef, useState } from "react";
import { translate } from "@/i18n";
import type { RedactionArea } from "@/platform/pdf-engine";
import { PdfViewport } from "./PdfViewport";

export interface RedactPdfPanelProps {
  readonly preserve?: boolean;
  readonly onPreserveChange?: (preserve: boolean) => void;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly thumbnailUrl?: string;
  readonly pageThumbnails?: readonly string[];
  readonly onPreviewPageChange?: (page: number) => void;
  readonly redactions: readonly RedactionArea[];
  readonly onRedactionsChange: (redactions: readonly RedactionArea[]) => void;
}

export function RedactPdfPanel({
  preserve = false,
  onPreserveChange,
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  redactions,
  onRedactionsChange,
}: RedactPdfPanelProps) {
  const labelInputId = useId();
  const modeInputId = useId();
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [selectedColor, setSelectedColor] = useState<"black" | "white" | "gray">("black");
  const [defaultLabel, setDefaultLabel] = useState<string>(() => translate("redact.defaultLabel"));
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  const formattedSize =
    fileSizeBytes > 1024 * 1024
      ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(fileSizeBytes / 1024)} KB`;

  useEffect(() => {
    onPreviewPageChange?.(previewPage);
  }, [onPreviewPageChange, previewPage]);

  const activeThumbnail =
    pageThumbnails?.[previewPage - 1] ?? (previewPage === 1 ? thumbnailUrl : undefined);

  const currentPageIndex = previewPage - 1;
  const currentPageRedactions = redactions.filter((r) => r.pageIndex === currentPageIndex);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (
      !activeThumbnail ||
      !containerRef.current ||
      e.button !== 0 ||
      (e.target as HTMLElement).closest("button")
    )
      return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));

    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !containerRef.current || !startPoint) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));

    setCurrentPoint({ x, y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint || !currentPoint) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const endPoint = {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
    const widthPercent = Math.abs(endPoint.x - startPoint.x);
    const heightPercent = Math.abs(endPoint.y - startPoint.y);

    if (widthPercent > 2 && heightPercent > 1) {
      const xPercent = Math.min(startPoint.x, endPoint.x);
      const yPercent = Math.min(startPoint.y, endPoint.y);

      const newArea: RedactionArea = {
        id: `redact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        pageIndex: currentPageIndex,
        xPercent: Math.round(xPercent * 10) / 10,
        yPercent: Math.round(yPercent * 10) / 10,
        widthPercent: Math.round(widthPercent * 10) / 10,
        heightPercent: Math.round(heightPercent * 10) / 10,
        color: selectedColor,
        label: defaultLabel.trim() || undefined,
      };

      onRedactionsChange([...redactions, newArea]);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const handleAddManual = () => {
    const newArea: RedactionArea = {
      id: `redact-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      pageIndex: currentPageIndex,
      xPercent: 15,
      yPercent: 45,
      widthPercent: 70,
      heightPercent: 6,
      color: selectedColor,
      label: defaultLabel.trim() || undefined,
    };
    onRedactionsChange([...redactions, newArea]);
  };

  const handleRemoveRedaction = (id: string) => {
    onRedactionsChange(redactions.filter((r) => r.id !== id));
  };

  const handleClearAll = () => {
    onRedactionsChange([]);
  };

  const handleUpdateRedactionColor = (id: string, color: "black" | "white" | "gray") => {
    onRedactionsChange(redactions.map((r) => (r.id === id ? { ...r, color } : r)));
  };

  const handleUpdateRedactionLabel = (id: string, label: string) => {
    onRedactionsChange(redactions.map((r) => (r.id === id ? { ...r, label } : r)));
  };

  // Caixa sendo desenhada no momento
  const drawingBox =
    isDrawing && startPoint && currentPoint
      ? {
          x: Math.min(startPoint.x, currentPoint.x),
          y: Math.min(startPoint.y, currentPoint.y),
          w: Math.abs(currentPoint.x - startPoint.x),
          h: Math.abs(currentPoint.y - startPoint.y),
        }
      : null;

  return (
    <div className="redact-container" data-workspace-panel>
      {/* Coluna Esquerda: Controles e Lista de Tarjas */}
      <div className="redact-controls-pane" data-workspace-part="options">
        <div className="redact-header-card">
          <div className="redact-file-info">
            <div className="redact-file-icon">
              <EyeOff size={22} color="#f43f5e" />
            </div>
            <div>
              <div className="redact-file-name" title={fileName}>
                {fileName}
              </div>
              <div className="redact-file-meta">
                <span>{formattedSize}</span>
                <span>•</span>
                <span>
                  {totalPages}{" "}
                  {translate(totalPages === 1 ? "unlock.pageSingular" : "unlock.pagePlural")}
                </span>
                <span>•</span>
                <span className="redact-badge-count">
                  {redactions.length} {redactions.length === 1 ? "tarja" : "tarjas"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Card de Configurações das Novas Tarjas */}
        <div className="redact-section-card">
          <div className="redact-section-title">
            <ShieldAlert size={16} />
            <span>{translate("redact.optionsTitle")}</span>
          </div>

          <label htmlFor={modeInputId}>{translate("redact.mode")}</label>
          <select
            id={modeInputId}
            className="redact-text-input"
            value={preserve ? "preserve" : "raster"}
            onChange={(event) => onPreserveChange?.(event.target.value === "preserve")}
          >
            <option value="raster">{translate("redact.modeRaster")}</option>
            <option value="preserve">{translate("redact.modePreserve")}</option>
          </select>
          <p className="redact-instruction">{translate("redact.instruction")}</p>

          <div className="redact-field-group">
            <span className="redact-field-label">{translate("redact.colorLabel")}</span>
            <div className="redact-color-picker">
              <button
                type="button"
                className={`redact-color-btn ${selectedColor === "black" ? "selected" : ""}`}
                onClick={() => setSelectedColor("black")}
                aria-pressed={selectedColor === "black"}
              >
                <span className="redact-swatch" style={{ background: "#000000" }} />
                <span>{translate("redact.colorBlack")}</span>
              </button>
              <button
                type="button"
                className={`redact-color-btn ${selectedColor === "white" ? "selected" : ""}`}
                onClick={() => setSelectedColor("white")}
                aria-pressed={selectedColor === "white"}
              >
                <span
                  className="redact-swatch"
                  style={{ background: "#ffffff", border: "1px solid #64748b" }}
                />
                <span>{translate("redact.colorWhite")}</span>
              </button>
              <button
                type="button"
                className={`redact-color-btn ${selectedColor === "gray" ? "selected" : ""}`}
                onClick={() => setSelectedColor("gray")}
                aria-pressed={selectedColor === "gray"}
              >
                <span className="redact-swatch" style={{ background: "#6b7280" }} />
                <span>{translate("redact.colorGray")}</span>
              </button>
            </div>
          </div>

          <div className="redact-field-group">
            <label htmlFor={labelInputId} className="redact-field-label">
              {translate("redact.labelOptional")}
            </label>
            <input
              id={labelInputId}
              type="text"
              className="redact-text-input"
              value={defaultLabel}
              onChange={(e) => setDefaultLabel(e.target.value)}
              placeholder={translate("redact.labelPlaceholder")}
            />
          </div>

          <button
            type="button"
            className="redact-add-manual-btn"
            onClick={handleAddManual}
            data-testid="redact-add-manual"
          >
            <Plus size={16} />
            <span>{translate("redact.addArea")}</span>
          </button>
        </div>

        {/* Lista de Tarjas Cadastradas */}
        <div className="redact-section-card">
          <div className="redact-list-header">
            <div className="redact-section-title">
              <span>
                {translate("redact.activeRedactions").replace("{count}", String(redactions.length))}
              </span>
            </div>
            {redactions.length > 0 && (
              <button type="button" className="redact-btn-clear" onClick={handleClearAll}>
                {translate("redact.clearAll")}
              </button>
            )}
          </div>

          {redactions.length === 0 ? (
            <div className="redact-empty-notice">
              <AlertCircle size={16} color="#94a3b8" />
              <span>{translate("redact.noRedactions")}</span>
            </div>
          ) : (
            <div className="redact-items-list" data-testid="redact-items-list">
              {redactions.map((item, idx) => {
                const isCurrentPage = item.pageIndex === currentPageIndex;
                return (
                  <div
                    key={item.id}
                    className={`redact-item-card ${isCurrentPage ? "highlighted" : ""}`}
                    data-testid="redact-area-item"
                  >
                    <div className="redact-item-top">
                      <button
                        type="button"
                        className="redact-item-badge"
                        onClick={() => setPreviewPage(item.pageIndex + 1)}
                        aria-pressed={isCurrentPage}
                      >
                        {translate("redact.page").replace("{page}", String(item.pageIndex + 1))} • #
                        {idx + 1}
                      </button>
                      <button
                        type="button"
                        className="redact-item-remove"
                        onClick={() => handleRemoveRedaction(item.id)}
                        aria-label={translate("redact.removeArea")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="redact-item-controls">
                      <div className="redact-item-color-row">
                        {(["black", "white", "gray"] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`redact-mini-swatch ${(item.color || "black") === c ? "active" : ""}`}
                            style={{
                              background:
                                c === "black" ? "#000000" : c === "white" ? "#ffffff" : "#6b7280",
                            }}
                            onClick={() => handleUpdateRedactionColor(item.id, c)}
                            aria-label={translate(
                              c === "black"
                                ? "redact.colorBlack"
                                : c === "white"
                                  ? "redact.colorWhite"
                                  : "redact.colorGray",
                            )}
                            aria-pressed={(item.color || "black") === c}
                          />
                        ))}
                      </div>

                      <input
                        type="text"
                        className="redact-item-label-input"
                        value={item.label || ""}
                        placeholder={translate("redact.labelPlaceholder")}
                        aria-label={translate("redact.labelOptional")}
                        onChange={(e) => handleUpdateRedactionLabel(item.id, e.target.value)}
                      />
                    </div>
                    <div className="redact-coordinate-grid">
                      {(["xPercent", "yPercent", "widthPercent", "heightPercent"] as const).map(
                        (field) => (
                          <label key={field} className="redact-field-label">
                            {translate(
                              field === "xPercent"
                                ? "redact.areaX"
                                : field === "yPercent"
                                  ? "redact.areaY"
                                  : field === "widthPercent"
                                    ? "redact.areaWidth"
                                    : "redact.areaHeight",
                            )}
                            <input
                              type="number"
                              className="redact-text-input"
                              min={field === "xPercent" || field === "yPercent" ? 0 : 0.1}
                              max={100}
                              step={0.1}
                              value={item[field]}
                              onChange={(event) => {
                                if (event.target.value === "") return;
                                const value = Number(event.target.value);
                                if (!Number.isFinite(value)) return;
                                const updated = { ...item };
                                if (field === "xPercent")
                                  updated.xPercent = Math.max(
                                    0,
                                    Math.min(100 - item.widthPercent, value),
                                  );
                                if (field === "yPercent")
                                  updated.yPercent = Math.max(
                                    0,
                                    Math.min(100 - item.heightPercent, value),
                                  );
                                if (field === "widthPercent")
                                  updated.widthPercent = Math.max(
                                    0.1,
                                    Math.min(100 - item.xPercent, value),
                                  );
                                if (field === "heightPercent")
                                  updated.heightPercent = Math.max(
                                    0.1,
                                    Math.min(100 - item.yPercent, value),
                                  );
                                onRedactionsChange(
                                  redactions.map((area) => (area.id === item.id ? updated : area)),
                                );
                              }}
                            />
                          </label>
                        ),
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Coluna Direita: Pré-visualização Interativa */}
      <div className="redact-preview-pane" data-workspace-part="document">
        <div className="redact-preview-card">
          <div className="redact-preview-header">
            <span className="redact-preview-title">
              {translate("redact.page").replace("{page}", String(previewPage))} de {totalPages}
            </span>
          </div>

          <p className="redact-draw-hint">{translate("redact.originalPreview")}</p>
          <div className="redact-draw-hint">{translate("redact.drawHint")}</div>

          <PdfViewport page={previewPage} pageCount={totalPages} onPageChange={setPreviewPage}>
            <div className="redact-preview-area">
              <div
                ref={containerRef}
                className="redact-preview-canvas-wrapper"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={() => {
                  setIsDrawing(false);
                  setStartPoint(null);
                  setCurrentPoint(null);
                }}
                data-testid="redact-preview-canvas"
              >
                {activeThumbnail ? (
                  <img
                    src={activeThumbnail}
                    alt={translate("unlock.previewAlt").replace("{page}", String(previewPage))}
                    className="redact-thumb-image"
                    draggable={false}
                  />
                ) : (
                  <div className="redact-thumb-placeholder">
                    <EyeOff size={48} color="#64748b" />
                    <span>{translate("common.previewUnavailable")}</span>
                  </div>
                )}

                {/* Tarjas já desenhadas na página atual */}
                {currentPageRedactions.map((area) => {
                  const isWhite = area.color === "white";
                  const isGray = area.color === "gray";
                  const bg = isWhite ? "#ffffff" : isGray ? "#4b5563" : "#000000";
                  const textColor = isWhite ? "#000000" : "#ffffff";

                  return (
                    <div
                      key={area.id}
                      className="redact-box-overlay"
                      style={{
                        left: `${area.xPercent}%`,
                        top: `${area.yPercent}%`,
                        width: `${area.widthPercent}%`,
                        height: `${area.heightPercent}%`,
                        backgroundColor: bg,
                        color: textColor,
                      }}
                      title={area.label || translate("redact.removeArea")}
                    >
                      {area.label && <span className="redact-box-label">{area.label}</span>}
                      <button
                        type="button"
                        className="redact-box-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveRedaction(area.id);
                        }}
                        aria-label={translate("redact.removeArea")}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {/* Caixa sendo desenhada ativamente */}
                {drawingBox && (
                  <div
                    className="redact-drawing-overlay"
                    style={{
                      left: `${drawingBox.x}%`,
                      top: `${drawingBox.y}%`,
                      width: `${drawingBox.w}%`,
                      height: `${drawingBox.h}%`,
                      backgroundColor:
                        selectedColor === "white"
                          ? "rgba(255, 255, 255, 0.7)"
                          : selectedColor === "gray"
                            ? "rgba(107, 114, 128, 0.7)"
                            : "rgba(0, 0, 0, 0.7)",
                    }}
                  />
                )}
              </div>
            </div>
          </PdfViewport>

          <div className="redact-preview-footer">
            <span className="redact-privacy-notice">
              {translate(preserve ? "redact.preserveNotice" : "redact.privacyNotice")}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        button.redact-item-badge { cursor: pointer; border: 1px solid #475569; }
        .redact-coordinate-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
        .redact-controls-pane, .redact-preview-pane { min-width: 0; }
        .redact-container button:focus-visible { outline: 2px solid #38bdf8; outline-offset: 3px; }
        .redact-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          width: 100%;
          align-items: start;
        }
        @media (max-width: 900px) {
          .redact-container {
            grid-template-columns: 1fr;
          }
        }
        .redact-controls-pane {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .redact-header-card {
          padding: 1rem 1.25rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
        }
        .redact-file-info {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }
        .redact-file-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.2);
        }
        .redact-file-name {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--color-ink);
          word-break: break-all;
        }
        .redact-file-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--color-ink-muted);
          margin-top: 2px;
        }
        .redact-badge-count {
          color: #0369a1;
          font-weight: 500;
        }
        .redact-section-card {
          padding: 1.25rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .redact-section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-ink);
        }
        .redact-instruction {
          font-size: 0.82rem;
          color: var(--color-ink-muted);
          line-height: 1.4;
          margin: 0;
        }
        .redact-field-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .redact-field-label {
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--color-ink);
        }
        .redact-color-picker {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        .redact-color-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.65rem;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          color: var(--color-ink);
          font-size: 0.78rem;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .redact-color-btn.selected {
          border-color: #0369a1;
          background: rgba(56, 189, 248, 0.1);
          color: var(--color-ink);
        }
        .redact-swatch {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          display: inline-block;
        }
        .redact-text-input {
          width: 100%;
          padding: 0.55rem 0.75rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          color: var(--color-ink);
          font-size: 0.85rem;
        }
        .redact-text-input:focus {
          outline: none;
          border-color: #0369a1;
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
        }
        .redact-add-manual-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.6rem 1rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          color: var(--color-ink);
          font-size: 0.82rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s;
          margin-top: 0.25rem;
        }
        .redact-add-manual-btn:hover {
          background: var(--color-surface-muted);
        }
        .redact-list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .redact-btn-clear {
          background: transparent;
          border: none;
          color: #f43f5e;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          padding: 2px 6px;
        }
        .redact-btn-clear:hover {
          text-decoration: underline;
        }
        .redact-empty-notice {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.85rem;
          background: var(--color-surface-muted);
          border: 1px dashed var(--color-border);
          border-radius: 8px;
          font-size: 0.8rem;
          color: var(--color-ink-muted);
        }
        .redact-items-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 260px;
          overflow-y: auto;
        }
        .redact-item-card {
          padding: 0.65rem 0.85rem;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          transition: border-color 0.15s;
        }
        .redact-item-card.highlighted {
          border-color: rgba(56, 189, 248, 0.4);
          background: rgba(56, 189, 248, 0.03);
        }
        .redact-item-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .redact-item-badge {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-ink);
        }
        .redact-item-remove {
          background: transparent;
          border: none;
          color: var(--color-ink-muted);
          cursor: pointer;
          padding: 2px;
          border-radius: 4px;
        }
        .redact-item-remove:hover {
          color: #f43f5e;
          background: rgba(244, 63, 94, 0.1);
        }
        .redact-item-controls {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .redact-item-color-row {
          display: flex;
          gap: 0.3rem;
        }
        .redact-mini-swatch {
          width: 18px;
          height: 18px;
          border-radius: 3px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
        }
        .redact-mini-swatch.active {
          box-shadow: 0 0 0 2px #38bdf8;
        }
        .redact-item-label-input {
          flex: 1;
          padding: 0.3rem 0.5rem;
          font-size: 0.78rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 4px;
          color: var(--color-ink);
        }
        .redact-preview-pane {
          position: sticky;
          top: 1.5rem;
        }
        .redact-preview-card {
          padding: 1.25rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .redact-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .redact-preview-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-ink);
        }
        .redact-page-nav {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .redact-nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          color: var(--color-ink);
          cursor: pointer;
        }
        .redact-nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .redact-page-counter {
          font-size: 0.75rem;
          color: var(--color-ink-muted);
          min-width: 48px;
          text-align: center;
        }
        .redact-draw-hint {
          font-size: 0.75rem;
          color: #0369a1;
          background: rgba(56, 189, 248, 0.08);
          border: 1px solid rgba(56, 189, 248, 0.2);
          padding: 0.45rem 0.75rem;
          border-radius: 6px;
        }
        .redact-preview-area {
          background: var(--color-surface-muted);
          border-radius: 8px;
          padding: 1rem;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 420px;
        }
        .redact-preview-canvas-wrapper {
          position: relative;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          border-radius: 4px;
          overflow: hidden;
          cursor: crosshair;
          user-select: none;
          max-height: 520px;
          touch-action: none;
          max-width: 100%;
        }
        .redact-thumb-image {
          display: block;
          max-width: 100%;
          max-height: 520px;
          object-fit: contain;
          pointer-events: none;
        }
        .redact-thumb-placeholder {
          width: 320px;
          height: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          background: var(--color-surface-muted);
          color: #64748b;
          font-size: 0.85rem;
        }
        .redact-box-overlay {
          position: absolute;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.4);
          font-size: 9px;
          font-weight: 700;
          overflow: hidden;
          z-index: 2;
        }
        .redact-box-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding: 0 4px;
        }
        .redact-box-delete-btn {
          position: absolute;
          top: 0;
          right: 0;
          width: 14px;
          height: 14px;
          display: none;
          align-items: center;
          justify-content: center;
          background: #f43f5e;
          color: #ffffff;
          border: none;
          font-size: 10px;
          cursor: pointer;
          line-height: 1;
        }
        .redact-box-overlay:hover .redact-box-delete-btn {
          display: flex;
        }
        .redact-drawing-overlay {
          position: absolute;
          box-sizing: border-box;
          border: 2px dashed #38bdf8;
          z-index: 3;
          pointer-events: none;
        }
        .redact-preview-footer {
          padding-top: 0.5rem;
          border-top: 1px solid var(--color-border);
          text-align: center;
        }
        .redact-privacy-notice {
          font-size: 0.75rem;
          color: var(--color-ink-muted);
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
