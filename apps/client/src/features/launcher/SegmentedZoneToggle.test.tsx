import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedZoneToggle } from "./SegmentedZoneToggle";

describe("SegmentedZoneToggle", () => {
  it("renderiza as abas de alternância de PDF e Imagem com atributos acessíveis", () => {
    const onZoneChange = vi.fn();
    render(<SegmentedZoneToggle currentZone="pdf" onZoneChange={onZoneChange} />);

    const tablist = screen.getByRole("tablist", { name: /alternar zona de trabalho/i });
    expect(tablist).toBeInTheDocument();

    const pdfTab = screen.getByRole("tab", { name: /alternar para modo pdf/i });
    const imgTab = screen.getByRole("tab", { name: /alternar para modo imagem/i });

    expect(pdfTab).toHaveAttribute("aria-selected", "true");
    expect(imgTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("IMAGEM")).toBeInTheDocument();
  });

  it("chama onZoneChange ao clicar na aba oposta", () => {
    const onZoneChange = vi.fn();
    render(<SegmentedZoneToggle currentZone="pdf" onZoneChange={onZoneChange} />);

    const imgTab = screen.getByRole("tab", { name: /alternar para modo imagem/i });
    fireEvent.click(imgTab);

    expect(onZoneChange).toHaveBeenCalledTimes(1);
    expect(onZoneChange).toHaveBeenCalledWith("img");
  });

  it("reflete estado ativo ao renderizar com currentZone='img'", () => {
    const onZoneChange = vi.fn();
    render(<SegmentedZoneToggle currentZone="img" onZoneChange={onZoneChange} />);

    const pdfTab = screen.getByRole("tab", { name: /alternar para modo pdf/i });
    const imgTab = screen.getByRole("tab", { name: /alternar para modo imagem/i });

    expect(pdfTab).toHaveAttribute("aria-selected", "false");
    expect(imgTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(pdfTab);
    expect(onZoneChange).toHaveBeenCalledWith("pdf");
  });
});
