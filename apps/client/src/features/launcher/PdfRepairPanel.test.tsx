import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PdfRepairPanel } from "./PdfRepairPanel";

describe("PdfRepairPanel", () => {
  const recovered = {
    fixedHeader: true,
    fixedEof: false,
    fixedTrailer: false,
    fixedXref: false,
    recoveredPages: 1,
    totalDetectedPages: 2,
    originalSize: 1024,
    repairedSize: 800,
    warnings: ["Página 2 não pôde ser recuperada devido a fluxo corrompido."],
  };
  const resultProps = {
    fileName: "original.pdf",
    fileSizeBytes: 1024,
    isRunning: false,
    progressPercent: 100,
    report: recovered,
    errorMessage: null,
    downloadUrl: "blob:http://localhost/reparado",
    outputFileName: "reparado.pdf",
    onRunRepair: vi.fn(),
    onReset: vi.fn(),
  };
  it("distingue recuperação parcial e conserva os avisos e o download", () => {
    render(<PdfRepairPanel {...resultProps} />);
    expect(screen.getByRole("status")).toHaveTextContent("Recuperação parcial");
    expect(screen.getByText(recovered.warnings[0])).toBeInTheDocument();
    expect(screen.getByText("1 de 2 páginas recuperadas")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Baixar PDF Reparado" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Reparar PDF" })).not.toBeInTheDocument();
  });
  it("esconde o download anterior ao receber um erro e anuncia a falha", () => {
    const { rerender } = render(<PdfRepairPanel {...resultProps} />);
    rerender(<PdfRepairPanel {...resultProps} errorMessage="Documento irrecuperável" />);
    expect(screen.queryByRole("link", { name: "Baixar PDF Reparado" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Falha na Recuperação");
    expect(screen.getByText("Documento irrecuperável")).toBeInTheDocument();
  });
  it("separa documento, diagnóstico e ações em regiões acessíveis", () => {
    render(
      <PdfRepairPanel
        fileName="original.pdf"
        fileSizeBytes={1024}
        isRunning={false}
        progressPercent={0}
        report={null}
        errorMessage={null}
        downloadUrl={null}
        outputFileName="reparado.pdf"
        thumbnail="data:image/png;base64,original"
        onRunRepair={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByRole("region", { name: "Área do documento" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Opções" })).toBeInTheDocument();
    const actions = screen.getByRole("region", { name: "Ações da ferramenta" });
    expect(actions).toContainElement(screen.getByRole("button", { name: "Reparar PDF" }));
    expect(screen.getByAltText("Prévia da página 1 do original original.pdf")).toBeInTheDocument();
  });

  it("nomeia o progresso e bloqueia as ações durante a execução", () => {
    render(
      <PdfRepairPanel
        fileName="original.pdf"
        fileSizeBytes={1024}
        isRunning
        progressPercent={65}
        report={null}
        errorMessage={null}
        downloadUrl={null}
        outputFileName="reparado.pdf"
        onRunRepair={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(screen.getByRole("progressbar", { name: "Progresso do reparo" })).toHaveAttribute(
      "aria-valuenow",
      "65",
    );
    expect(screen.getByRole("button", { name: "Reparar PDF" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Tentar outro arquivo" })).toBeDisabled();
  });

  it("renderiza o estado inicial pronto para iniciar a reparação", async () => {
    const handleRun = vi.fn();
    const handleReset = vi.fn();

    render(
      <PdfRepairPanel
        fileName="corrompido.pdf"
        fileSizeBytes={1024}
        isRunning={false}
        progressPercent={0}
        report={null}
        errorMessage={null}
        downloadUrl={null}
        outputFileName="corrompido_reparado.pdf"
        onRunRepair={handleRun}
        onReset={handleReset}
      />,
    );

    expect(screen.getByTestId("pdf-repair-idle")).toBeInTheDocument();
    expect(screen.getByText(/corrompido.pdf/)).toBeInTheDocument();

    const repairButton = screen.getByRole("button", { name: "Reparar PDF" });
    fireEvent.click(repairButton);
    expect(handleRun).toHaveBeenCalledTimes(1);
  });

  it("renderiza a barra de progresso durante o reparo", () => {
    render(
      <PdfRepairPanel
        fileName="corrompido.pdf"
        fileSizeBytes={1024}
        isRunning={true}
        progressPercent={65}
        report={null}
        errorMessage={null}
        downloadUrl={null}
        outputFileName="corrompido_reparado.pdf"
        onRunRepair={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByTestId("pdf-repair-running")).toBeInTheDocument();
    expect(screen.getByText("65%")).toBeInTheDocument();
  });

  it("renderiza o cartão de diagnóstico completo após sucesso", () => {
    const mockReport = {
      fixedHeader: true,
      fixedEof: true,
      fixedTrailer: true,
      fixedXref: true,
      recoveredPages: 5,
      totalDetectedPages: 5,
      originalSize: 5000,
      repairedSize: 4800,
      warnings: [],
    };

    render(
      <PdfRepairPanel
        fileName="corrompido.pdf"
        fileSizeBytes={5000}
        isRunning={false}
        progressPercent={100}
        report={mockReport}
        errorMessage={null}
        downloadUrl="blob:http://localhost/teste-reparado"
        outputFileName="corrompido_reparado.pdf"
        thumbnail="data:image/png;base64,mock"
        onRunRepair={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByTestId("pdf-repair-success")).toBeInTheDocument();
    expect(screen.getByText("5 de 5 páginas recuperadas")).toBeInTheDocument();
    expect(screen.getByText("Tabela de referências (xref) reconstruída")).toBeInTheDocument();
    expect(screen.getByText("Estrutura de final e trailer restaurada")).toBeInTheDocument();
    expect(screen.getByText("Marcador de fim de arquivo (EOF) corrigido")).toBeInTheDocument();
    expect(screen.getByText("Cabeçalho e alinhamento sintático corrigidos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Baixar PDF Reparado/i })).toBeInTheDocument();
  });

  it("renderiza o painel de erro amigável quando o documento é irrecuperável", async () => {
    const handleReset = vi.fn();

    render(
      <PdfRepairPanel
        fileName="arquivo_zerado.pdf"
        fileSizeBytes={0}
        isRunning={false}
        progressPercent={0}
        report={null}
        errorMessage="Documento sem dados estruturais recuperáveis. O arquivo não possui objetos ou cabeçalho PDF legível."
        downloadUrl={null}
        outputFileName="arquivo_zerado_reparado.pdf"
        onRunRepair={vi.fn()}
        onReset={handleReset}
      />,
    );

    expect(screen.getByTestId("pdf-repair-error")).toBeInTheDocument();
    expect(screen.getByText(/Falha na Recuperação/i)).toBeInTheDocument();
    expect(screen.getByText(/Documento sem dados estruturais recuperáveis/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: "Tentar outro arquivo" });
    fireEvent.click(retryBtn);
    expect(handleReset).toHaveBeenCalledTimes(1);
  });
});
