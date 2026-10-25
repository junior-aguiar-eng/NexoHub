import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Eye,
  FileCode2,
  Heading,
  Sparkles,
  Table as TableIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { PdfViewport } from "./PdfViewport";

export interface PdfToMarkdownPanelProps {
  fileName: string;
  fileSizeBytes: number;
  pageCount?: number;
  thumbnailUrl?: string;
  pageThumbnails?: readonly string[];
  onPreviewPageChange?: (page: number) => void;
  detectHeadings: boolean;
  onDetectHeadingsChange: (val: boolean) => void;
  detectTables: boolean;
  onDetectTablesChange: (val: boolean) => void;
  includePageBreaks: boolean;
  onIncludePageBreaksChange: (val: boolean) => void;
  markdownResult?: string;
  onMarkdownResultChange?: (val: string) => void;
  isConverting?: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Renderizador seguro de visualização Markdown básica (sem dependências pesadas externas).
 * Converte títulos, tabelas (| col |), listas e separadores em elementos visuais estilizados.
 */
function SimpleMarkdownViewer({ content }: { content: string }) {
  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (keyPrefix: string) => {
    if (tableBuffer.length === 0) return;
    const rows = tableBuffer
      .filter((line) => !line.match(/^\|\s*[-:\s|]+\s*\|$/))
      .map((line) =>
        line
          .split("|")
          .map((c) => c.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1),
      );

    if (rows.length > 0) {
      const header = rows[0];
      const body = rows.slice(1);
      renderedElements.push(
        <div
          key={`${keyPrefix}-table`}
          className="my-4 overflow-x-auto rounded border border-[var(--color-border)] bg-[var(--color-surface-muted)]"
        >
          <table className="w-full text-left text-sm text-[var(--color-ink)]">
            <thead className="bg-[var(--color-surface-muted)] text-xs uppercase tracking-wider text-[var(--color-ink)]">
              <tr>
                {header.map((cell) => (
                  <th
                    key={`th-${keyPrefix}-${cell}`}
                    className="border-b border-[var(--color-border)] px-3 py-2 font-semibold"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {body.map((row) => (
                <tr
                  key={`tr-${keyPrefix}-${row.join("-")}`}
                  className="hover:bg-[var(--color-surface-muted)] transition-colors"
                >
                  {row.map((cell) => (
                    <td key={`td-${keyPrefix}-${cell}-${row[0] ?? ""}`} className="px-3 py-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    }
    tableBuffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tableBuffer.push(trimmed);
      continue;
    }

    flushTable(`table-${i}`);

    if (trimmed.startsWith("<!--") && trimmed.endsWith("-->")) {
      renderedElements.push(
        <div key={i} className="my-3 text-xs italic text-[var(--color-ink-muted)] font-mono">
          {trimmed}
        </div>,
      );
      continue;
    }

    if (trimmed === "---") {
      renderedElements.push(<hr key={i} className="my-6 border-[var(--color-border)]" />);
      continue;
    }

    if (trimmed.startsWith("# ")) {
      renderedElements.push(
        <h1
          key={i}
          className="mt-6 mb-3 text-2xl font-bold text-[var(--color-ink)] tracking-tight border-b border-[var(--color-border)] pb-2"
        >
          {trimmed.slice(2)}
        </h1>,
      );
    } else if (trimmed.startsWith("## ")) {
      renderedElements.push(
        <h2 key={i} className="mt-5 mb-2 text-xl font-semibold text-[var(--color-ink)]">
          {trimmed.slice(3)}
        </h2>,
      );
    } else if (trimmed.startsWith("### ")) {
      renderedElements.push(
        <h3 key={i} className="mt-4 mb-2 text-lg font-medium text-[var(--color-ink)]">
          {trimmed.slice(4)}
        </h3>,
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      renderedElements.push(
        <li key={i} className="ml-5 list-disc text-[var(--color-ink)] my-0.5 leading-relaxed">
          {trimmed.slice(2)}
        </li>,
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      renderedElements.push(
        <li key={i} className="ml-5 list-decimal text-[var(--color-ink)] my-0.5 leading-relaxed">
          {trimmed.replace(/^\d+\.\s/, "")}
        </li>,
      );
    } else if (trimmed.startsWith("> ")) {
      renderedElements.push(
        <blockquote
          key={i}
          className="my-2 border-l-4 border-indigo-500 bg-indigo-950/20 px-4 py-2 italic text-[var(--color-ink)] rounded-r"
        >
          {trimmed.slice(2)}
        </blockquote>,
      );
    } else if (trimmed.length > 0) {
      renderedElements.push(
        <p key={i} className="my-2 text-[var(--color-ink)] leading-relaxed text-sm md:text-base">
          {trimmed}
        </p>,
      );
    }
  }

  flushTable("final-table");

  return <div className="space-y-1">{renderedElements}</div>;
}

export function PdfToMarkdownPanel({
  fileName,
  fileSizeBytes,
  pageCount = 1,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  detectHeadings,
  onDetectHeadingsChange,
  detectTables,
  onDetectTablesChange,
  includePageBreaks,
  onIncludePageBreaksChange,
  markdownResult,
  onMarkdownResultChange,
  isConverting = false,
}: PdfToMarkdownPanelProps) {
  const [previewPage, setPreviewPage] = useState(1);
  useEffect(() => {
    onPreviewPageChange?.(previewPage);
  }, [onPreviewPageChange, previewPage]);
  const activeThumbnail =
    pageThumbnails?.[previewPage - 1] || (previewPage === 1 ? thumbnailUrl : undefined);

  const [viewTab, setViewTab] = useState<"rendered" | "raw">("rendered");
  const [copied, setCopied] = useState(false);

  const charCount = markdownResult?.length ?? 0;
  const wordCount = markdownResult?.trim() ? markdownResult.trim().split(/\s+/).length : 0;
  const lineCount = markdownResult ? markdownResult.split("\n").length : 0;
  const isScannedHint = Boolean(markdownResult && charCount < 40);

  const handleCopy = async () => {
    if (!markdownResult) return;
    try {
      await navigator.clipboard.writeText(markdownResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleDownload = () => {
    if (!markdownResult) return;
    const blob = new Blob([markdownResult], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/\.[^/.]+$/, "")}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ilovepdf-compress-container" data-workspace-panel>
      {/* Coluna Central: Visualização do Documento ou Resultado Markdown */}
      <div
        className="ilovepdf-compress-preview-area"
        data-workspace-part="document"
        style={{
          flexDirection: "column",
          gap: "1.25rem",
          alignItems: "stretch",
          justifyContent: "flex-start",
        }}
      >
        {markdownResult ? (
          /* Estado com Resultado Pronto: Visualizador Duplo */
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 backdrop-blur shadow-xl">
            {/* Barra de Ferramentas do Resultado */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewTab("rendered")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewTab === "rendered"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-[var(--color-surface-muted)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                  }`}
                >
                  <Eye size={14} />
                  <span>{translate("pdfToMarkdown.viewRendered")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab("raw")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewTab === "raw"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "bg-[var(--color-surface-muted)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                  }`}
                >
                  <FileCode2 size={14} />
                  <span>{translate("pdfToMarkdown.viewRaw")}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="compact"
                  onClick={handleCopy}
                  className="gap-1.5 border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-xs text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                >
                  {copied ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                  <span>
                    {copied ? translate("pdfToMarkdown.copied") : translate("pdfToMarkdown.copy")}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="compact"
                  onClick={handleDownload}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-xs text-white shadow-lg shadow-emerald-600/20"
                >
                  <Download size={14} />
                  <span>{translate("pdfToMarkdown.download")}</span>
                </Button>
              </div>
            </div>

            {/* Aviso para documento potencialmente escaneado */}
            {isScannedHint && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                <AlertCircle size={16} className="shrink-0 text-amber-400" />
                <span>{translate("pdfToMarkdown.scannedNotice")}</span>
              </div>
            )}

            {/* Conteúdo: Visualização ou Código Raw */}
            <div className="min-h-[420px] max-h-[620px] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              {viewTab === "rendered" ? (
                <SimpleMarkdownViewer content={markdownResult} />
              ) : (
                <textarea
                  value={markdownResult}
                  onChange={(e) => onMarkdownResultChange?.(e.target.value)}
                  className="h-full min-h-[400px] w-full resize-none bg-transparent font-mono text-xs md:text-sm text-[var(--color-ink)] outline-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </div>

            {/* Estatísticas do Documento */}
            <div className="flex flex-wrap items-center justify-between text-xs text-[var(--color-ink-muted)] pt-1">
              <span className="font-medium text-[var(--color-ink)]">{fileName}</span>
              <div className="flex items-center gap-3">
                <span>
                  {charCount.toLocaleString()} {translate("pdfToMarkdown.statsCharacters")}
                </span>
                <span>•</span>
                <span>
                  {wordCount.toLocaleString()} {translate("pdfToMarkdown.statsWords")}
                </span>
                <span>•</span>
                <span>
                  {lineCount.toLocaleString()} {translate("pdfToMarkdown.statsLines")}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Estado Inicial: Miniatura do Arquivo e Destaques */
          <div className="pdf-markdown-source">
            <div className="ilovepdf-file-card-center mb-6">
              <PdfViewport page={previewPage} pageCount={pageCount} onPageChange={setPreviewPage}>
                <div className="ilovepdf-file-thumb-wrapper">
                  {activeThumbnail ? (
                    <img
                      src={activeThumbnail}
                      alt={`Miniatura de ${fileName}`}
                      className="ilovepdf-file-thumb-img"
                      style={{ height: "auto", width: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <div className="ilovepdf-file-thumb-placeholder">PDF</div>
                  )}
                </div>
              </PdfViewport>
              <span className="ilovepdf-file-card-name" title={fileName}>
                {fileName}
              </span>
              <span className="ilovepdf-file-card-size">
                {formatSize(fileSizeBytes)} • {pageCount} {pageCount === 1 ? "página" : "páginas"}
              </span>
            </div>

            <div className="grid max-w-lg grid-cols-1 md:grid-cols-3 gap-3 w-full text-left">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <div className="flex items-center gap-2 text-indigo-700 mb-1 text-xs font-semibold">
                  <Heading size={14} />
                  <span>Hierarquia</span>
                </div>
                <p className="text-[11px] text-[var(--color-ink-muted)] leading-tight">
                  Títulos #, ## e ### identificados pelo tamanho de fonte.
                </p>
              </div>

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <div className="flex items-center gap-2 text-emerald-700 mb-1 text-xs font-semibold">
                  <TableIcon size={14} />
                  <span>Tabelas</span>
                </div>
                <p className="text-[11px] text-[var(--color-ink-muted)] leading-tight">
                  Colunas tabulares formatadas na sintaxe nativa do Markdown.
                </p>
              </div>

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <div className="flex items-center gap-2 text-sky-700 mb-1 text-xs font-semibold">
                  <Sparkles size={14} />
                  <span>Pronto para IA</span>
                </div>
                <p className="text-[11px] text-[var(--color-ink-muted)] leading-tight">
                  Ideal para Notion, Obsidian, GitHub e prompts em LLMs.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Coluna Lateral: Opções da Ferramenta */}
      <aside className="ilovepdf-compress-options-sidebar" data-workspace-part="options">
        <h3 className="ilovepdf-sidebar-title">{translate("pdfToMarkdown.optionsTitle")}</h3>

        <div className="flex flex-col gap-4">
          {/* Opção 1: Detectar Títulos */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-muted)] cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={detectHeadings}
              onChange={(e) => onDetectHeadingsChange(e.target.checked)}
              disabled={isConverting}
              className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface-muted)] text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--color-ink)]">
                {translate("pdfToMarkdown.detectHeadings")}
              </span>
              <span className="text-[11px] text-[var(--color-ink-muted)] mt-0.5">
                {translate("pdfToMarkdown.detectHeadingsDesc")}
              </span>
            </div>
          </label>

          {/* Opção 2: Formatar Tabelas */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-muted)] cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={detectTables}
              onChange={(e) => onDetectTablesChange(e.target.checked)}
              disabled={isConverting}
              className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface-muted)] text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--color-ink)]">
                {translate("pdfToMarkdown.detectTables")}
              </span>
              <span className="text-[11px] text-[var(--color-ink-muted)] mt-0.5">
                {translate("pdfToMarkdown.detectTablesDesc")}
              </span>
            </div>
          </label>

          {/* Opção 3: Quebras de Página */}
          <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-surface-muted)] cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={includePageBreaks}
              onChange={(e) => onIncludePageBreaksChange(e.target.checked)}
              disabled={isConverting}
              className="mt-1 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface-muted)] text-indigo-600 focus:ring-indigo-500"
            />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--color-ink)]">
                {translate("pdfToMarkdown.includePageBreaks")}
              </span>
              <span className="text-[11px] text-[var(--color-ink-muted)] mt-0.5">
                {translate("pdfToMarkdown.includePageBreaksDesc")}
              </span>
            </div>
          </label>
        </div>
      </aside>
    </div>
  );
}
