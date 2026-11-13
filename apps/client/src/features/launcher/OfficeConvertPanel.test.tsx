import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfficeConvertPanel } from "./OfficeConvertPanel";

describe("OfficeConvertPanel", () => {
  it("informa honestamente no navegador offline sem mostrar botão falso de conversão", () => {
    const onBack = vi.fn();
    render(
      <OfficeConvertPanel
        toolId="word-to-pdf"
        toolTitle="Word para PDF"
        accentColor="#2B579A"
        surfaceMode="offline-browser"
        fileName={null}
        fileSizeBytes={0}
        capabilityStatus="not_installed"
        isRunning={false}
        errorMessage={null}
        downloadUrl={null}
        outputFileName="documento.pdf"
        processingMode="local"
        isCloudAuthed={false}
        onChangeProcessingMode={vi.fn()}
        onSelectFile={vi.fn()}
        onRunConvert={vi.fn()}
        onReset={vi.fn()}
        onBack={onBack}
      />,
    );

    expect(screen.getByTestId("office-offline-notice")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Converter Word para PDF/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Voltar ao catálogo local/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("oferece instalação do Superpoder no Desktop quando office.suite está ausente", () => {
    const onInstall = vi.fn();
    render(
      <OfficeConvertPanel
        toolId="excel-to-pdf"
        toolTitle="Excel para PDF"
        accentColor="#107C41"
        surfaceMode="desktop"
        fileName="planilha.xlsx"
        fileSizeBytes={4096}
        capabilityStatus="not_installed"
        isRunning={false}
        errorMessage={null}
        downloadUrl={null}
        outputFileName="planilha.pdf"
        processingMode="local"
        isCloudAuthed={false}
        onChangeProcessingMode={vi.fn()}
        onSelectFile={vi.fn()}
        onInstallCapability={onInstall}
        onRunConvert={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const installBtn = screen.getByRole("button", { name: /Instalar Suíte Office/i });
    fireEvent.click(installBtn);
    expect(onInstall).toHaveBeenCalledTimes(1);

    const convertBtn = screen.getByRole("button", { name: /Converter Excel para PDF/i });
    expect((convertBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("habilita conversão no Desktop quando office.suite está instalada e exibe download no sucesso", () => {
    const onRun = vi.fn();
    const { rerender } = render(
      <OfficeConvertPanel
        toolId="pdf-to-powerpoint"
        toolTitle="PDF para PowerPoint"
        accentColor="#D24726"
        surfaceMode="desktop"
        fileName="apresentacao.pdf"
        fileSizeBytes={2048}
        capabilityStatus="installed"
        isRunning={false}
        errorMessage={null}
        downloadUrl={null}
        outputFileName="apresentacao.pptx"
        processingMode="local"
        isCloudAuthed={false}
        onChangeProcessingMode={vi.fn()}
        onSelectFile={vi.fn()}
        onRunConvert={onRun}
        onReset={vi.fn()}
      />,
    );

    const convertBtn = screen.getByRole("button", { name: /Converter PDF para PowerPoint/i });
    expect((convertBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(convertBtn);
    expect(onRun).toHaveBeenCalledTimes(1);

    rerender(
      <OfficeConvertPanel
        toolId="pdf-to-powerpoint"
        toolTitle="PDF para PowerPoint"
        accentColor="#D24726"
        surfaceMode="desktop"
        fileName="apresentacao.pdf"
        fileSizeBytes={2048}
        capabilityStatus="installed"
        isRunning={false}
        errorMessage={null}
        downloadUrl="blob:http://localhost/pptx-1"
        outputFileName="apresentacao.pptx"
        outputFileSizeBytes={8192}
        conversionDurationMs={650}
        processingMode="local"
        isCloudAuthed={false}
        onChangeProcessingMode={vi.fn()}
        onSelectFile={vi.fn()}
        onRunConvert={onRun}
        onReset={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: /Baixar arquivo convertido/i });
    expect(link.getAttribute("download")).toBe("apresentacao.pptx");
  });

  it("bloqueia honestamente pdf-to-powerpoint na Web Híbrida", () => {
    render(
      <OfficeConvertPanel
        toolId="pdf-to-powerpoint"
        toolTitle="PDF para PowerPoint"
        accentColor="#D24726"
        surfaceMode="hybrid-web"
        fileName={null}
        fileSizeBytes={0}
        capabilityStatus="not_installed"
        isRunning={false}
        errorMessage={null}
        downloadUrl={null}
        outputFileName="slides.pptx"
        processingMode="cloud"
        isCloudAuthed={false}
        onChangeProcessingMode={vi.fn()}
        onSelectFile={vi.fn()}
        onRunConvert={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByTestId("office-desktop-only-notice")).toBeTruthy();
  });
});
