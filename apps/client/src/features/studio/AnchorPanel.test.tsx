import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnchorPanel } from "./AnchorPanel";

describe("AnchorPanel", () => {
  it("cria um seletor tipado para a representação escolhida", () => {
    const onCreate = vi.fn();
    render(<AnchorPanel onCreate={onCreate} />);

    fireEvent.change(screen.getByRole("combobox", { name: "Tipo de anchor" }), {
      target: { value: "OCR_LINE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar anchor" }));

    expect(onCreate).toHaveBeenCalledWith({
      type: "OCR_LINE",
      pageNumber: 1,
      lineIndex: 0,
    });
  });
});
