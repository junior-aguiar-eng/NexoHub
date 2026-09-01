import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextEditor } from "./TextEditor";

describe("TextEditor", () => {
  it("habilita a criação de revisão apenas para conteúdo alterado com contexto persistível", async () => {
    const onSave = vi.fn();
    render(<TextEditor initialContent="Original" onSave={onSave} />);
    const editor = screen.getByRole("textbox", { name: "Conteúdo textual" });
    const save = screen.getByRole("button", { name: "Criar revisão" });

    expect(save).toBeDisabled();
    fireEvent.change(editor, { target: { value: "Revisão" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);

    expect(onSave).toHaveBeenCalledWith("Revisão");
  });
});
