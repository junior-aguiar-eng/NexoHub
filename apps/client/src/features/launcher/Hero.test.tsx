import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "./Hero";

describe("Hero", () => {
  it("renderiza o Hero no Modo PDF com títulos e placeholder específicos", () => {
    const onSearchChange = vi.fn();
    const onOpenCommandPalette = vi.fn();

    render(
      <Hero
        searchQuery=""
        onSearchChange={onSearchChange}
        onOpenCommandPalette={onOpenCommandPalette}
        currentZone="pdf"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Olá, o que faremos hoje no seu PDF?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Todas as ferramentas para simplificar seus documentos PDF, em um só lugar.",
      ),
    ).toBeInTheDocument();

    const searchInput = screen.getByRole("searchbox", { name: /buscar ferramentas/i });
    expect(searchInput).toHaveAttribute(
      "placeholder",
      "Buscar ferramenta (ex: juntar, assinar, ocr)...",
    );
  });

  it("renderiza o Hero no Modo Imagem com títulos e placeholder específicos", () => {
    const onSearchChange = vi.fn();
    const onOpenCommandPalette = vi.fn();

    render(
      <Hero
        searchQuery=""
        onSearchChange={onSearchChange}
        onOpenCommandPalette={onOpenCommandPalette}
        currentZone="img"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Todas as ferramentas necessárias para editar imagens" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manipulação e edição visual de imagens sem enviar dados para a nuvem."),
    ).toBeInTheDocument();

    const searchInput = screen.getByRole("searchbox", { name: /buscar ferramentas/i });
    expect(searchInput).toHaveAttribute(
      "placeholder",
      "Buscar ferramenta de imagem (ex: redimensionar, remover fundo)...",
    );
  });

  it("dispara callback ao digitar na busca do Hero", () => {
    const onSearchChange = vi.fn();
    render(
      <Hero
        searchQuery=""
        onSearchChange={onSearchChange}
        onOpenCommandPalette={vi.fn()}
        currentZone="pdf"
      />,
    );

    const searchInput = screen.getByRole("searchbox", { name: /buscar ferramentas/i });
    fireEvent.change(searchInput, { target: { value: "ocr" } });

    expect(onSearchChange).toHaveBeenCalledWith("ocr");
  });
});
