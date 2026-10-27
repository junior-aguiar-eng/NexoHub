import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import { DedicatedToolView } from "./DedicatedToolView";
import { launcherTools } from "./data";

it.each(["", "Segundo 00999"])("exporta o par selecionado (documento 2: %s)", async (second) => {
  const tool = launcherTools.find((item) => item.id === "text-compare");
  if (!tool) throw new Error("Comparador ausente");
  const urls = vi.spyOn(URL, "createObjectURL");
  render(
    <DedicatedToolView
      tool={tool}
      documentCore={new BrowserDocumentCorePort()}
      onBack={vi.fn()}
      initialFiles={[
        new File(["Original 00123"], "original.txt"),
        new File([second], "segundo.txt"),
        new File(["Terceiro 00456"], "terceiro.txt"),
      ]}
    />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Doc 1 × 3" })).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Doc 1 × 3" }));
  const button = screen.getByRole("button", { name: /Exportar/i });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() => expect(urls).toHaveBeenCalled());
  const blob = urls.mock.calls.at(-1)?.[0];
  if (!(blob instanceof Blob)) throw new Error("Relatório ausente");
  const report = await blob.text();
  expect(report).toContain("- Original 00123");
  expect(report).toContain("+ Terceiro 00456");
  expect(report).not.toContain("Segundo 00999");
  urls.mockRestore();
});

it("bloqueia ambas as ações se a coluna selecionada for apagada, sem recuperar o arquivo 2", async () => {
  const tool = launcherTools.find((item) => item.id === "text-compare");
  if (!tool) throw new Error("Comparador ausente");
  const view = render(
    <DedicatedToolView
      tool={tool}
      documentCore={new BrowserDocumentCorePort()}
      onBack={vi.fn()}
      initialFiles={[
        new File(["Original"], "original.txt"),
        new File(["Segundo"], "segundo.txt"),
        new File(["Terceiro"], "terceiro.txt"),
      ]}
    />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Doc 1 × 3" })).toBeVisible());
  fireEvent.click(screen.getByRole("button", { name: "Doc 1 × 3" }));
  fireEvent.click(screen.getByRole("button", { name: /Editar \/ Digitar/i }));
  const editor = view.container.querySelectorAll(".doc-compare-textarea")[2];
  if (!editor) throw new Error("Terceiro editor ausente");
  fireEvent.change(editor, { target: { value: "" } });
  expect(screen.getByRole("button", { name: /Exportar/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Comparar Textos" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Doc 1 × 2" }));
  expect(screen.getByRole("button", { name: "Comparar Textos" })).toBeEnabled();
});
