import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { type SplitInterval, SplitPdfPanel } from "./SplitPdfPanel";

function Harness({ merged = false }: { merged?: boolean }) {
  const [intervals, setIntervals] = useState<SplitInterval[]>([
    { id: "original", start: 1, end: 5 },
  ]);
  const [merge, setMerge] = useState(merged);
  const [mode, setMode] = useState<"interval" | "pages">("interval");
  return (
    <>
      <SplitPdfPanel
        totalPages={5}
        fileName="original.pdf"
        intervals={intervals}
        mergeIntervals={merge}
        splitMode={mode}
        selectedPageNumbers={[]}
        onIntervalsChange={setIntervals}
        onMergeIntervalsChange={setMerge}
        onSplitModeChange={setMode}
        onSelectedPageNumbersChange={() => {}}
      />
      <output aria-label="Intervalos de saída">
        {JSON.stringify(intervals.map(({ start, end }) => [start, end]))}
      </output>
      <output aria-label="Mesclar intervalos">{String(merge)}</output>
    </>
  );
}

function chooseFixed() {
  fireEvent.click(screen.getByRole("button", { name: "Fixo" }));
}

describe("SplitPdfPanel", () => {
  it("gera partes de uma página ao ativar o intervalo fixo padrão", () => {
    render(<Harness />);
    chooseFixed();
    expect(screen.getByLabelText("Intervalos de saída")).toHaveTextContent(
      "[[1,1],[2,2],[3,3],[4,4],[5,5]]",
    );
  });

  it("desativa a junção oculta para produzir arquivos separados no modo fixo", () => {
    render(<Harness merged />);
    chooseFixed();
    expect(screen.getByLabelText("Mesclar intervalos")).toHaveTextContent("false");
  });

  it("divide em blocos e preserva o último intervalo incompleto", () => {
    render(<Harness />);
    chooseFixed();
    fireEvent.change(screen.getByLabelText("Dividir a cada:"), { target: { value: "2" } });
    expect(screen.getByLabelText("Intervalos de saída")).toHaveTextContent("[[1,2],[3,4],[5,5]]");
    expect(screen.getByLabelText("Dividir a cada:")).toHaveValue(2);
  });

  it("reaplica o tamanho fixo escolhido depois de editar intervalos personalizados", () => {
    render(<Harness />);
    chooseFixed();
    fireEvent.change(screen.getByLabelText("Dividir a cada:"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }));
    fireEvent.change(screen.getAllByLabelText("para")[0], { target: { value: "1" } });
    chooseFixed();
    expect(screen.getByLabelText("Intervalos de saída")).toHaveTextContent("[[1,2],[3,4],[5,5]]");
  });
});
