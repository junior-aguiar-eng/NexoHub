import { asArtifactId, asDocumentId } from "@nexohub/domain";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentCorePort } from "@/platform/document-core";
import { ReviewPanel } from "./ReviewPanel";

describe("ReviewPanel", () => {
  it("descarta achados de uma análise invalidada por edição", async () => {
    let resolveReview: ((result: ReturnType<typeof reviewResult>) => void) | undefined;
    const invoke = vi.fn(
      () =>
        new Promise<ReturnType<typeof reviewResult>>((resolve) => {
          resolveReview = resolve;
        }),
    );
    render(
      <ReviewPanel
        initialContent="texto antigo"
        documentCore={{ invoke } as unknown as DocumentCorePort}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Analisar texto" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Texto para revisão" }), {
      target: { value: "texto novo" },
    });
    await act(async () => {
      resolveReview?.(
        reviewResult([match("OLD_RESULT", 0, 5, "texto", "duplication", "Achado antigo.")]),
      );
    });

    expect(screen.getByText("0 achados")).toBeInTheDocument();
    expect(screen.queryByText("Achado antigo.")).not.toBeInTheDocument();
  });

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

  it("permite aplicar substituição individual de um achado mantendo a sincronia dos demais", async () => {
    const invoke = vi.fn().mockResolvedValueOnce({
      language: "pt-BR",
      engine: "languagetool-community",
      version: "6.9-SNAPSHOT",
      matches: [
        match("WORD_REPEAT", 0, 11, "texto", "duplication", "Palavra repetida."),
        match("SPACE_BEFORE", 18, 2, ".", "typographical", "Espaço antes da pontuação."),
      ],
    });
    render(
      <ReviewPanel
        initialContent="texto texto errado ."
        documentCore={{ invoke } as unknown as DocumentCorePort}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Analisar texto" }));
    expect(await screen.findByText("2 achados")).toBeInTheDocument();

    const applyButtons = screen.getAllByRole("button", { name: "Substituir" });
    expect(applyButtons).toHaveLength(2);

    // Aplica apenas a primeira sugestão
    const firstButton = applyButtons[0];
    if (firstButton) {
      fireEvent.click(firstButton);
    }

    expect(screen.getByRole("textbox", { name: "Texto para revisão" })).toHaveValue(
      "texto errado .",
    );
    expect(screen.getByText("1 achados")).toBeInTheDocument();
    expect(screen.getByText("Espaço antes da pontuação.")).toBeInTheDocument();
  });

  it("ativa regras locais embutidas como salvaguarda se o serviço de revisão do backend rejeitar", async () => {
    const invoke = vi.fn().mockRejectedValueOnce(new Error("Sidecar indisponível"));
    render(
      <ReviewPanel
        initialContent="Este é um um teste ."
        documentCore={{ invoke } as unknown as DocumentCorePort}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Analisar texto" }));

    // Fallback de regras do domínio roda localmente sem quebrar o componente
    expect(await screen.findByText("2 achados")).toBeInTheDocument();
    expect(screen.getByText("Palavra repetida em sequência.")).toBeInTheDocument();
    expect(screen.getByText("Espaço indevido antes da pontuação.")).toBeInTheDocument();
  });

  it("chama onSuccess após salvar a revisão com sucesso", async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce({ artifact: { id: asArtifactId("derived-ok") }, operation: {} });
    const onSuccess = vi.fn();

    render(
      <ReviewPanel
        initialContent="Conteúdo original"
        documentCore={{ invoke } as unknown as DocumentCorePort}
        revisionContext={{
          projectPath: "C:/projeto.nexohub",
          documentId: asDocumentId("document-1"),
          artifactId: asArtifactId("original-1"),
        }}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Texto para revisão" }), {
      target: { value: "Conteúdo com alteração" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar revisão" }));

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Revisão criada e adicionada às camadas.")).toBeInTheDocument();
  });
});

function reviewResult(matches: ReturnType<typeof match>[] = []) {
  return {
    language: "pt-BR",
    engine: "languagetool-community",
    version: "6.9-SNAPSHOT",
    matches,
  };
}

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
