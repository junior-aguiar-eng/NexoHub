import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import type {
  BrowserTranslationOptions,
  BrowserTranslationResult,
} from "@/platform/browser-translator";
import { DedicatedToolView } from "./DedicatedToolView";
import { launcherTools } from "./data";

const engine = vi.hoisted(() =>
  vi.fn<(text: string, options: BrowserTranslationOptions) => Promise<BrowserTranslationResult>>(),
);
vi.mock("@/platform/browser-translator", async () => ({
  ...(await vi.importActual<typeof import("@/platform/browser-translator")>(
    "@/platform/browser-translator",
  )),
  performBrowserTranslation: engine,
}));
afterEach(() => {
  engine.mockReset();
  vi.restoreAllMocks();
});
function open() {
  const tool = launcherTools.find((tool) => tool.id === "text-translate");
  if (!tool) throw new Error("Tradutor ausente");
  const complete = vi.fn();
  const view = render(
    <DedicatedToolView
      tool={tool}
      documentCore={new BrowserDocumentCorePort()}
      onBack={vi.fn()}
      onOperationComplete={complete}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Digitar Texto" }));
  const input = view.container.querySelector("#dedicated-tool-direct-textarea");
  if (!input) throw new Error("Entrada de texto ausente");
  fireEvent.change(input, {
    target: { value: "Hello" },
  });
  return { ...view, complete };
}
const result: BrowserTranslationResult = {
  translatedText: "Olá",
  sourceLang: "en",
  targetLang: "pt",
  engine: "transformers.js-m2m100",
};

describe("cancelamento da tradução na interface", () => {
  it("cancela o carregamento e ignora um resultado atrasado", async () => {
    let finish!: (value: BrowserTranslationResult) => void;
    engine.mockImplementation((_text, options) => {
      options.onProgress?.({ status: "downloading", progress: 12, loadedBytes: 1024 });
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    const { complete } = open();
    fireEvent.click(screen.getByRole("button", { name: "Executar agora" }));
    await waitFor(() => expect(engine).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar tradução" }));
    expect(engine.mock.calls[0][1].signal?.aborted).toBe(true);
    await act(async () => {
      finish(result);
    });
    expect(complete).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Texto traduzido" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Executar agora" })).toBeEnabled();
  });
  it("interrompe o motor ao sair da tela", async () => {
    engine.mockImplementation(() => new Promise(() => {}));
    const { unmount } = open();
    fireEvent.click(screen.getByRole("button", { name: "Executar agora" }));
    await waitFor(() => expect(engine).toHaveBeenCalledOnce());
    const signal = engine.mock.calls[0][1].signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
