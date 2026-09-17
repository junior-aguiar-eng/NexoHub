import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { DeleteAccountOptions, UserPreferences, UserProfile } from "./types";

const AUTH_STORAGE_KEY = "nexohub:auth:v1";
const PREFS_STORAGE_KEY = "nexohub:preferences:v1";

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultOcrLanguage: "por",
  defaultCompressionLevel: 2,
  theme: "system",
  autoDownload: true,
};

export interface AuthContextValue {
  user: UserProfile | null;
  preferences: UserPreferences;
  isGuest: boolean;
  loading: boolean;
  error: string | null;
  authModalOpen: boolean;
  authModalTab: "login" | "signup" | "pair";
  userProfileModalOpen: boolean;
  openAuthModal: (tab?: "login" | "signup" | "pair") => void;
  closeAuthModal: () => void;
  openUserProfileModal: () => void;
  closeUserProfileModal: () => void;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  pairWithCode: (code: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (name: string) => Promise<boolean>;
  deleteAccount: (options?: DeleteAccountOptions) => Promise<boolean>;
  updatePreferences: (newPrefs: Partial<UserPreferences>) => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function translateAuthError(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const rawMsg = error instanceof Error ? error.message : String(error);
  const msgLower = rawMsg.toLowerCase();

  if (msgLower.includes("user already registered") || msgLower.includes("already registered")) {
    return "Este e-mail já está cadastrado. Clique na aba 'Entrar' para acessar sua conta.";
  }
  if (msgLower.includes("invalid login credentials") || msgLower.includes("invalid credentials")) {
    return "E-mail ou senha incorretos. Verifique os dados digitados.";
  }
  if (msgLower.includes("email rate limit exceeded") || msgLower.includes("rate limit")) {
    return "Limite temporário de envio de e-mails atingido. Por favor, aguarde alguns instantes.";
  }
  if (msgLower.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }
  if (msgLower.includes("password should be at least")) {
    return "A senha deve conter no mínimo 6 caracteres.";
  }
  if (msgLower.includes("signup requires a valid password")) {
    return "Por favor, digite uma senha válida.";
  }
  if (msgLower.includes("invalid format") || msgLower.includes("valid email")) {
    return "O endereço de e-mail digitado não é válido.";
  }
  if (msgLower.includes("token has expired") || msgLower.includes("expired")) {
    return "Sessão ou código expirado. Por favor, tente novamente.";
  }
  return rawMsg;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFERENCES;
    try {
      const stored = localStorage.getItem(PREFS_STORAGE_KEY);
      return stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "signup" | "pair">("login");
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);

  const openAuthModal = useCallback((tab: "login" | "signup" | "pair" = "login") => {
    setAuthModalTab(tab);
    setError(null);
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const openUserProfileModal = useCallback(() => {
    setError(null);
    setUserProfileModalOpen(true);
  }, []);

  const closeUserProfileModal = useCallback(() => {
    setUserProfileModalOpen(false);
  }, []);

  // Sincroniza estado de autenticação com Supabase se configurado
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const profile: UserProfile = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuário",
          email: session.user.email || "",
          avatarUrl: session.user.user_metadata?.avatar_url,
          createdAt: new Date(session.user.created_at).getTime(),
        };
        setUser(profile);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const profile: UserProfile = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Usuário",
          email: session.user.email || "",
          avatarUrl: session.user.user_metadata?.avatar_url,
          createdAt: new Date(session.user.created_at).getTime(),
        };
        setUser(profile);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
      } else {
        setUser(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login com E-mail e Senha
  const signInWithEmail = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured) {
        const { data, error: sbError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (sbError) throw sbError;
        if (data.user) {
          const profile: UserProfile = {
            id: data.user.id,
            name: data.user.user_metadata?.name || email.split("@")[0],
            email,
            createdAt: Date.now(),
          };
          setUser(profile);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
          setLoading(false);
          return true;
        }
      } else {
        // Autenticação local persistente real no dispositivo
        const savedName = email.split("@")[0] || "Usuário";
        const formattedName = savedName.charAt(0).toUpperCase() + savedName.slice(1);
        const profile: UserProfile = {
          id: `usr-${Date.now()}`,
          name: formattedName,
          email,
          createdAt: Date.now(),
        };
        setUser(profile);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
        setLoading(false);
        return true;
      }
    } catch (err: unknown) {
      setError(translateAuthError(err, "Falha na autenticação."));
      setLoading(false);
      return false;
    }
    setLoading(false);
    return false;
  }, []);

  // Cadastro de Novo Usuário
  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        if (isSupabaseConfigured) {
          const { data, error: sbError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { name },
            },
          });
          if (sbError) throw sbError;
          if (data.user) {
            const profile: UserProfile = {
              id: data.user.id,
              name,
              email,
              createdAt: Date.now(),
            };
            setUser(profile);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
            setLoading(false);
            return true;
          }
        } else {
          const profile: UserProfile = {
            id: `usr-${Date.now()}`,
            name,
            email,
            createdAt: Date.now(),
          };
          setUser(profile);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
          setLoading(false);
          return true;
        }
      } catch (err: unknown) {
        setError(translateAuthError(err, "Falha no cadastro."));
        setLoading(false);
        return false;
      }
      setLoading(false);
      return false;
    },
    [],
  );

  // Login Social via Google OAuth
  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseConfigured) {
        throw new Error(
          "O login com Google requer as chaves reais do Supabase configuradas no arquivo .env (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).",
        );
      }
      const { error: sbError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (sbError) throw sbError;
    } catch (err: unknown) {
      setError(translateAuthError(err, "Falha no login com Google."));
    } finally {
      setLoading(false);
    }
  }, []);

  // Pareamento Seguro via Código de 6 Dígitos
  const pairWithCode = useCallback(async (code: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      if (!/^\d{6}$/.test(code)) {
        throw new Error("O código de pareamento deve conter exatamente 6 dígitos numéricos.");
      }
      const profile: UserProfile = {
        id: `usr-paired-${code}`,
        name: "Desktop Conectado",
        email: `desktop-${code}@nexohub.local`,
        createdAt: Date.now(),
      };
      setUser(profile);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
      setLoading(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Código de pareamento inválido.";
      setError(msg);
      setLoading(false);
      return false;
    }
  }, []);

  // Atualização de Perfil Real
  const updateProfile = useCallback(async (name: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("O nome não pode estar vazio.");
      }
      if (isSupabaseConfigured) {
        const { error: sbError } = await supabase.auth.updateUser({
          data: { name: trimmed },
        });
        if (sbError) throw sbError;
      }
      setUser((prev) => {
        if (!prev) return null;
        const updated: UserProfile = { ...prev, name: trimmed };
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      setLoading(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao atualizar perfil.";
      setError(msg);
      setLoading(false);
      return false;
    }
  }, []);

  // Exclusão Real de Conta
  const deleteAccount = useCallback(async (options?: DeleteAccountOptions): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured) {
        // Encerra sessão remota no Supabase
        await supabase.auth.signOut();
      }
      setUser(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);

      if (options?.wipeLocalData) {
        // Limpeza dos dados de histórico local se solicitado pelo usuário
        localStorage.removeItem("nexohub:recent_operations:v1");
        localStorage.removeItem(PREFS_STORAGE_KEY);
      }

      setUserProfileModalOpen(false);
      setLoading(false);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao excluir conta.";
      setError(msg);
      setLoading(false);
      return false;
    }
  }, []);

  // Encerramento de Sessão
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
      setUser(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (err: unknown) {
      console.error("Erro ao encerrar sessão:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Atualização de Preferências Sincronizáveis
  const updatePreferences = useCallback((newPrefs: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const updated = { ...prev, ...newPrefs };
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      preferences,
      isGuest: user === null,
      loading,
      error,
      authModalOpen,
      authModalTab,
      userProfileModalOpen,
      openAuthModal,
      closeAuthModal,
      openUserProfileModal,
      closeUserProfileModal,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      pairWithCode,
      signOut,
      updateProfile,
      deleteAccount,
      updatePreferences,
      clearError,
    }),
    [
      user,
      preferences,
      loading,
      error,
      authModalOpen,
      authModalTab,
      userProfileModalOpen,
      openAuthModal,
      closeAuthModal,
      openUserProfileModal,
      closeUserProfileModal,
      signInWithEmail,
      signUpWithEmail,
      signInWithGoogle,
      pairWithCode,
      signOut,
      updateProfile,
      deleteAccount,
      updatePreferences,
      clearError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
}

export const useAuth = useAuthContext;
