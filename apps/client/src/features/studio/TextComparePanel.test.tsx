import { asArtifactId, asDocumentId } from "@nexohub/domain";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentCorePort } from "@/platform/document-core";
import { TextComparePanel } from "./TextComparePanel";

describe("TextComparePanel", () => {
  it("compara dois textos e exibe estatísticas de adições e remoções", async () => {
    render(
      <TextComparePanel
        initialOriginal={`Primeira linha
Segunda linha`}
        initialModified={`Primeira linha
Linha modificada`}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Comparar" }));

    expect(screen.getByText("+1 adições")).toBeInTheDocument();
    expect(screen.getByText("-1 remoções")).toBeInTheDocument();
    expect(screen.getByText("Linha modificada")).toBeInTheDocument();
    expect(screen.getByText("Segunda linha")).toBeInTheDocument();
  });

  it("permite alternar entre visualização lado a lado e unificada", async () => {
    render(<TextComparePanel initialOriginal="Texto A" initialModified="Texto B" />);

    fireEvent.click(screen.getByRole("button", { name: "Comparar" }));

    const unifiedBtn = screen.getByTitle("Unificado");
    fireEvent.click(unifiedBtn);

    expect(screen.getByText("Texto B")).toBeInTheDocument();

    const sideBySideBtn = screen.getByTitle("Lado a lado");
    fireEvent.click(sideBySideBtn);

    expect(screen.getByText("Texto A")).toBeInTheDocument();
  });

  it("permite fixar âncora de referência em trecho modificado", async () => {
    const invoke = vi.fn().mockResolvedValue({ id: "anchor-1" });
    const documentCore = { invoke } as unknown as DocumentCorePort;
    const onAnchorCreated = vi.fn();

    render(
      <TextComparePanel
        initialOriginal="Base original"
        initialModified="Base alterada"
        documentCore={documentCore}
        projectPath="C:/projeto"
        documentId={asDocumentId("doc-1")}
        artifactId={asArtifactId("art-1")}
        onAnchorCreated={onAnchorCreated}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Comparar" }));

    const anchorBtn = screen.getByTitle("Fixar âncora");
    fireEvent.click(anchorBtn);

    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect(invoke).toHaveBeenCalledWith(
      "create_anchor",
      expect.objectContaining({
        projectPath: "C:/projeto",
        artifactId: "art-1",
        selector: expect.objectContaining({ type: "TEXT_RANGE" }),
        quote: "Base alterada",
      }),
    );
    expect(onAnchorCreated).toHaveBeenCalledTimes(1);
  });
});
