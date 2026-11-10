import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LazyPageThumbnail } from "./LazyPageThumbnail";

describe("LazyPageThumbnail", () => {
  it("renderiza o skeleton fluido enquanto a imagem da página está carregando via PDFium", () => {
    const onRequest = vi.fn();
    const { container } = render(<LazyPageThumbnail pageNumber={1} onRequest={onRequest} />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(container.querySelector(".page-thumbnail-skeleton")).toBeTruthy();
    expect(container.querySelector(".page-thumbnail-skeleton__shimmer")).toBeTruthy();
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-busy")).toBe("true");
  });

  it("não exibe o skeleton quando a miniatura já foi renderizada", () => {
    const { container } = render(
      <LazyPageThumbnail
        pageNumber={1}
        src="data:image/png;base64,synthetic"
        onRequest={vi.fn()}
      />,
    );

    expect(container.querySelector(".page-thumbnail-skeleton")).toBeNull();
    const img = screen.getByRole("img");
    expect(img.getAttribute("aria-busy")).toBe("false");
    expect(img.getAttribute("src")).toBe("data:image/png;base64,synthetic");
  });
});
