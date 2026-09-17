import {
  ArrowLeftRight,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Grid,
  RotateCw,
  Square,
  Trash2,
} from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { createSvgPageThumbnail } from "@/platform/browser-pdf-utils";

export type PdfPageItem = {
  id: string;
  originalIndex: number;
  rotation: number;
};

type PdfPageGridPanelProps = {
  mode: "organize" | "extract";
  totalPages: number;
  pages: PdfPageItem[];
  selectedIndices: number[];
  onPagesChange?: (pages: PdfPageItem[]) => void;
  onSelectedIndicesChange?: (indices: number[]) => void;
  onRotateAll?: () => void;
  onResetOrder?: () => void;
};

export function PdfPageGridPanel({
  mode,
  totalPages,
  pages,
  selectedIndices,
  onPagesChange,
  onSelectedIndicesChange,
  onRotateAll,
  onResetOrder,
}: PdfPageGridPanelProps) {
  const [rangeInput, setRangeInput] = useState<string>("");

  function handleMove(index: number, direction: "left" | "right") {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    const newPages = [...pages];
    const temp = newPages[index];
    newPages[index] = newPages[targetIndex];
    newPages[targetIndex] = temp;
    onPagesChange?.(newPages);
  }

  function handleRotate(index: number) {
    const newPages = pages.map((page, i) => {
      if (i === index) {
        const nextRotation = (page.rotation + 90) % 360;
        return { ...page, rotation: nextRotation };
      }
      return page;
    });
    onPagesChange?.(newPages);
  }

  function handleDelete(index: number) {
    if (pages.length <= 1) return;
    const newPages = pages.filter((_, i) => i !== index);
    onPagesChange?.(newPages);
  }

  function handleToggleSelect(pageNumber: number) {
    let newSelection: number[];
    if (selectedIndices.includes(pageNumber)) {
      newSelection = selectedIndices.filter((idx) => idx !== pageNumber);
    } else {
      newSelection = [...selectedIndices, pageNumber].sort((a, b) => a - b);
    }
    onSelectedIndicesChange?.(newSelection);
  }

  function handleSelectAll() {
    const all = pages.map((p) => p.originalIndex);
    onSelectedIndicesChange?.(all);
  }

  function handleClearSelection() {
    onSelectedIndicesChange?.([]);
  }

  function handleInvertSelection() {
    const all = pages.map((p) => p.originalIndex);
    const inverted = all.filter((p) => !selectedIndices.includes(p));
    onSelectedIndicesChange?.(inverted);
  }

  function handleRangeChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setRangeInput(val);

    // Converte string de intervalo como "1-3, 5" em array de números
    const parsedIndices = new Set<number>();
    const parts = val.split(/[,;]/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      if (trimmed.includes("-")) {
        const [startStr, endStr] = trimmed.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            if (i >= 1 && i <= totalPages) parsedIndices.add(i);
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!Number.isNaN(num) && num >= 1 && num <= totalPages) {
          parsedIndices.add(num);
        }
      }
    }
    if (parsedIndices.size > 0) {
      onSelectedIndicesChange?.(Array.from(parsedIndices).sort((a, b) => a - b));
    }
  }

  return (
    <div className="pdf-page-grid-panel">
      {/* Barra Superior com Título e Ações */}
      <div className="pdf-page-grid-header">
        <div className="pdf-page-grid-title-block">
          <Grid size={18} className="pdf-page-grid-icon" />
          <div>
            <h3 className="pdf-page-grid-title">
              {translate("workspace.pageGrid.title")} ({pages.length}{" "}
              {pages.length === 1 ? "página" : "páginas"})
            </h3>
            <p className="pdf-page-grid-hint">
              {mode === "organize"
                ? translate("workspace.pageGrid.hint")
                : translate("workspace.pageGrid.extractHint")}
            </p>
          </div>
        </div>

        <div className="pdf-page-grid-actions">
          {mode === "organize" ? (
            <>
              <Button
                variant="ghost"
                size="compact"
                onClick={onRotateAll}
                title="Girar todas as páginas em 90 graus"
              >
                <RotateCw size={14} />
                <span>Girar Todas</span>
              </Button>
              {onResetOrder && (
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={onResetOrder}
                  title="Restaurar ordem original das páginas"
                >
                  <ArrowLeftRight size={14} />
                  <span>Restaurar Ordem</span>
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="compact"
                onClick={handleSelectAll}
                title="Selecionar todas as páginas"
              >
                <CheckSquare size={14} />
                <span>{translate("workspace.pageGrid.selectAll")}</span>
              </Button>
              <Button
                variant="ghost"
                size="compact"
                onClick={handleClearSelection}
                title="Limpar seleção"
              >
                <Square size={14} />
                <span>{translate("workspace.pageGrid.clearSelection")}</span>
              </Button>
              <Button
                variant="ghost"
                size="compact"
                onClick={handleInvertSelection}
                title="Inverter seleção de páginas"
              >
                <ArrowLeftRight size={14} />
                <span>Inverter</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Se for modo Extrator, exibe barra de intervalo digitado e contador */}
      {mode === "extract" && (
        <div className="pdf-page-extract-bar">
          <div className="pdf-page-extract-input-group">
            <label htmlFor="extract-range-input">Intervalo de páginas:</label>
            <input
              id="extract-range-input"
              type="text"
              placeholder="Ex: 1-3, 5, 8-10"
              value={rangeInput}
              onChange={handleRangeChange}
              className="pdf-page-range-input"
            />
          </div>
          <div className="pdf-page-extract-badge">
            <strong>{selectedIndices.length}</strong> de <strong>{pages.length}</strong>{" "}
            {translate("workspace.pageGrid.selectedCount")}
          </div>
        </div>
      )}

      {/* Grade Visual de Miniaturas */}
      <div className="pdf-page-cards-grid">
        {pages.map((page, index) => {
          const isSelected = mode === "extract" && selectedIndices.includes(page.originalIndex);
          const thumbUrl = createSvgPageThumbnail(page.originalIndex, page.rotation, totalPages);

          if (mode === "extract") {
            return (
              <button
                type="button"
                key={page.id}
                className={`pdf-page-card ${isSelected ? "pdf-page-card--selected" : ""}`}
                onClick={() => handleToggleSelect(page.originalIndex)}
              >
                {/* Badge de número / checkbox */}
                <div className="pdf-page-card-header">
                  <span className="pdf-page-badge">Pág. {page.originalIndex}</span>
                  <div
                    className={`pdf-page-checkbox ${isSelected ? "pdf-page-checkbox--checked" : ""}`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>

                {/* Prévia da Página */}
                <div className="pdf-page-card-preview">
                  <img
                    src={thumbUrl}
                    alt={`Miniatura página ${page.originalIndex}`}
                    className="pdf-page-thumbnail-img"
                    style={{
                      transform: `rotate(${page.rotation}deg)`,
                      transition: "transform 0.2s ease-in-out",
                    }}
                  />
                </div>
              </button>
            );
          }

          return (
            <div key={page.id} className="pdf-page-card">
              {/* Badge de número */}
              <div className="pdf-page-card-header">
                <span className="pdf-page-badge">Pág. {index + 1}</span>
              </div>

              {/* Prévia da Página */}
              <div className="pdf-page-card-preview">
                <img
                  src={thumbUrl}
                  alt={`Miniatura página ${page.originalIndex}`}
                  className="pdf-page-thumbnail-img"
                  style={{
                    transform: `rotate(${page.rotation}deg)`,
                    transition: "transform 0.2s ease-in-out",
                  }}
                />
              </div>

              {/* Botões de Ação na Miniatura (apenas no modo organizar) */}
              {mode === "organize" && (
                <div className="pdf-page-card-toolbar">
                  <button
                    type="button"
                    className="pdf-page-tool-btn"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMove(index, "left");
                    }}
                    title={translate("workspace.pageGrid.moveLeft")}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    className="pdf-page-tool-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRotate(index);
                    }}
                    title={translate("workspace.pageGrid.rotate")}
                  >
                    <RotateCw size={14} />
                  </button>
                  <button
                    type="button"
                    className="pdf-page-tool-btn pdf-page-tool-btn--danger"
                    disabled={pages.length <= 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(index);
                    }}
                    title={translate("workspace.pageGrid.delete")}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    className="pdf-page-tool-btn"
                    disabled={index === pages.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMove(index, "right");
                    }}
                    title={translate("workspace.pageGrid.moveRight")}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
