import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hero } from "./Hero";

describe("Hero", () => {
  it.each([
    ["pdf", "Seus PDFs, prontos para o próximo passo."],
    ["img", "Suas imagens, do jeito que você precisa."],
  ] as const)("apresenta %s sem duplicar a busca ou destacar selos", (currentZone, title) => {
    render(<Hero currentZone={currentZone} />);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(screen.queryByText(/Seus arquivos nunca saem/)).not.toBeInTheDocument();
  });
});
