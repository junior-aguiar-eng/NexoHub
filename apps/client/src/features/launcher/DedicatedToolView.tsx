import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileCheck,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Sliders,
  Trash2,
  Upload,
} from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import type { DocumentCorePort } from "@/platform/document-core";
import type { LauncherTool } from "./model";

type DedicatedToolViewProps = {
  tool: LauncherTool;
  documentCore: DocumentCorePort;
  onBack: () => void;
  onOperationComplete?: (op: {
    documentName: string;
    toolId: string;
    toolName: string;
    originalSize: number;
    resultSize: number;
    categoryKey:
      | "recent.type.general"
      | "recent.type.document"
      | "recent.type.pdf"
      | "recent.type.procedural"
      | "recent.type.contracts"
      | "recent.type.opinion";
  }) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DedicatedToolView({
  tool,
  documentCore,
  onBack,
  onOperationComplete,
}: DedicatedToolViewProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [compressionLevel, setCompressionLevel] = useState<"recommended" | "extreme" | "less">(
    "recommended",
  );
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [ocrLanguage, setOcrLanguage] = useState<string>("por");
  const [translationSourceLang, setTranslationSourceLang] = useState<string>("en");
  const [translationTargetLang, setTranslationTargetLang] = useState<string>("pt");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const Icon = tool.icon;
  const accent = tool.accentColor || "var(--color-brand)";

  function handleDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  }

  function addFiles(newFiles: File[]) {
    if (tool.id === "pdf-organize" || tool.id === "pdf-merge") {
      setFiles((prev) => [...prev, ...newFiles]);
    } else {
      setFiles(newFiles.slice(0, 1));
    }
    setStatus("idle");
    setDownloadUrl(null);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      setStatus("idle");
      setDownloadUrl(null);
    }
  }

  async function handleExecute() {
    if (files.length === 0) return;
    setStatus("running");
    setProgress(15);

    const primaryFile = files[0];

    try {
      const defaultProjectPath = "/documentos/projeto-local";
      if (documentCore instanceof BrowserDocumentCorePort) {
        for (const file of files) {
          documentCore.registerUploadedFile(file);
        }
      }

      setProgress(30);

      const imported = await documentCore.invoke("import_document", {
        projectPath: defaultProjectPath,
        sourcePath: primaryFile.name,
        mimeType: primaryFile.type || "application/pdf",
        title: primaryFile.name,
      });

      const docId = imported.document.id;
      const artId = imported.artifact.id;
      let outputBlob: Blob | null = null;
      let outName = "";
      let categoryKey: "recent.type.pdf" | "recent.type.document" = "recent.type.pdf";
      let resultSizeBytes = primaryFile.size;

      setProgress(60);

      if (tool.id === "pdf-compress") {
        const compLevel =
          compressionLevel === "extreme" ? 3 : compressionLevel === "less" ? 1 : 2;
        const res = await documentCore.invoke("compress_pdf", {
          projectPath: defaultProjectPath,
          documentId: docId,
          artifactId: artId,
          compressionLevel: compLevel,
        });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_comprimido.pdf`;
        resultSizeBytes = res.artifact.size;
        if (documentCore instanceof BrowserDocumentCorePort) {
          outputBlob = documentCore.getArtifactBlob(res.artifact.id);
        }
      } else if (tool.id === "pdf-organize") {
        const rotDeg = rotation === 90 ? 90 : rotation === 180 ? 180 : rotation === 270 ? 270 : 0;
        const res = await documentCore.invoke("organize_pdf", {
          projectPath: defaultProjectPath,
          documentId: docId,
          artifactId: artId,
          pageOrder: [1],
          rotationDegrees: rotDeg,
        });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_organizado.pdf`;
        resultSizeBytes = res.artifact.size;
        if (documentCore instanceof BrowserDocumentCorePort) {
          outputBlob = documentCore.getArtifactBlob(res.artifact.id);
        }
      } else if (tool.id === "pdf-extract-images") {
        const res = await documentCore.invoke("extract_pdf_images", {
          projectPath: defaultProjectPath,
          documentId: docId,
          artifactId: artId,
        });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_imagens.zip`;
        categoryKey = "recent.type.document";
        resultSizeBytes = res.artifact.size;
        if (documentCore instanceof BrowserDocumentCorePort) {
          outputBlob = documentCore.getArtifactBlob(res.artifact.id);
        }
      } else if (tool.id === "pdf-ocr") {
        const res = await documentCore.invoke("execute_ocr", {
          projectPath: defaultProjectPath,
          documentId: docId,
          artifactId: artId,
        });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_ocr.txt`;
        categoryKey = "recent.type.document";
        resultSizeBytes = res.artifact.size;
        if (documentCore instanceof BrowserDocumentCorePort) {
          outputBlob = documentCore.getArtifactBlob(res.artifact.id);
        }
        if (!outputBlob && res.text) {
          outputBlob = new Blob([res.text], { type: "text/plain;charset=utf-8" });
        }
      } else if (tool.id === "text-translate") {
        const textContent = await primaryFile.text();
        const res = await documentCore.invoke("translate_text", {
          projectPath: defaultProjectPath,
          documentId: docId,
          artifactId: artId,
          text: textContent,
          sourceLanguage: translationSourceLang,
          targetLanguage: translationTargetLang,
        });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_traduzido_${translationTargetLang}.txt`;
        categoryKey = "recent.type.document";
        if (res.artifact) {
          resultSizeBytes = res.artifact.size;
        }
        if (documentCore instanceof BrowserDocumentCorePort && res.artifact) {
          outputBlob = documentCore.getArtifactBlob(res.artifact.id);
        }
        if (!outputBlob && res.text) {
          outputBlob = new Blob([res.text], { type: "text/plain;charset=utf-8" });
          resultSizeBytes = outputBlob.size;
        }
      } else if (tool.id === "text-review") {
        const textContent = await primaryFile.text();
        const res = await documentCore.invoke("create_text_revision", {
          projectPath: defaultProjectPath,
          documentId: docId,
          artifactId: artId,
          content: textContent,
        });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_revisado.txt`;
        categoryKey = "recent.type.document";
        resultSizeBytes = res.artifact.size;
        if (documentCore instanceof BrowserDocumentCorePort) {
          outputBlob = documentCore.getArtifactBlob(res.artifact.id);
        }
      } else if (tool.id === "text-compare") {
        const text1 = await primaryFile.text();
        const text2 = files.length > 1 ? await files[1].text() : text1;
        const diffRes = await import("@nexohub/domain").then((m) => m.diffText(text1, text2));
        const diffLines = diffRes.lines
          .map((l) => `${l.type === "added" ? "+" : l.type === "removed" ? "-" : " "} ${l.content}`)
          .join("\n");
        const diffSummary = `RELATÓRIO DE COMPARAÇÃO DE TEXTO\n================================\nAdições: +${diffRes.stats.additions}\nRemoções: -${diffRes.stats.deletions}\nInalteradas: ${diffRes.stats.unchanged}\n\n${diffLines}`;
        outputBlob = new Blob([diffSummary], { type: "text/plain;charset=utf-8" });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_comparacao.diff.txt`;
        categoryKey = "recent.type.document";
        resultSizeBytes = outputBlob.size;
      } else {
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_processado.pdf`;
        outputBlob = primaryFile;
      }

      if (!outputBlob) {
        outputBlob = new Blob([await primaryFile.arrayBuffer()], {
          type: primaryFile.type || "application/pdf",
        });
      }

      setProgress(100);
      setOutputFileName(outName);

      const url = URL.createObjectURL(outputBlob);
      setDownloadUrl(url);
      setStatus("success");

      onOperationComplete?.({
        documentName: primaryFile.name,
        toolId: tool.id,
        toolName: translate(tool.titleKey),
        originalSize: primaryFile.size,
        resultSize: resultSizeBytes,
        categoryKey,
      });
    } catch (err) {
      console.error("Erro na execução da ferramenta:", err);
      setStatus("error");
    }
  }

  function handleReset() {
    setFiles([]);
    setStatus("idle");
    setProgress(0);
    setDownloadUrl(null);
  }

  return (
    <div className="dedicated-tool-page">
      <header className="dedicated-tool-header">
        <button
          type="button"
          className="dedicated-tool-back-btn"
          onClick={onBack}
          aria-label={translate("dedicated.back")}
        >
          <ArrowLeft size={18} />
          <span>{translate("dedicated.back")}</span>
        </button>

        <div className="dedicated-tool-badge" style={{ borderColor: accent }}>
          <span
            className="dedicated-tool-badge__dot"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
          <span>{translate(tool.titleKey)}</span>
        </div>
      </header>

      <main className="dedicated-tool-content">
        <section className="dedicated-tool-intro">
          <div
            className="dedicated-tool-icon-large"
            style={{ color: accent, backgroundColor: `${accent}18` }}
          >
            <Icon size={36} />
          </div>
          <h1 className="dedicated-tool-title">{translate(tool.titleKey)}</h1>
          <p className="dedicated-tool-desc">{translate(tool.descriptionKey)}</p>
        </section>

        {status === "success" ? (
          <section className="dedicated-tool-success-card">
            <div className="dedicated-tool-success-icon">
              <CheckCircle2 size={48} />
            </div>
            <h2>{translate("dedicated.successTitle")}</h2>
            <p className="dedicated-tool-success-filename">{outputFileName}</p>

            <div className="dedicated-tool-success-actions">
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={outputFileName}
                  className="dedicated-tool-download-btn"
                  style={{ backgroundColor: accent }}
                >
                  <Download size={18} />
                  <span>{translate("dedicated.download")}</span>
                </a>
              )}
              <Button variant="secondary" onClick={handleReset}>
                <RefreshCw size={16} />
                <span>{translate("dedicated.processAnother")}</span>
              </Button>
            </div>
          </section>
        ) : files.length === 0 ? (
          <section
            className={`dedicated-tool-dropzone ${isDragging ? "dedicated-tool-dropzone--active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="visually-hidden"
              multiple={tool.id === "pdf-organize"}
              accept={
                tool.suite === "text"
                  ? ".txt,.md,.pdf,.docx"
                  : ".pdf,application/pdf,image/*"
              }
              onChange={handleFileInput}
            />
            <div
              className="dedicated-tool-dropzone__btn"
              style={{ backgroundColor: accent }}
            >
              <Upload size={22} />
              <span>{translate("dedicated.selectFiles")}</span>
            </div>
            <p className="dedicated-tool-dropzone__hint">
              {translate("dedicated.orDragDrop")}
            </p>
          </section>
        ) : (
          <div className="dedicated-tool-workspace">
            <div className="dedicated-tool-files-list">
              <div className="dedicated-tool-files-header">
                <h3>
                  {files.length} {translate("dedicated.filesCount")}
                </h3>
                {tool.id === "pdf-organize" && (
                  <Button
                    variant="secondary"
                    className="dedicated-tool-add-more-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus size={16} />
                    <span>{translate("dedicated.selectMoreFiles")}</span>
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="visually-hidden"
                  multiple
                  accept=".pdf,application/pdf"
                  onChange={handleFileInput}
                />
              </div>

              <div className="dedicated-tool-files-grid">
                {files.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="dedicated-tool-file-card">
                    <div className="dedicated-tool-file-card__icon" style={{ color: accent }}>
                      <FileText size={28} />
                    </div>
                    <div className="dedicated-tool-file-card__info">
                      <span className="dedicated-tool-file-card__name" title={file.name}>
                        {file.name}
                      </span>
                      <span className="dedicated-tool-file-card__size">
                        {formatFileSize(file.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="dedicated-tool-file-card__remove"
                      onClick={() => removeFile(idx)}
                      title="Remover arquivo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Painel de Opções */}
            <aside className="dedicated-tool-options-panel">
              <div className="dedicated-tool-options-header">
                <Sliders size={18} />
                <h3>{translate("dedicated.optionsTitle")}</h3>
              </div>

              {tool.id === "pdf-compress" && (
                <div className="dedicated-tool-options-group">
                  <label className="dedicated-tool-label">
                    {translate("dedicated.compressionLevel")}
                  </label>
                  <div className="dedicated-tool-radio-group">
                    <button
                      type="button"
                      className={`dedicated-tool-radio-item ${compressionLevel === "extreme" ? "dedicated-tool-radio-item--selected" : ""}`}
                      onClick={() => setCompressionLevel("extreme")}
                    >
                      <strong>{translate("dedicated.compressionExtreme")}</strong>
                    </button>
                    <button
                      type="button"
                      className={`dedicated-tool-radio-item ${compressionLevel === "recommended" ? "dedicated-tool-radio-item--selected" : ""}`}
                      onClick={() => setCompressionLevel("recommended")}
                    >
                      <strong>{translate("dedicated.compressionRecommended")}</strong>
                    </button>
                    <button
                      type="button"
                      className={`dedicated-tool-radio-item ${compressionLevel === "less" ? "dedicated-tool-radio-item--selected" : ""}`}
                      onClick={() => setCompressionLevel("less")}
                    >
                      <strong>{translate("dedicated.compressionLess")}</strong>
                    </button>
                  </div>
                </div>
              )}

              {tool.id === "pdf-ocr" && (
                <div className="dedicated-tool-options-group">
                  <label className="dedicated-tool-label">
                    {translate("dedicated.ocrLang")}
                  </label>
                  <select
                    className="dedicated-tool-select"
                    value={ocrLanguage}
                    onChange={(e) => setOcrLanguage(e.target.value)}
                  >
                    <option value="por">Português (Brasil)</option>
                    <option value="eng">Inglês (English)</option>
                    <option value="spa">Espanhol (Español)</option>
                  </select>
                </div>
              )}

              {tool.id === "text-translate" && (
                <div className="dedicated-tool-options-group">
                  <label className="dedicated-tool-label">
                    Idioma de Origem
                  </label>
                  <select
                    className="dedicated-tool-select"
                    value={translationSourceLang}
                    onChange={(e) => setTranslationSourceLang(e.target.value)}
                  >
                    <option value="en">Inglês (English)</option>
                    <option value="pt">Português (Brasil)</option>
                    <option value="es">Espanhol (Español)</option>
                  </select>

                  <label className="dedicated-tool-label" style={{ marginTop: "12px" }}>
                    Idioma de Destino
                  </label>
                  <select
                    className="dedicated-tool-select"
                    value={translationTargetLang}
                    onChange={(e) => setTranslationTargetLang(e.target.value)}
                  >
                    <option value="pt">Português (Brasil)</option>
                    <option value="en">Inglês (English)</option>
                    <option value="es">Espanhol (Español)</option>
                  </select>
                </div>
              )}

              <div className="dedicated-tool-action-bar">
                <Button
                  variant="primary"
                  className="dedicated-tool-action-btn"
                  style={{ backgroundColor: accent }}
                  disabled={status === "running"}
                  onClick={handleExecute}
                >
                  {status === "running" ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{translate("dedicated.processing")}</span>
                    </>
                  ) : (
                    <>
                      <Icon size={18} />
                      <span>{translate("dedicated.actionRun")}</span>
                    </>
                  )}
                </Button>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
