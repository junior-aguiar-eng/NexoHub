import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ImageCompressPanel } from "./ImageCompressPanel";

describe("ImageCompressPanel", () => {
  it("renderiza os detalhes do arquivo e a estimativa dinâmica de compressão", () => {
    const onLevelChange = vi.fn();
    render(
      <ImageCompressPanel
        fileName="foto.jpg"
        fileSizeBytes={1_000_000}
        level="recommended"
        onLevelChange={onLevelChange}
      />,
    );

    expect(screen.getByText("foto.jpg")).toBeTruthy();
    expect(screen.getByText(/Redução estimada:/)).toBeTruthy();
    expect(screen.getByText(/~45%/)).toBeTruthy();
  });

  it("permite alternar entre níveis de compressão disparando o callback", () => {
    const onLevelChange = vi.fn();
    render(
      <ImageCompressPanel
        fileName="foto.jpg"
        fileSizeBytes={1_000_000}
        level="recommended"
        onLevelChange={onLevelChange}
      />,
    );

    const extremeBtn = screen.getByRole("button", { name: /Extrema/i });
    fireEvent.click(extremeBtn);
    expect(onLevelChange).toHaveBeenCalledWith("extreme");
  });
});
