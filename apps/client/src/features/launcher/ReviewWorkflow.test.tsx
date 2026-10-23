import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import { DedicatedToolView } from "./DedicatedToolView";
import { launcherTools } from "./data";

// A inicialização WASM é validada no Chromium. Este teste cobre o contrato de edição/aplicação.
vi.mock("@/platform/browser-reviewer", async () => {
  const actual = await vi.importActual<typeof import("@/platform/browser-reviewer")>(
    "@/platform/browser-reviewer",
  );
  const { reviewText } = await import("@nexohub/domain");
  return {
    ...actual,
    performBrowserReview: async ({ text }: { text: string }) => reviewText(text),
  };
});

function openReview(text: string, upload = false) {
  const tool = launcherTools.find((tool) => tool.id === "text-review");
  if (!tool) throw new Error("Revisor ausente");
  const complete = vi.fn();
  const view = render(
    <DedicatedToolView
      tool={tool}
      documentCore={new BrowserDocumentCorePort()}
      onBack={vi.fn()}
      onOperationComplete={complete}
      initialFiles={upload ? [new File([text], "minuta.txt", { type: "text/plain" })] : undefined}
    />,
  );
  if (!upload) {
    fireEvent.click(screen.getByRole("button", { name: "Digitar Texto" }));
    const input = view.container.querySelector("#dedicated-tool-direct-textarea");
    if (!input) throw new Error("Entrada ausente");
    fireEvent.change(input, { target: { value: text } });
  }
  const editor = () => {
    const textarea = view.container.querySelector(".text-review-textarea");
    if (!textarea) throw new Error("Editor de revisão ausente");
    return textarea;
  };
  return { ...view, complete, editor };
}

describe("Revisão interativa no website", () => {
  it.each([false, true])("aguarda confirmação das sugestões (arquivo: %s)", async (upload) => {
    const { complete, editor } = openReview("Eu fasso isso.", upload);
    fireEvent.click(screen.getByRole("button", { name: /^Revisar Texto$/ }));
    await waitFor(() => expect(complete).toHaveBeenCalled(), { timeout: 10000 });
    expect(editor()).toHaveValue("Eu fasso isso.");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar Todas as Correções" }));
    expect(editor()).toHaveValue("Eu faço isso.");
    expect(
      screen.queryByRole("button", { name: "Aplicar Todas as Correções" }),
    ).not.toBeInTheDocument();
  });

  it("atualiza as posições das sugestões após uma correção individual", () => {
    const { editor } = openReview("Eu fasso e fasso.");
    fireEvent.click(screen.getAllByRole("button", { name: /^Aplicar$/ })[0]);
    expect(editor()).toHaveValue("Eu faço e fasso.");
    fireEvent.click(screen.getByRole("button", { name: /^Aplicar$/ }));
    expect(editor()).toHaveValue("Eu faço e faço.");
  });

  it("invalida sugestões após edição manual e permite apagar todo o texto", () => {
    const { editor } = openReview("Eu fasso isso.");
    fireEvent.change(editor(), { target: { value: "" } });
    expect(editor()).toHaveValue("");
    expect(screen.queryByRole("button", { name: /^Aplicar$/ })).not.toBeInTheDocument();
  });
});
