import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PdfADiagnosticReport } from "@/platform/pdfa-converter";
import { PdfToPdfaPanel, type PdfToPdfaPanelProps } from "./PdfToPdfaPanel";

const baseDiagnostic: PdfADiagnosticReport = {
  pageCount: 2,
  isEncrypted: false,
  hasDigitalSignature: false,
  unembeddedStandardFonts: [],
  unembeddedCustomFonts: [],
  hasTransparency: false,
  prohibitedActions: [],
  alreadyHasPdfaXmp: false,
  alreadyHasOutputIntent: false,
};

function makeProps(overrides: Partial<PdfToPdfaPanelProps> = {}): PdfToPdfaPanelProps {
  return {
    fileName: "contrato.pdf",
    fileSizeBytes: 24_000,
    conformance: "2b",
    fontStrategy: "preserve-vector",
    allowDiscardSignatures: false,
    isInspecting: false,
    diagnostic: baseDiagnostic,
    isRunning: false,
    progressPercent: 0,
    report: null,
    errorMessage: null,
    downloadUrl: null,
    outputFileName: "contrato_pdfa.pdf",
    onChangeConformance: vi.fn(),
    onChangeFontStrategy: vi.fn(),
    onChangeAllowDiscardSignatures: vi.fn(),
    onRunConvert: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
}

describe("PdfToPdfaPanel", () => {
  it("exibe diagnóstico vetorial e aciona conversão ao clicar em Converter para PDF/A", () => {
    const onRunConvert = vi.fn();
    render(<PdfToPdfaPanel {...makeProps({ onRunConvert })} />);

    expect(screen.getByTestId("pdfa-idle")).toBeInTheDocument();
    expect(screen.getByText(/Fontes já incorporadas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Converter para PDF\/A/i }));
    expect(onRunConvert).toHaveBeenCalledOnce();
  });

  it("bloqueia conversão até autorização explícita quando há assinatura digital", () => {
    const onChangeAllowDiscardSignatures = vi.fn();
    const { rerender } = render(
      <PdfToPdfaPanel
        {...makeProps({
          diagnostic: { ...baseDiagnostic, hasDigitalSignature: true },
          allowDiscardSignatures: false,
          onChangeAllowDiscardSignatures,
        })}
      />,
    );

    const submit = screen.getByRole("button", { name: /Converter para PDF\/A/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChangeAllowDiscardSignatures).toHaveBeenCalledWith(true);

    rerender(
      <PdfToPdfaPanel
        {...makeProps({
          diagnostic: { ...baseDiagnostic, hasDigitalSignature: true },
          allowDiscardSignatures: true,
        })}
      />,
    );
    expect(screen.getByRole("button", { name: /Converter para PDF\/A/i })).not.toBeDisabled();
  });

  it("renderiza progresso, resultado com link de download e estado de erro", () => {
    const { rerender } = render(
      <PdfToPdfaPanel {...makeProps({ isRunning: true, progressPercent: 60 })} />,
    );
    expect(screen.getByTestId("pdfa-running")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");

    rerender(
      <PdfToPdfaPanel
        {...makeProps({
          downloadUrl: "blob:pdfa-1",
          outputFileName: "contrato_pdfa.pdf",
          outputFileSizeBytes: 28_000,
          report: {
            conformance: "2b",
            pageCount: 2,
            vectorPages: 2,
            reconstructedPages: 0,
            embeddedIccProfile: true,
            wroteXmpMetadata: true,
            removedActionsCount: 1,
            warnings: [],
          },
        })}
      />,
    );
    expect(screen.getByTestId("pdfa-success")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Baixar PDF\/A/i })).toHaveAttribute(
      "href",
      "blob:pdfa-1",
    );

    rerender(<PdfToPdfaPanel {...makeProps({ errorMessage: "Arquivo criptografado" })} />);
    expect(screen.getByTestId("pdfa-error")).toBeInTheDocument();
    expect(screen.getByText("Arquivo criptografado")).toBeInTheDocument();
  });
});
