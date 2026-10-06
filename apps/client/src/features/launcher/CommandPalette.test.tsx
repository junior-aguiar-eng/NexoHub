import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { launcherTools } from "./data";

describe("CommandPalette", () => {
  it("renderiza ferramentas disponíveis e aciona navegação ao clicar", () => {
    const onSelectTool = vi.fn();
    const onSelectSuite = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <CommandPalette
        open={true}
        onOpenChange={onOpenChange}
        onSelectSuite={onSelectSuite}
        onSelectTool={onSelectTool}
        tools={launcherTools}
      />,
    );

    expect(
      screen.getByPlaceholderText(/Digite uma suíte ou ferramenta\.\.\./i),
    ).toBeInTheDocument();

    const mergeButton = screen.getByRole("button", { name: /Juntar PDF/i });
    expect(mergeButton).toBeInTheDocument();

    fireEvent.click(mergeButton);
    expect(onSelectTool).toHaveBeenCalledWith(expect.objectContaining({ id: "pdf-merge" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
