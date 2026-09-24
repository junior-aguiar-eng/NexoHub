import {
  ArrowLeftRight,
  Check,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Trash2,
  Undo2,
} from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { createSvgPageThumbnail } from "@/platform/browser-pdf-utils";

export type PdfPageItem = {
  id: string;
  originalIndex: number;
  rotation: number;
  deleted?: boolean;
};

type PdfPageGridPanelProps = {
  mode: "organize" | "extract";
  totalPages: number;
  pages: PdfPageItem[];
  selectedIndices: number[];
  realThumbnails?: string[];
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
  realThumbnails,
  onPagesChange,
  onSelectedIndicesChange,
  onRotateAll,
  onResetOrder,
}: PdfPageGridPanelProps) {
  const [rangeInput, setRangeInput] = useState<string>("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Arrastar e soltar nativo e responsivo
  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(targetIndex: number) {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const newPages = [...pages];
    const [moved] = newPages.splice(draggedIndex, 1);
    newPages.splice(targetIndex, 0, moved);
    onPagesChange?.(newPages);
    setDraggedIndex(null);
  }

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

  function handleToggleDelete(index: number) {
    const newPages = pages.map((page, i) => {
      if (i === index) {
        return { ...page, deleted: !page.deleted };
      }
      return page;
    });
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
    onSelectedIndicesChange?.(Array.from(parsedIndices).sort((a, b) => a - b));
  }

  const activePagesCount = pages.filter((p) => !p.deleted).length;
  const deletedPagesCount = pages.filter((p) => p.deleted).length;

  return (
    <div className="pdf-page-grid-panel">
      {/* Barra de Ações Rápidas no Topo */}
      <div className="pdf-page-grid-toolbar">
        <div className="pdf-page-grid-stats">
          <span className="pdf-page-grid-title">Organização Visual de Páginas</span>
          <span className="pdf-page-grid-counter">
            {activePagesCount} de {totalPages} página(s) ativas
            {deletedPagesCount > 0 && ` (${deletedPagesCount} excluída(s))`}
          </span>
        </div>

        <div className="pdf-page-grid-actions">
          {mode === "organize" ? (
            <>
              <Button variant="ghost" size="compact" onClick={onRotateAll}>
                <RotateCw size={14} />
                <span>Girar Todas</span>
              </Button>
              <Button variant="ghost" size="compact" onClick={onResetOrder}>
                <ArrowLeftRight size={14} />
                <span>Restaurar Ordem</span>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="compact" onClick={handleSelectAll}>
                <Check size={14} />
                <span>{translate("workspace.pageGrid.selectAll")}</span>
              </Button>
              <Button variant="ghost" size="compact" onClick={handleClearSelection}>
                <span>{translate("workspace.pageGrid.clearSelection")}</span>
              </Button>
              <Button variant="ghost" size="compact" onClick={handleInvertSelection}>
                <ArrowLeftRight size={14} />
                <span>Inverter</span>
              </Button>
            </>
          )}
        </div>
      </div>

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

      {/* Grade Visual de Miniaturas com Drag & Drop */}
      <div className="pdf-page-cards-grid">
        {pages.map((page, index) => {
          const isSelected = mode === "extract" && selectedIndices.includes(page.originalIndex);
          const realThumb = realThumbnails?.[page.originalIndex - 1];
          const thumbUrl =
            realThumb || createSvgPageThumbnail(page.originalIndex, page.rotation, totalPages);
          const isDeleted = Boolean(page.deleted);

          if (mode === "extract") {
            return (
              <button
                type="button"
                key={page.id}
                className={`pdf-page-card ${isSelected ? "pdf-page-card--selected" : ""}`}
                onClick={() => handleToggleSelect(page.originalIndex)}
              >
                <div className="pdf-page-card-header">
                  <span className="pdf-page-badge">Pág. {page.originalIndex}</span>
                  <div
                    className={`pdf-page-checkbox ${isSelected ? "pdf-page-checkbox--checked" : ""}`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </div>

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
            // biome-ignore lint/a11y/noStaticElementInteractions: card de arrastar e soltar para reorganização de páginas
            <div
              key={page.id}
              className={`pdf-page-card ${isDeleted ? "pdf-page-card--deleted" : ""}`}
              draggable={!isDeleted}
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
            >
              <div className="pdf-page-card-header">
                <span className="pdf-page-badge">
                  {isDeleted
                    ? `Pág. ${page.originalIndex} (Excluída)`
                    : `Pág. ${page.originalIndex}`}
                </span>
              </div>

              <div className="pdf-page-card-preview">
                <img
                  src={thumbUrl}
                  alt={`Miniatura página ${page.originalIndex}`}
                  className="pdf-page-thumbnail-img"
                  style={{
                    transform: `rotate(${page.rotation}deg)`,
                    transition: "transform 0.2s ease-in-out",
                    opacity: isDeleted ? 0.35 : 1,
                  }}
                />

                {isDeleted && (
                  <div className="pdf-page-deleted-overlay">
                    <span className="pdf-page-deleted-text">Página Excluída</span>
                    <button
                      type="button"
                      className="pdf-page-undo-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleDelete(index);
                      }}
                    >
                      <Undo2 size={13} />
                      <span>Desfazer</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="pdf-page-card-toolbar">
                {!isDeleted ? (
                  <>
                    <button
                      type="button"
                      className="pdf-page-tool-btn"
                      disabled={index === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMove(index, "left");
                      }}
                      title="Mover para esquerda"
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
                      title="Girar 90°"
                    >
                      <RotateCw size={14} />
                    </button>
                    <button
                      type="button"
                      className="pdf-page-tool-btn pdf-page-tool-btn--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleDelete(index);
                      }}
                      title="Excluir esta página"
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
                      title="Mover para direita"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="pdf-page-tool-btn pdf-page-tool-btn--undo-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleDelete(index);
                    }}
                  >
                    <Undo2 size={13} />
                    <span>Recuperar página</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
