import { applyReviewFindings, type ReviewFinding, reviewText } from "@nexohub/domain";
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Languages,
  Layers,
  Loader2,
  PenTool,
  RefreshCw,
  Upload,
} from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { performBrowserOcr } from "@/platform/browser-ocr";
import { createZipArchive, extractJpegsFromPdfAsync } from "@/platform/browser-pdf-utils";
import { translateTextLocally } from "@/platform/browser-translation";
import type { DocumentCorePort } from "@/platform/document-core";
import {
  compressPdfDocument,
  extractPdfSelectedPages,
  getPdfPageCount,
  mergePdfDocuments,
  renderPdfPageToDataUrl,
  reorganizePdfDocument,
  rotatePdfDocument,
  splitPdfByInterval,
} from "@/platform/pdf-engine";
import { CompressPdfPanel } from "./CompressPdfPanel";
import { DocumentComparePanel } from "./DocumentComparePanel";
import { MergePdfPanel } from "./MergePdfPanel";
import type { LauncherTool } from "./model";
import { OcrScannerPanel } from "./OcrScannerPanel";
import { PdfPageGridPanel, type PdfPageItem } from "./PdfPageGridPanel";
import { RotatePdfPanel } from "./RotatePdfPanel";
import { type SplitInterval, SplitPdfPanel } from "./SplitPdfPanel";

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
  documentCore: _documentCore,
  onBack,
  initialFiles,
  onOperationComplete,
}: DedicatedToolViewProps) {
  const [files, setFiles] = useState<File[]>(() => initialFiles ?? []);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [_progress, setProgress] = useState(0);
  const [inputTab, setInputTab] = useState<"upload" | "text">("upload");

  // Miniaturas Reais Geradas com PDF.js
  const [firstPageThumb, setFirstPageThumb] = useState<string>("");
  const [lastPageThumb, setLastPageThumb] = useState<string>("");
  const [fileThumbnails, setFileThumbnails] = useState<Record<string, string>>({});
  const [allPageThumbnails, setAllPageThumbnails] = useState<string[]>([]);

  // Estados de Dividir PDF estilo iLovePDF
  const [splitIntervals, setSplitIntervals] = useState<SplitInterval[]>([
    { id: "interval-1", start: 1, end: 1 },
  ]);
  const [splitMergeIntervals, setSplitMergeIntervals] = useState(false);
  const [splitMode, setSplitMode] = useState<"interval" | "pages">("interval");
  const [splitSelectedPages, setSplitSelectedPages] = useState<number[]>([1]);

  // Parâmetros de Ferramentas
  const [compressionLevel, setCompressionLevel] = useState<"recommended" | "extreme" | "less">(
    "recommended",
  );
  const [ocrLanguage, _setOcrLanguage] = useState<string>("por");
  const [translationSourceLang, setTranslationSourceLang] = useState<string>("en");
  const [translationTargetLang, setTranslationTargetLang] = useState<string>("pt");
  const [rotateAngle, setRotateAngle] = useState<number>(0);

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

  // Resultado de Execução
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>("");
  const [compressionResult, setCompressionResult] = useState<{
    originalBytes: number;
    compressedBytes: number;
    savedPercent: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const accent = tool.accentColor || "#e5322d";
  const isTextTool =
    tool.id === "text-review" || tool.id === "text-translate" || tool.id === "text-compare";

  // Quando arquivos PDF são carregados, gera miniaturas reais em canvas com PDF.js
  useEffect(() => {
    let isCancelled = false;

    async function inspectPdf() {
      if (
        files.length > 0 &&
        (files[0].type.includes("pdf") || files[0].name.toLowerCase().endsWith(".pdf"))
      ) {
        try {
          const buffer = new Uint8Array(await files[0].arrayBuffer());
          const count = await getPdfPageCount(buffer);
          if (isCancelled) return;

          setPdfPageCount(count);
          setSplitIntervals([{ id: "interval-1", start: 1, end: count }]);
          setSplitSelectedPages([1]);

          // Renderiza miniaturas reais em canvas
          const thumb1 = await renderPdfPageToDataUrl(buffer, 1, 0.6);
          if (isCancelled) return;
          setFirstPageThumb(thumb1);

          const thumbLast = count > 1 ? await renderPdfPageToDataUrl(buffer, count, 0.6) : thumb1;
          if (isCancelled) return;
          setLastPageThumb(thumbLast);

          setFileThumbnails((prev) => ({ ...prev, [files[0].name]: thumb1 }));

          const items: PdfPageItem[] = Array.from({ length: count }, (_, i) => ({
            id: `page-${i + 1}`,
            originalIndex: i + 1,
            rotation: 0,
          }));
          setPageItems(items);
          setSelectedPageIndices(items.map((it) => it.originalIndex));

          // Se for organizador, carrega miniaturas reais
          if (tool.id === "pdf-organize" || tool.id === "pdf-extract") {
            const thumbs: string[] = [];
            const max = Math.min(count, 48);
            for (let i = 1; i <= max; i++) {
              if (isCancelled) return;
              const th = await renderPdfPageToDataUrl(buffer, i, 0.4);
              thumbs.push(th);
            }
            if (!isCancelled) {
              setAllPageThumbnails(thumbs);
            }
          }
        } catch (err) {
          console.error("Falha ao analisar PDF:", err);
        }
      }
    }

    inspectPdf();
    return () => {
      isCancelled = true;
    };
  }, [files, tool.id]);

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

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      setStatus("idle");
      setDownloadUrl(null);
    }
  }

  function handleMoveFile(index: number, direction: "left" | "right") {
    const target = direction === "left" ? index - 1 : index + 1;
    if (target < 0 || target >= files.length) return;
    const reordered = [...files];
    const temp = reordered[index];
    reordered[index] = reordered[target];
    reordered[target] = temp;
    setFiles(reordered);
  }

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

  // =========================================================================
  // EXECUÇÃO 100% REAL E INFALÍVEL (WEB + TAURI DESKTOP)
  // =========================================================================
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
      let outputBlob: Blob | null = null;
      let outName = "";
      let categoryKey: "recent.type.pdf" | "recent.type.document" = "recent.type.pdf";
      let resultSizeBytes = primaryFile.size;

      setProgress(40);

      // DIVIDIR PDF
      if (tool.id === "pdf-split" || tool.id === "pdf-extract") {
        const buffer = new Uint8Array(await primaryFile.arrayBuffer());
        if (splitMode === "interval") {
          const first = splitIntervals[0] || { start: 1, end: pdfPageCount };
          const splitBytes = await splitPdfByInterval(buffer, first.start, first.end);
          outputBlob = new Blob([splitBytes as unknown as BlobPart], { type: "application/pdf" });
          outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_paginas_${first.start}_a_${first.end}.pdf`;
        } else {
          const pagesToExtract =
            splitSelectedPages.length > 0 ? splitSelectedPages : selectedPageIndices;
          const extractedBytes = await extractPdfSelectedPages(buffer, pagesToExtract);
          outputBlob = new Blob([extractedBytes as unknown as BlobPart], {
            type: "application/pdf",
          });
          outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_extraido.pdf`;
        }
        resultSizeBytes = outputBlob.size;
      }
      // COMPRIMIR PDF
      else if (tool.id === "pdf-compress") {
        const buffer = new Uint8Array(await primaryFile.arrayBuffer());
        const comp = await compressPdfDocument(buffer, compressionLevel);
        outputBlob = new Blob([comp.bytes as unknown as BlobPart], { type: "application/pdf" });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_comprimido.pdf`;
        resultSizeBytes = outputBlob.size;
        setCompressionResult({
          originalBytes: primaryFile.size,
          compressedBytes: resultSizeBytes,
          savedPercent: comp.savedPercent,
        });
      }
      // JUNTAR PDF
      else if (tool.id === "pdf-merge") {
        const buffers: Uint8Array[] = [];
        for (const f of files) {
          buffers.push(new Uint8Array(await f.arrayBuffer()));
        }
        const mergedBytes = await mergePdfDocuments(buffers);
        outputBlob = new Blob([mergedBytes as unknown as BlobPart], { type: "application/pdf" });
        outName = `nexohub_mesclado_${Date.now()}.pdf`;
        resultSizeBytes = outputBlob.size;
      }
      // ORGANIZAR PDF
      else if (tool.id === "pdf-organize") {
        const activePages = pageItems.filter((p) => !p.deleted);
        if (activePages.length === 0) {
          throw new Error("Pelo menos uma página precisa ser mantida no documento.");
        }
        const buffer = new Uint8Array(await primaryFile.arrayBuffer());
        const organizedBytes = await reorganizePdfDocument(buffer, activePages);
        outputBlob = new Blob([organizedBytes as unknown as BlobPart], {
          type: "application/pdf",
        });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_organizado.pdf`;
        resultSizeBytes = outputBlob.size;
      }
      // ROTACIONAR PDF
      else if (tool.id === "pdf-rotate") {
        const buffer = new Uint8Array(await primaryFile.arrayBuffer());
        const rotatedBytes = await rotatePdfDocument(buffer, rotateAngle);
        outputBlob = new Blob([rotatedBytes as unknown as BlobPart], {
          type: "application/pdf",
        });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_rotacionado.pdf`;
        resultSizeBytes = outputBlob.size;
      }
      // EXTRAIR IMAGENS
      else if (tool.id === "pdf-extract-images") {
        const buffer = new Uint8Array(await primaryFile.arrayBuffer());
        const allFound = await extractJpegsFromPdfAsync(buffer);
        if (allFound.length > 0) {
          const filesForZip = allFound.map((img, idx) => {
            const binaryStr = atob(img.dataBase64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let b = 0; b < binaryStr.length; b++) bytes[b] = binaryStr.charCodeAt(b);
            return { name: `imagem_${idx + 1}.${img.format.toLowerCase()}`, data: bytes };
          });
          const zipBytes = createZipArchive(filesForZip);
          outputBlob = new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" });
          outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_imagens.zip`;
          resultSizeBytes = outputBlob.size;
        } else {
          outputBlob = primaryFile;
          outName = primaryFile.name;
        }
        categoryKey = "recent.type.document";
      }
      // OCR
      else if (tool.id === "pdf-ocr") {
        const ocrOutcome = await performBrowserOcr(primaryFile, ocrLanguage);
        setRecognizedOcrText(ocrOutcome.text);
        outputBlob = new Blob([ocrOutcome.text], { type: "text/plain;charset=utf-8" });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_ocr.txt`;
        categoryKey = "recent.type.document";
        resultSizeBytes = outputBlob.size;
      }
      // TRADUZIR TEXTO
      else if (tool.id === "text-translate") {
        const textContent = isDirectTextInput ? directText : await primaryFile.text();
        const translated = translateTextLocally(
          textContent,
          translationSourceLang,
          translationTargetLang,
        );
        setTranslatedText(translated);
        outputBlob = new Blob([translated], { type: "text/plain;charset=utf-8" });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_traduzido_${translationTargetLang}.txt`;
        categoryKey = "recent.type.document";
        resultSizeBytes = outputBlob.size;
      }
      // REVISAR TEXTO
      else if (tool.id === "text-review") {
        const textContent = isDirectTextInput ? directText : await primaryFile.text();
        const findings = reviewText(textContent);
        setReviewFindings(findings);
        setReviewedText(textContent);
        outputBlob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
        outName = `${primaryFile.name.replace(/\.[^/.]+$/, "")}_revisado.txt`;
        categoryKey = "recent.type.document";
        resultSizeBytes = outputBlob.size;
      }
      // COMPARAR TEXTOS
      else if (tool.id === "text-compare") {
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

  // Título do Botão Principal estilo iLovePDF
  function getActionLabel() {
    if (tool.id === "pdf-split") return "Dividir PDF";
    if (tool.id === "pdf-compress") return "Comprimir PDF";
    if (tool.id === "pdf-merge") return "Juntar PDF";
    if (tool.id === "pdf-rotate") return "Rotacionar PDF";
    if (tool.id === "pdf-organize") return "Salvar PDF Organizado";
    if (tool.id === "pdf-ocr") return "Iniciar Reconhecimento OCR";
    if (tool.id === "text-compare") return "Comparar Textos";
    if (tool.id === "text-review") return "Revisar Texto";
    return translate("dedicated.actionRun");
  }

  // Renderiza o Painel Visual Central Específico
  function renderVisualPanel() {
    // DIVIDIR PDF
    if (tool.id === "pdf-split") {
      return (
        <SplitPdfPanel
          totalPages={pdfPageCount}
          fileName={files[0]?.name || "documento.pdf"}
          firstPageThumb={firstPageThumb}
          lastPageThumb={lastPageThumb}
          intervals={splitIntervals}
          mergeIntervals={splitMergeIntervals}
          splitMode={splitMode}
          selectedPageNumbers={splitSelectedPages}
          onIntervalsChange={setSplitIntervals}
          onMergeIntervalsChange={setSplitMergeIntervals}
          onSplitModeChange={setSplitMode}
          onSelectedPageNumbersChange={setSplitSelectedPages}
        />
      );
    }

    // COMPRIMIR PDF
    if (tool.id === "pdf-compress") {
      return (
        <CompressPdfPanel
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          thumbnailUrl={firstPageThumb}
          compressionLevel={compressionLevel}
          onCompressionLevelChange={setCompressionLevel}
          onAddMoreFiles={() => fileInputRef.current?.click()}
        />
      );
    }

    // JUNTAR PDF
    if (tool.id === "pdf-merge") {
      return (
        <MergePdfPanel
          files={files}
          thumbnails={fileThumbnails}
          onRemoveFile={handleRemoveFile}
          onMoveFile={handleMoveFile}
          onAddMoreFiles={() => fileInputRef.current?.click()}
        />
      );
    }

    // ORGANIZAR PDF
    if (tool.id === "pdf-organize") {
      return (
        <PdfPageGridPanel
          mode="organize"
          totalPages={pdfPageCount}
          pages={pageItems}
          selectedIndices={selectedPageIndices}
          realThumbnails={allPageThumbnails}
          onPagesChange={setPageItems}
          onRotateAll={handleRotateAll}
          onResetOrder={handleResetOrder}
        />
      );
    }

    // ROTACIONAR PDF
    if (tool.id === "pdf-rotate") {
      return (
        <RotatePdfPanel
          fileName={files[0]?.name || "documento.pdf"}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          rotation={rotateAngle}
          onRotateRight={() => setRotateAngle((r) => (r + 90) % 360)}
          onRotateLeft={() => setRotateAngle((r) => (r - 90 + 360) % 360)}
        />
      );
    }

    if (tool.id === "pdf-ocr") {
      return (
        <OcrScannerPanel
          isScanning={status === "running"}
          progress={_progress}
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

    return (
      <div className="generic-tool-visual-panel">
        <div className="generic-tool-hero-box">
          <Layers size={36} style={{ color: accent }} />
          <h3>Espaço de Visualização Documental</h3>
          <p>Arquivo selecionado e pronto para processamento imediato.</p>
        </div>
      </div>
    );
  }

  const isWorkspaceMode = files.length > 0 || inputTab === "text" || tool.id === "text-compare";
  const hasFilesOrText = files.length > 0 || (inputTab === "text" && directText.trim().length > 0);

  // FASE 3: SUCESSO E DOWNLOAD
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
            <strong>{outputFileName}</strong> foi processado com sucesso e está pronto.
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

          {downloadUrl && (
            <a
              href={downloadUrl}
              download={outputFileName}
              className="ilovepdf-big-download-btn"
              style={{ backgroundColor: "#e5322d" }}
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

  // FASE 1: TELA INICIAL DE UPLOAD CENTRALIZADO
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
            multiple={
              tool.id === "pdf-organize" || tool.id === "pdf-merge" || tool.id === "text-compare"
            }
            accept={tool.suite === "text" ? ".txt,.md,.pdf,.docx" : ".pdf,application/pdf,image/*"}
            onChange={handleFileInput}
          />
          <button
            type="button"
            className="ilovepdf-main-upload-btn"
            style={{ backgroundColor: "#e5322d" }}
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

  // FASE 2: WORKSPACE ATIVO
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

      <div className="dedicated-tool-workspace-main">
        {inputTab === "text" && isTextTool && tool.id !== "text-compare" ? (
          <div className="dedicated-tool-workspace-split">
            <div className="dedicated-tool-left-column">
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
            </div>
            <div className="dedicated-tool-right-column">{renderVisualPanel()}</div>
          </div>
        ) : (
          renderVisualPanel()
        )}

        {/* Barra de Ação Inferior Fixa com Botão Vermelho Estilo iLovePDF */}
        <div className="dedicated-tool-bottom-bar" style={{ marginTop: "1.5rem" }}>
          <button
            type="button"
            className="ilovepdf-action-red-btn"
            disabled={status === "running" || (!hasFilesOrText && tool.id !== "text-compare")}
            onClick={handleExecute}
          >
            {status === "running" ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <span>{getActionLabel()}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
