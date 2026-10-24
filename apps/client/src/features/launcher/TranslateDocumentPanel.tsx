import { ArrowRightLeft, Check, Copy, Download, Languages, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { TranslationLanguage, TranslationProgressInfo } from "@/platform/browser-translator";

type TranslateDocumentPanelProps = {
  sourceLang: TranslationLanguage;
  targetLang: TranslationLanguage;
  onSourceLangChange: (lang: TranslationLanguage) => void;
  onTargetLangChange: (lang: TranslationLanguage) => void;
  onSwapLanguages: () => void;
  translatedText: string;
  onTranslatedTextChange: (text: string) => void;
  isRunning: boolean;
  progressPercent: number;
  progressStatusMessage?: string;
  accentColor?: string;
  outputFileName?: string;
  outputBlob?: Blob;
  progressPhase?: TranslationProgressInfo["status"];
  loadedBytes?: number;
  totalBytes?: number;
  onCancel?: () => void;
};

export function TranslateDocumentPanel({
  sourceLang,
  targetLang,
  onSourceLangChange,
  onTargetLangChange,
  onSwapLanguages,
  translatedText,
  onTranslatedTextChange,
  isRunning,
  progressPercent,
  progressStatusMessage,
  accentColor = "#06b6d4",
  outputFileName = "documento_traduzido.txt",
  progressPhase,
  loadedBytes,
  totalBytes,
  onCancel,
}: TranslateDocumentPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!translatedText) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function handleDownload() {
    if (!translatedText) return;
    const blob = new Blob([translatedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="ilovepdf-translate-container"
      style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}
    >
      {/* Barra superior de seleção de idiomas e privacidade */}
      <div
        className="ilovepdf-translate-lang-bar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          background: "rgba(6, 182, 212, 0.05)",
          borderRadius: "0.75rem",
          border: "1px solid rgba(6, 182, 212, 0.15)",
        }}
      >
        <div className="translate-language-controls">
          {/* Seletor Origem */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <label
              htmlFor="translate-source-lang"
              style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}
            >
              {translate("workspace.translate.sourceLang")}
            </label>
            <select
              id="translate-source-lang"
              value={sourceLang}
              onChange={(e) => onSourceLangChange(e.target.value as TranslationLanguage)}
              disabled={isRunning}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#1e293b",
                cursor: isRunning ? "not-allowed" : "pointer",
              }}
            >
              <option value="en">{translate("workspace.translate.lang.en")}</option>
              <option value="pt">{translate("workspace.translate.lang.pt")}</option>
              <option value="es">{translate("workspace.translate.lang.es")}</option>
            </select>
          </div>

          {/* Botão Inverter */}
          <button
            type="button"
            onClick={onSwapLanguages}
            disabled={isRunning}
            title={translate("workspace.translate.swapTitle")}
            style={{
              marginTop: "1.1rem",
              padding: "0.45rem",
              borderRadius: "0.5rem",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              cursor: isRunning ? "not-allowed" : "pointer",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowRightLeft size={16} />
          </button>

          {/* Seletor Destino */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
            <label
              htmlFor="translate-target-lang"
              style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}
            >
              {translate("workspace.translate.targetLang")}
            </label>
            <select
              id="translate-target-lang"
              value={targetLang}
              onChange={(e) => onTargetLangChange(e.target.value as TranslationLanguage)}
              disabled={isRunning}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#1e293b",
                cursor: isRunning ? "not-allowed" : "pointer",
              }}
            >
              <option value="pt">{translate("workspace.translate.lang.pt")}</option>
              <option value="en">{translate("workspace.translate.lang.en")}</option>
              <option value="es">{translate("workspace.translate.lang.es")}</option>
            </select>
          </div>
        </div>

        {/* Badge informativo de privacidade e offline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.75rem",
            color: "#0891b2",
            fontWeight: 500,
          }}
        >
          <Sparkles size={14} />
          <span>{translate("workspace.translate.offlineBadge")}</span>
        </div>
      </div>

      {/* Caixa de Progresso de Download / Tradução em Tempo Real */}
      {isRunning && (
        <div
          style={{
            padding: "0.875rem 1rem",
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#166534" }}>
              {progressStatusMessage || translate("workspace.translate.translating")}
            </span>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#166534" }}>
              {progressPercent}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-label={progressStatusMessage || translate("workspace.translate.preparing")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            style={{
              width: "100%",
              height: "6px",
              background: "#dcfce7",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: "#16a34a",
                transition: "width 0.2s ease-in-out",
              }}
            />
          </div>

          {progressPhase === "downloading" && (
            <span style={{ fontSize: "0.75rem", color: "#15803d" }}>
              {translate("workspace.translate.downloadNotice")}
            </span>
          )}
          {typeof loadedBytes === "number" && loadedBytes > 0 && (
            <span style={{ fontSize: "0.75rem", color: "#15803d" }}>
              {(loadedBytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB
              {typeof totalBytes === "number" && totalBytes > 0
                ? ` / ${(totalBytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`
                : ""}
            </span>
          )}
          {onCancel && (
            <Button variant="secondary" onClick={onCancel}>
              {translate("workspace.translate.cancel")}
            </Button>
          )}
        </div>
      )}

      {/* Área de Resultado da Tradução */}
      <div
        className="text-translate-visual-panel"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          border: "1px solid #e2e8f0",
          borderRadius: "0.75rem",
          padding: "1rem",
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div
          className="translate-result-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "0.5rem",
            borderBottom: "1px solid #f1f5f9",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Languages size={18} style={{ color: accentColor }} />
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#0f172a" }}>
              {translate("workspace.translate.title")}
            </h4>
          </div>

          <div className="translate-result-actions">
            <Button
              variant="ghost"
              size="compact"
              onClick={handleCopy}
              disabled={!translatedText || isRunning}
              title={translate("workspace.translate.copyTooltip")}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span style={{ marginLeft: "0.3rem" }}>
                {copied ? translate("workspace.ocr.copied") : translate("workspace.translate.copy")}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="compact"
              onClick={handleDownload}
              disabled={!translatedText || isRunning}
              title={translate("workspace.translate.downloadTooltip")}
            >
              <Download size={14} />
              <span style={{ marginLeft: "0.3rem" }}>
                {translate("workspace.translate.download")}
              </span>
            </Button>
          </div>
        </div>

        <textarea
          className="text-translate-output-textarea"
          value={translatedText}
          disabled={isRunning}
          aria-label={translate("workspace.translate.outputLabel")}
          onChange={(e) => onTranslatedTextChange(e.target.value)}
          placeholder={
            isRunning
              ? translate("workspace.translate.translating")
              : translate("workspace.translate.outputPlaceholder")
          }
          rows={12}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "0.75rem",
            fontSize: "0.9rem",
            lineHeight: "1.5",
            borderRadius: "0.5rem",
            border: "1px solid #cbd5e1",
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
            color: "#1e293b",
          }}
        />
      </div>
    </div>
  );
}
