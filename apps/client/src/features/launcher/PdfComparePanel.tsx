import { ToolRunError } from "@nexohub/tool-sdk";
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  FileDiff,
  FileUp,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { type UIEvent, useEffect, useId, useRef, useState } from "react";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";
import { type LauncherToolOutput, runLauncherTool } from "@/platform/launcher-tool-runner";
import type { PdfComparisonPair, PdfComparisonProgress } from "@/platform/pdf-comparison-types";
import "./PdfComparePanel.css";

export interface PdfComparePanelProps {
  readonly documentCore: DocumentCorePort;
  readonly onBack: () => void;
  readonly initialFiles?: readonly File[];
}
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const isPdf = (file: File) => /\.pdf$/i.test(file.name) || file.type === "application/pdf";
const phaseKeys = {
  reading: "pdfCompare.reading",
  aligning: "pdfCompare.aligning",
  comparing: "pdfCompare.comparing",
  done: "pdfCompare.done",
} as const;
const statusKeys = {
  unchanged: "pdfCompare.unchanged",
  modified: "pdfCompare.modified",
  added: "pdfCompare.added",
  removed: "pdfCompare.removed",
} as const;

export function PdfComparePanel({ documentCore, onBack, initialFiles = [] }: PdfComparePanelProps) {
  const [files, setFiles] = useState<readonly (File | undefined)[]>(() =>
    initialFiles
      .slice(0, 2)
      .map((file) => (isPdf(file) && file.size <= MAX_FILE_BYTES ? file : undefined)),
  );
  const [output, setOutput] = useState<LauncherToolOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PdfComparisonProgress>({
    phase: "reading",
    progress: 0,
  });
  const [mode, setMode] = useState<"text" | "visual">("text");
  const [selected, setSelected] = useState(0);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [sync, setSync] = useState(true);
  const [overlay, setOverlay] = useState(false);
  const [opacity, setOpacity] = useState(0.5);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const panes = useRef<(HTMLElement | null)[]>([]);
  const syncing = useRef(false);
  const id = useId();
  useEffect(
    () => () => {
      generation.current += 1;
      controller.current?.abort();
    },
    [],
  );
  const result = output?.comparison;
  const pair = result?.pairs[selected];
  const canOverlay = !!pair?.leftImage && !!pair?.rightImage;
  const activeOverlay = overlay && canOverlay;
  const textAvailable = !!result?.leftHasText && !!result.rightHasText;
  const changes =
    result?.pairs.filter(
      (item) =>
        (item.status === "added" ||
          item.status === "removed" ||
          (mode === "text" ? item.textChanged : item.visualChanged || item.geometryChanged)) &&
        `${item.leftText}\n${item.rightText}`
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
    ) ?? [];
  function invalidate() {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setOutput(null);
    setMessage(null);
    setError(null);
    setSelected(0);
  }
  function replace(side: number, file: File | undefined) {
    if (!file) return;
    invalidate();
    setFiles((current) => {
      const next = [...current];
      next[side] = isPdf(file) && file.size <= MAX_FILE_BYTES ? file : undefined;
      return next;
    });
    if (!isPdf(file)) setError(translate("pdfCompare.invalidFile"));
    else if (file.size > MAX_FILE_BYTES) setError(translate("pdfCompare.fileTooLarge"));
  }
  async function compare() {
    const [left, right] = files;
    if (!left || !right) return;
    invalidate();
    const token = generation.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setProgress({ phase: "reading", progress: 0 });
    try {
      const next = await runLauncherTool(documentCore, "pdf-compare", {
        files: [left, right],
        splitMode: "interval",
        splitIntervals: [],
        mergeIntervals: false,
        selectedPages: [],
        pages: [],
        rotateAngle: 0,
        compressionLevel: "recommended",
        firstText: "",
        secondText: "",
        comparisonSignal: abort.signal,
        onComparisonProgress: (info) => {
          if (token === generation.current && !abort.signal.aborted) setProgress(info);
        },
      });
      if (token !== generation.current || abort.signal.aborted) return;
      if (!next.comparison) throw new Error("COMPARISON_RESULT_MISSING");
      setOutput(next);
      setMode(next.comparison.leftHasText && next.comparison.rightHasText ? "text" : "visual");
      setSearch("");
    } catch (cause) {
      if (token === generation.current && !abort.signal.aborted)
        setError(cause instanceof ToolRunError ? cause.message : translate("pdfCompare.error"));
    } finally {
      if (token === generation.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  async function download(blob: Blob, fileName: string) {
    try {
      if (documentCore.saveOutputFile) {
        await documentCore.saveOutputFile({ blob, fileName });
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(translate("pdfCompare.error"));
    }
  }
  function syncScroll(event: UIEvent<HTMLElement>, side: number) {
    if (!sync || syncing.current) return;
    const other = panes.current[side === 0 ? 1 : 0];
    if (!other) return;
    syncing.current = true;
    const source = event.currentTarget;
    other.scrollTop =
      (source.scrollTop / Math.max(1, source.scrollHeight - source.clientHeight)) *
      (other.scrollHeight - other.clientHeight);
    other.scrollLeft =
      (source.scrollLeft / Math.max(1, source.scrollWidth - source.clientWidth)) *
      (other.scrollWidth - other.clientWidth);
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }
  function pageLabel(item: PdfComparisonPair) {
    return `${translate("pdfCompare.page")} ${item.leftPage ?? "—"} ↔ ${item.rightPage ?? "—"}`;
  }
  function renderImage(image: string | undefined, label: string) {
    return image ? (
      <img src={image} alt={label} draggable={false} />
    ) : (
      <p>{translate("pdfCompare.previewUnavailable")}</p>
    );
  }
  return (
    <section className="pdf-compare" aria-labelledby={`${id}-title`}>
      <button
        type="button"
        className="pdf-compare-back"
        onClick={() => {
          invalidate();
          onBack();
        }}
      >
        <ArrowLeft size={18} />
        {translate("pdfCompare.back")}
      </button>
      <header className="pdf-compare-heading">
        <span className="pdf-compare-emblem">
          <FileDiff size={30} />
        </span>
        <h1 id={`${id}-title`}>{translate("pdfCompare.title")}</h1>
        <p>{translate("pdfCompare.subtitle")}</p>
        <span className="pdf-compare-local">
          <ShieldCheck size={16} />
          {translate("pdfCompare.local")}
        </span>
      </header>
      <div className="pdf-compare-upload-row">
        {(["pdfCompare.original", "pdfCompare.revised"] as const).map((key, side) => (
          <section
            aria-label={`${translate(key)}: ${translate("pdfCompare.choose")}`}
            key={key}
            className="pdf-compare-slot"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              replace(side, event.dataTransfer.files[0]);
            }}
          >
            <label htmlFor={`${id}-file-${side}`}>
              <span className="pdf-compare-slot-title">{translate(key)}</span>
              <FileUp size={30} />
              <strong title={files[side]?.name}>
                {files[side]?.name ?? translate("pdfCompare.choose")}
              </strong>
              <span>{files[side] ? translate("pdfCompare.replace") : "PDF"}</span>
            </label>
            <input
              id={`${id}-file-${side}`}
              type="file"
              aria-label={translate(key)}
              accept=".pdf,application/pdf"
              onChange={(event) => {
                replace(side, event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </section>
        ))}
      </div>
      <p className="pdf-compare-note">{translate("pdfCompare.limits")}</p>
      <div className="pdf-compare-actions">
        <button
          type="button"
          onClick={() => {
            invalidate();
            setFiles([files[1], files[0]]);
          }}
          disabled={!files[0] && !files[1]}
        >
          <ArrowLeftRight size={18} />
          {translate("pdfCompare.swap")}
        </button>
        <button
          type="button"
          className="pdf-compare-primary"
          disabled={!files[0] || !files[1] || busy}
          onClick={() => void compare()}
        >
          {translate("pdfCompare.run")}
        </button>
        {busy && (
          <button
            type="button"
            onClick={() => {
              invalidate();
              setMessage(translate("pdfCompare.cancelled"));
            }}
          >
            {translate("pdfCompare.cancel")}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="pdf-compare-warning">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {busy && (
        <div className="pdf-compare-progress" role="status">
          <span>{translate(phaseKeys[progress.phase])}</span>
          <progress
            max={100}
            value={progress.progress}
            aria-label={translate(phaseKeys[progress.phase])}
          />
          <span>{Math.round(progress.progress)}%</span>
        </div>
      )}
      {result && (
        <div className="pdf-compare-results">
          {!textAvailable && (
            <p role="status" className="pdf-compare-warning">
              {translate("pdfCompare.scanned")}
            </p>
          )}
          <p className="pdf-compare-note">{translate("pdfCompare.alignmentNotice")}</p>
          <div className="pdf-compare-toolbar">
            <div className="pdf-compare-modes">
              {(["text", "visual"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  disabled={value === "text" && !textAvailable}
                  onClick={() => setMode(value)}
                >
                  {translate(value === "text" ? "pdfCompare.text" : "pdfCompare.visual")}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => void download(output.blob, output.fileName)}>
              <Download size={16} />
              {translate("pdfCompare.report")}
            </button>
            {output.secondaryBlob && (
              <button
                type="button"
                onClick={() =>
                  output.secondaryBlob &&
                  void download(output.secondaryBlob, output.secondaryFileName ?? "comparacao.json")
                }
              >
                {translate("pdfCompare.json")}
              </button>
            )}
          </div>
          <div className="pdf-compare-workspace">
            <aside className="pdf-compare-changes" aria-label={translate("pdfCompare.changes")}>
              <h2>
                {translate("pdfCompare.changes")} <span>{changes.length}</span>
              </h2>
              <input
                type="search"
                aria-label={translate("pdfCompare.search")}
                placeholder={translate("pdfCompare.search")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <div className="pdf-compare-change-list">
                {changes.map((item) => (
                  <button
                    key={item.index}
                    type="button"
                    aria-current={pair?.index === item.index ? "true" : undefined}
                    onClick={() => setSelected(result.pairs.indexOf(item))}
                  >
                    <strong>{pageLabel(item)}</strong>
                    <span className={`pdf-compare-status--${item.status}`}>
                      {translate(statusKeys[item.status])}
                    </span>
                  </button>
                ))}
                {changes.length === 0 && <p>{translate("pdfCompare.noChanges")}</p>}
              </div>
            </aside>
            <div className="pdf-compare-view">
              <nav className="pdf-compare-pager" aria-label={translate("pdfCompare.pair")}>
                <button
                  type="button"
                  aria-label={translate("pdfCompare.previous")}
                  disabled={selected === 0}
                  onClick={() => setSelected((value) => value - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {translate("pdfCompare.pair")} {selected + 1} {translate("pdfCompare.of")}{" "}
                  {result.pairs.length}
                </span>
                <button
                  type="button"
                  aria-label={translate("pdfCompare.next")}
                  disabled={selected >= result.pairs.length - 1}
                  onClick={() => setSelected((value) => value + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </nav>
              {mode === "visual" && (
                <div className="pdf-compare-visual-tools">
                  <button
                    type="button"
                    aria-label={translate("pdfCompare.zoomOut")}
                    disabled={zoom <= 0.5}
                    onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
                  >
                    <Minus size={16} />
                  </button>
                  <output aria-live="polite">{Math.round(zoom * 100)}%</output>
                  <button
                    type="button"
                    aria-label={translate("pdfCompare.zoomIn")}
                    disabled={zoom >= 2}
                    onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
                  >
                    <Plus size={16} />
                  </button>
                  <label>
                    <input
                      type="checkbox"
                      checked={sync}
                      onChange={(event) => setSync(event.target.checked)}
                    />
                    {translate("pdfCompare.sync")}
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={activeOverlay}
                      disabled={!canOverlay}
                      onChange={(event) => setOverlay(event.target.checked)}
                    />
                    {translate("pdfCompare.overlay")}
                  </label>
                  {activeOverlay && (
                    <label>
                      {translate("pdfCompare.opacity")}
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={opacity}
                        onChange={(event) => setOpacity(Number(event.target.value))}
                      />
                    </label>
                  )}
                </div>
              )}
              {pair && (
                <>
                  <p className="pdf-compare-pair-label">
                    {pageLabel(pair)} · {translate(statusKeys[pair.status])}
                  </p>
                  {pair.geometryChanged && (
                    <p className="pdf-compare-warning">{translate("pdfCompare.geometryChanged")}</p>
                  )}
                  {mode === "text" ? (
                    <section className="pdf-compare-text" aria-label={translate("pdfCompare.text")}>
                      {!pair.leftText.trim() || !pair.rightText.trim() ? (
                        <p className="pdf-compare-warning">
                          {translate("pdfCompare.pageTextUnavailable")}
                        </p>
                      ) : null}
                      {pair.textDiff.lines.map((line) => (
                        <div
                          key={line.id}
                          className={`pdf-compare-line pdf-compare-line--${line.type}`}
                        >
                          <span aria-hidden="true">
                            {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                          </span>
                          <p>
                            {line.words?.length
                              ? line.words.map((word) =>
                                  word.type === "unchanged" ? (
                                    <span key={word.id}>{word.text}</span>
                                  ) : (
                                    <mark
                                      key={word.id}
                                      className={`pdf-compare-word--${word.type}`}
                                    >
                                      {word.text}
                                    </mark>
                                  ),
                                )
                              : line.content}
                          </p>
                        </div>
                      ))}
                    </section>
                  ) : (
                    <div
                      className={`pdf-compare-previews ${activeOverlay ? "pdf-compare-previews--overlay" : ""}`}
                    >
                      {(activeOverlay ? [0] : [0, 1]).map((side) => (
                        <section key={side} className="pdf-compare-preview">
                          <h3>
                            {translate(side === 0 ? "pdfCompare.original" : "pdfCompare.revised")}
                          </h3>
                          <section
                            className="pdf-compare-scroll"
                            ref={(element) => {
                              panes.current[side] = element;
                            }}
                            onScroll={(event) => syncScroll(event, side)}
                            // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users must be able to scroll the PDF preview.
                            tabIndex={0}
                            aria-label={translate(
                              side === 0 ? "pdfCompare.original" : "pdfCompare.revised",
                            )}
                          >
                            <div className="pdf-compare-image" style={{ width: `${zoom * 100}%` }}>
                              {(side === 0 ? pair.leftPage : pair.rightPage) === null ? (
                                <p>{translate("pdfCompare.missingPage")}</p>
                              ) : (
                                renderImage(
                                  side === 0 ? pair.leftImage : pair.rightImage,
                                  translate(
                                    side === 0 ? "pdfCompare.original" : "pdfCompare.revised",
                                  ),
                                )
                              )}
                              {activeOverlay && pair.rightImage && (
                                <div className="pdf-compare-overlay" style={{ opacity }}>
                                  {renderImage(pair.rightImage, translate("pdfCompare.revised"))}
                                </div>
                              )}
                              {pair.regions.map((region) => (
                                <span
                                  key={`${region.x}-${region.y}-${region.width}-${region.height}`}
                                  className="pdf-compare-region"
                                  aria-hidden="true"
                                  style={{
                                    left: `${region.x * 100}%`,
                                    top: `${region.y * 100}%`,
                                    width: `${region.width * 100}%`,
                                    height: `${region.height * 100}%`,
                                  }}
                                />
                              ))}
                            </div>
                          </section>
                        </section>
                      ))}
                    </div>
                  )}
                  <p className="pdf-compare-note">{translate("pdfCompare.legend")}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
