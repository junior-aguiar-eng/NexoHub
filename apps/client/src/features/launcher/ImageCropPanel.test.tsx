import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
import { type CropRatioPreset, ImageCropPanel } from "./ImageCropPanel";

function Harness() {
  const [ratio, setRatio] = useState<CropRatioPreset>("free");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(800);
  return (
    <ImageCropPanel
      fileName="imagem.png"
      fileSizeBytes={100}
      originalDimensions={{ width: 1200, height: 800 }}
      ratio={ratio}
      onRatioChange={setRatio}
      cropX={x}
      onCropXChange={setX}
      cropY={y}
      onCropYChange={setY}
      cropWidth={width}
      onCropWidthChange={setWidth}
      cropHeight={height}
      onCropHeightChange={setHeight}
    />
  );
}

it("mantém o recorte quadrado dentro da imagem ao mover X e redimensionar", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: /1:1/ }));
  fireEvent.change(screen.getByLabelText("Posição X"), { target: { value: "700" } });
  expect(screen.getByLabelText("Posição X")).toHaveValue(400);
  expect(screen.getByLabelText("Largura")).toHaveValue(800);
  expect(screen.getByLabelText("Altura")).toHaveValue(800);
  fireEvent.change(screen.getByLabelText("Largura"), { target: { value: "1000" } });
  expect(screen.getByLabelText("Largura")).toHaveValue(800);
  expect(screen.getByLabelText("Altura")).toHaveValue(800);
});

it("preserva a proporção ao reduzir largura e limita Y pela altura do recorte", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: /1:1/ }));
  fireEvent.change(screen.getByLabelText("Largura"), { target: { value: "300" } });
  expect(screen.getByLabelText("Altura")).toHaveValue(300);
  fireEvent.change(screen.getByLabelText("Posição Y"), { target: { value: "750" } });
  expect(screen.getByLabelText("Posição Y")).toHaveValue(500);
});
