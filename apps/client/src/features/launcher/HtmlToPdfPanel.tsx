import { Code, FileCode, Globe, Layout, UploadCloud } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { translate } from "@/i18n";

export interface HtmlToPdfPanelProps {
  readonly fileName?: string;
  readonly htmlContent: string;
  readonly onHtmlContentChange: (content: string) => void;
  readonly onFileUpload: (file: File) => void;
  readonly pageSize: "A4" | "Letter" | "A3";
  readonly onPageSizeChange: (size: "A4" | "Letter" | "A3") => void;
  readonly orientation: "portrait" | "landscape";
  readonly onOrientationChange: (orientation: "portrait" | "landscape") => void;
  readonly margin: "none" | "small" | "normal" | "wide";
  readonly onMarginChange: (margin: "none" | "small" | "normal" | "wide") => void;
}

const DEFAULT_SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Relatório Executivo</title>
  <style>
    body { font-family: sans-serif; color: #1e293b; padding: 20px; }
    h1 { color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p { line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
    th { background-color: #f1f5f9; color: #0f172a; }
  </style>
</head>
<body>
  <h1>Relatório de Desempenho</h1>
  <p>Este documento foi gerado a partir de código HTML local com renderização precisa.</p>
  <table>
    <thead>
      <tr>
        <th>Módulo</th>
        <th>Status</th>
        <th>Eficiência</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Motor PDF Local</td>
        <td>100% Operacional</td>
        <td>Alta</td>
      </tr>
      <tr>
        <td>Conversor HTML</td>
        <td>Ativo</td>
        <td>Excelente</td>
      </tr>
    </tbody>
  </table>
</body>
</html>`;

export function HtmlToPdfPanel({
  fileName,
  htmlContent,
  onHtmlContentChange,
  onFileUpload,
  pageSize,
  onPageSizeChange,
  orientation,
  onOrientationChange,
  margin,
  onMarginChange,
}: HtmlToPdfPanelProps) {
  const [activeTab, setActiveTab] = useState<"code" | "upload">(htmlContent ? "code" : "upload");

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          onHtmlContentChange(text);
          setActiveTab("code");
        }
      };
      reader.readAsText(file);
    }
  }

  function handleLoadSample() {
    onHtmlContentChange(DEFAULT_SAMPLE_HTML);
    setActiveTab("code");
  }

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-4 sm:p-6"
      data-testid="html-to-pdf-panel"
    >
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {fileName || translate("htmlToPdf.title")}
            </h2>
            <p className="text-xs text-text-tertiary">
              {htmlContent.length > 0
                ? `${htmlContent.length} caracteres • Modo ${orientation === "portrait" ? "Retrato" : "Paisagem"}`
                : "Insira código HTML ou carregue um arquivo .html"}
            </p>
          </div>
        </div>

        {/* Tab buttons */}
        <div className="flex items-center p-1 rounded-xl bg-surface-secondary border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("code")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "code"
                ? "bg-surface text-text-primary shadow-xs"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <Code className="w-3.5 h-3.5 inline-block mr-1.5" />
            {translate("htmlToPdf.tabCode")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "upload"
                ? "bg-surface text-text-primary shadow-xs"
                : "text-text-tertiary hover:text-text-primary"
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 inline-block mr-1.5" />
            {translate("htmlToPdf.tabUpload")}
          </button>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-surface-secondary/40 border border-border">
        {/* Page Size */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="html-page-size" className="text-xs font-medium text-text-secondary">
            {translate("htmlToPdf.pageSize")}
          </label>
          <select
            id="html-page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(e.target.value as "A4" | "Letter" | "A3")}
            className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="A4">A4 (210 × 297 mm)</option>
            <option value="Letter">Carta / Letter (8.5 × 11 pol)</option>
            <option value="A3">A3 (297 × 420 mm)</option>
          </select>
        </div>

        {/* Orientation */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="html-orientation" className="text-xs font-medium text-text-secondary">
            {translate("htmlToPdf.orientation")}
          </label>
          <select
            id="html-orientation"
            value={orientation}
            onChange={(e) => onOrientationChange(e.target.value as "portrait" | "landscape")}
            className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="portrait">{translate("htmlToPdf.orientationPortrait")}</option>
            <option value="landscape">{translate("htmlToPdf.orientationLandscape")}</option>
          </select>
        </div>

        {/* Margins */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="html-margins" className="text-xs font-medium text-text-secondary">
            {translate("htmlToPdf.margins")}
          </label>
          <select
            id="html-margins"
            value={margin}
            onChange={(e) => onMarginChange(e.target.value as "none" | "small" | "normal" | "wide")}
            className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-hidden focus:ring-2 focus:ring-amber-500/40"
          >
            <option value="none">{translate("htmlToPdf.marginsNone")}</option>
            <option value="small">{translate("htmlToPdf.marginsSmall")}</option>
            <option value="normal">{translate("htmlToPdf.marginsNormal")}</option>
            <option value="wide">{translate("htmlToPdf.marginsWide")}</option>
          </select>
        </div>
      </div>

      {/* Editor & Preview Area */}
      {activeTab === "upload" && !htmlContent ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-surface text-center hover:border-amber-500/50 transition-colors">
          <UploadCloud className="w-12 h-12 text-amber-500 mb-4" />
          <h3 className="text-base font-semibold text-text-primary mb-1">
            Selecione um arquivo HTML
          </h3>
          <p className="text-xs text-text-tertiary mb-6 max-w-sm">
            Formatos suportados: .html, .htm. O arquivo será processado 100% no seu dispositivo.
          </p>
          <label className="cursor-pointer">
            <span className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-medium text-xs hover:bg-amber-600 transition-colors shadow-xs">
              Escolher Arquivo do Computador
            </span>
            <input
              type="file"
              accept=".html,.htm,text/html"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
          <button
            type="button"
            onClick={handleLoadSample}
            className="mt-4 text-xs text-amber-600 hover:underline"
          >
            Ou carregar modelo de exemplo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Code Editor */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
                <FileCode className="w-4 h-4 text-amber-500" />
                Código HTML
              </span>
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
              >
                Carregar Exemplo
              </button>
            </div>
            <textarea
              data-testid="html-code-input"
              value={htmlContent}
              onChange={(e) => onHtmlContentChange(e.target.value)}
              placeholder={translate("htmlToPdf.codePlaceholder")}
              className="w-full h-96 p-4 rounded-2xl border border-border bg-surface font-mono text-xs text-text-primary focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 resize-y"
            />
          </div>

          {/* Live Sandbox Preview */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <Layout className="w-4 h-4 text-amber-500" />
              {translate("htmlToPdf.preview")}
            </span>
            <div className="w-full h-96 rounded-2xl border border-border bg-white overflow-hidden shadow-xs">
              <iframe
                title="Pré-visualização HTML"
                srcDoc={
                  htmlContent ||
                  "<p style='color:#94a3b8;padding:20px;font-family:sans-serif;'>Nenhum código HTML para pré-visualizar.</p>"
                }
                sandbox="allow-same-origin"
                className="w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
