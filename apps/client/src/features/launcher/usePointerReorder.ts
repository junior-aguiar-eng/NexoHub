import { useCallback, useEffect, useRef, useState } from "react";

interface UsePointerReorderOptions {
  readonly enabled?: boolean;
  readonly onReorder: (fromIndex: number, toIndex: number) => void;
}

interface PointerDragState {
  readonly fromIndex: number;
  readonly startX: number;
  readonly startY: number;
  readonly active: boolean;
}

const DRAG_THRESHOLD_PX = 6;

const INTERACTIVE_SELECTOR =
  'button, input, select, textarea, a, [role="button"], [data-no-drag="true"]';

/**
 * Reordenação de cards por Pointer Events (funciona no navegador e no Tauri WebView2)
 * mantendo compatibilidade com eventos HTML5 Drag & Drop para acessibilidade e testes.
 */
export function usePointerReorder({ enabled = true, onReorder }: UsePointerReorderOptions) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const pointerStateRef = useRef<PointerDragState | null>(null);
  const draggedIndexRef = useRef<number | null>(null);
  const dragOverIndexRef = useRef<number | null>(null);
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const resetDrag = useCallback(() => {
    pointerStateRef.current = null;
    draggedIndexRef.current = null;
    dragOverIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  useEffect(() => {
    function findTargetIndex(clientX: number, clientY: number): number | null {
      if (typeof document.elementsFromPoint !== "function") return null;
      const elements = document.elementsFromPoint(clientX, clientY);
      for (const el of elements) {
        if (!(el instanceof HTMLElement)) continue;
        const card = el.closest<HTMLElement>("[data-reorder-index]");
        if (card) {
          const parsed = Number.parseInt(card.dataset.reorderIndex ?? "", 10);
          if (!Number.isNaN(parsed)) return parsed;
        }
      }
      return null;
    }

    function handlePointerMove(e: PointerEvent) {
      const current = pointerStateRef.current;
      if (!current) return;

      if (!current.active) {
        const dx = e.clientX - current.startX;
        const dy = e.clientY - current.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        pointerStateRef.current = { ...current, active: true };
        draggedIndexRef.current = current.fromIndex;
        setDraggedIndex(current.fromIndex);
      }

      const targetIndex = findTargetIndex(e.clientX, e.clientY);
      if (targetIndex !== dragOverIndexRef.current) {
        dragOverIndexRef.current = targetIndex;
        setDragOverIndex(targetIndex);
      }
    }

    function handlePointerUp() {
      const current = pointerStateRef.current;
      if (!current) return;

      if (current.active) {
        const target = dragOverIndexRef.current;
        if (target !== null && target !== current.fromIndex) {
          onReorderRef.current(current.fromIndex, target);
        }
      }
      resetDrag();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [resetDrag]);

  const getItemProps = useCallback(
    (index: number, itemEnabled = true) => {
      const canDrag = enabled && itemEnabled;
      return {
        "data-reorder-index": index,
        draggable: false,
        onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
          if (!canDrag || e.button !== 0) return;
          const target = e.target;
          if (target instanceof Element && target.closest(INTERACTIVE_SELECTOR)) return;
          e.preventDefault();
          pointerStateRef.current = {
            fromIndex: index,
            startX: e.clientX,
            startY: e.clientY,
            active: false,
          };
        },
        onDragStart: (e: React.DragEvent<HTMLElement>) => {
          if (!canDrag) {
            e.preventDefault();
            return;
          }
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(index));
          }
          draggedIndexRef.current = index;
          setDraggedIndex(index);
        },
        onDragOver: (e: React.DragEvent<HTMLElement>) => {
          if (!canDrag) return;
          e.preventDefault();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
          }
          if (dragOverIndexRef.current !== index) {
            dragOverIndexRef.current = index;
            setDragOverIndex(index);
          }
        },
        onDrop: (e: React.DragEvent<HTMLElement>) => {
          if (!canDrag) return;
          e.preventDefault();
          const from = draggedIndexRef.current;
          if (from !== null && from !== index) {
            onReorderRef.current(from, index);
          }
          resetDrag();
        },
        onDragEnd: () => {
          resetDrag();
        },
      };
    },
    [enabled, resetDrag],
  );

  return {
    draggedIndex,
    dragOverIndex,
    getItemProps,
  };
}
