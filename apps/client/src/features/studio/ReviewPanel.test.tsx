import { asArtifactId, asDocumentId } from "@nexohub/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentCorePort } from "@/platform/document-core";
import { ReviewPanel } from "./ReviewPanel";

describe("ReviewPanel", () => {
  it("limpa achados obsoletos e permite novo ciclo após aplicação", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        language: "pt-BR",
        engine: "languagetool-community",
        version: "6.9-SNAPSHOT",
        matches: [
          match("WORD_REPEAT", 0, 11, "texto", "duplication", "Palavra repetida."),
          match("SPACE_BEFORE", 18, 2, ".", "typographical", "Espaço antes da pontuação."),
        ],
      })
      .mockResolvedValueOnce({
        language: "pt-BR",
        engine: "languagetool-community",
        version: "6.9-SNAPSHOT",
        matches: [],
      });
    render(
      <ReviewPanel
        initialContent="texto texto errado ."
        documentCore={{ invoke } as unknown as DocumentCorePort}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Analisar texto" }));
    expect(await screen.findByText("2 achados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar todos" }));

    expect(screen.getByRole("textbox", { name: "Texto para revisão" })).toHaveValue(
      "texto errado.",
    );
    expect(screen.getByText("0 achados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Analisar texto" }));
    expect(await screen.findByText("0 achados")).toBeInTheDocument();
  });

  it("persiste cada ciclo sobre o último artifact derivado", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({
        language: "pt-BR",
        engine: "languagetool-community",
        version: "6.9-SNAPSHOT",
        matches: [match("WORD_REPEAT", 0, 11, "texto", "duplication", "Palavra repetida.")],
      })
      .mockResolvedValueOnce({ artifact: { id: asArtifactId("derived-1") }, operation: {} })
      .mockResolvedValueOnce({ artifact: { id: asArtifactId("derived-2") }, operation: {} });
    const documentCore = { invoke } as unknown as DocumentCorePort;
    render(
      <ReviewPanel
        initialContent="texto texto"
        documentCore={documentCore}
        revisionContext={{
          projectPath: "C:/projeto.nexohub",
          documentId: asDocumentId("document-1"),
          artifactId: asArtifactId("original-1"),
        }}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Texto para revisão" });
    fireEvent.click(screen.getByRole("button", { name: "Analisar texto" }));
    await screen.findByText("1 achados");
    fireEvent.click(screen.getByRole("button", { name: "Aplicar todos" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar revisão" }));
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));

    fireEvent.change(editor, { target: { value: "texto revisado" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar revisão" }));
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(3));

    expect(invoke.mock.calls[1]?.[1]).toMatchObject({ artifactId: "original-1", content: "texto" });
    expect(invoke.mock.calls[2]?.[1]).toMatchObject({
      artifactId: "derived-1",
      content: "texto revisado",
    });
  });
});

function match(
  id: string,
  offset: number,
  length: number,
  replacement: string,
  issueType: string,
  message: string,
) {
  return {
    message,
    shortMessage: "",
    offset,
    length,
    replacements: [{ value: replacement }],
    rule: { id, description: message, issueType },
  };
}
