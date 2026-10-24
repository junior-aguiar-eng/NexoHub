import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ImageResizePanel } from "./ImageResizePanel";

it("prevê o resultado do retrato dentro da caixa compartilhada do lote", () => {
  render(
    <ImageResizePanel
      fileName="retrato.png"
      fileSizeBytes={100}
      originalDimensions={{ width: 640, height: 960 }}
      mode="pixels"
      percentage={50}
      width={1200}
      height={800}
      maintainAspectRatio
      doNotEnlarge={false}
      onModeChange={vi.fn()}
      onPercentageChange={vi.fn()}
      onWidthChange={vi.fn()}
      onHeightChange={vi.fn()}
      onMaintainAspectRatioChange={vi.fn()}
      onDoNotEnlargeChange={vi.fn()}
    />,
  );
  expect(screen.getByText("Novo: 533 × 800 px")).toBeInTheDocument();
});

it("prevê a dimensão original quando não ampliar limita a saída", () => {
  render(
    <ImageResizePanel
      fileName="retrato.png"
      fileSizeBytes={100}
      originalDimensions={{ width: 640, height: 960 }}
      mode="percentage"
      percentage={200}
      width={1200}
      height={1800}
      maintainAspectRatio
      doNotEnlarge
      onModeChange={vi.fn()}
      onPercentageChange={vi.fn()}
      onWidthChange={vi.fn()}
      onHeightChange={vi.fn()}
      onMaintainAspectRatioChange={vi.fn()}
      onDoNotEnlargeChange={vi.fn()}
    />,
  );
  expect(screen.getByText("Novo: 640 × 960 px")).toBeInTheDocument();
});
