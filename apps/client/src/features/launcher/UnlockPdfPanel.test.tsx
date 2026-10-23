import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UnlockPdfPanel } from "./UnlockPdfPanel";

describe("UnlockPdfPanel", () => {
  it("renderiza o estado de documento já desbloqueado e aciona navegação", () => {
    const onGoToCompress = vi.fn();
    const onGoToOrganize = vi.fn();

    render(
      <UnlockPdfPanel
        fileName="livre.pdf"
        fileSizeBytes={1024 * 80}
        totalPages={1}
        protectionStatus={{
          isProtected: false,
          needsPassword: false,
          hasPermissionsRestriction: false,
        }}
        passwordValue=""
        onPasswordChange={vi.fn()}
        onGoToCompress={onGoToCompress}
        onGoToOrganize={onGoToOrganize}
      />,
    );

    expect(screen.getByText("livre.pdf")).toBeDefined();
    expect(screen.getByText("Desbloqueado")).toBeDefined();
    expect(
      screen.getByText(/Este documento não possui senhas nem restrições ativas/i),
    ).toBeDefined();

    const compressBtn = screen.getByText("Ir para Comprimir PDF");
    fireEvent.click(compressBtn);
    expect(onGoToCompress).toHaveBeenCalledOnce();

    const organizeBtn = screen.getByText("Ir para Organizar PDF");
    fireEvent.click(organizeBtn);
    expect(onGoToOrganize).toHaveBeenCalledOnce();
  });

  it("renderiza o formulário de senha para documento protegido e dispara alterações", () => {
    const onPasswordChange = vi.fn();

    render(
      <UnlockPdfPanel
        fileName="confidencial.pdf"
        fileSizeBytes={1024 * 250}
        totalPages={3}
        protectionStatus={{
          isProtected: true,
          needsPassword: true,
          hasPermissionsRestriction: true,
        }}
        passwordValue="minhasenha123"
        onPasswordChange={onPasswordChange}
        errorMessage="Senha incorreta. Verifique e tente novamente."
      />,
    );

    expect(screen.getByText("confidencial.pdf")).toBeDefined();
    expect(screen.getByText("Protegido com Senha")).toBeDefined();
    expect(screen.getByText("Senha incorreta. Verifique e tente novamente.")).toBeDefined();

    // Input de senha
    const input = screen.getByPlaceholderText("Digite a senha do PDF...");
    expect(input).toBeDefined();
    expect(input.getAttribute("type")).toBe("password");

    // Digitação
    fireEvent.change(input, { target: { value: "novasenha456" } });
    expect(onPasswordChange).toHaveBeenCalledWith("novasenha456");

    // Toggle de visualização de senha
    const toggleBtn = screen.getByLabelText("Ver senha");
    fireEvent.click(toggleBtn);
    expect(input.getAttribute("type")).toBe("text");
  });
});
