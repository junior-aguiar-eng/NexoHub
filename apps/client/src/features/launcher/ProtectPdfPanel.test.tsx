import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProtectPdfPanel } from "./ProtectPdfPanel";

describe("ProtectPdfPanel", () => {
  it("renderiza os campos de senha, opções de algoritmo e permissões", () => {
    const onPasswordChange = vi.fn();
    const onConfirmPasswordChange = vi.fn();
    const onAlgorithmChange = vi.fn();

    render(
      <ProtectPdfPanel
        fileName="contrato.pdf"
        fileSizeBytes={1024 * 120}
        totalPages={2}
        protectionStatus={{
          isProtected: false,
          needsPassword: false,
          hasPermissionsRestriction: false,
        }}
        passwordValue=""
        onPasswordChange={onPasswordChange}
        confirmPasswordValue=""
        onConfirmPasswordChange={onConfirmPasswordChange}
        algorithm="AES-256"
        onAlgorithmChange={onAlgorithmChange}
        allowPrinting={true}
        onAllowPrintingChange={vi.fn()}
        allowCopying={false}
        onAllowCopyingChange={vi.fn()}
        allowModifying={false}
        onAllowModifyingChange={vi.fn()}
        allowAnnotating={false}
        onAllowAnnotatingChange={vi.fn()}
        allowFillingForms={true}
        onAllowFillingFormsChange={vi.fn()}
      />,
    );

    expect(screen.getByText("contrato.pdf")).toBeDefined();
    expect(screen.getByLabelText("Senha de abertura do documento")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByText("Padrão de Criptografia")).toBeDefined();
    expect(screen.getByText("Permissões de Uso do Documento")).toBeDefined();
    expect(screen.getByText("Permitir impressão do documento")).toBeDefined();
    expect(screen.getByText("Permitir cópia e extração de texto")).toBeDefined();
  });

  it("renderiza aviso se o documento já possui proteção e aciona navegação", () => {
    const onGoToUnlock = vi.fn();

    render(
      <ProtectPdfPanel
        fileName="protegido.pdf"
        fileSizeBytes={1024 * 80}
        totalPages={1}
        protectionStatus={{
          isProtected: true,
          needsPassword: true,
          hasPermissionsRestriction: true,
        }}
        passwordValue=""
        onPasswordChange={vi.fn()}
        confirmPasswordValue=""
        onConfirmPasswordChange={vi.fn()}
        algorithm="AES-256"
        onAlgorithmChange={vi.fn()}
        allowPrinting={true}
        onAllowPrintingChange={vi.fn()}
        allowCopying={false}
        onAllowCopyingChange={vi.fn()}
        allowModifying={false}
        onAllowModifyingChange={vi.fn()}
        allowAnnotating={false}
        onAllowAnnotatingChange={vi.fn()}
        allowFillingForms={true}
        onAllowFillingFormsChange={vi.fn()}
        onGoToUnlock={onGoToUnlock}
      />,
    );

    expect(screen.getByText("Documento já protegido")).toBeDefined();
    const unlockBtn = screen.getByText("Ir para Desbloquear PDF");
    fireEvent.click(unlockBtn);
    expect(onGoToUnlock).toHaveBeenCalledOnce();
  });

  it("exibe aviso de divergência quando as senhas não coincidem", () => {
    render(
      <ProtectPdfPanel
        fileName="documento.pdf"
        fileSizeBytes={1024 * 50}
        totalPages={1}
        protectionStatus={{
          isProtected: false,
          needsPassword: false,
          hasPermissionsRestriction: false,
        }}
        passwordValue="Senha1"
        onPasswordChange={vi.fn()}
        confirmPasswordValue="Senha2"
        onConfirmPasswordChange={vi.fn()}
        algorithm="AES-256"
        onAlgorithmChange={vi.fn()}
        allowPrinting={true}
        onAllowPrintingChange={vi.fn()}
        allowCopying={false}
        onAllowCopyingChange={vi.fn()}
        allowModifying={false}
        onAllowModifyingChange={vi.fn()}
        allowAnnotating={false}
        onAllowAnnotatingChange={vi.fn()}
        allowFillingForms={true}
        onAllowFillingFormsChange={vi.fn()}
      />,
    );

    expect(screen.getByText("As senhas digitadas não coincidem.")).toBeDefined();
  });
});
