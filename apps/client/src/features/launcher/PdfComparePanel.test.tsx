import { diffText } from "@nexohub/domain";
import { ToolRunError } from "@nexohub/tool-sdk";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnavailableDocumentCorePort } from "@/platform/document-core";
import type { LauncherToolOutput } from "@/platform/launcher-tool-runner";
import { runLauncherTool } from "@/platform/launcher-tool-runner";
import type { PdfComparisonResult } from "@/platform/pdf-comparison-types";
import { PdfComparePanel } from "./PdfComparePanel";

vi.mock("@/platform/launcher-tool-runner", () => ({ runLauncherTool: vi.fn() }));
const run = vi.mocked(runLauncherTool);
const files = [
  new File(["pdf"], "original.pdf", { type: "application/pdf" }),
  new File(["pdf"], "revisado.pdf", { type: "application/pdf" }),
];
const comparison: PdfComparisonResult = {
  leftPageCount: 1,
  rightPageCount: 1,
  leftHasText: true,
  rightHasText: true,
  pairs: [
    {
      index: 0,
      leftPage: 1,
      rightPage: 1,
      status: "modified",
      leftText: "Texto antigo",
      rightText: "Texto novo",
      textDiff: diffText("Texto antigo", "Texto novo"),
      textChanged: true,
      visualChanged: true,
      visualDifferenceRatio: 0.1,
      regions: [],
      leftImage: "data:image/png;base64,AA==",
      rightImage: "data:image/png;base64,AA==",
      width: 600,
      height: 800,
    },
  ],
};
const output = {
  blob: new Blob(["report"]),
  fileName: "relatorio.pdf",
  categoryKey: "recent.type.pdf",
  comparison,
} satisfies LauncherToolOutput;
function setup() {
  return render(
    <PdfComparePanel
      documentCore={new UnavailableDocumentCorePort()}
      onBack={vi.fn()}
      initialFiles={files}
    />,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
});
describe("PdfComparePanel", () => {
  it("salta alterações filtradas, mantém zoom e oferece ajuste à largura", async () => {
    const first = comparison.pairs[0];
    run.mockResolvedValue({
      ...output,
      comparison: {
        ...comparison,
        pairs: [
          { ...first, status: "unchanged", textChanged: false, visualChanged: false },
          { ...first, index: 1, leftPage: 2, rightPage: 2 },
          { ...first, index: 2, leftPage: 3, rightPage: 3, leftText: "outra", rightText: "outra" },
        ],
      },
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
    await screen.findByRole("button", { name: "Baixar relatório PDF" });
    fireEvent.click(screen.getByRole("button", { name: "Visual" }));
    fireEvent.click(screen.getByRole("button", { name: "Ampliar zoom" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "antigo" } });
    fireEvent.click(screen.getByRole("button", { name: "Próxima alteração" }));
    expect(screen.getByText("Par 2 de 3")).toBeInTheDocument();
    expect(screen.getByText("125%")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Próxima alteração" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Ajustar à largura" }));
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByLabelText("Sincronizar rolagem")).toBeChecked();
  });
  it("carrega só a prévia visual solicitada e descarta detalhe após troca de arquivo", async () => {
    const lean = {
      ...comparison,
      pairs: comparison.pairs.map(({ leftImage: _l, rightImage: _r, ...pair }) => pair),
    };
    let resolve!: (value: LauncherToolOutput) => void;
    run.mockResolvedValueOnce({ ...output, comparison: lean }).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
    await screen.findByRole("button", { name: "Baixar relatório PDF" });
    expect(run).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Visual" }));
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1][2].comparisonPreviewPair).toEqual(lean.pairs[0]);
    const signal = run.mock.calls[1][2].comparisonSignal;
    fireEvent.change(screen.getByLabelText("PDF revisado", { selector: "input" }), {
      target: { files: [files[1]] },
    });
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve({ ...output, comparisonPreview: comparison.pairs[0] }));
    expect(screen.queryByRole("img", { name: "PDF original" })).not.toBeInTheDocument();
  });
  it("requires both labeled PDF slots and rejects invalid files", () => {
    render(<PdfComparePanel documentCore={new UnavailableDocumentCorePort()} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Comparar PDFs" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("PDF original"), {
      target: { files: [new File(["x"], "x.txt")] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Selecione um arquivo PDF");
  });
  it("rejects oversized PDF before running", () => {
    setup();
    const oversized = new File(["pdf"], "grande.pdf", { type: "application/pdf" });
    Object.defineProperty(oversized, "size", { value: 64 * 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText("PDF revisado"), { target: { files: [oversized] } });
    expect(screen.getByRole("button", { name: "Comparar PDFs" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("64 MiB");
  });
  it.each(["cancel", "replace", "swap", "unmount"])(
    "discards late completion after %s",
    async (action) => {
      let resolve!: (value: LauncherToolOutput) => void;
      run.mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const view = setup();
      fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
      const signal = run.mock.calls[0]?.[2].comparisonSignal;
      act(() =>
        run.mock.calls[0]?.[2].onComparisonProgress?.({ phase: "reporting", progress: 96 }),
      );
      expect(screen.getAllByText("Gerando relatório").length).toBeGreaterThan(0);
      expect(
        screen
          .getByRole("button", { name: "Cancelar comparação" })
          .closest(".tool-workspace-actions"),
      ).not.toBeNull();
      expect(screen.getByRole("progressbar").closest(".tool-workspace-actions")).not.toBeNull();
      if (action === "cancel")
        fireEvent.click(screen.getByRole("button", { name: "Cancelar comparação" }));
      if (action === "replace")
        fireEvent.change(screen.getByLabelText("PDF revisado"), {
          target: { files: [new File(["new"], "novo.pdf")] },
        });
      if (action === "swap")
        fireEvent.click(screen.getByRole("button", { name: "Inverter documentos" }));
      if (action === "unmount") view.unmount();
      expect(signal?.aborted).toBe(true);
      await act(async () => resolve(output));
      expect(
        screen.queryByRole("button", { name: "Baixar relatório PDF" }),
      ).not.toBeInTheDocument();
    },
  );
  it("shows real text differences, visual previews, bounded zoom and searchable changes", async () => {
    run.mockResolvedValue(output);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
    expect(await screen.findByText("antigo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Visual" }));
    expect(screen.getByRole("img", { name: "PDF original" })).toBeInTheDocument();
    for (let i = 0; i < 12; i++)
      fireEvent.click(screen.getByRole("button", { name: "Ampliar zoom" }));
    expect(screen.getByRole("button", { name: "Ampliar zoom" })).toBeDisabled();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "ausente" } });
    expect(screen.getByText("Nenhuma alteração encontrada para este filtro.")).toBeInTheDocument();
  });
  it("falls back to visual mode when text is unavailable", async () => {
    run.mockResolvedValue({ ...output, comparison: { ...comparison, leftHasText: false } });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
    expect(await screen.findByText(/Texto indisponível em um dos PDFs/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Texto" })).toBeDisabled();
    expect(screen.getByRole("img", { name: "PDF original" })).toBeInTheDocument();
  });
  it("downloads the executor report and JSON without rebuilding documents", async () => {
    const secondaryBlob = new Blob(["json"]);
    const saveOutputFile = vi.fn().mockResolvedValue(true);
    run.mockResolvedValue({ ...output, secondaryBlob, secondaryFileName: "dados.json" });
    render(
      <PdfComparePanel
        documentCore={{ ...new UnavailableDocumentCorePort(), invoke: vi.fn(), saveOutputFile }}
        onBack={vi.fn()}
        initialFiles={files}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
    fireEvent.click(await screen.findByRole("button", { name: "Baixar relatório PDF" }));
    fireEvent.click(screen.getByRole("button", { name: "Baixar dados JSON" }));
    expect(saveOutputFile).toHaveBeenNthCalledWith(1, {
      blob: output.blob,
      fileName: output.fileName,
    });
    expect(saveOutputFile).toHaveBeenNthCalledWith(2, {
      blob: secondaryBlob,
      fileName: "dados.json",
    });
  });
  it("navigates all pairs while the list contains only changed pages", async () => {
    const first = comparison.pairs[0];
    if (!first) throw new Error("missing fixture");
    run.mockResolvedValue({
      ...output,
      comparison: {
        ...comparison,
        pairs: [
          { ...first, status: "unchanged" },
          { ...first, index: 1, leftPage: 2, rightPage: 3, status: "added" },
        ],
      },
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
    await screen.findByRole("button", { name: "Baixar relatório PDF" });
    expect(screen.getByText("Par 1 de 2")).toBeInTheDocument();
    const changeButton = screen.getByText("Página 2 ↔ 3").closest("button");
    if (!changeButton) throw new Error("missing change button");
    fireEvent.click(changeButton);
    expect(screen.getByText("Par 2 de 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Par anterior" }));
    expect(screen.getByText("Par 1 de 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo par" }));
    expect(screen.getByText("Par 2 de 2")).toBeInTheDocument();
  });
  it("preserves the executor's localized failure reason", async () => {
    run.mockRejectedValue(new ToolRunError("INVALID_INPUT", "Limite de 40 páginas excedido."));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite de 40 páginas excedido.");
  });
  it("keeps an inserted page visible when overlay was enabled on another pair", async () => {
    const first = comparison.pairs[0];
    if (!first) throw new Error("missing fixture");
    run.mockResolvedValue({
      ...output,
      comparison: {
        ...comparison,
        pairs: [
          first,
          {
            ...first,
            index: 1,
            leftPage: null,
            rightPage: 2,
            leftImage: undefined,
            status: "added",
          },
        ],
      },
    });
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
    await screen.findByRole("button", { name: "Baixar relatório PDF" });
    fireEvent.click(screen.getByRole("button", { name: "Visual" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Sobrepor revisado ao original" }));
    expect(container.querySelector(".pdf-compare-previews--overlay")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Próximo par" }));
    expect(container.querySelector(".pdf-compare-previews--overlay")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "PDF revisado" })).toBeInTheDocument();
    expect(screen.getByText("Página ausente neste documento")).toBeInTheDocument();
  });

  it("lists visual-only changes only in visual mode", async () => {
    const first = comparison.pairs[0];
    if (!first) throw new Error("missing fixture");
    run.mockResolvedValue({
      ...output,
      comparison: {
        ...comparison,
        pairs: [
          {
            ...first,
            textChanged: false,
            leftText: "Igual",
            rightText: "Igual",
            textDiff: diffText("Igual", "Igual"),
          },
        ],
      },
    });
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Comparar PDFs" }));
    await screen.findByRole("button", { name: "Baixar relatório PDF" });
    expect(screen.getByText("Nenhuma alteração encontrada para este filtro.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Visual" }));
    expect(
      screen.queryByText("Nenhuma alteração encontrada para este filtro."),
    ).not.toBeInTheDocument();
  });
});
