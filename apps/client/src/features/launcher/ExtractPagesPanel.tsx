import { Archive, Check, FileCheck2, FileOutput, Layers, X } from "lucide-react";
import { type ChangeEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { createSvgPageThumbnail } from "@/platform/browser-pdf-utils";
import { parsePageRange } from "./page-range-input";

export interface ExtractPagesPanelProps {
  readonly onRangeValidityChange?: (valid: boolean) => void;
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly pageThumbnails?: readonly string[];
  readonly selectedPages: readonly number[];
  readonly onSelectedPagesChange: (pages: number[]) => void;
  readonly mode: "single-pdf" | "zip-split";
  readonly onModeChange: (mode: "single-pdf" | "zip-split") => void;
}

export function ExtractPagesPanel({
  onRangeValidityChange,
  fileName,
  fileSizeBytes,
  totalPages,
  pageThumbnails = [],
  selectedPages,
  onSelectedPagesChange,
  mode,
  onModeChange,
}: ExtractPagesPanelProps) {
  const [rangeInput, setRangeInput] = useState("");
  const [rangeValid, setRangeValid] = useState(true);
  function selectPages(pages: number[]) {
    setRangeInput("");
    setRangeValid(true);
    onRangeValidityChange?.(true);
    onSelectedPagesChange(pages);
  }
  const selectedSet = useMemo(() => new Set(selectedPages), [selectedPages]);

  function togglePage(pageNum: number) {
    if (selectedSet.has(pageNum)) {
      selectPages(selectedPages.filter((p) => p !== pageNum));
    } else {
      selectPages([...selectedPages, pageNum].sort((a, b) => a - b));
    }
  }

  function handleRangeChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setRangeInput(val);
    const parsed = parsePageRange(val, totalPages);
    setRangeValid(parsed.valid);
    onRangeValidityChange?.(parsed.valid);
    onSelectedPagesChange(parsed.pages);
  }

  function handleSelectAll() {
    const all = Array.from({ length: totalPages }, (_, i) => i + 1);
    selectPages(all);
  }

  function handleDeselectAll() {
    setRangeInput("");
    selectPages([]);
  }

  function handleSelectEven() {
    const evens: number[] = [];
    for (let i = 2; i <= totalPages; i += 2) evens.push(i);
    selectPages(evens);
  }

  function handleSelectOdd() {
    const odds: number[] = [];
    for (let i = 1; i <= totalPages; i += 2) odds.push(i);
    selectPages(odds);
  }

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-4 sm:p-6"
      data-testid="extract-pages-panel"
    >
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <FileOutput className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{fileName}</h2>
            {!rangeValid && (
              <p id="page-range-error" role="alert">
                {translate("pages.invalidRange")}
              </p>
            )}
            <p className="text-xs text-text-tertiary">
              {totalPages} {totalPages === 1 ? "página" : "páginas"} •{" "}
              {(fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        </div>

        <span
          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
            selectedSet.size > 0
              ? "bg-orange-500/10 text-orange-600 border-orange-500/30 dark:bg-orange-950/40 dark:text-orange-300"
              : "bg-surface-secondary text-text-secondary border-border"
          }`}
        >
          {translate("extractPages.selectedCount").replace("{count}", String(selectedSet.size))}
        </span>
      </div>

      {/* Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onModeChange("single-pdf")}
          className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
            mode === "single-pdf"
              ? "bg-orange-500/10 border-orange-500/60 shadow-xs dark:bg-orange-950/30"
              : "bg-surface border-border hover:border-orange-500/40"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              mode === "single-pdf"
                ? "bg-orange-500 text-white"
                : "bg-surface-secondary text-text-secondary"
            }`}
          >
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">
                {translate("extractPages.modeSingle")}
              </span>
              {mode === "single-pdf" && (
                <Check className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              )}
            </div>
            <p className="text-xs text-text-tertiary mt-1">
              Junta todas as páginas selecionadas em um novo arquivo PDF consolidado.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onModeChange("zip-split")}
          className={`flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
            mode === "zip-split"
              ? "bg-orange-500/10 border-orange-500/60 shadow-xs dark:bg-orange-950/30"
              : "bg-surface border-border hover:border-orange-500/40"
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              mode === "zip-split"
                ? "bg-orange-500 text-white"
                : "bg-surface-secondary text-text-secondary"
            }`}
          >
            <Archive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-text-primary">
                {translate("extractPages.modeZip")}
              </span>
              {mode === "zip-split" && (
                <Check className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              )}
            </div>
            <p className="text-xs text-text-tertiary mt-1">
              Exporta cada página selecionada como um PDF individual agrupado em um arquivo ZIP.
            </p>
          </div>
        </button>
      </div>

      {/* Toolbar Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-xl bg-surface-secondary/50 border border-border">
        {/* Quick range input */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <label
            htmlFor="quick-extract-range"
            className="text-xs font-medium text-text-secondary whitespace-nowrap"
          >
            {translate("extractPages.quickRangeLabel")}:
          </label>
          <input
            id="quick-extract-range"
            aria-invalid={!rangeValid}
            aria-describedby={!rangeValid ? "page-range-error" : undefined}
            type="text"
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-hidden focus:ring-2 focus:ring-orange-500/40"
            placeholder={translate("extractPages.quickRangePlaceholder")}
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
            onClick={handleSelectAll}
            className="text-xs h-8"
          >
            {translate("extractPages.selectAll")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={handleSelectEven}
            className="text-xs h-8"
          >
            {translate("extractPages.evenPages")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={handleSelectOdd}
            className="text-xs h-8"
          >
            {translate("extractPages.oddPages")}
          </Button>
          {selectedSet.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={handleDeselectAll}
              className="text-xs h-8 text-text-tertiary hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              {translate("extractPages.deselectAll")}
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-text-tertiary">{translate("extractPages.instruction")}</p>

      {/* Pages Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: totalPages }, (_, i) => {
          const pageNum = i + 1;
          const isSelected = selectedSet.has(pageNum);
          const thumbUrl = pageThumbnails[i] || createSvgPageThumbnail(pageNum, 0);

          return (
            <button
              type="button"
              key={`extract-page-${pageNum}`}
              aria-pressed={isSelected}
              data-testid={`extract-page-${pageNum}`}
              onClick={() => togglePage(pageNum)}
              className={`group relative flex flex-col items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none text-left w-full ${
                isSelected
                  ? "bg-orange-500/10 border-orange-500/60 dark:bg-orange-950/30 dark:border-orange-500/70 shadow-xs"
                  : "bg-surface border-border hover:border-orange-500/40 hover:shadow-xs"
              }`}
            >
              {/* Header Badge */}
              <div className="w-full flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isSelected
                      ? "bg-orange-500 text-white"
                      : "bg-surface-secondary text-text-secondary"
                  }`}
                >
                  Pág. {pageNum}
                </span>

                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-orange-500 text-white"
                      : "border border-border text-transparent group-hover:text-text-tertiary"
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Thumbnail Container */}
              <div className="relative w-full aspect-[1/1.414] rounded-lg overflow-hidden border border-border/60 bg-white flex items-center justify-center">
                <img
                  src={thumbUrl}
                  alt={`Miniatura da página ${pageNum}`}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />

                {isSelected && (
                  <div className="absolute inset-0 flex items-center justify-center bg-orange-600/10 pointer-events-none">
                    <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-md">
                      <FileCheck2 className="w-4 h-4" />
                    </div>
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
