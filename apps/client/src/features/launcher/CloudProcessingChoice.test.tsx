import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import { CloudProcessingChoice } from "./CloudProcessingChoice";
import { renderTextAndIntelPanel } from "./dedicated/renderTextAndIntelPanel";

describe("CloudProcessingChoice", () => {
  it("renderiza os modos local e nuvem e dispara callback ao alternar", () => {
    const onChangeMode = vi.fn();
    render(
      <CloudProcessingChoice
        toolId="pdf-ocr"
        mode="local"
        onChangeMode={onChangeMode}
        quotaRemaining={45}
        quotaUnitLabel="páginas"
        isAuthenticated={true}
      />,
    );

    const localRadio = screen.getByRole("radio", { name: /Navegador \(Local\)/i });
    const cloudRadio = screen.getByRole("radio", { name: /Nuvem \(Acelerado\)/i });

    expect(localRadio).toBeChecked();
    expect(cloudRadio).not.toBeChecked();

    fireEvent.click(cloudRadio);
    expect(onChangeMode).toHaveBeenCalledWith("cloud");
  });

  it("exibe badge de cota disponível e garantia de privacidade quando autenticado no modo nuvem", () => {
    render(
      <CloudProcessingChoice
        toolId="pdf-ocr"
        mode="cloud"
        onChangeMode={vi.fn()}
        quotaRemaining={30}
        quotaUnitLabel="páginas"
        isAuthenticated={true}
      />,
    );

    expect(screen.getByText(/30 páginas restantes este mês/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Garantia de Privacidade: O arquivo é processado em memória efêmera/i),
    ).toBeInTheDocument();
  });

  it("exibe aviso e link de login quando selecionado modo nuvem sem autenticação", () => {
    render(
      <CloudProcessingChoice
        toolId="pdf-ocr"
        mode="cloud"
        onChangeMode={vi.fn()}
        isAuthenticated={false}
      />,
    );

    expect(
      screen.getByText(/Acesse sua conta para utilizar sua cota gratuita mensal/i),
    ).toBeInTheDocument();
    const loginLink = screen.getByRole("link", { name: /Entrar na conta/i });
    expect(loginLink).toHaveAttribute("href", "/hub/cloud/login");
  });

  it("desabilita opções quando disabled for verdadeiro", () => {
    render(
      <CloudProcessingChoice
        toolId="text-translate"
        mode="local"
        onChangeMode={vi.fn()}
        isAuthenticated={true}
        disabled={true}
      />,
    );

    const localRadio = screen.getByRole("radio", { name: /Navegador \(Local\)/i });
    const cloudRadio = screen.getByRole("radio", { name: /Nuvem \(Acelerado\)/i });

    expect(localRadio).toBeDisabled();
    expect(cloudRadio).toBeDisabled();
  });

  it("exibe ou oculta escolha em nuvem via renderTextAndIntelPanel conforme isCloudEnabled", () => {
    const baseProps = {
      toolId: "pdf-ocr",
      files: [],
      setFiles: vi.fn(),
      documentCore: new BrowserDocumentCorePort(),
      accent: "#7c3aed",
      status: "idle" as const,
      progress: 0,
      pdfPageCount: 1,
      firstPageThumb: "",
      allPageThumbnails: [],
      previewEpoch: 0,
      downloadUrl: null,
      outputBlob: null,
      outputFileName: "out.pdf",
      processingMode: "local" as const,
      setProcessingMode: vi.fn(),
      cloudUsage: null,
      isCloudAuthed: false,
      handleExecute: vi.fn(async () => {}),
      handleSaveOutput: vi.fn(async () => {}),
      handleExcelPreviewPageChange: vi.fn(),
      excelPreviewPage: 1,
      excelSelection: {},
      excelPagesText: "",
      setExcelPagesText: vi.fn(),
      excelSeparatorsText: "",
      setExcelSeparatorsText: vi.fn(),
      excelRegion: { left: 0, top: 0, width: 1, height: 1 },
      setExcelRegion: vi.fn(),
      excelPreserveText: true,
      setExcelPreserveText: vi.fn(),
      excelPreviewRows: undefined,
      excelPreviewError: undefined,
      isAnalyzingExcel: false,
      excelOutputFormat: "xlsx" as const,
      setExcelOutputFormat: vi.fn(),
      excelSheetMode: "per-page" as const,
      setExcelSheetMode: vi.fn(),
      excelCsvDelimiter: ";" as const,
      setExcelCsvDelimiter: vi.fn(),
      excelDetectTablesOnly: false,
      setExcelDetectTablesOnly: vi.fn(),
      htmlCodeContent: "",
      setHtmlCodeContent: vi.fn(),
      htmlPageSize: "A4" as const,
      setHtmlPageSize: vi.fn(),
      htmlOrientation: "portrait" as const,
      setHtmlOrientation: vi.fn(),
      htmlMargin: "normal" as const,
      setHtmlMargin: vi.fn(),
      ocrProgressStatus: "",
      setOcrProgressStatus: vi.fn(),
      recognizedOcrText: "",
      setRecognizedOcrText: vi.fn(),
      ocrLanguage: "por" as const,
      setOcrLanguage: vi.fn(),
      ocrOutputMode: "searchable-pdf" as const,
      setOcrOutputMode: vi.fn(),
      ocrEnhanceContrast: true,
      setOcrEnhanceContrast: vi.fn(),
      ocrPageReports: [],
      ocrController: { current: null },
      onInvalidateOcrOutput: vi.fn(),
      onCancelOcr: vi.fn(),
      doc1Text: "",
      setDoc1Text: vi.fn(),
      doc1Name: "",
      setDoc1Name: vi.fn(),
      doc2Text: "",
      setDoc2Text: vi.fn(),
      doc2Name: "",
      setDoc2Name: vi.fn(),
      doc3Text: "",
      setDoc3Text: vi.fn(),
      doc3Name: "",
      setDoc3Name: vi.fn(),
      showDoc3: false,
      setShowDoc3: vi.fn(),
      comparePair: "1-2" as const,
      setComparePair: vi.fn(),
      reviewFindings: [],
      setReviewFindings: vi.fn(),
      reviewedText: "",
      setReviewedText: vi.fn(),
      invalidateReviewResult: vi.fn(),
      handleApplySingleReview: vi.fn(),
      handleApplyAllReview: vi.fn(),
      handleIgnoreFinding: vi.fn(),
      handleAddToDictionary: vi.fn(),
      reviewProgressStatus: "",
      translationSourceLang: "en",
      setTranslationSourceLang: vi.fn(),
      translationTargetLang: "pt",
      setTranslationTargetLang: vi.fn(),
      translationPreservedNames: "",
      setTranslationPreservedNames: vi.fn(),
      handleSwapLanguages: vi.fn(),
      translatedText: "",
      setTranslatedText: vi.fn(),
      translationProgressStatus: "",
      translationProgress: null,
      cancelTranslation: vi.fn(),
      clearTranslationResult: vi.fn(),
    };

    const { rerender } = render(
      <div>{renderTextAndIntelPanel({ ...baseProps, isCloudEnabled: false })}</div>,
    );
    expect(screen.queryByRole("radio", { name: /Nuvem \(Acelerado\)/i })).not.toBeInTheDocument();

    rerender(<div>{renderTextAndIntelPanel({ ...baseProps, isCloudEnabled: true })}</div>);
    expect(screen.getByRole("radio", { name: /Nuvem \(Acelerado\)/i })).toBeInTheDocument();
  });
});
