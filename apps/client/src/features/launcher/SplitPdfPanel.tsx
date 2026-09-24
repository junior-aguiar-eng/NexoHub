import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

export type SplitInterval = {
  id: string;
  start: number;
  end: number;
};

type SplitPdfPanelProps = {
  totalPages: number;
  fileName: string;
  firstPageThumb?: string;
  lastPageThumb?: string;
  intervals: SplitInterval[];
  mergeIntervals: boolean;
  splitMode: "interval" | "pages";
  selectedPageNumbers: number[];
  onIntervalsChange: (intervals: SplitInterval[]) => void;
  onMergeIntervalsChange: (merge: boolean) => void;
  onSplitModeChange: (mode: "interval" | "pages") => void;
  onSelectedPageNumbersChange: (pages: number[]) => void;
};

export function SplitPdfPanel({
  totalPages,
  firstPageThumb,
  lastPageThumb,
  intervals,
  mergeIntervals,
  splitMode,
  selectedPageNumbers,
  onIntervalsChange,
  onMergeIntervalsChange,
  onSplitModeChange,
  onSelectedPageNumbersChange,
}: SplitPdfPanelProps) {
  const [intervalType, setIntervalType] = useState<"custom" | "fixed">("custom");
  const [fixedPageCount, setFixedPageCount] = useState<number>(1);

  function handleAddInterval() {
    const last = intervals[intervals.length - 1];
    const nextStart = last ? Math.min(last.end + 1, totalPages) : 1;
    const nextEnd = totalPages;
    const newInterval: SplitInterval = {
      id: `interval-${Date.now()}`,
      start: nextStart,
      end: nextEnd,
    };
    onIntervalsChange([...intervals, newInterval]);
  }

  function handleRemoveInterval(id: string) {
    if (intervals.length <= 1) return;
    onIntervalsChange(intervals.filter((i) => i.id !== id));
  }

  function handleUpdateInterval(id: string, field: "start" | "end", value: number) {
    const clamped = Math.max(1, Math.min(value, totalPages));
    onIntervalsChange(
      intervals.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          [field]: clamped,
        };
      }),
    );
  }

  return (
    <div className="ilovepdf-split-container">
      {/* Área Central de Visualização dos Intervalos */}
      <div className="ilovepdf-split-preview-area">
        {splitMode === "interval" ? (
          <div className="ilovepdf-interval-cards-flow">
            {intervals.map((interval, idx) => (
              <div key={interval.id} className="ilovepdf-interval-card">
                <div className="ilovepdf-interval-card-header">
                  <span className="ilovepdf-interval-card-title">Intervalo {idx + 1}</span>
                  {intervals.length > 1 && (
                    <button
                      type="button"
                      className="ilovepdf-interval-card-delete"
                      onClick={() => handleRemoveInterval(interval.id)}
                      title="Remover intervalo"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="ilovepdf-interval-card-body">
                  {/* Página Inicial */}
                  <div className="ilovepdf-page-thumb-box">
                    {firstPageThumb ? (
                      <img
                        src={firstPageThumb}
                        alt={`Página ${interval.start}`}
                        className="ilovepdf-page-thumb-img"
                      />
                    ) : (
                      <div className="ilovepdf-page-thumb-fallback">Pág. {interval.start}</div>
                    )}
                    <span className="ilovepdf-page-number-tag">{interval.start}</span>
                  </div>

                  {interval.start !== interval.end && (
                    <>
                      <div className="ilovepdf-interval-dots">...</div>

                      {/* Página Final */}
                      <div className="ilovepdf-page-thumb-box">
                        {lastPageThumb ? (
                          <img
                            src={lastPageThumb}
                            alt={`Página ${interval.end}`}
                            className="ilovepdf-page-thumb-img"
                          />
                        ) : (
                          <div className="ilovepdf-page-thumb-fallback">Pág. {interval.end}</div>
                        )}
                        <span className="ilovepdf-page-number-tag">{interval.end}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ilovepdf-pages-extract-preview">
            <div className="ilovepdf-pages-selection-summary">
              <strong>{selectedPageNumbers.length}</strong> de {totalPages} páginas selecionadas
              para extração.
            </div>
            <div className="ilovepdf-pages-mini-grid">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                const isSelected = selectedPageNumbers.includes(pageNum);
                return (
                  <button
                    key={pageNum}
                    type="button"
                    className={`ilovepdf-page-mini-card ${isSelected ? "ilovepdf-page-mini-card--selected" : ""}`}
                    onClick={() => {
                      if (isSelected) {
                        onSelectedPageNumbersChange(
                          selectedPageNumbers.filter((p) => p !== pageNum),
                        );
                      } else {
                        onSelectedPageNumbersChange([...selectedPageNumbers, pageNum]);
                      }
                    }}
                  >
                    <div className="ilovepdf-page-mini-header">
                      <span>Pág. {pageNum}</span>
                      {isSelected && <Check size={12} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Painel Lateral Direito de Configuração (Estilo iLovePDF) */}
      <aside className="ilovepdf-split-options-sidebar">
        {/* Abas Superiores de Modo */}
        <div className="ilovepdf-split-mode-tabs">
          <button
            type="button"
            className={`ilovepdf-split-tab ${splitMode === "interval" ? "ilovepdf-split-tab--active" : ""}`}
            onClick={() => onSplitModeChange("interval")}
          >
            Intervalo
          </button>
          <button
            type="button"
            className={`ilovepdf-split-tab ${splitMode === "pages" ? "ilovepdf-split-tab--active" : ""}`}
            onClick={() => onSplitModeChange("pages")}
          >
            Páginas
          </button>
        </div>

        {splitMode === "interval" && (
          <div className="ilovepdf-split-interval-controls">
            <span className="ilovepdf-control-label">Modo de intervalo:</span>
            <div className="ilovepdf-btn-toggle-group">
              <button
                type="button"
                className={`ilovepdf-toggle-btn ${intervalType === "custom" ? "ilovepdf-toggle-btn--active" : ""}`}
                onClick={() => setIntervalType("custom")}
              >
                Personalizado
              </button>
              <button
                type="button"
                className={`ilovepdf-toggle-btn ${intervalType === "fixed" ? "ilovepdf-toggle-btn--active" : ""}`}
                onClick={() => setIntervalType("fixed")}
              >
                Fixo
              </button>
            </div>

            {intervalType === "custom" ? (
              <div className="ilovepdf-interval-inputs-list">
                {intervals.map((interval, index) => (
                  <div key={interval.id} className="ilovepdf-interval-input-row">
                    <span className="ilovepdf-interval-row-title">Intervalo {index + 1}</span>
                    <div className="ilovepdf-range-input-fields">
                      <div className="ilovepdf-range-field">
                        <label htmlFor={`split-start-${interval.id}`}>a partir da página</label>
                        <input
                          id={`split-start-${interval.id}`}
                          type="number"
                          min={1}
                          max={totalPages}
                          value={interval.start}
                          onChange={(e) =>
                            handleUpdateInterval(
                              interval.id,
                              "start",
                              parseInt(e.target.value, 10) || 1,
                            )
                          }
                        />
                      </div>
                      <div className="ilovepdf-range-field">
                        <label htmlFor={`split-end-${interval.id}`}>para</label>
                        <input
                          id={`split-end-${interval.id}`}
                          type="number"
                          min={1}
                          max={totalPages}
                          value={interval.end}
                          onChange={(e) =>
                            handleUpdateInterval(
                              interval.id,
                              "end",
                              parseInt(e.target.value, 10) || totalPages,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="ilovepdf-add-interval-btn"
                  onClick={handleAddInterval}
                >
                  <Plus size={16} />
                  <span>Adicionar Intervalo</span>
                </button>

                <label className="ilovepdf-checkbox-label">
                  <input
                    type="checkbox"
                    checked={mergeIntervals}
                    onChange={(e) => onMergeIntervalsChange(e.target.checked)}
                  />
                  <span>Mesclar todos os intervalos em um arquivo PDF.</span>
                </label>
              </div>
            ) : (
              <div className="ilovepdf-fixed-split-box">
                <label htmlFor="ilovepdf-fixed-split-input" className="ilovepdf-control-label">
                  Dividir a cada:
                </label>
                <div className="ilovepdf-fixed-split-input-wrapper">
                  <input
                    id="ilovepdf-fixed-split-input"
                    type="number"
                    min={1}
                    max={totalPages}
                    value={fixedPageCount}
                    onChange={(e) => {
                      const count = parseInt(e.target.value, 10) || 1;
                      setFixedPageCount(count);
                      // Gera intervalos fixos
                      const generated: SplitInterval[] = [];
                      for (let start = 1; start <= totalPages; start += count) {
                        generated.push({
                          id: `fix-${start}`,
                          start,
                          end: Math.min(start + count - 1, totalPages),
                        });
                      }
                      onIntervalsChange(generated);
                    }}
                  />
                  <span>páginas</span>
                </div>
              </div>
            )}
          </div>
        )}

        {splitMode === "pages" && (
          <div className="ilovepdf-split-pages-controls">
            <span className="ilovepdf-control-label">Extrair páginas:</span>
            <p className="ilovepdf-control-hint">
              Clique nas páginas que deseja extrair ou digite o intervalo abaixo:
            </p>
            <input
              type="text"
              className="ilovepdf-pages-input-field"
              placeholder="Ex: 1-3, 5, 8-10"
              onChange={(e) => {
                const text = e.target.value;
                const set = new Set<number>();
                for (const part of text.split(/[,;]/)) {
                  const tr = part.trim();
                  if (!tr) continue;
                  if (tr.includes("-")) {
                    const [s, end] = tr.split("-").map((v) => parseInt(v, 10));
                    if (!Number.isNaN(s) && !Number.isNaN(end)) {
                      for (let i = s; i <= end; i++) {
                        if (i >= 1 && i <= totalPages) set.add(i);
                      }
                    }
                  } else {
                    const num = parseInt(tr, 10);
                    if (!Number.isNaN(num) && num >= 1 && num <= totalPages) set.add(num);
                  }
                }
                onSelectedPageNumbersChange(Array.from(set).sort((a, b) => a - b));
              }}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
