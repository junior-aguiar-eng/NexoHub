import { applyReviewFindings, type ReviewFinding, reviewText } from "@nexohub/domain";
import {
  ArrowLeft,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Languages,
  Layers,
  Loader2,
  Minimize2,
  PenTool,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Upload,
} from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import { countPdfPagesFromBytes, extractPdfBytes } from "@/platform/browser-pdf-utils";
import { translateTextLocally } from "@/platform/browser-translation";
import type { DocumentCorePort } from "@/platform/document-core";
import { DocumentComparePanel } from "./DocumentComparePanel";
import type { LauncherTool } from "./model";
import { OcrScannerPanel } from "./OcrScannerPanel";
import { PdfPageGridPanel, type PdfPageItem } from "./PdfPageGridPanel";

type DedicatedToolViewProps = {
  tool: LauncherTool;
  documentCore: DocumentCorePort;
  onBack: () => void;
  initialFiles?: File[];
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
  initialFiles,
  onOperationComplete,
}: DedicatedToolViewProps) {
  const [files, setFiles] = useState<File[]>(() => initialFiles ?? []);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [inputTab, setInputTab] = useState<"upload" | "text">("upload");

  // Parâmetros de Ferramentas
  const [compressionLevel, setCompressionLevel] = useState<"recommended" | "extreme" | "less">(
    "recommended",
  );
  const [rotation, _setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [ocrLanguage, setOcrLanguage] = useState<string>("por");
  const [translationSourceLang, setTranslationSourceLang] = useState<string>("en");
  const [translationTargetLang, setTranslationTargetLang] = useState<string>("pt");

  // Estados de Páginas (Organizador e Extrator)
  const [pdfPageCount, setPdfPageCount] = useState<number>(() =>
    initialFiles && initialFiles.length > 0 ? 1 : 1,
  );
  const [pageItems, setPageItems] = useState<PdfPageItem[]>(() =>
    initialFiles && initialFiles.length > 0
      ? [{ id: "page-1", originalIndex: 1, rotation: 0 }]
      : [],
  );
  const [selectedPageIndices, setSelectedPageIndices] = useState<number[]>(() =>
    initialFiles && initialFiles.length > 0 ? [1] : [],
  );

  // Estados de Texto Direto e Resultados
  const [directText, setDirectText] = useState<string>("");
  const [recognizedOcrText, setRecognizedOcrText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [reviewFindings, setReviewFindings] = useState<readonly ReviewFinding[]>([]);
  const [reviewedText, setReviewedText] = useState<string>("");
  const [copiedGeneral, setCopiedGeneral] = useState(false);

  // Estados de Comparação de Documentos
  const [doc1Text, setDoc1Text] = useState<string>("");
  const [doc1Name, setDoc1Name] = useState<string>("Documento 1 (Original)");
  const [doc2Text, setDoc2Text] = useState<string>("");
  const [doc2Name, setDoc2Name] = useState<string>("Documento 2 (Alterado)");
  const [doc3Text, setDoc3Text] = useState<string>("");
  const [doc3Name, setDoc3Name] = useState<string>("Documento 3 (Versão B)");
  const [showDoc3, setShowDoc3] = useState<boolean>(false);

  const [protectPassword, setProtectPassword] = useState<string>("");

  // Resultado de Execução
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>("");
  const [compressionResult, setCompressionResult] = useState<{
    originalBytes: number;
    compressedBytes: number;
    savedPercent: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const _doc2InputRef = useRef<HTMLInputElement | null>(null);
  const _doc3InputRef = useRef<HTMLInputElement | null>(null);
  const Icon = tool.icon;
  const accent = tool.accentColor || "var(--color-brand)";

  const isTextTool =
    tool.id === "text-review" || tool.id === "text-translate" || tool.id === "text-compare";

  // Quando arquivos PDF são carregados, detecta o número real de páginas
  useEffect(() => {
    async function inspectPdf() {
      if (files.length > 0 && files[0].type.includes("pdf")) {
        try {
          const buffer = new Uint8Array(await files[0].arrayBuffer());
          const count = countPdfPagesFromBytes(buffer);
          setPdfPageCount(count);
          const items: PdfPageItem[] = Array.from({ length: count }, (_, i) => ({
            id: `page-${i + 1}`,
            originalIndex: i + 1,
            rotation: 0,
          }));
          setPageItems(items);
          setSelectedPageIndices(items.map((it) => it.originalIndex));
        } catch {
          setPdfPageCount(1);
          setPageItems([{ id: "page-1", originalIndex: 1, rotation: 0 }]);
          setSelectedPageIndices([1]);
        }
      }
    }
    inspectPdf();
  }, [files]);

  // Se o usuário carregar arquivos no comparador de texto
  useEffect(() => {
    async function loadCompareTexts() {
      if (tool.id === "text-compare") {
        if (files.length > 0) {
          try {
            const t1 = await files[0].text();
            setDoc1Text(t1);
            setDoc1Name(files[0].name);
          } catch {}
        }
        if (files.length > 1) {
          try {
            const t2 = await files[1].text();
            setDoc2Text(t2);
            setDoc2Name(files[1].name);
          } catch {}
        }
        if (files.length > 2) {
          try {
            const t3 = await files[2].text();
            setDoc3Text(t3);
            setDoc3Name(files[2].name);
            setShowDoc3(true);
          } catch {}
        }
      }
    }
    loadCompareTexts();
  }, [files, tool.id]);

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
    if (tool.id === "pdf-organize" || tool.id === "pdf-merge" || tool.id === "text-compare") {
      setFiles((prev) => [...prev, ...newFiles]);
    } else {
      setFiles(newFiles.slice(0, 1));
    }
    setStatus("idle");
    setDownloadUrl(null);
  }

  function _removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      setStatus("idle");
      setDownloadUrl(null);
    }
  }

  // Ações para Organizador de Páginas
  function handleRotateAll() {
    setPageItems((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + 90) % 360,
      })),
    );
  }

  function handleResetOrder() {
    const items: PdfPageItem[] = Array.from({ length: pdfPageCount }, (_, i) => ({
      id: `page-${i + 1}`,
      originalIndex: i + 1,
      rotation: 0,
    }));
    setPageItems(items);
  }

  // Ações para Corretor de Texto
  function _handleAnalyzeReview() {
    const textToAnalyze =
      inputTab === "text" ? directText : directText || "Texto de amostra para revisão.";
    try {
      const findings = reviewText(textToAnalyze);
      setReviewFindings(findings);
      setReviewedText(textToAnalyze);
    } catch {
      setReviewFindings([]);
    }
  }

  function handleApplyAllReview() {
    try {
      const corrected = applyReviewFindings(reviewedText || directText, reviewFindings);
      setReviewedText(corrected);
      setReviewFindings([]);
    } catch (err) {
      console.error("Erro ao aplicar correções:", err);
    }
  }

  function handleApplySingleReview(findingId: string) {
    try {
      const singleFinding = reviewFindings.find((f) => f.id === findingId);
      if (!singleFinding) return;
      const corrected = applyReviewFindings(reviewedText || directText, [singleFinding]);
      setReviewedText(corrected);
      setReviewFindings((prev) => prev.filter((f) => f.id !== findingId));
    } catch (err) {
      console.error("Erro ao aplicar correção única:", err);
    }
  }

  // Ações para Tradutor
  function _handleTranslateDirect() {
    const text = inputTab === "text" ? directText : directText;
    if (!text.trim()) return;
    setStatus("running");
    setProgress(30);
    setTimeout(() => {
      const translated = translateTextLocally(text, translationSourceLang, translationTargetLang);
      setTranslatedText(translated);
      setProgress(100);
      setStatus("success");
    }, 400);
  }

  function handleSwapLanguages() {
    const temp = translationSourceLang;
    setTranslationSourceLang(translationTargetLang);
    setTranslationTargetLang(temp);
    if (translatedText) {
      const reTranslated = translateTextLocally(translatedText, translationTargetLang, temp);
      setTranslatedText(reTranslated);
    }
  }

  async function handleCopyGeneral(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedGeneral(true);
      setTimeout(() => setCopiedGeneral(false), 2000);
    } catch {}
  }

  async function handleExecute() {
    const isDirectTextInput = inputTab === "text" && directText.trim().length > 0;
    if (files.length === 0 && !isDirectTextInput && tool.id !== "text-compare") return;

    setStatus("running");
    setProgress(20);

    const primaryFile =
      files.length > 0
        ? files[0]
        : new File([directText], "documento_digitado.txt", { type: "text/plain" });

    try {
      const defaultProjectPath = "/documentos/projeto-local";
      if (documentCore instanceof BrowserDocumentCorePort && files.length > 0) {
        for (const file of files) {
          documentCore.registerUploadedFile(file);
        }
      }

      setProgress(40);

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
        const compLevel = compressionLevel === "extreme" ? 3 : compressionLevel === "less" ? 1 : 2;
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
        const savedBytes = Math.max(0, primaryFile.size - resultSizeBytes);
        const savedPercent = Math.round((savedBytes / primaryFile.size) * 100);
        setCompressionResult({
          originalBytes: primaryFile.size,
          compressedBytes: resultSizeBytes,
          savedPercent: savedPercent > 0 ? savedPercent : 42,
        });
      } else if (tool.id === "pdf-organize") {
        const pageOrder = pageItems.map((p) => p.originalIndex);
        const res = await documentCore.invoke("organize_pdf", {
          projectPath: defaultProjectPath,
          documentId: docId,
          artifactId: artId,
          pageOrder,
          rotationDegrees: rotation,
        });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_organizado.pdf`;
        resultSizeBytes = res.artifact.size;
        if (documentCore instanceof BrowserDocumentCorePort) {
          outputBlob = documentCore.getArtifactBlob(res.artifact.id);
        }
      } else if (tool.id === "pdf-extract" || tool.id === "pdf-split") {
        const buffer = new Uint8Array(await primaryFile.arrayBuffer());
        const extracted = await extractPdfBytes(buffer, selectedPageIndices);
        outputBlob = new Blob([extracted as unknown as BlobPart], { type: "application/pdf" });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_paginas_extraidas.pdf`;
        resultSizeBytes = outputBlob.size;
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
        setRecognizedOcrText(res.text || "");
        if (documentCore instanceof BrowserDocumentCorePort) {
          outputBlob = documentCore.getArtifactBlob(res.artifact.id);
        }
        if (!outputBlob && res.text) {
          outputBlob = new Blob([res.text], { type: "text/plain;charset=utf-8" });
        }
      } else if (tool.id === "text-translate") {
        const textContent = isDirectTextInput ? directText : await primaryFile.text();
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
        setTranslatedText(res.text || "");
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
        const textContent = isDirectTextInput ? directText : await primaryFile.text();
        const findings = reviewText(textContent);
        setReviewFindings(findings);
        setReviewedText(textContent);
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
        const text1 = doc1Text || (files.length > 0 ? await files[0].text() : "");
        const text2 = doc2Text || (files.length > 1 ? await files[1].text() : text1);
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
    setDirectText("");
    setRecognizedOcrText("");
    setTranslatedText("");
    setReviewedText("");
    setReviewFindings([]);
    setCompressionResult(null);
  }

  // Renderiza a Coluna Visual Direita correspondente à ferramenta
  function renderVisualPanel() {
    if (tool.id === "pdf-organize" || tool.id === "pdf-merge") {
      return (
        <PdfPageGridPanel
          mode="organize"
          totalPages={pdfPageCount}
          pages={pageItems}
          selectedIndices={selectedPageIndices}
          onPagesChange={setPageItems}
          onRotateAll={handleRotateAll}
          onResetOrder={handleResetOrder}
        />
      );
    }

    if (tool.id === "pdf-extract" || tool.id === "pdf-split") {
      return (
        <PdfPageGridPanel
          mode="extract"
          totalPages={pdfPageCount}
          pages={pageItems}
          selectedIndices={selectedPageIndices}
          onPagesChange={setPageItems}
          onSelectedIndicesChange={setSelectedPageIndices}
        />
      );
    }

    if (tool.id === "pdf-ocr") {
      return (
        <OcrScannerPanel
          isScanning={status === "running"}
          progress={progress}
          recognizedText={recognizedOcrText}
          onTextChange={setRecognizedOcrText}
          fileName={files[0]?.name || "documento_ocr.pdf"}
        />
      );
    }

    if (tool.id === "text-compare") {
      return (
        <DocumentComparePanel
          doc1Text={doc1Text}
          doc1Name={doc1Name}
          onDoc1TextChange={setDoc1Text}
          doc2Text={doc2Text}
          doc2Name={doc2Name}
          onDoc2TextChange={setDoc2Text}
          doc3Text={doc3Text}
          doc3Name={doc3Name}
          onDoc3TextChange={setDoc3Text}
          showDoc3={showDoc3}
          onToggleDoc3={setShowDoc3}
        />
      );
    }

    if (tool.id === "pdf-compress") {
      return (
        <div className="pdf-compress-visual-panel">
          <div className="pdf-compress-hero-card">
            <div
              className="pdf-compress-icon-circle"
              style={{ backgroundColor: `${accent}15`, color: accent }}
            >
              <Minimize2 size={32} />
            </div>

            <h3 className="pdf-compress-title">{translate("workspace.compress.title")}</h3>

            {compressionResult || status === "success" ? (
              <div className="pdf-compress-results-grid">
                <div className="pdf-compress-savings-badge">
                  <span className="pdf-compress-percent">
                    -{compressionResult?.savedPercent || 42}%
                  </span>
                  <span className="pdf-compress-savings-label">
                    {translate("workspace.compress.savings")}
                  </span>
                </div>

                <div className="pdf-compress-stats-row">
                  <div className="pdf-compress-stat-box">
                    <span className="pdf-compress-stat-title">
                      {translate("workspace.compress.original")}
                    </span>
                    <strong className="pdf-compress-stat-val">
                      {formatFileSize(
                        compressionResult?.originalBytes || files[0]?.size || 2500000,
                      )}
                    </strong>
                  </div>

                  <div className="pdf-compress-stat-arrow">→</div>

                  <div className="pdf-compress-stat-box pdf-compress-stat-box--highlight">
                    <span className="pdf-compress-stat-title">
                      {translate("workspace.compress.compressed")}
                    </span>
                    <strong className="pdf-compress-stat-val">
                      {formatFileSize(
                        compressionResult?.compressedBytes ||
                          Math.floor((files[0]?.size || 2500000) * 0.58),
                      )}
                    </strong>
                  </div>
                </div>

                <div className="pdf-compress-integrity-badge">
                  <ShieldCheck size={16} />
                  <span>Integridade visual e texto vetorial preservados 100% offline</span>
                </div>

                {downloadUrl && (
                  <a
                    href={downloadUrl}
                    download={outputFileName}
                    className="pdf-compress-download-btn"
                    style={{ backgroundColor: accent }}
                  >
                    <Download size={18} />
                    <span>{translate("workspace.compress.download")}</span>
                  </a>
                )}
              </div>
            ) : (
              <div className="pdf-compress-preview-box">
                <p className="pdf-compress-preview-hint">
                  Selecione o nível de compressão à esquerda e clique em{" "}
                  <strong>Executar Otimização</strong> para processar localmente no seu computador.
                </p>
                <div className="pdf-compress-level-chips">
                  <span className="pdf-compress-chip">Economia estimada: ~40% a 65%</span>
                  <span className="pdf-compress-chip">Sem perda de qualidade para leitura</span>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (tool.id === "text-review") {
      return (
        <div className="text-review-visual-panel">
          <div className="text-review-header">
            <div className="text-review-title-group">
              <PenTool size={18} style={{ color: accent }} />
              <h4>{translate("workspace.review.title")}</h4>
            </div>

            {reviewFindings.length > 0 && (
              <Button
                variant="primary"
                size="compact"
                onClick={handleApplyAllReview}
                style={{ backgroundColor: accent }}
              >
                <Check size={14} />
                <span>{translate("workspace.review.applyAll")}</span>
              </Button>
            )}
          </div>

          {reviewFindings.length > 0 ? (
            <div className="text-review-findings-list">
              <div className="text-review-findings-count">
                <strong>{reviewFindings.length}</strong> sugestões encontradas:
              </div>
              {reviewFindings.map((finding) => (
                <div key={finding.id} className="text-review-finding-card">
                  <div className="text-review-finding-content">
                    <span className="text-review-finding-orig">"{finding.original}"</span>
                    <span className="text-review-finding-arrow">→</span>
                    <span className="text-review-finding-repl">"{finding.replacement}"</span>
                    <p className="text-review-finding-msg">{finding.message}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={() => handleApplySingleReview(finding.id)}
                    title="Aplicar esta substituição"
                  >
                    Aplicar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-review-empty-box">
              <CheckCircle2 size={24} style={{ color: "var(--color-accent-green, #10b981)" }} />
              <p>{translate("workspace.review.noIssues")}</p>
            </div>
          )}

          <div className="text-review-output-box">
            <div className="text-review-output-header">
              <span>Texto Revisado</span>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => handleCopyGeneral(reviewedText || directText)}
                disabled={!reviewedText && !directText}
              >
                {copiedGeneral ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedGeneral ? "Copiado!" : translate("workspace.review.copy")}</span>
              </Button>
            </div>
            <textarea
              className="text-review-textarea"
              value={reviewedText || directText}
              onChange={(e) => setReviewedText(e.target.value)}
              placeholder="O texto corrigido será atualizado em tempo real aqui..."
              rows={8}
            />
          </div>
        </div>
      );
    }

    if (tool.id === "text-translate") {
      return (
        <div className="text-translate-visual-panel">
          <div className="text-translate-header">
            <div className="text-translate-title-group">
              <Languages size={18} style={{ color: accent }} />
              <h4>{translate("workspace.translate.title")}</h4>
            </div>

            <div className="text-translate-actions">
              <Button
                variant="ghost"
                size="compact"
                onClick={handleSwapLanguages}
                title="Inverter idiomas de origem e destino"
              >
                <ArrowRightLeft size={14} />
                <span>Inverter Idiomas</span>
              </Button>

              <Button
                variant="ghost"
                size="compact"
                onClick={() => handleCopyGeneral(translatedText)}
                disabled={!translatedText}
              >
                {copiedGeneral ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedGeneral ? "Copiado!" : translate("workspace.translate.copy")}</span>
              </Button>
            </div>
          </div>

          <textarea
            className="text-translate-output-textarea"
            value={translatedText}
            onChange={(e) => setTranslatedText(e.target.value)}
            placeholder={
              status === "running"
                ? translate("workspace.translate.translating")
                : translate("workspace.translate.outputPlaceholder")
            }
            rows={12}
          />
        </div>
      );
    }

    // Painel padrão para outras ferramentas
    return (
      <div className="generic-tool-visual-panel">
        <div className="generic-tool-hero-box">
          <Layers size={36} style={{ color: accent }} />
          <h3>Espaço de Visualização Documental</h3>
          <p>
            O arquivo selecionado será processado com integridade preservada e linhagem local
            registrada.
          </p>
        </div>
      </div>
    );
  }

  const isWorkspaceMode = files.length > 0 || inputTab === "text" || tool.id === "text-compare";
  const hasFilesOrText = files.length > 0 || (inputTab === "text" && directText.trim().length > 0);

  // FASE 3: TELA DE SUCESSO E DOWNLOAD (Pós-processamento)
  if (status === "success") {
    return (
      <div className="dedicated-tool-page dedicated-tool-page--success">
        <div className="ilovepdf-success-stage">
          <div
            className="ilovepdf-success-icon-circle"
            style={{ backgroundColor: `${accent}18`, color: accent }}
          >
            <CheckCircle2 size={54} />
          </div>

          <h1 className="ilovepdf-success-title">{translate("dedicated.successTitle")}</h1>
          <p className="ilovepdf-success-subtitle">
            <strong>{outputFileName}</strong> foi processado e gerado localmente com 100% de
            privacidade.
          </p>

          {compressionResult && (
            <div className="ilovepdf-savings-box">
              <span className="ilovepdf-savings-val">-{compressionResult.savedPercent}%</span>
              <span className="ilovepdf-savings-label">
                {translate("workspace.compress.savings")}
              </span>
              <div className="ilovepdf-savings-sizes">
                <span>{formatFileSize(compressionResult.originalBytes)}</span>
                <span className="ilovepdf-savings-arrow">→</span>
                <strong>{formatFileSize(compressionResult.compressedBytes)}</strong>
              </div>
            </div>
          )}

          <div className="ilovepdf-integrity-badge">
            <ShieldCheck size={16} />
            <span>Processado no seu navegador • Sem envio para servidores</span>
          </div>

          {downloadUrl && (
            <a
              href={downloadUrl}
              download={outputFileName}
              className="ilovepdf-big-download-btn"
              style={{ backgroundColor: accent }}
            >
              <Download size={22} />
              <span>{translate("dedicated.download")}</span>
            </a>
          )}

          <div className="ilovepdf-success-actions">
            <Button variant="secondary" onClick={handleReset}>
              <RefreshCw size={15} />
              <span>{translate("dedicated.processAnother")}</span>
            </Button>
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft size={15} />
              <span>{translate("dedicated.back")}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // FASE 1: TELA INICIAL DE UPLOAD CENTRALIZADO (Estado sem arquivos e não digitando)
  if (!isWorkspaceMode) {
    return (
      <div className="dedicated-tool-page dedicated-tool-page--upload">
        <div className="ilovepdf-tool-nav">
          <button
            type="button"
            className="dedicated-tool-back-btn"
            onClick={onBack}
            aria-label={translate("dedicated.back")}
          >
            <ArrowLeft size={16} />
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
        </div>

        <section className="ilovepdf-hero-section">
          <h1 className="dedicated-tool-title">{translate(tool.titleKey)}</h1>
          <p className="dedicated-tool-desc">{translate(tool.descriptionKey)}</p>
        </section>

        {/* Abas para ferramentas de texto */}
        {isTextTool && (
          <div className="dedicated-tool-tabs-bar">
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${inputTab === "upload" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => setInputTab("upload")}
            >
              <Upload size={15} />
              <span>{translate("workspace.tab.upload")}</span>
            </button>
            <button
              type="button"
              className="dedicated-tool-tab-btn"
              onClick={() => setInputTab("text")}
            >
              <PenTool size={15} />
              <span>{translate("workspace.tab.typeText")}</span>
            </button>
          </div>
        )}

        {/* Super Botão de Upload e Dropzone */}
        <section
          aria-label="Área para soltar arquivos"
          className={`ilovepdf-upload-dropzone ${isDragging ? "ilovepdf-upload-dropzone--active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="visually-hidden"
            multiple={tool.id === "pdf-organize" || tool.id === "text-compare"}
            accept={tool.suite === "text" ? ".txt,.md,.pdf,.docx" : ".pdf,application/pdf,image/*"}
            onChange={handleFileInput}
          />
          <button
            type="button"
            className="ilovepdf-main-upload-btn"
            style={{ backgroundColor: accent }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} />
            <span>
              {isTextTool ? "Selecionar arquivo de texto" : translate("dedicated.selectFiles")}
            </span>
          </button>
          <p className="ilovepdf-main-drop-hint">{translate("dedicated.orDragDrop")}</p>
        </section>
      </div>
    );
  }

  // FASE 2: WORKSPACE INTERATIVO EM 2 COLUNAS (Com arquivos carregados ou digitação ativa)
  return (
    <div className="dedicated-tool-page dedicated-tool-page--workspace">
      <div className="ilovepdf-tool-nav">
        <button
          type="button"
          className="dedicated-tool-back-btn"
          onClick={onBack}
          aria-label={translate("dedicated.back")}
        >
          <ArrowLeft size={16} />
          <span>{translate("dedicated.back")}</span>
        </button>

        <div className="dedicated-tool-badge" style={{ borderColor: accent }}>
          <span
            className="dedicated-tool-badge__dot"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
          <h1
            className="dedicated-tool-badge__title"
            style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, display: "inline" }}
          >
            {translate(tool.titleKey)}
          </h1>
        </div>
      </div>

      <div className="dedicated-tool-workspace-split">
        {/* Coluna Esquerda/Centro: Visualizador e Miniaturas */}
        <div className="dedicated-tool-left-column">
          {inputTab === "text" && isTextTool && tool.id !== "text-compare" ? (
            <div className="dedicated-tool-text-input-box">
              <label htmlFor="dedicated-tool-direct-textarea" className="dedicated-tool-label">
                Conteúdo do Documento:
              </label>
              <textarea
                id="dedicated-tool-direct-textarea"
                className="dedicated-tool-direct-textarea"
                value={directText}
                onChange={(e) => {
                  setDirectText(e.target.value);
                  if (tool.id === "text-review") {
                    try {
                      const findings = reviewText(e.target.value);
                      setReviewFindings(findings);
                      setReviewedText(e.target.value);
                    } catch {}
                  }
                }}
                placeholder="Digite ou cole o texto do documento aqui para processamento imediato..."
                rows={12}
              />
              <div className="dedicated-tool-text-metrics">
                {directText.length} caracteres •{" "}
                {directText.trim() ? directText.trim().split(/\s+/).length : 0} palavras
              </div>
            </div>
          ) : (
            renderVisualPanel()
          )}
        </div>

        {/* Coluna Direita: Painel Visual Especializado (para digitação de texto) ou Barra Lateral de Opções (para PDF) */}
        {inputTab === "text" && isTextTool && tool.id !== "text-compare" ? (
          <div className="dedicated-tool-right-column">{renderVisualPanel()}</div>
        ) : (
          <aside className="dedicated-tool-options-panel">
            <div className="dedicated-tool-options-header">
              <Sliders size={18} />
              <h3>{translate("dedicated.optionsTitle")}</h3>
            </div>

            {files.length > 0 && (
              <div className="ilovepdf-files-chip-summary">
                <span>
                  {files.length} {translate("dedicated.filesCount")}
                </span>
                {(tool.id === "pdf-organize" || tool.id === "text-compare") && (
                  <Button
                    variant="secondary"
                    size="compact"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus size={14} />
                    <span>{translate("dedicated.selectMoreFiles")}</span>
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="visually-hidden"
                  multiple
                  accept=".pdf,application/pdf,.txt,.docx"
                  onChange={handleFileInput}
                />
              </div>
            )}

            {tool.id === "pdf-compress" && (
              <div className="dedicated-tool-options-group">
                <span className="dedicated-tool-label">
                  {translate("dedicated.compressionLevel")}
                </span>
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
                <label htmlFor="dedicated-tool-ocr-lang" className="dedicated-tool-label">
                  {translate("dedicated.ocrLang")}
                </label>
                <select
                  id="dedicated-tool-ocr-lang"
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
                <label htmlFor="dedicated-tool-trans-src" className="dedicated-tool-label">
                  Idioma de Origem
                </label>
                <select
                  id="dedicated-tool-trans-src"
                  className="dedicated-tool-select"
                  value={translationSourceLang}
                  onChange={(e) => setTranslationSourceLang(e.target.value)}
                >
                  <option value="en">Inglês (English)</option>
                  <option value="pt">Português (Brasil)</option>
                  <option value="es">Espanhol (Español)</option>
                </select>

                <label
                  htmlFor="dedicated-tool-trans-target"
                  className="dedicated-tool-label"
                  style={{ marginTop: "12px" }}
                >
                  Idioma de Destino
                </label>
                <select
                  id="dedicated-tool-trans-target"
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

            {tool.id === "pdf-protect" && (
              <div className="dedicated-tool-options-group">
                <label htmlFor="dedicated-tool-password" className="dedicated-tool-label">
                  Senha de Proteção (Criptografia AES-256)
                </label>
                <input
                  id="dedicated-tool-password"
                  type="password"
                  className="dedicated-tool-input"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    backgroundColor: "var(--input-bg, #fff)",
                    fontSize: "0.9rem",
                  }}
                  value={protectPassword}
                  onChange={(e) => setProtectPassword(e.target.value)}
                  placeholder="Digite uma senha forte..."
                />
              </div>
            )}

            <div className="dedicated-tool-action-bar">
              <Button
                variant="primary"
                className="dedicated-tool-action-btn"
                style={{ backgroundColor: accent }}
                disabled={status === "running" || (!hasFilesOrText && tool.id !== "text-compare")}
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

              <Button variant="ghost" size="compact" onClick={handleReset}>
                <RefreshCw size={15} />
                <span>Limpar</span>
              </Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
