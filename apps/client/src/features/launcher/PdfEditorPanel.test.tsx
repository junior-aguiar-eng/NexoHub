import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { UnavailableDocumentCorePort } from "@/platform/document-core";
import { runLauncherTool } from "@/platform/launcher-tool-runner";
import type { EditorRevision } from "@/platform/pdf-editor-types";
import { allowToolNavigation } from "@/platform/tool-navigation-guard";
import { PdfEditorPanel } from "./PdfEditorPanel";

vi.mock("@/platform/launcher-tool-runner", () => ({ runLauncherTool: vi.fn() }));
const run = vi.mocked(runLauncherTool);
const file = new File(["pdf"], "exemplo.pdf", { type: "application/pdf" });
const revision: EditorRevision = {
  bytes: new Uint8Array([1]),
  pages: [
    {
      width: 500,
      height: 700,
      texts: [
        {
          id: "0:0",
          text: "Texto antigo",
          x: 0.1,
          y: 0.2,
          width: 0.4,
          height: 0.04,
          fontName: "Helvetica",
          fontSize: 18,
          color: "#000000",
          editable: true,
        },
      ],
    },
  ],
  preview: { width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) },
  thumbnails: [],
  signed: false,
};
function setup(core = new UnavailableDocumentCorePort()) {
  return render(<PdfEditorPanel documentCore={core} onBack={vi.fn()} initialFiles={[file]} />);
}

it("mostra motivo do objeto incompatível sem abrir edição", async () => {
  run.mockResolvedValueOnce({
    blob: new Blob(["pdf"]),
    fileName: "editado.pdf",
    categoryKey: "recent.type.pdf",
    editorRevision: {
      ...revision,
      pages: [
        {
          ...revision.pages[0],
          texts: [
            {
              ...revision.pages[0].texts[0],
              editable: false,
              editRestriction: "transform",
            },
          ],
        },
      ],
    },
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Editar texto existente" }));
  fireEvent.change(screen.getByLabelText("Objetos da página"), { target: { value: "0:0" } });
  expect(await screen.findByText(/Texto inclinado ou espelhado/)).toBeVisible();
  expect(screen.queryByLabelText("Conteúdo do texto")).not.toBeInTheDocument();
});

it("bloqueia glifo não demonstrado e permite fonte alternativa explícita", async () => {
  run.mockResolvedValueOnce({
    blob: new Blob(["pdf"]),
    fileName: "editado.pdf",
    categoryKey: "recent.type.pdf",
    editorRevision: {
      ...revision,
      pages: [
        {
          ...revision.pages[0],
          texts: [
            {
              ...revision.pages[0].texts[0],
              fontPolicy: "observed",
              supportedCharacters: "Texto antigo ",
            },
          ],
        },
      ],
    },
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Editar texto existente" }));
  fireEvent.click(screen.getByRole("button", { name: "Selecionar texto: Texto antigo" }));
  fireEvent.change(screen.getByLabelText("Conteúdo do texto"), { target: { value: "ação" } });
  expect(screen.getByRole("button", { name: "Aplicar alteração" })).toBeDisabled();
  expect(screen.getByText(/caracteres ainda não demonstrados/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Fonte para a substituição"), {
    target: { value: "Helvetica" },
  });
  expect(screen.getByRole("button", { name: "Aplicar alteração" })).toBeEnabled();
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    putImageData: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,AA==");
  vi.stubGlobal(
    "ImageData",
    class {
      constructor(
        public data: Uint8ClampedArray,
        public width: number,
        public height: number,
      ) {}
    },
  );
  run.mockResolvedValue({
    blob: new Blob(["pdf"]),
    fileName: "editado.pdf",
    categoryKey: "recent.type.pdf",
    editorRevision: revision,
  });
});
it("abre documento e permite editar texto original com confirmação explícita da fonte", async () => {
  setup();
  await screen.findByRole("button", { name: "Editar texto existente" });
  fireEvent.click(screen.getByRole("button", { name: "Editar texto existente" }));
  fireEvent.click(screen.getByRole("button", { name: "Selecionar texto: Texto antigo" }));
  fireEvent.change(screen.getByLabelText("Conteúdo do texto"), { target: { value: "Texto novo" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar alteração" }));
  await waitFor(() =>
    expect(run).toHaveBeenLastCalledWith(
      expect.anything(),
      "pdf-edit",
      expect.objectContaining({
        editorSnapshot: {
          replacements: [{ id: "0:0", text: "Texto novo", fallbackFont: undefined }],
          elements: [],
        },
      }),
    ),
  );
});
it("adiciona elemento e permite desfazer sem perder a revisão", async () => {
  setup();
  await screen.findByRole("button", { name: "Adicionar texto" });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar texto" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Desfazer" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Refazer" })).toBeEnabled());
  expect(run).toHaveBeenLastCalledWith(
    expect.anything(),
    "pdf-edit",
    expect.objectContaining({ editorThumbnails: true }),
  );
});

it("navega pela revisão exportável e reutiliza página em cache sem refazer a edição", async () => {
  run.mockResolvedValueOnce({
    blob: new Blob(["revisao"]),
    fileName: "editado.pdf",
    categoryKey: "recent.type.pdf",
    editorRevision: { ...revision, pages: [...revision.pages, { ...revision.pages[0] }] },
  });
  run.mockResolvedValueOnce({
    blob: new Blob(["revisao"]),
    fileName: "editado.pdf",
    categoryKey: "recent.type.pdf",
    editorPreview: revision.preview,
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Próxima página" }));
  await screen.findByText("2 / 2");
  expect(run).toHaveBeenLastCalledWith(
    expect.anything(),
    "pdf-edit",
    expect.objectContaining({ editorPreviewOnly: true, editorPage: 1 }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Página anterior" }));
  await screen.findByText("1 / 2");
  expect(run).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("button", { name: "Desfazer" })).toBeDisabled();
  expect(run.mock.calls[1][2].files[0].size).toBe(7);
});

it("resposta atrasada de prévia cancelada não substitui a navegação mais recente", async () => {
  const drawn = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    putImageData: drawn,
  } as unknown as CanvasRenderingContext2D);
  let finish: ((value: Awaited<ReturnType<typeof runLauncherTool>>) => void) | undefined;
  const twoPages = { ...revision, pages: [...revision.pages, { ...revision.pages[0] }] };
  run.mockResolvedValueOnce({
    blob: new Blob(["pdf"]),
    fileName: "x.pdf",
    categoryKey: "recent.type.pdf",
    editorRevision: twoPages,
  });
  run.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  run.mockResolvedValueOnce({
    blob: new Blob(["pdf"]),
    fileName: "x.pdf",
    categoryKey: "recent.type.pdf",
    editorPreview: { data: new Uint8Array([2, 2, 2, 255]), width: 1, height: 1 },
  });
  setup();
  fireEvent.click(await screen.findByRole("button", { name: "Próxima página" }));
  fireEvent.click(await screen.findByRole("button", { name: "Cancelar operação" }));
  fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
  await screen.findByText("2 / 2");
  await act(async () =>
    finish?.({
      blob: new Blob(["pdf"]),
      fileName: "x.pdf",
      categoryKey: "recent.type.pdf",
      editorPreview: { data: new Uint8Array([9, 9, 9, 255]), width: 1, height: 1 },
    }),
  );
  expect(drawn.mock.lastCall?.[0].data[0]).toBe(2);
});
it("falha ao aplicar mantém documento e conteúdo digitado para correção", async () => {
  setup();
  await screen.findByRole("button", { name: "Adicionar texto" });
  fireEvent.click(screen.getByRole("button", { name: "Adicionar texto" }));
  await screen.findByLabelText("Conteúdo do texto");
  run.mockRejectedValueOnce(new Error("EDITOR_TEXTO_NAO_CABE"));
  fireEvent.change(screen.getByLabelText("Conteúdo do texto"), {
    target: { value: "Texto muito longo" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar alteração" }));
  await expect(screen.findByRole("alert")).resolves.toHaveTextContent(/não cabe/);
  expect(screen.getByLabelText("Conteúdo do texto")).toHaveValue("Texto muito longo");
});
it("arquivo inválido não chama o motor", () => {
  render(<PdfEditorPanel documentCore={new UnavailableDocumentCorePort()} onBack={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Selecionar PDF"), {
    target: { files: [new File(["x"], "x.txt")] },
  });
  expect(screen.getByRole("alert")).toHaveTextContent(/PDF/);
  expect(run).not.toHaveBeenCalled();
});
it("permite ajustar tamanho do texto existente e removê-lo de verdade", async () => {
  setup();
  await screen.findByRole("button", { name: "Editar texto existente" });
  fireEvent.click(screen.getByRole("button", { name: "Editar texto existente" }));
  fireEvent.click(screen.getByRole("button", { name: "Selecionar texto: Texto antigo" }));
  fireEvent.change(screen.getByLabelText("Tamanho (pt)"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Aplicar alteração" }));
  await waitFor(() =>
    expect(run).toHaveBeenLastCalledWith(
      expect.anything(),
      "pdf-edit",
      expect.objectContaining({
        editorSnapshot: expect.objectContaining({
          replacements: [expect.objectContaining({ fontSize: 12 })],
        }),
      }),
    ),
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Excluir texto" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Excluir texto" }));
  await waitFor(() =>
    expect(run).toHaveBeenLastCalledWith(
      expect.anything(),
      "pdf-edit",
      expect.objectContaining({
        editorSnapshot: expect.objectContaining({
          replacements: [expect.objectContaining({ text: "" })],
        }),
      }),
    ),
  );
});
it("não descarta texto digitado ao trocar de modo sem confirmação", async () => {
  setup();
  await screen.findByRole("button", { name: "Editar texto existente" });
  fireEvent.click(screen.getByRole("button", { name: "Editar texto existente" }));
  fireEvent.click(screen.getByRole("button", { name: "Selecionar texto: Texto antigo" }));
  fireEvent.change(screen.getByLabelText("Conteúdo do texto"), {
    target: { value: "Ainda não apliquei" },
  });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "Selecionar elementos" }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(screen.getByLabelText("Conteúdo do texto")).toHaveValue("Ainda não apliquei");
  confirm.mockRestore();
});

it("desfazer até a revisão salva continua reconhecendo estado sem alterações", async () => {
  const core = new (class extends UnavailableDocumentCorePort {
    saveOutputFile = vi.fn(async () => undefined);
  })();
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  // Os jobs deste fixture já retornam promises resolvidas; consumir suas transações React
  // evita usar o prazo de polling do DOM como sincronização do histórico.
  await act(async () => {
    setup(core);
  });
  const click = async (name: string) => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name }));
    });
  };
  await click("Adicionar texto");
  expect(screen.getByRole("button", { name: "Desfazer" })).toBeEnabled();
  await click("Salvar alterações");
  expect(screen.getByText("PDF editado salvo.")).toBeInTheDocument();
  await click("Adicionar texto");
  expect(run).toHaveBeenCalledTimes(3);
  expect(screen.getByRole("button", { name: "Desfazer" })).toBeEnabled();
  await click("Desfazer");
  expect(screen.getByRole("button", { name: "Refazer" })).toBeEnabled();
  expect(allowToolNavigation()).toBe(true);
  expect(confirm).not.toHaveBeenCalled();
  await click("Refazer");
  expect(screen.getByRole("button", { name: "Adicionar texto" })).toBeEnabled();
  expect(allowToolNavigation()).toBe(false);
  confirm.mockRestore();
});
