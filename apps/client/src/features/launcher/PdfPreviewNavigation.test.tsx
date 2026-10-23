import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CropPdfPanel } from "./CropPdfPanel";
import { FormFillPdfPanel } from "./FormFillPdfPanel";
import { SignPdfPanel } from "./SignPdfPanel";

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

interface PreviewProps {
  readonly onPreviewPageChange?: (page: number) => void;
  readonly pageThumbnails?: readonly string[];
}
const common = {
  fileName: "paginas.pdf",
  fileSizeBytes: 100,
  totalPages: 3,
  thumbnailUrl: "/first.png",
};
const cases = [
  {
    name: "Recortar",
    panel: (props: PreviewProps) => (
      <CropPdfPanel
        {...common}
        {...props}
        margins={{ top: 0, bottom: 0, left: 0, right: 0 }}
        onMarginsChange={vi.fn()}
        scope="all"
        onScopeChange={vi.fn()}
        selectedPagesText=""
        onSelectedPagesTextChange={vi.fn()}
      />
    ),
  },
  {
    name: "Assinar",
    panel: (props: PreviewProps) => (
      <SignPdfPanel
        {...common}
        {...props}
        placement={{
          page: "first",
          xPercent: 10,
          yPercent: 10,
          widthPercent: 20,
          heightPercent: 10,
        }}
        onPlacementChange={vi.fn()}
        onSignatureImageChange={vi.fn()}
        signerName=""
        onSignerNameChange={vi.fn()}
        includeDate={false}
        onIncludeDateChange={vi.fn()}
      />
    ),
  },
  {
    name: "Preencher",
    panel: (props: PreviewProps) => (
      <FormFillPdfPanel
        {...common}
        {...props}
        fields={[]}
        values={{}}
        onValuesChange={vi.fn()}
        flatten={false}
        onFlattenChange={vi.fn()}
      />
    ),
  },
];

describe.each(cases)("prévia paginada: $name", ({ panel }) => {
  it("solicita a página exibida e mostra a miniatura correta após carregamento", () => {
    const onPreviewPageChange = vi.fn();
    const { container, rerender } = render(panel({ onPreviewPageChange }));
    expect(onPreviewPageChange).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByLabelText("Próxima página"));
    expect(onPreviewPageChange).toHaveBeenLastCalledWith(2);
    expect(container.querySelector('img[src="/first.png"]')).toBeNull();
    rerender(panel({ onPreviewPageChange, pageThumbnails: ["/first.png", "/second.png"] }));
    expect(container.querySelector('img[src="/second.png"]')).not.toBeNull();
    expect(container.querySelector('img[src="/first.png"]')).toBeNull();
  });
  it("sem callback não substitui página intermediária pela primeira", () => {
    const { container } = render(panel({}));
    expect(container.querySelector('img[src="/first.png"]')).not.toBeNull();
    fireEvent.click(screen.getByLabelText("Próxima página"));
    expect(container.querySelector('img[src="/first.png"]')).toBeNull();
  });
});
