import { ToolRunError } from "@nexohub/tool-sdk";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Hand,
  ImagePlus,
  Layers,
  Minus,
  MousePointer2,
  PanelLeft,
  PanelRight,
  Pencil,
  Plus,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { translate } from "@/i18n";
import type { MessageKey } from "@/i18n/pt-BR";
import type { DocumentCorePort } from "@/platform/document-core";
import { type LauncherToolOutput, runLauncherTool } from "@/platform/launcher-tool-runner";
import {
  commitEditorSnapshot,
  type EditorHistory,
  editorHistory,
  redoEditor,
  undoEditor,
} from "@/platform/pdf-editor-state";
import {
  EDITOR_LIMITS,
  type EditorBitmap,
  type EditorElement,
  type EditorFont,
  type EditorReplacement,
} from "@/platform/pdf-editor-types";
import { registerToolNavigationGuard } from "@/platform/tool-navigation-guard";
import "./PdfEditorPanel.css";

type Key = Extract<MessageKey, `editor.${string}`> extends `editor.${infer K}` ? K : never;
const t = (key: Key) => translate(`editor.${key}` as MessageKey);
const fontNames: EditorFont[] = [
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Times-Roman",
  "Courier",
];
function bitmapUrl(bitmap?: EditorBitmap) {
  if (!bitmap) return "";
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas
    .getContext("2d")
    ?.putImageData(
      new ImageData(new Uint8ClampedArray(bitmap.data), bitmap.width, bitmap.height),
      0,
      0,
    );
  return canvas.toDataURL("image/png");
}
function errorMessage(cause: unknown) {
  if (cause instanceof ToolRunError) return cause.message;
  const code = cause instanceof Error ? cause.message : "";
  const keys: Record<string, Key> = {
    EDITOR_LIMITE: "limit",
    EDITOR_PDF_INVALIDO: "invalidPdf",
    EDITOR_SENHA: "password",
    EDITOR_GLIFO: "glyph",
    EDITOR_TEXTO_NAO_CABE: "fitError",
    EDITOR_WORKER: "workerError",
    EDITOR_IMAGEM: "imageError",
    EDITOR_OBJETO: "unsafeObject",
  };
  return t(keys[code] ?? "error");
}
interface Props {
  documentCore: DocumentCorePort;
  onBack: () => void;
  initialFiles?: readonly File[];
}
export function PdfEditorPanel({ documentCore, onBack, initialFiles = [] }: Props) {
  const [file, setFile] = useState<File>();
  const [history, setHistory] = useState<EditorHistory>(editorHistory);
  const [output, setOutput] = useState<LauncherToolOutput>();
  const [page, setPage] = useState(0),
    [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<"select" | "existing" | "draw">("select");
  const [selected, setSelected] = useState<string>();
  const [draft, setDraft] = useState<EditorElement>();
  const [replacement, setReplacement] = useState<EditorReplacement>();
  const [draftDirty, setDraftDirty] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>(),
    [status, setStatus] = useState<string>();
  const [showPages, setShowPages] = useState(true),
    [showProps, setShowProps] = useState(true);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    count = useRef(0);
  const savedSnapshot = useRef(history.present),
    started = useRef(false),
    stage = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null),
    pdfInput = useRef<HTMLInputElement>(null);
  const gesture = useRef<
    | {
        id?: string;
        startX: number;
        startY: number;
        element?: EditorElement;
        resize?: boolean;
        points: { x: number; y: number }[];
      }
    | undefined
  >(undefined);
  const [transient, setTransient] = useState<EditorElement>();
  const id = useId(),
    revision = output?.editorRevision,
    info = revision?.pages[page];
  const preview = useMemo(() => bitmapUrl(revision?.preview), [revision?.preview]);
  const dirty = history.present !== savedSnapshot.current;
  const selectedOriginal = info?.texts.find((o) => o.id === selected);
  const clearSelection = useCallback(() => {
    setSelected(undefined);
    setDraft(undefined);
    setReplacement(undefined);
    setDraftDirty(false);
  }, []);
  const invalidate = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
  }, []);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const leave = (event: BeforeUnloadEvent) => {
      if (dirty || draftDirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [dirty, draftDirty]);
  useEffect(
    () => registerToolNavigationGuard(() => !(dirty || draftDirty) || window.confirm(t("discard"))),
    [dirty, draftDirty],
  );
  async function run(
    target: File,
    next: EditorHistory,
    targetPage: number,
    initial = false,
    refreshThumbnails = false,
  ) {
    invalidate();
    const token = generation.current,
      abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError(undefined);
    setStatus(undefined);
    try {
      const result = await runLauncherTool(documentCore, "pdf-edit", {
        files: [target],
        splitMode: "interval",
        splitIntervals: [],
        mergeIntervals: false,
        selectedPages: [],
        pages: [],
        rotateAngle: 0,
        compressionLevel: "recommended",
        firstText: "",
        secondText: "",
        editorSnapshot: next.present,
        editorPage: targetPage,
        editorThumbnails: initial || refreshThumbnails,
        editorSignal: abort.signal,
      });
      if (token !== generation.current || abort.signal.aborted) return false;
      if (!result.editorRevision) throw new Error("EDITOR_OPERACAO");
      setFile(target);
      setHistory(next);
      setPage(targetPage);
      setOutput(result);
      setDraftDirty(false);
      if (initial) {
        savedSnapshot.current = next.present;
        setThumbnails(result.editorRevision.thumbnails.map(bitmapUrl));
        clearSelection();
        setZoom(1);
      } else if (refreshThumbnails) setThumbnails(result.editorRevision.thumbnails.map(bitmapUrl));
      else
        setThumbnails((current) =>
          current.map((url, index) =>
            index === targetPage ? bitmapUrl(result.editorRevision?.preview) : url,
          ),
        );
      return true;
    } catch (cause) {
      if (token === generation.current && !abort.signal.aborted) setError(errorMessage(cause));
      return false;
    } finally {
      if (token === generation.current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  function allowDiscard() {
    return !(dirty || draftDirty) || window.confirm(t("discard"));
  }
  function openFile(next?: File) {
    if (!next) return;
    if (!/\.pdf$/i.test(next.name) && next.type !== "application/pdf") {
      setError(t("invalidPdf"));
      return;
    }
    if (next.size > EDITOR_LIMITS.bytes) {
      setError(t("limit"));
      return;
    }
    if (!allowDiscard()) return;
    void run(next, editorHistory(), 0, true);
  }
  useEffect(() => {
    if (!started.current && initialFiles[0]) {
      started.current = true;
      openFile(initialFiles[0]);
    }
  });
  function allowDraftDiscard() {
    return !draftDirty || window.confirm(t("discard"));
  }
  function selectElement(element: EditorElement, confirmed = false) {
    if (!confirmed && draftDirty && selected === element.id) return;
    if (!confirmed && !allowDraftDiscard()) return;
    setSelected(element.id);
    setDraft(element);
    setReplacement(undefined);
    setDraftDirty(false);
    setShowProps(true);
  }
  function selectOriginal(objectId: string) {
    if (draftDirty && selected === objectId) return;
    if (!allowDraftDiscard()) return;
    const object = info?.texts.find((o) => o.id === objectId);
    if (!object?.editable) return;
    setSelected(objectId);
    setReplacement(
      history.present.replacements.find((r) => r.id === objectId) ?? {
        id: objectId,
        text: object.text,
      },
    );
    setDraft(undefined);
    setDraftDirty(false);
    setShowProps(true);
  }
  async function commit(next: EditorHistory, targetPage = page, refreshThumbnails = false) {
    if (file) return run(file, next, targetPage, false, refreshThumbnails);
    return false;
  }
  function updateDraft(changes: Partial<EditorElement>) {
    if (draft) {
      setDraft({ ...draft, ...changes });
      setDraftDirty(true);
    }
  }
  async function apply() {
    if (replacement) {
      const next = {
        ...history.present,
        replacements: [
          ...history.present.replacements.filter((r) => r.id !== replacement.id),
          replacement,
        ],
      };
      await commit(commitEditorSnapshot(history, next));
    } else if (draft)
      await commit(
        commitEditorSnapshot(history, {
          ...history.present,
          elements: history.present.elements.map((e) => (e.id === draft.id ? draft : e)),
        }),
      );
  }
  function unique() {
    return `new-${++count.current}`;
  }
  async function add(kind: EditorElement["kind"], image?: EditorElement["image"]) {
    if (!info) return;
    const element: EditorElement = {
      id: unique(),
      kind,
      page,
      x: 0.12,
      y: 0.15,
      width: kind === "text" ? 0.65 : 0.3,
      height: kind === "text" ? 0.15 : kind === "line" ? 0.015 : 0.2,
      color: "#253047",
      text: kind === "text" ? t("newText") : undefined,
      font: "Helvetica",
      fontSize: 18,
      align: "left",
      strokeWidth: 2,
      image,
    };
    if (image)
      element.height = Math.min(
        0.5,
        (element.width * info.width * image.height) / image.width / info.height,
      );
    if (
      await commit(
        commitEditorSnapshot(history, {
          ...history.present,
          elements: [...history.present.elements, element],
        }),
      )
    ) {
      setMode("select");
      selectElement(element, true);
    }
  }
  async function loadImage(next?: File) {
    if (!next) return;
    if (!["image/png", "image/jpeg"].includes(next.type) || next.size > 10 * 1024 * 1024) {
      setError(t("imageError"));
      return;
    }
    const token = generation.current;
    try {
      const bitmap = await createImageBitmap(next);
      try {
        if (bitmap.width * bitmap.height > EDITOR_LIMITS.imagePixels)
          throw new Error("EDITOR_IMAGEM");
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("EDITOR_IMAGEM");
        context.drawImage(bitmap, 0, 0);
        const data = new Uint8Array(context.getImageData(0, 0, bitmap.width, bitmap.height).data);
        if (token === generation.current)
          await add("image", { data, width: bitmap.width, height: bitmap.height });
      } finally {
        bitmap.close();
      }
    } catch {
      if (token === generation.current) setError(t("imageError"));
    }
  }
  async function remove() {
    if (!draft) return;
    if (
      await commit(
        commitEditorSnapshot(history, {
          ...history.present,
          elements: history.present.elements.filter((e) => e.id !== draft.id),
        }),
      )
    )
      clearSelection();
  }
  async function duplicate() {
    if (!draft) return;
    const copy = {
      ...draft,
      id: unique(),
      x: Math.min(1 - draft.width, draft.x + 0.025),
      y: Math.min(1 - draft.height, draft.y + 0.025),
    };
    if (
      await commit(
        commitEditorSnapshot(history, {
          ...history.present,
          elements: [...history.present.elements, copy],
        }),
      )
    )
      selectElement(copy, true);
  }
  async function order(front: boolean) {
    if (!draft) return;
    const others = history.present.elements.filter((e) => e.id !== draft.id);
    await commit(
      commitEditorSnapshot(history, {
        ...history.present,
        elements: front ? [...others, draft] : [draft, ...others],
      }),
    );
  }
  async function travel(forward: boolean) {
    if (!allowDraftDiscard()) return;
    if (await commit(forward ? redoEditor(history) : undoEditor(history), page, true))
      clearSelection();
  }
  async function navigate(index: number) {
    if (draftDirty && !window.confirm(t("discard"))) return;
    if (await commit(history, index)) clearSelection();
  }
  async function save() {
    if (!output || draftDirty) return;
    try {
      if (documentCore.saveOutputFile)
        await documentCore.saveOutputFile({ blob: output.blob, fileName: output.fileName });
      else {
        const url = URL.createObjectURL(output.blob),
          anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = output.fileName;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      savedSnapshot.current = history.present;
      setStatus(t("saved"));
    } catch {
      setError(t("error"));
    }
  }
  function point(event: ReactPointerEvent) {
    const r = stage.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
    };
  }
  function start(event: ReactPointerEvent, element?: EditorElement, resize = false) {
    if (busy || (mode === "existing" && !element)) return;
    if (draftDirty) {
      setError(t("draft"));
      return;
    }
    if (!element && mode !== "draw") return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = point(event);
    gesture.current = { id: element?.id, startX: p.x, startY: p.y, element, resize, points: [p] };
    if (element) selectElement(element);
  }
  function move(event: ReactPointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const p = point(event);
    if (!g.element) {
      if (g.points.length < 2000) g.points.push(p);
      setTransient({
        id: "drawing",
        page,
        kind: "draw",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        color: "#253047",
        strokeWidth: 2,
        points: [...g.points],
      });
      return;
    }
    const e = g.element,
      dx = p.x - g.startX,
      dy = p.y - g.startY;
    const next = g.resize
      ? {
          ...e,
          width: Math.max(0.02, Math.min(1 - e.x, e.width + dx)),
          height: Math.max(0.01, Math.min(1 - e.y, e.height + dy)),
        }
      : {
          ...e,
          x: Math.max(0, Math.min(1 - e.width, e.x + dx)),
          y: Math.max(0, Math.min(1 - e.height, e.y + dy)),
        };
    setTransient(next);
  }
  async function end(event: ReactPointerEvent) {
    const g = gesture.current;
    if (!g) return;
    gesture.current = undefined;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    const changed = transient;
    setTransient(undefined);
    if (g.element && changed) {
      if (
        await commit(
          commitEditorSnapshot(history, {
            ...history.present,
            elements: history.present.elements.map((e) => (e.id === changed.id ? changed : e)),
          }),
        )
      )
        selectElement(changed, true);
    } else if (!g.element && g.points.length > 1) {
      const xs = g.points.map((p) => p.x),
        ys = g.points.map((p) => p.y),
        x = Math.min(...xs),
        y = Math.min(...ys),
        width = Math.max(0.002, Math.max(...xs) - x),
        height = Math.max(0.002, Math.max(...ys) - y);
      const element: EditorElement = {
        id: unique(),
        page,
        kind: "draw",
        x,
        y,
        width: Math.min(width, 1 - x),
        height: Math.min(height, 1 - y),
        color: "#253047",
        strokeWidth: 2,
        points: g.points.map((p) => ({ x: (p.x - x) / width, y: (p.y - y) / height })),
      };
      if (
        await commit(
          commitEditorSnapshot(history, {
            ...history.present,
            elements: [...history.present.elements, element],
          }),
        )
      ) {
        setMode("select");
        selectElement(element);
      }
    }
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.matches("input,textarea,select") || event.target.isContentEditable)
      )
        return;
      if (busy) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey ? history.future.length : history.past.length)
          void travel(event.shiftKey);
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
      if ((event.key === "Delete" || event.key === "Backspace") && draft) {
        event.preventDefault();
        void remove();
      }
      if (event.key === "Escape" && allowDraftDiscard()) {
        gesture.current = undefined;
        setTransient(undefined);
        clearSelection();
        setMode("select");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const tool = (label: Key, icon: React.ReactNode, action: () => void, active = false) => (
    <button
      type="button"
      disabled={busy}
      aria-pressed={active}
      onClick={() => {
        if (allowDraftDiscard()) action();
      }}
    >
      {icon}
      <span>{t(label)}</span>
    </button>
  );
  const numberField = (key: "x" | "y" | "width" | "height") =>
    draft && (
      <label>
        {t(key)}
        <input
          aria-label={t(key)}
          type="number"
          min={key === "x" || key === "y" ? 0 : 1}
          max="100"
          step="0.1"
          value={Math.round(draft[key] * 1000) / 10}
          onChange={(event) => updateDraft({ [key]: Number(event.target.value) / 100 })}
        />
      </label>
    );
  return (
    <section
      className={`pdf-editor ${revision ? "pdf-editor-workspace" : ""}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="pdf-editor-topline">
        <button
          type="button"
          onClick={() => {
            onBack();
          }}
        >
          <ArrowLeft size={18} />
          {t("back")}
        </button>
        <h1 id={`${id}-title`}>{t("title")}</h1>
        {file && (
          <span className="pdf-editor-filename" title={file.name}>
            {file.name}
          </span>
        )}
      </div>
      <input
        ref={pdfInput}
        className="pdf-editor-file"
        tabIndex={-1}
        aria-hidden="true"
        id={`${id}-pdf`}
        aria-label={t("upload")}
        type="file"
        accept="application/pdf,.pdf"
        onChange={(event) => {
          openFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={imageInput}
        className="pdf-editor-file"
        tabIndex={-1}
        aria-hidden="true"
        aria-label={t("image")}
        type="file"
        accept="image/png,image/jpeg"
        onChange={(event) => {
          void loadImage(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {error && (
        <p className="pdf-editor-alert" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="pdf-editor-status">
          <Check size={16} />
          {status}
        </p>
      )}
      {busy && (
        <div className="pdf-editor-progress" role="status">
          <span>{t("loading")}</span>
          <button type="button" onClick={invalidate}>
            <X size={16} />
            {t("cancel")}
          </button>
        </div>
      )}
      {!revision ? (
        <section
          className="pdf-editor-upload"
          aria-label={t("title")}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            openFile(event.dataTransfer.files[0]);
          }}
        >
          <div className="pdf-editor-emblem">
            <Pencil size={30} />
          </div>
          <h2>{t("tagline")}</h2>
          <p>{t("description")}</p>
          <button
            className="pdf-editor-primary"
            type="button"
            disabled={busy}
            onClick={() => pdfInput.current?.click()}
          >
            <Upload size={22} />
            {t("upload")}
          </button>
          <p>{t("drop")}</p>
          <small>{t("limits")}</small>
          <p className="pdf-editor-privacy">{t("privacy")}</p>
        </section>
      ) : (
        <>
          <div className="pdf-editor-toolbar" role="toolbar" aria-label={t("title")}>
            {tool(
              "select",
              <MousePointer2 size={19} />,
              () => {
                clearSelection();
                setMode("select");
              },
              mode === "select",
            )}
            {tool(
              "existing",
              <Pencil size={19} />,
              () => {
                clearSelection();
                setMode("existing");
              },
              mode === "existing",
            )}
            {tool("text", <Type size={19} />, () => {
              void add("text");
            })}
            {tool("image", <ImagePlus size={19} />, () => imageInput.current?.click())}
            {tool("rect", <Square size={19} />, () => {
              void add("rect");
            })}
            {tool("ellipse", <span className="pdf-editor-circle" />, () => {
              void add("ellipse");
            })}
            {tool("line", <Minus size={19} />, () => {
              void add("line");
            })}
            {tool(
              "draw",
              <Pencil size={19} />,
              () => {
                clearSelection();
                setMode("draw");
              },
              mode === "draw",
            )}
            <span className="pdf-editor-toolbar-divider" />
            <button
              type="button"
              aria-label={t("undo")}
              title={t("undo")}
              disabled={busy || !history.past.length}
              onClick={() => {
                void travel(false);
              }}
            >
              <Undo2 size={20} />
            </button>
            <button
              type="button"
              aria-label={t("redo")}
              title={t("redo")}
              disabled={busy || !history.future.length}
              onClick={() => {
                void travel(true);
              }}
            >
              <Redo2 size={20} />
            </button>
            <button type="button" disabled={busy} onClick={() => pdfInput.current?.click()}>
              <Upload size={18} />
              {t("replace")}
            </button>
          </div>
          {revision.signed && <p className="pdf-editor-warning">{t("signed")}</p>}
          <div
            className={`pdf-editor-layout ${showPages ? "show-pages" : ""} ${showProps ? "show-props" : ""}`}
          >
            <aside className="pdf-editor-pages" aria-label={t("pages")}>
              <h2>{t("pages")}</h2>
              {revision.pages.map((_, index) => (
                <button
                  type="button"
                  // biome-ignore lint/suspicious/noArrayIndexKey: páginas não são reordenadas neste editor
                  key={index}
                  disabled={busy}
                  aria-label={`${t("page")} ${index + 1}`}
                  aria-current={page === index ? "page" : undefined}
                  onClick={() => {
                    void navigate(index);
                  }}
                >
                  {thumbnails[index] ? (
                    <img src={thumbnails[index]} alt="" />
                  ) : (
                    <span className="pdf-editor-paper" />
                  )}
                  <span>{index + 1}</span>
                </button>
              ))}
            </aside>
            <div className="pdf-editor-center">
              <div className="pdf-editor-viewbar">
                <button
                  type="button"
                  aria-label={t("thumbnails")}
                  aria-expanded={showPages}
                  onClick={() => setShowPages(!showPages)}
                >
                  <PanelLeft size={18} />
                </button>
                <button
                  type="button"
                  aria-label={t("previous")}
                  disabled={busy || page === 0}
                  onClick={() => {
                    void navigate(page - 1);
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {page + 1} / {revision.pages.length}
                </span>
                <button
                  type="button"
                  aria-label={t("next")}
                  disabled={busy || page >= revision.pages.length - 1}
                  onClick={() => {
                    void navigate(page + 1);
                  }}
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  type="button"
                  aria-label={t("zoomOut")}
                  disabled={zoom <= 0.5}
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                >
                  <Minus size={17} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  aria-label={t("zoomIn")}
                  disabled={zoom >= 2}
                  onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                >
                  <Plus size={17} />
                </button>
                <button type="button" onClick={() => setZoom(1)}>
                  <Hand size={17} />
                  {t("fit")}
                </button>
                <button
                  type="button"
                  aria-label={t("showProperties")}
                  aria-expanded={showProps}
                  onClick={() => setShowProps(!showProps)}
                >
                  <PanelRight size={18} />
                </button>
              </div>
              <p className="pdf-editor-hint">
                {t(
                  mode === "draw" ? "drawHint" : mode === "existing" ? "unsupported" : "selectHint",
                )}
              </p>
              {/* biome-ignore lint/a11y/noNoninteractiveTabindex: área rolável acessível pelo teclado */}
              <section className="pdf-editor-scroll" tabIndex={0} aria-label={t("title")}>
                <div
                  ref={stage}
                  className={`pdf-editor-stage mode-${mode}`}
                  style={{
                    width: `${zoom * 100}%`,
                    aspectRatio: info ? `${info.width}/${info.height}` : undefined,
                  }}
                  onPointerDown={(event) => start(event)}
                  onPointerMove={move}
                  onPointerUp={(event) => {
                    void end(event);
                  }}
                  onPointerCancel={() => {
                    gesture.current = undefined;
                    setTransient(undefined);
                  }}
                >
                  <img
                    className="pdf-editor-preview"
                    src={preview}
                    alt={`${t("page")} ${page + 1}`}
                    draggable={false}
                  />
                  {mode === "existing" &&
                    info?.texts
                      .filter((o) => o.editable)
                      .map((object) => (
                        <button
                          className={`pdf-editor-object original ${selected === object.id ? "selected" : ""}`}
                          key={object.id}
                          type="button"
                          disabled={busy}
                          aria-label={t("objectLabel") + object.text}
                          title={object.text}
                          style={{
                            left: `${object.x * 100}%`,
                            top: `${object.y * 100}%`,
                            width: `${object.width * 100}%`,
                            height: `${object.height * 100}%`,
                          }}
                          onClick={() => selectOriginal(object.id)}
                        />
                      ))}
                  {mode === "select" &&
                    history.present.elements
                      .filter((e) => e.page === page)
                      .map((element) => {
                        const box = transient?.id === element.id ? transient : element;
                        return (
                          <div
                            key={element.id}
                            className={`pdf-editor-object added ${selected === element.id ? "selected" : ""}`}
                            style={{
                              left: `${box.x * 100}%`,
                              top: `${box.y * 100}%`,
                              width: `${box.width * 100}%`,
                              height: `${box.height * 100}%`,
                            }}
                          >
                            <button
                              type="button"
                              disabled={busy}
                              aria-label={
                                t("elementLabel") +
                                t(element.kind === "text" ? "text" : element.kind)
                              }
                              onClick={() => selectElement(element)}
                              onPointerDown={(event) => start(event, element)}
                              onPointerMove={move}
                              onPointerUp={(event) => {
                                void end(event);
                              }}
                            />
                            {selected === element.id && (
                              <button
                                className="pdf-editor-resize"
                                type="button"
                                disabled={busy}
                                aria-label={t("resize")}
                                onPointerDown={(event) => start(event, element, true)}
                                onPointerMove={move}
                                onPointerUp={(event) => {
                                  void end(event);
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                  {transient?.kind === "draw" && (
                    <svg
                      className="pdf-editor-drawing"
                      viewBox="0 0 1000 1000"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <polyline
                        points={transient.points
                          ?.map((p) => `${p.x * 1000},${p.y * 1000}`)
                          .join(" ")}
                        fill="none"
                        stroke={transient.color}
                        strokeWidth="3"
                      />
                    </svg>
                  )}
                </div>
              </section>
              {mode === "existing" && !info?.texts.some((o) => o.editable) && (
                <p className="pdf-editor-warning">{t("noText")}</p>
              )}
            </div>
            <aside className="pdf-editor-properties" aria-label={t("properties")}>
              <h2>{t("properties")}</h2>
              <label className="pdf-editor-object-list">
                {t("objects")}
                <select
                  aria-label={t("objects")}
                  disabled={busy}
                  value={selected ?? ""}
                  onChange={(event) => {
                    if (mode === "existing") selectOriginal(event.target.value);
                    else {
                      const element = history.present.elements.find(
                        (item) => item.id === event.target.value,
                      );
                      if (element) selectElement(element);
                    }
                  }}
                >
                  <option value="">{t("chooseObject")}</option>
                  {mode === "existing"
                    ? info?.texts
                        .filter((item) => item.editable)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.text.slice(0, 80)}
                          </option>
                        ))
                    : history.present.elements
                        .filter((item) => item.page === page)
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.kind === "text" ? item.text?.slice(0, 80) : t(item.kind)}
                          </option>
                        ))}
                </select>
              </label>
              {!draft && !replacement && (
                <div className="pdf-editor-empty">
                  <Layers size={30} />
                  <p>{t("emptySelection")}</p>
                </div>
              )}
              <fieldset disabled={busy}>
                {(draft?.kind === "text" || replacement) && (
                  <label>
                    {t("textContent")}
                    <textarea
                      aria-label={t("textContent")}
                      rows={5}
                      value={replacement?.text ?? draft?.text ?? ""}
                      onChange={(event) => {
                        if (replacement) {
                          setReplacement({ ...replacement, text: event.target.value });
                          setDraftDirty(true);
                        } else updateDraft({ text: event.target.value });
                      }}
                    />
                  </label>
                )}
                {replacement && (
                  <>
                    <span className="pdf-editor-meta">
                      {t("originalObject")} · {selectedOriginal?.fontName} ·{" "}
                      {selectedOriginal?.fontSize.toFixed(1)} pt
                    </span>
                    <label>
                      {t("fontFallback")}
                      <select
                        aria-label={t("fontFallback")}
                        disabled={selectedOriginal?.canChangeStyle === false}
                        value={replacement.fallbackFont ?? ""}
                        onChange={(event) => {
                          setReplacement({
                            ...replacement,
                            fallbackFont: (event.target.value || undefined) as
                              | EditorFont
                              | undefined,
                          });
                          setDraftDirty(true);
                        }}
                      >
                        <option value="">{t("originalFont")}</option>
                        {fontNames.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("size")}
                      <input
                        type="number"
                        min="6"
                        max="120"
                        disabled={selectedOriginal?.canChangeStyle === false}
                        value={replacement.fontSize ?? selectedOriginal?.fontSize ?? 18}
                        onChange={(event) => {
                          setReplacement({ ...replacement, fontSize: Number(event.target.value) });
                          setDraftDirty(true);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        const next = {
                          ...history.present,
                          replacements: [
                            ...history.present.replacements.filter((r) => r.id !== replacement.id),
                            { ...replacement, text: "" },
                          ],
                        };
                        if (await commit(commitEditorSnapshot(history, next))) clearSelection();
                      }}
                    >
                      <Trash2 size={17} />
                      {t("deleteText")}
                    </button>
                    {selectedOriginal?.canChangeStyle === false && (
                      <p className="pdf-editor-warning">{t("unsafeStyle")}</p>
                    )}
                    {replacement.fallbackFont && (
                      <p className="pdf-editor-warning">{t("fallbackNotice")}</p>
                    )}
                  </>
                )}
                {draft?.kind === "text" && (
                  <>
                    <label>
                      {t("font")}
                      <select
                        aria-label={t("font")}
                        value={draft.font}
                        onChange={(event) =>
                          updateDraft({ font: event.target.value as EditorFont })
                        }
                      >
                        {fontNames.map((font) => (
                          <option key={font} value={font}>
                            {font}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("size")}
                      <input
                        type="number"
                        min="6"
                        max="120"
                        value={draft.fontSize}
                        onChange={(event) => updateDraft({ fontSize: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      {t("align")}
                      <select
                        value={draft.align}
                        onChange={(event) =>
                          updateDraft({ align: event.target.value as EditorElement["align"] })
                        }
                      >
                        {(["left", "center", "right"] as const).map((align) => (
                          <option key={align} value={align}>
                            {t(align)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {draft && draft.kind !== "image" && (
                  <label className="pdf-editor-color">
                    {t("color")}
                    <input
                      type="color"
                      value={draft.color}
                      onChange={(event) => updateDraft({ color: event.target.value })}
                    />
                    <span>{draft.color}</span>
                  </label>
                )}
                {draft && !["text", "image"].includes(draft.kind) && (
                  <label>
                    {t("stroke")}
                    <input
                      type="number"
                      min="0.5"
                      max="20"
                      step="0.5"
                      value={draft.strokeWidth}
                      onChange={(event) => updateDraft({ strokeWidth: Number(event.target.value) })}
                    />
                  </label>
                )}
                {draft && (
                  <div className="pdf-editor-measures">
                    {numberField("x")}
                    {numberField("y")}
                    {numberField("width")}
                    {numberField("height")}
                  </div>
                )}
                {(draft || replacement) && (
                  <button
                    className="pdf-editor-apply"
                    type="button"
                    disabled={!draftDirty}
                    onClick={() => {
                      void apply();
                    }}
                  >
                    <Check size={18} />
                    {t("apply")}
                  </button>
                )}
                {draftDirty && (
                  <button
                    type="button"
                    onClick={() => {
                      if (draft) {
                        const original = history.present.elements.find((e) => e.id === draft.id);
                        if (original) {
                          setDraft(original);
                          setDraftDirty(false);
                        }
                      } else if (selected) {
                        setReplacement(
                          history.present.replacements.find((r) => r.id === selected) ?? {
                            id: selected,
                            text: selectedOriginal?.text ?? "",
                          },
                        );
                        setDraftDirty(false);
                      }
                    }}
                  >
                    {t("discardDraft")}
                  </button>
                )}
                {draft && (
                  <div className="pdf-editor-element-actions">
                    <button
                      type="button"
                      onClick={() => {
                        void duplicate();
                      }}
                    >
                      <Copy size={17} />
                      {t("duplicate")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void remove();
                      }}
                    >
                      <Trash2 size={17} />
                      {t("delete")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void order(true);
                      }}
                    >
                      {t("forward")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void order(false);
                      }}
                    >
                      {t("backward")}
                    </button>
                  </div>
                )}
              </fieldset>
              <div className="pdf-editor-save">
                <p>{draftDirty ? t("draft") : t("notes")}</p>
                <button
                  className="pdf-editor-primary"
                  type="button"
                  disabled={busy || draftDirty}
                  onClick={() => {
                    void save();
                  }}
                >
                  <Download size={20} />
                  {t("save")}
                </button>
                <small>{t("privacy")}</small>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
