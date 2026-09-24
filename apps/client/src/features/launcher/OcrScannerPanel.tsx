import { Check, Copy, Download, FileSearch, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type OcrScannerPanelProps = {
  isScanning: boolean;
  progress: number;
  recognizedText: string;
  onTextChange?: (text: string) => void;
  fileName?: string;
};

export function OcrScannerPanel({
  isScanning,
  progress,
  recognizedText,
  onTextChange,
  fileName = "documento",
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
    <div className="ocr-scanner-panel">
      {/* Scanner Visual Hero */}
      <div className={`ocr-scanner-stage ${isScanning ? "ocr-scanner-stage--active" : ""}`}>
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
                  ? "Reconhecimento Concluído com Sucesso"
                  : "Pronto para Escanear"}
            </span>
          </div>

          {isScanning && (
            <div className="ocr-progress-track">
              <div className="ocr-progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      </div>

      {/* Caixa de Texto Reconhecido */}
      <div className="ocr-result-container">
        <div className="ocr-result-header">
          <div className="ocr-result-title-group">
            <Sparkles size={16} style={{ color: "var(--color-brand)" }} />
            <h4>{translate("workspace.ocr.resultTitle")}</h4>
            {recognizedText && (
              <span className="ocr-result-metrics">
                {wordCount} palavras • {charCount} caracteres
              </span>
            )}
          </div>

          <div className="ocr-result-actions">
            <Button
              variant="ghost"
              size="compact"
              onClick={handleCopy}
              disabled={!recognizedText || isScanning}
              title="Copiar texto reconhecido"
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
              title="Baixar em formato .txt"
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
              ? "Reconhecendo texto do documento..."
              : "O texto reconhecido aparecerá aqui após o processamento. Você poderá editá-lo diretamente."
          }
          readOnly={isScanning}
          rows={10}
        />
      </div>
    </div>
  );
}
