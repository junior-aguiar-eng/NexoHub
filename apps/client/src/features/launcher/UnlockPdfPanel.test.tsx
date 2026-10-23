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
  it("reinicia página e oculta senha ao trocar de documento", () => {
    const props = {
      fileName: "primeiro.pdf",
      fileSizeBytes: 2048,
      totalPages: 3,
      protectionStatus: { isProtected: true, needsPassword: true, hasPermissionsRestriction: true },
      passwordValue: "senha",
      onPasswordChange: vi.fn(),
      pageThumbnails: ["pagina-1.png", "pagina-2.png", "pagina-3.png"],
    };
    const { rerender } = render(<UnlockPdfPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(screen.getByRole("img").getAttribute("src")).toBe("pagina-2.png");
    fireEvent.click(screen.getByLabelText("Ver senha"));
    expect(screen.getByLabelText("Senha do Documento").getAttribute("type")).toBe("text");
    rerender(
      <UnlockPdfPanel
        {...props}
        fileName="segundo.pdf"
        totalPages={1}
        pageThumbnails={["nova-pagina.png"]}
      />,
    );
    expect(screen.getByRole("img").getAttribute("alt")).toBe("Pré-visualização da página 1");
    expect(screen.getByLabelText("Senha do Documento").getAttribute("type")).toBe("password");
  });

  it("não apresenta criptografia sem restrições como documento desbloqueado", () => {
    render(
      <UnlockPdfPanel
        fileName="cifrado.pdf"
        fileSizeBytes={2048}
        totalPages={1}
        protectionStatus={{
          isProtected: true,
          needsPassword: false,
          hasPermissionsRestriction: false,
        }}
        passwordValue=""
        onPasswordChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Criptografia ativa")).toBeDefined();
    expect(screen.queryByText("Desbloqueado")).toBeNull();
  });

  it("desativa a entrada enquanto verifica proteções", () => {
    render(
      <UnlockPdfPanel
        fileName="cifrado.pdf"
        fileSizeBytes={2048}
        totalPages={1}
        protectionStatus={{
          isProtected: true,
          needsPassword: true,
          hasPermissionsRestriction: true,
        }}
        isCheckingStatus
        passwordValue=""
        onPasswordChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Senha do Documento")).toBeDisabled();
    expect(screen.getByText("Analisando proteções do documento...")).toBeDefined();
  });
  it("solicita a página atual e não reutiliza miniatura da primeira nas demais", () => {
    const onPreviewPageChange = vi.fn();
    render(
      <UnlockPdfPanel
        fileName="previews.pdf"
        fileSizeBytes={2048}
        totalPages={3}
        protectionStatus={{
          isProtected: true,
          needsPassword: false,
          hasPermissionsRestriction: true,
        }}
        thumbnailUrl="primeira.png"
        pageThumbnails={["primeira.png"]}
        onPreviewPageChange={onPreviewPageChange}
        passwordValue=""
        onPasswordChange={vi.fn()}
      />,
    );
    expect(onPreviewPageChange).toHaveBeenLastCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "Próxima página" }));
    expect(onPreviewPageChange).toHaveBeenLastCalledWith(2);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Página 2")).toBeDefined();
  });
});
