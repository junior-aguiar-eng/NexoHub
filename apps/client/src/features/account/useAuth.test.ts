import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
    },
  },
}));

describe("Real Hybrid Authentication Hook (useAuth)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("inicia no modo convidado (Guest) quando não há usuário salvo", () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.isGuest).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("permite criar uma conta de usuário real com persistência", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    let success = false;
    await act(async () => {
      success = await result.current.signUpWithEmail(
        "Boni Silva",
        "boni@empresa.com",
        "senha123456",
      );
    });

    expect(success).toBe(true);
    expect(result.current.isGuest).toBe(false);
    expect(result.current.user?.name).toBe("Boni Silva");
    expect(result.current.user?.email).toBe("boni@empresa.com");
    expect(localStorage.getItem("nexohub:auth:v1")).toContain("Boni Silva");
  });

  it("permite fazer logout e retornar ao modo convidado", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.signUpWithEmail("Boni Silva", "boni@empresa.com", "senha123456");
    });
    expect(result.current.isGuest).toBe(false);

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.isGuest).toBe(true);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("nexohub:auth:v1")).toBeNull();
  });

  it("permite parear com código de 6 dígitos", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    let ok = false;
    await act(async () => {
      ok = await result.current.pairWithCode("123456");
    });

    expect(ok).toBe(true);
    expect(result.current.isGuest).toBe(false);
    expect(result.current.user?.name).toContain("Desktop Conectado");
  });

  it("permite atualizar o nome do perfil de usuário com persistência", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.signUpWithEmail("Boni Inicial", "boni@empresa.com", "senha123456");
    });
    expect(result.current.user?.name).toBe("Boni Inicial");

    let updated = false;
    await act(async () => {
      updated = await result.current.updateProfile("José Bonifácio");
    });

    expect(updated).toBe(true);
    expect(result.current.user?.name).toBe("José Bonifácio");
    expect(localStorage.getItem("nexohub:auth:v1")).toContain("José Bonifácio");
  });

  it("permite excluir conta preservando ou limpando histórico local", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    // Cria conta e simula histórico local
    await act(async () => {
      await result.current.signUpWithEmail("Boni Silva", "boni@empresa.com", "senha123456");
    });
    localStorage.setItem("nexohub:recent_operations:v1", JSON.stringify([{ id: "op-1" }]));

    // Exclusão mantendo arquivos locais
    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteAccount({ wipeLocalData: false });
    });

    expect(deleted).toBe(true);
    expect(result.current.isGuest).toBe(true);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("nexohub:auth:v1")).toBeNull();
    expect(localStorage.getItem("nexohub:recent_operations:v1")).not.toBeNull();

    // Recria e testa com wipeLocalData: true
    await act(async () => {
      await result.current.signUpWithEmail("Boni Silva", "boni@empresa.com", "senha123456");
    });
    await act(async () => {
      await result.current.deleteAccount({ wipeLocalData: true });
    });
    expect(localStorage.getItem("nexohub:recent_operations:v1")).toBeNull();
  });
});
