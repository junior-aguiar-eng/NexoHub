import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CloudProcessingChoice } from "./CloudProcessingChoice";

describe("CloudProcessingChoice", () => {
  it("renderiza os modos local e nuvem e dispara callback ao alternar", () => {
    const onChangeMode = vi.fn();
    render(
      <CloudProcessingChoice
        toolId="pdf-ocr"
        mode="local"
        onChangeMode={onChangeMode}
        quotaRemaining={45}
        quotaUnitLabel="páginas"
        isAuthenticated={true}
      />,
    );

    const localRadio = screen.getByRole("radio", { name: /Navegador \(Local\)/i });
    const cloudRadio = screen.getByRole("radio", { name: /Nuvem \(Acelerado\)/i });

    expect(localRadio).toBeChecked();
    expect(cloudRadio).not.toBeChecked();

    fireEvent.click(cloudRadio);
    expect(onChangeMode).toHaveBeenCalledWith("cloud");
  });

  it("exibe badge de cota disponível e garantia de privacidade quando autenticado no modo nuvem", () => {
    render(
      <CloudProcessingChoice
        toolId="pdf-ocr"
        mode="cloud"
        onChangeMode={vi.fn()}
        quotaRemaining={30}
        quotaUnitLabel="páginas"
        isAuthenticated={true}
      />,
    );

    expect(screen.getByText(/30 páginas restantes este mês/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Garantia de Privacidade: O arquivo é processado em memória efêmera/i),
    ).toBeInTheDocument();
  });

  it("exibe aviso e link de login quando selecionado modo nuvem sem autenticação", () => {
    render(
      <CloudProcessingChoice
        toolId="pdf-ocr"
        mode="cloud"
        onChangeMode={vi.fn()}
        isAuthenticated={false}
      />,
    );

    expect(
      screen.getByText(/Acesse sua conta para utilizar sua cota gratuita mensal/i),
    ).toBeInTheDocument();
    const loginLink = screen.getByRole("link", { name: /Entrar na conta/i });
    expect(loginLink).toHaveAttribute("href", "/hub/cloud/login");
  });

  it("desabilita opções quando disabled for verdadeiro", () => {
    render(
      <CloudProcessingChoice
        toolId="text-translate"
        mode="local"
        onChangeMode={vi.fn()}
        isAuthenticated={true}
        disabled={true}
      />,
    );

    const localRadio = screen.getByRole("radio", { name: /Navegador \(Local\)/i });
    const cloudRadio = screen.getByRole("radio", { name: /Nuvem \(Acelerado\)/i });

    expect(localRadio).toBeDisabled();
    expect(cloudRadio).toBeDisabled();
  });
});
