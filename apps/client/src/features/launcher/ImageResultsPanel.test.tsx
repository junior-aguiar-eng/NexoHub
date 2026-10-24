import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ImageResultsPanel } from "./ImageResultsPanel";

afterEach(cleanup);
for (const [after, label] of [
  [999990, /Redução/],
  [1000010, /Aumento/],
] as const) {
  it(`informa a variação real de 1000000 para ${after}, mesmo arredondando para zero`, () => {
    render(
      <ImageResultsPanel
        items={[
          {
            sourceName: "foto.png",
            outputName: "foto.webp",
            before: { sizeBytes: 1000000, width: 100, height: 100, mimeType: "image/png" },
            after: { sizeBytes: after, width: 100, height: 100, mimeType: "image/webp" },
          },
        ]}
      />,
    );
    expect(screen.getByText(label)).toHaveTextContent("<0,1%");
    expect(screen.queryByText("Tamanho mantido")).not.toBeInTheDocument();
  });
}
