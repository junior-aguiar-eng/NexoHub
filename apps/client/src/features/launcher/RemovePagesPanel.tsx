import { AlertTriangle, FileX2, Trash2, Undo2, X } from "lucide-react";
import { type ChangeEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { createSvgPageThumbnail } from "@/platform/browser-pdf-utils";

export interface RemovePagesPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly pageThumbnails?: readonly string[];
  readonly pagesToRemove: readonly number[];
  readonly onPagesToRemoveChange: (pages: number[]) => void;
}

function parseRanges(input: string, maxPages: number): number[] {
  const pages = new Set<number>();
  if (!input.trim() || !Number.isSafeInteger(maxPages) || maxPages < 1) return [];
  for (const part of input.split(",").map((value) => value.trim())) {
    if (!/^\d+(?:\s*-\s*\d+)?$/.test(part)) continue;
    const [first, last = first] = part.split("-").map(Number);
    if (![first, last].every((p) => Number.isSafeInteger(p) && p >= 1 && p <= maxPages)) continue;
    for (let p = Math.min(first, last); p <= Math.max(first, last); p++) {
      pages.add(p);
    }
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export function RemovePagesPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  pageThumbnails = [],
  pagesToRemove,
  onPagesToRemoveChange,
}: RemovePagesPanelProps) {
  const [rangeInput, setRangeInput] = useState("");
  const removeSet = useMemo(() => new Set(pagesToRemove), [pagesToRemove]);
  const remainingCount = Math.max(0, totalPages - removeSet.size);
  const isAllSelected = totalPages > 0 && removeSet.size >= totalPages;

  function togglePage(pageNum: number) {
    if (removeSet.has(pageNum)) {
      onPagesToRemoveChange(pagesToRemove.filter((p) => p !== pageNum));
    } else {
      onPagesToRemoveChange([...pagesToRemove, pageNum].sort((a, b) => a - b));
    }
  }

  function handleRangeChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setRangeInput(val);
    const parsed = parseRanges(val, totalPages);
    if (parsed.length > 0) {
      onPagesToRemoveChange(parsed);
    }
  }

  function handleSelectEven() {
    const evens: number[] = [];
    for (let i = 2; i <= totalPages; i += 2) evens.push(i);
    onPagesToRemoveChange(evens);
  }

  function handleSelectOdd() {
    const odds: number[] = [];
    for (let i = 1; i <= totalPages; i += 2) odds.push(i);
    onPagesToRemoveChange(odds);
  }

  function handleInvert() {
    const inverted: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (!removeSet.has(i)) inverted.push(i);
    }
    onPagesToRemoveChange(inverted);
  }

  function handleClear() {
    setRangeInput("");
    onPagesToRemoveChange([]);
  }

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-4 sm:p-6"
      data-testid="remove-pages-panel"
    >
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
            <FileX2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{fileName}</h2>
            <p className="text-xs text-text-tertiary">
              {totalPages} {totalPages === 1 ? "página" : "páginas"} •{" "}
              {(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              isAllSelected
                ? "bg-red-500/10 text-red-600 border-red-500/30 dark:bg-red-950/40 dark:text-red-300"
                : removeSet.size > 0
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300"
                  : "bg-surface-secondary text-text-secondary border-border"
            }`}
          >
            {translate("removePages.selectedCount").replace("{count}", String(removeSet.size))}
          </span>
          <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-surface-secondary text-text-tertiary border border-border">
            {translate("removePages.remainingCount").replace("{count}", String(remainingCount))}
          </span>
        </div>
      </div>

      {isAllSelected && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{translate("removePages.cannotRemoveAll")}</span>
        </div>
      )}

      {/* Toolbar Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-surface-secondary/50 border border-border">
        {/* Quick range input */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <label
            htmlFor="quick-remove-range"
            className="text-xs font-medium text-text-secondary whitespace-nowrap"
          >
            {translate("removePages.quickRangeLabel")}:
          </label>
          <input
            id="quick-remove-range"
            type="text"
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-hidden focus:ring-2 focus:ring-red-500/40"
            placeholder={translate("removePages.quickRangePlaceholder")}
            value={rangeInput}
            onChange={handleRangeChange}
          />
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={handleSelectEven}
            className="text-xs h-8"
          >
            {translate("removePages.evenPages")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={handleSelectOdd}
            className="text-xs h-8"
          >
            {translate("removePages.oddPages")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={handleInvert}
            className="text-xs h-8"
          >
            <Undo2 className="w-3.5 h-3.5 mr-1" />
            {translate("removePages.invertSelection")}
          </Button>
          {removeSet.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={handleClear}
              className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              {translate("removePages.clearSelection")}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-text-tertiary">{translate("removePages.instruction")}</p>

      {/* Pages Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: totalPages }, (_, i) => {
          const pageNum = i + 1;
          const isMarked = removeSet.has(pageNum);
          const thumbUrl = pageThumbnails[i] || createSvgPageThumbnail(pageNum, 0);

          return (
            <button
              type="button"
              key={`page-card-${pageNum}`}
              data-testid={`page-card-${pageNum}`}
              onClick={() => togglePage(pageNum)}
              className={`group relative flex flex-col items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none text-left w-full ${
                isMarked
                  ? "bg-red-500/10 border-red-500/50 dark:bg-red-950/30 dark:border-red-500/60 shadow-xs"
                  : "bg-surface border-border hover:border-red-500/40 hover:shadow-xs"
              }`}
            >
              {/* Header Badge */}
              <div className="w-full flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isMarked ? "bg-red-500 text-white" : "bg-surface-secondary text-text-secondary"
                  }`}
                >
                  Pág. {pageNum}
                </span>

                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                    isMarked
                      ? "bg-red-500 text-white"
                      : "text-text-tertiary hover:text-red-600 hover:bg-red-500/10"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Thumbnail Container */}
              <div className="relative w-full aspect-[1/1.414] rounded-lg overflow-hidden border border-border/60 bg-white flex items-center justify-center">
                <img
                  src={thumbUrl}
                  alt={`Miniatura da página ${pageNum}`}
                  className={`w-full h-full object-contain transition-opacity duration-200 ${
                    isMarked ? "opacity-30 grayscale" : "opacity-100"
                  }`}
                  loading="lazy"
                />

                {isMarked && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-600/20 backdrop-blur-[1px]">
                    <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-300 mt-1 uppercase tracking-wider bg-white/90 dark:bg-black/90 px-2 py-0.5 rounded">
                      Remover
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
