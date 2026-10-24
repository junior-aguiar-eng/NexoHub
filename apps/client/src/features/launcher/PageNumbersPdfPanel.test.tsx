import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PageNumbersPdfPanel } from "./PageNumbersPdfPanel";

it("pular capa mostra a página realmente numerada em vez da capa", () => {
  const requestPage = vi.fn();
  render(
    <PageNumbersPdfPanel
      fileName="exemplo.pdf"
      fileSizeBytes={100}
      totalPages={3}
      thumbnailUrl="capa.png"
      pageThumbnails={["capa.png", "corpo.png"]}
      onPreviewPageChange={requestPage}
      position="bottom-center"
      format="pageXofY"
      startPage={2}
      onPositionChange={vi.fn()}
      onFormatChange={vi.fn()}
      onStartPageChange={vi.fn()}
    />,
  );
  expect(screen.getByRole("img")).toHaveAttribute("src", "corpo.png");
  expect(requestPage).toHaveBeenCalledWith(2);
  expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
});
