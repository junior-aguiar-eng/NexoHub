import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { launcherTools } from "./data";
import { Header } from "./Header";

function renderHeader() {
  return render(
    <Header
      tools={launcherTools}
      activeSuite="overview"
      onSelectSuite={vi.fn()}
      onOpenCommandPalette={vi.fn()}
    />,
  );
}

describe("Header", () => {
  it("anuncia abertura do catálogo e fecha com Escape devolvendo foco ao gatilho", () => {
    renderHeader();
    const trigger = screen.getByRole("button", { name: "Todas as ferramentas PDF" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
    if (!panel) throw new Error("Catálogo não encontrado");
    const tool = within(panel).getByRole("button", { name: "Juntar PDF" });
    tool.focus();
    fireEvent.keyDown(tool, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(panel).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("fecha o catálogo quando o teclado leva o foco para fora", () => {
    renderHeader();
    const trigger = screen.getByRole("button", { name: "Todas as ferramentas PDF" });
    fireEvent.click(trigger);
    const search = screen.getByRole("button", { name: "Buscar no NexoHub" });
    fireEvent.focusIn(search);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("preserva clique em conteúdo não focável dentro do catálogo", () => {
    const { container } = renderHeader();
    const trigger = screen.getByRole("button", { name: "Todas as ferramentas PDF" });
    trigger.focus();
    fireEvent.click(trigger);
    const title = container.querySelector(".megamenu-col-title");
    if (!title) throw new Error("Título não encontrado");
    fireEvent.mouseDown(title);
    fireEvent.blur(trigger, { relatedTarget: null });
    fireEvent.click(title);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.focusIn(screen.getByRole("button", { name: "Buscar no NexoHub" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
