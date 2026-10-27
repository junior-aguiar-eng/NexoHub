import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TranslateDocumentPanel } from "./TranslateDocumentPanel";

const props = {
  sourceLang: "en" as const,
  targetLang: "pt" as const,
  onSourceLangChange: vi.fn(),
  onTargetLangChange: vi.fn(),
  onSwapLanguages: vi.fn(),
  translatedText: "Texto editado",
  onTranslatedTextChange: vi.fn(),
  isRunning: false,
  progressPercent: 0,
};
afterEach(() => vi.restoreAllMocks());

describe("carregamento e resultado do tradutor", () => {
  it("baixa o texto editado, sem reutilizar o arquivo anterior", async () => {
    const create = vi.fn((_blob: Blob) => "blob:translation");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<TranslateDocumentPanel {...props} outputBlob={new Blob(["Texto anterior"])} />);
    fireEvent.click(screen.getByRole("button", { name: "Baixar .txt" }));
    expect(await (create.mock.calls[0][0] as Blob).text()).toBe("Texto editado");
  });
  it("distingue inicialização de download e permite cancelar", () => {
    const onCancel = vi.fn();
    render(
      <TranslateDocumentPanel
        {...props}
        isRunning
        progressPercent={70}
        progressStatusMessage="Inicializando modelo no dispositivo..."
        progressPhase="initializing"
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "70");
    expect(screen.getByText("Inicializando modelo no dispositivo...")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar tradução" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Baixar .txt" })).toBeDisabled();
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});

it("informa somente o download necessário sem expor detalhes técnicos", () => {
  const view = render(<TranslateDocumentPanel {...props} />);
  expect(
    screen.getByText("Para traduzir, é necessário fazer um download no primeiro uso."),
  ).toBeVisible();
  expect(view.container.textContent).not.toMatch(
    /M2M100|tokenizer|runtime|cache|MIT|GiB|mecanismo nativo|processado neste navegador/,
  );
  view.rerender(<TranslateDocumentPanel {...props} browserModel={false} />);
  expect(
    screen.queryByText("Para traduzir, é necessário fazer um download no primeiro uso."),
  ).not.toBeInTheDocument();
});
