import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ImageBatchPanel } from "./ImageBatchPanel";
import { ToolWorkspace } from "./ToolWorkspace";

it("recolhe a lista móvel do lote sem remover arquivos ou perder a seleção", () => {
  const select = vi.fn();
  render(
    <ImageBatchPanel
      entries={[{ file: new File(["a"], "a.png") }, { file: new File(["b"], "b.png") }]}
      selectedIndex={0}
      onSelect={select}
      onRemove={vi.fn()}
      onAdd={vi.fn()}
    />,
  );
  const toggle = screen.getByRole("button", { name: "Mostrar arquivos do lote" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Visualizar imagem 2: b.png" }));
  expect(select).toHaveBeenCalledWith(1);
});

it("alterna as regiões sem perder campos e mantém a ação fora das opções roláveis", () => {
  render(
    <ToolWorkspace
      titleId="title"
      header={<h1 id="title">Ferramenta</h1>}
      options={
        <label>
          Parâmetro
          <input defaultValue="inicial" />
        </label>
      }
      actions={<button type="button">Executar</button>}
    >
      <label>
        Documento
        <textarea defaultValue="texto" />
      </label>
    </ToolWorkspace>,
  );
  const input = screen.getByRole("textbox", { name: "Parâmetro" });
  expect(screen.getByRole("region", { name: "Área do documento" })).toContainElement(
    screen.getByRole("textbox", { name: "Documento" }),
  );
  expect(screen.getByRole("region", { name: "Ações da ferramenta" })).toContainElement(
    screen.getByRole("button", { name: "Executar" }),
  );
  expect(screen.getByRole("complementary", { name: "Opções" })).toContainElement(input);
  fireEvent.change(input, { target: { value: "ajustado" } });
  const text = screen.getByRole("textbox", { name: "Documento" });
  fireEvent.click(screen.getByRole("button", { name: "Opções" }));
  expect(screen.getByRole("button", { name: "Opções" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Documento" }));
  expect(screen.getByRole("textbox", { name: "Parâmetro" })).toBe(input);
  expect(input).toHaveValue("ajustado");
  expect(screen.getByRole("textbox", { name: "Documento" })).toBe(text);
  expect(
    screen.getByRole("button", { name: "Executar" }).closest("[data-workspace-part=options]"),
  ).toBeNull();
});
