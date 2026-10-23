import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExtractImagesPanel } from "./ExtractImagesPanel";

describe("ExtractImagesPanel", () => {
  const sampleImages = [
    {
      id: "img-1",
      name: "foto_perfil.jpg",
      pageNumber: 1,
      width: 400,
      height: 300,
      format: "jpeg" as const,
      data: new Uint8Array([1, 2, 3]),
    },
    {
      id: "img-2",
      name: "diagrama.png",
      pageNumber: 2,
      width: 800,
      height: 600,
      format: "png" as const,
      data: new Uint8Array([4, 5, 6]),
    },
  ];

  it("renderiza os controles de escopo e filtro no estado inicial", () => {
    const onScopeChange = vi.fn();
    const onIgnoreSmallChange = vi.fn();

    render(
      <ExtractImagesPanel
        fileName="catalogo.pdf"
        fileSizeBytes={1024 * 100}
        totalPages={5}
        scope="all"
        onScopeChange={onScopeChange}
        selectedPagesText=""
        onSelectedPagesTextChange={vi.fn()}
        ignoreSmall={true}
        onIgnoreSmallChange={onIgnoreSmallChange}
        extractedImages={[]}
        selectedImageIds={[]}
        onSelectedImageIdsChange={vi.fn()}
        isExtracting={false}
      />,
    );

    expect(screen.getByText("Opções de Extração")).toBeDefined();
    expect(screen.getByText("Todas as páginas")).toBeDefined();
    expect(screen.getByText("Páginas selecionadas")).toBeDefined();
    expect(screen.getByText("Ignorar ícones e figuras pequenas (< 16px)")).toBeDefined();
  });

  it("renderiza a galeria de imagens extraídas e permite selecionar/desmarcar", () => {
    const onSelectedImageIdsChange = vi.fn();

    render(
      <ExtractImagesPanel
        fileName="catalogo.pdf"
        fileSizeBytes={1024 * 100}
        totalPages={5}
        scope="all"
        onScopeChange={vi.fn()}
        selectedPagesText=""
        onSelectedPagesTextChange={vi.fn()}
        ignoreSmall={true}
        onIgnoreSmallChange={vi.fn()}
        extractedImages={sampleImages}
        selectedImageIds={["img-1"]}
        onSelectedImageIdsChange={onSelectedImageIdsChange}
        isExtracting={false}
      />,
    );

    expect(screen.getByText("2 imagens encontradas")).toBeDefined();
    expect(screen.getByText("1 selecionadas")).toBeDefined();
    expect(screen.getByText("foto_perfil.jpg")).toBeDefined();
    expect(screen.getByText("diagrama.png")).toBeDefined();

    // Selecionar todas
    const selectAllBtn = screen.getByText("Selecionar todas");
    fireEvent.click(selectAllBtn);
    expect(onSelectedImageIdsChange).toHaveBeenCalledWith(["img-1", "img-2"]);

    // Desmarcar todas
    const deselectAllBtn = screen.getByText("Desmarcar todas");
    fireEvent.click(deselectAllBtn);
    expect(onSelectedImageIdsChange).toHaveBeenCalledWith([]);
  });

  it("permite alternar escopo de páginas e selecionar imagem individual", () => {
    const onSelectedImageIdsChange = vi.fn();

    render(
      <ExtractImagesPanel
        fileName="catalogo.pdf"
        fileSizeBytes={1024}
        totalPages={2}
        scope="all"
        onScopeChange={vi.fn()}
        selectedPagesText=""
        onSelectedPagesTextChange={vi.fn()}
        ignoreSmall={true}
        onIgnoreSmallChange={vi.fn()}
        extractedImages={sampleImages}
        selectedImageIds={[]}
        onSelectedImageIdsChange={onSelectedImageIdsChange}
        isExtracting={false}
      />,
    );

    const checkbox = screen.getByLabelText("Selecionar foto_perfil.jpg");
    fireEvent.click(checkbox);
    expect(onSelectedImageIdsChange).toHaveBeenCalledWith(["img-1"]);
  });
});
