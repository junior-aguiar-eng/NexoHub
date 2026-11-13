import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SUMMARIZE_MODEL } from "@/platform/pdf-summarize-protocol";
import type { PdfSummaryResult } from "@/platform/pdf-summarizer";
import { PdfSummarizePanel } from "./PdfSummarizePanel";

const sampleResult: PdfSummaryResult = {
  summaryMarkdown:
    "## Pontos Principais\n- O contrato entra em vigor em 01/12/2026 [p. 1].\n- A multa por descumprimento é de 5% [p. 2].",
  citations: [
    { label: "[p. 1]", startPage: 1, endPage: 1 },
    { label: "[p. 2]", startPage: 2, endPage: 2 },
  ],
  mode: "executive",
  deviceUsed: "wasm",
  modelId: SUMMARIZE_MODEL.id,
  modelLicense: SUMMARIZE_MODEL.license,
  totalPages: 4,
  analyzedPages: 4,
  chunkCount: 2,
  wasTruncated: false,
  durationMs: 4120,
};

describe("PdfSummarizePanel", () => {
  it("exibe pré-requisitos de modelo/hardware e permite trocar o modo e iniciar resumo", () => {
    const onChangeMode = vi.fn();
    const onRunSummarize = vi.fn();

    render(
      <PdfSummarizePanel
        fileName="contrato_servicos.pdf"
        fileSizeBytes={152_400}
        pageCount={4}
        previewPage={1}
        mode="executive"
        isRunning={false}
        progress={null}
        result={null}
        errorCode={null}
        errorMessage={null}
        hardwareProfile={{
          hasWebGpu: false,
          recommendedDevice: "wasm",
          recommendedDtype: "q4",
          approxDownloadMb: 390,
          deviceMemoryGb: 2,
          lowMemoryWarning: true,
          cpuSlowWarning: true,
        }}
        onChangeMode={onChangeMode}
        onSelectPreviewPage={vi.fn()}
        onRunSummarize={onRunSummarize}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText(/100% local/i)).toBeInTheDocument();
    expect(screen.getByText(/390 MB/i)).toBeInTheDocument();
    expect(screen.getByText(/abaixo de 4 GB/i)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Obrigações e Datas/i));
    expect(onChangeMode).toHaveBeenCalledWith("obligations-dates");

    fireEvent.click(screen.getByRole("button", { name: /Resumir PDF localmente/i }));
    expect(onRunSummarize).toHaveBeenCalledTimes(1);
  });

  it("exibe barra de progresso com bytes baixados e permite cancelamento imediato", () => {
    const onCancel = vi.fn();

    render(
      <PdfSummarizePanel
        fileName="edital.pdf"
        fileSizeBytes={420_000}
        pageCount={8}
        previewPage={1}
        mode="executive"
        isRunning
        progress={{
          phase: "downloading",
          progress: 28,
          loadedBytes: 150 * 1024 * 1024,
          totalBytes: 390 * 1024 * 1024,
          device: "wasm",
        }}
        result={null}
        errorCode={null}
        errorMessage={null}
        onChangeMode={vi.fn()}
        onSelectPreviewPage={vi.fn()}
        onRunSummarize={vi.fn()}
        onCancel={onCancel}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "28");
    expect(screen.getByText(/150 MB/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar resumo/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("oferece encadeamento direto para OCR PDF quando recebe PDF escaneado sem texto", () => {
    const onGoToOcr = vi.fn();

    render(
      <PdfSummarizePanel
        fileName="digitalizado.pdf"
        fileSizeBytes={980_000}
        pageCount={2}
        previewPage={1}
        mode="executive"
        isRunning={false}
        progress={null}
        result={null}
        errorCode="SUMMARIZE_SCANNED_PDF_NO_TEXT"
        errorMessage="Sem texto selecionável."
        onChangeMode={vi.fn()}
        onSelectPreviewPage={vi.fn()}
        onRunSummarize={vi.fn()}
        onCancel={vi.fn()}
        onGoToOcr={onGoToOcr}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByText(/PDF sem texto selecionável detectado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Abrir OCR PDF/i }));
    expect(onGoToOcr).toHaveBeenCalledTimes(1);
  });

  it("torna citações [p. X] clicáveis para navegar até a página correspondente da prévia", () => {
    const onSelectPreviewPage = vi.fn();

    render(
      <PdfSummarizePanel
        fileName="contrato_servicos.pdf"
        fileSizeBytes={152_400}
        pageCount={4}
        previewPage={1}
        mode="executive"
        isRunning={false}
        progress={null}
        result={sampleResult}
        errorCode={null}
        errorMessage={null}
        onChangeMode={vi.fn()}
        onSelectPreviewPage={onSelectPreviewPage}
        onRunSummarize={vi.fn()}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const jumpBtn = screen.getByRole("button", { name: /Ir para a página 2 na prévia/i });
    fireEvent.click(jumpBtn);
    expect(onSelectPreviewPage).toHaveBeenCalledWith(2);

    expect(screen.getByRole("button", { name: /Baixar \.md/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Baixar \.txt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Baixar \.pdf/i })).toBeInTheDocument();
  });
});
