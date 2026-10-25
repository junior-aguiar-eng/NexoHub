import {
  Check,
  Copy,
  Download,
  FileSearch,
  FileText,
  Languages,
  Sliders,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

export type OcrScannerPanelProps = {
  isScanning: boolean;
  progress: number;
  progressStatus?: string;
  recognizedText: string;
  onTextChange?: (text: string) => void;
  fileName?: string;
  language: "por" | "eng" | "spa";
  onLanguageChange: (lang: "por" | "eng" | "spa") => void;
  outputMode: "searchable-pdf" | "text";
  onOutputModeChange: (mode: "searchable-pdf" | "text") => void;
  enhanceContrast: boolean;
  onEnhanceContrastChange: (enhance: boolean) => void;
};

export function OcrScannerPanel({
  isScanning,
  progress,
  progressStatus,
  recognizedText,
  onTextChange,
  fileName = "documento",
  language,
  onLanguageChange,
  outputMode,
  onOutputModeChange,
  enhanceContrast,
  onEnhanceContrastChange,
}: OcrScannerPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!recognizedText) return;
    try {
      await navigator.clipboard.writeText(recognizedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleDownloadTxt() {
    if (!recognizedText) return;
    const blob = new Blob([recognizedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName.replace(/\.[^/.]+$/, "")}_ocr.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const wordCount = recognizedText.trim() ? recognizedText.trim().split(/\s+/).length : 0;
  const charCount = recognizedText.length;

  return (
    <div className="ilovepdf-compress-container" data-workspace-panel>
      {/* Área Central: Visualização do Scanner e Editor de Texto Reconhecido */}
      <div
        className="ilovepdf-compress-preview-area"
        data-workspace-part="document"
        style={{ flexDirection: "column", gap: "1.25rem", alignItems: "stretch" }}
      >
        {/* Scanner Visual Hero */}
        <div
          className={`ocr-scanner-stage ${isScanning ? "ocr-scanner-stage--active" : ""}`}
          style={{ width: "100%", maxWidth: "100%" }}
        >
          {/* Document Sheet Simulation */}
          <div className="ocr-scanner-sheet">
            <div className="ocr-scanner-sheet-header">
              <span className="ocr-scanner-sheet-dot" />
              <span className="ocr-scanner-sheet-dot" />
              <span className="ocr-scanner-sheet-dot" />
              <span className="ocr-scanner-sheet-title">{fileName}</span>
            </div>

            <div className="ocr-scanner-sheet-lines">
              <div className="ocr-sheet-line ocr-sheet-line--title" />
              <div className="ocr-sheet-line ocr-sheet-line--full" />
              <div className="ocr-sheet-line ocr-sheet-line--full" />
              <div className="ocr-sheet-line ocr-sheet-line--short" />
              <div className="ocr-sheet-line ocr-sheet-line--full" />
              <div className="ocr-sheet-line ocr-sheet-line--mid" />
            </div>

            {/* Laser Scanner Bar Animation */}
            {isScanning && (
              <div className="ocr-laser-beam">
                <div className="ocr-laser-glow" />
              </div>
            )}
          </div>

          {/* Progress & Live Badge */}
          <div className="ocr-scanner-status-card">
            <div className="ocr-scanner-status-header">
              <FileSearch size={16} className={isScanning ? "animate-pulse" : ""} />
              <span>
                {isScanning
                  ? `${translate("workspace.ocr.scanning")} (${progress}%)`
                  : recognizedText
                    ? translate("workspace.ocr.completed")
                    : translate("workspace.ocr.ready")}
              </span>
            </div>

            {progressStatus && (
              <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>
                {progressStatus}
              </span>
            )}

            {isScanning && (
              <div className="ocr-progress-track">
                <div className="ocr-progress-bar" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        </div>

        {/* Caixa de Texto Reconhecido com Cópia e Download Imediato */}
        <div className="ocr-result-container" style={{ width: "100%", margin: 0 }}>
          <div className="ocr-result-header">
            <div className="ocr-result-title-group">
              <Sparkles size={16} style={{ color: "var(--color-brand)" }} />
              <h4>{translate("workspace.ocr.resultTitle")}</h4>
              {recognizedText && (
                <span className="ocr-result-metrics">
                  {wordCount} {translate("workspace.ocr.words")} • {charCount}{" "}
                  {translate("workspace.ocr.chars")}
                </span>
              )}
            </div>

            <div className="ocr-result-actions">
              <Button
                variant="ghost"
                size="compact"
                onClick={handleCopy}
                disabled={!recognizedText || isScanning}
                title={translate("workspace.ocr.copyTooltip")}
              >
                {copied ? (
                  <>
                    <Check size={14} style={{ color: "var(--color-accent-green, #10b981)" }} />
                    <span>{translate("workspace.ocr.copied")}</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>{translate("workspace.ocr.copyText")}</span>
                  </>
                )}
              </Button>

              <Button
                variant="secondary"
                size="compact"
                onClick={handleDownloadTxt}
                disabled={!recognizedText || isScanning}
                title={translate("workspace.ocr.downloadTooltip")}
              >
                <Download size={14} />
                <span>{translate("workspace.ocr.downloadTxt")}</span>
              </Button>
            </div>
          </div>

          <textarea
            className="ocr-result-textarea"
            value={recognizedText}
            onChange={(e) => onTextChange?.(e.target.value)}
            placeholder={
              isScanning
                ? translate("workspace.ocr.scanningPlaceholder")
                : translate("workspace.ocr.idlePlaceholder")
            }
            readOnly={isScanning}
            rows={8}
          />
        </div>
      </div>

      {/* Barra Lateral: Configurações do OCR */}
      <aside className="ilovepdf-compress-options-sidebar" data-workspace-part="options">
        <h3 className="ilovepdf-sidebar-title">{translate("workspace.ocr.optionsTitle")}</h3>
        <p
          className="ilovepdf-control-hint"
          style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}
        >
          {translate("workspace.ocr.optionsDesc")}
        </p>

        {/* Seletor de Idioma */}
        <div style={{ marginTop: "0.5rem" }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.4rem",
            }}
          >
            <Languages size={15} />
            <span>{translate("workspace.ocr.languageLabel")}</span>
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[
              { code: "por" as const, key: "workspace.ocr.langPor" as const, flag: "🇧🇷" },
              { code: "eng" as const, key: "workspace.ocr.langEng" as const, flag: "🇺🇸" },
              { code: "spa" as const, key: "workspace.ocr.langSpa" as const, flag: "🇪🇸" },
            ].map((lang) => {
              const isSelected = language === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  className={`ilovepdf-level-card ${isSelected ? "ilovepdf-level-card--selected" : ""}`}
                  onClick={() => onLanguageChange(lang.code)}
                  style={{
                    padding: "0.5rem 0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                  aria-pressed={isSelected}
                >
                  <span style={{ fontSize: "1.1rem" }}>{lang.flag}</span>
                  <strong style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    {translate(lang.key)}
                  </strong>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formato de Entrega do Resultado */}
        <div style={{ marginTop: "0.5rem" }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.4rem",
            }}
          >
            <FileText size={15} />
            <span>{translate("workspace.ocr.outputFormat")}</span>
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <button
              type="button"
              className={`ilovepdf-level-card ${outputMode === "searchable-pdf" ? "ilovepdf-level-card--selected" : ""}`}
              onClick={() => onOutputModeChange("searchable-pdf")}
              style={{ padding: "0.6rem 0.75rem", textAlign: "left" }}
              aria-pressed={outputMode === "searchable-pdf"}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <strong style={{ fontSize: "0.85rem" }}>
                  {translate("workspace.ocr.outputSearchablePdf")}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {translate("workspace.ocr.outputSearchablePdfDesc")}
                </span>
              </div>
            </button>
            <button
              type="button"
              className={`ilovepdf-level-card ${outputMode === "text" ? "ilovepdf-level-card--selected" : ""}`}
              onClick={() => onOutputModeChange("text")}
              style={{ padding: "0.6rem 0.75rem", textAlign: "left" }}
              aria-pressed={outputMode === "text"}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                <strong style={{ fontSize: "0.85rem" }}>
                  {translate("workspace.ocr.outputText")}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  {translate("workspace.ocr.outputTextDesc")}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Realce de Contraste Adaptativo */}
        <div style={{ marginTop: "0.5rem" }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.4rem",
            }}
          >
            <Sliders size={15} />
            <span>{translate("workspace.ocr.enhanceContrast")}</span>
          </span>
          <button
            type="button"
            className={`ilovepdf-level-card ${enhanceContrast ? "ilovepdf-level-card--selected" : ""}`}
            onClick={() => onEnhanceContrastChange(!enhanceContrast)}
            style={{ padding: "0.6rem 0.75rem", textAlign: "left", width: "100%" }}
            aria-pressed={enhanceContrast}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.8rem", color: "#475569" }}>
                {translate("workspace.ocr.enhanceContrastDesc")}
              </span>
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "4px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: enhanceContrast ? "var(--color-brand)" : "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {enhanceContrast && <Check size={12} color="#ffffff" strokeWidth={3} />}
              </div>
            </div>
          </button>
        </div>
      </aside>
    </div>
  );
}
