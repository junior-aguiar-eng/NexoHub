import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserProfileModal } from "./UserProfileModal";
import { AuthProvider, useAuth } from "./useAuth";

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: false,
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

function TestWrapper({ children }: { children: React.ReactNode }) {
  const { signUpWithEmail } = useAuth();
  useEffect(() => {
    signUpWithEmail("José Bonifácio", "boni@empresa.com", "senha123456");
  }, [signUpWithEmail]);

  return <>{children}</>;
}

describe("UserProfileModal Component", () => {
  beforeEach(() => {
    localStorage.clear();
    // Injeta algumas operações reais para teste de métricas
    localStorage.setItem(
      "nexohub:recent-operations:v2",
      JSON.stringify([
        {
          id: "op-1",
          documentName: "arquivo_cliente.pdf",
          toolId: "pdf-compress",
          toolName: "Comprimir PDF",
          timestamp: Date.now(),
          originalSize: 10 * 1024 * 1024, // 10MB
          resultSize: 4 * 1024 * 1024, // 4MB (6MB poupados)
          categoryKey: "recent.type.pdf",
        },
        {
          id: "op-2",
          documentName: "documento.pdf",
          toolId: "ocr-image",
          toolName: "Reconhecimento OCR",
          timestamp: Date.now(),
          categoryKey: "recent.type.document",
        },
      ]),
    );
  });

  it("renderiza as métricas reais de produtividade e espaço economizado", async () => {
    const handleClose = vi.fn();

    render(
      <AuthProvider>
        <TestWrapper>
          <UserProfileModal open={true} onClose={handleClose} />
        </TestWrapper>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Minha Produtividade")).toBeDefined();
    });

    // Deve exibir as métricas calculadas
    expect(screen.getByText("Espaço Economizado")).toBeDefined();
    expect(screen.getByText("6.0 MB")).toBeDefined();
    expect(screen.getByText("Tarefas Concluídas")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined();
    expect(screen.getByText("Comprimir PDF")).toBeDefined();
  });

  it("permite navegar para a aba de dados pessoais e atualizar o nome", async () => {
    const handleClose = vi.fn();

    render(
      <AuthProvider>
        <TestWrapper>
          <UserProfileModal open={true} onClose={handleClose} />
        </TestWrapper>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Dados Pessoais & Preferências")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Dados Pessoais & Preferências"));

    const nameInput = screen.getByLabelText("Nome Completo") as HTMLInputElement;
    expect(nameInput.value).toBe("José Bonifácio");

    fireEvent.change(nameInput, { target: { value: "Boni Engenheiro" } });
    fireEvent.click(screen.getByText("Salvar Alterações"));

    await waitFor(() => {
      expect(screen.getByText("Perfil atualizado com sucesso!")).toBeDefined();
    });
  });

  it("exige a palavra EXCLUIR para destravar o botão na aba de exclusão de conta", async () => {
    const handleClose = vi.fn();

    render(
      <AuthProvider>
        <TestWrapper>
          <UserProfileModal open={true} onClose={handleClose} />
        </TestWrapper>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Excluir Conta")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Excluir Conta"));

    const deleteBtn = screen.getByRole("button", { name: /Excluir Minha Conta/i });
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true);

    const confirmInput = screen.getByPlaceholderText("EXCLUIR");
    fireEvent.change(confirmInput, { target: { value: "EXCLUIR" } });

    expect((deleteBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
