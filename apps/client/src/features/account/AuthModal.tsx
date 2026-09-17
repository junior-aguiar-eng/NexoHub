import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LogIn,
  Monitor,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { isTauriEnvironment } from "@/platform/document-core";
import { useAuth } from "./useAuth";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialTab?: "login" | "signup" | "pair";
}

export function AuthModal({ open, onClose, initialTab = "login" }: AuthModalProps) {
  const [tab, setTab] = useState<"login" | "signup" | "pair">(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const {
    user,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    pairWithCode,
    loading,
    error,
    clearError,
  } = useAuth();
  const isDesktop = isTauriEnvironment();

  // Código de pareamento gerado na Web para o app Desktop
  const generatedWebCode = useMemo(() => {
    if (!open) return "849201";
    // Gera código estável baseado no usuário ou aleatório numérico
    if (user?.id) {
      let hash = 0;
      for (let i = 0; i < user.id.length; i++) {
        hash = (hash * 31 + user.id.charCodeAt(i)) % 900000;
      }
      return String(100000 + hash);
    }
    return String(Math.floor(100000 + Math.random() * 900000));
  }, [open, user?.id]);

  // Atualiza a aba inicial quando o modal abre
  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setFormValidationMsg(null);
      setLocalSuccess(null);
      clearError();
    }
  }, [open, initialTab, clearError]);

  // Fecha o modal ao pressionar ESC
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setFormValidationMsg(null);

    if (!email.trim() || !password.trim()) {
      setFormValidationMsg("Por favor, preencha o e-mail e a senha.");
      return;
    }

    const ok = await signInWithEmail(email.trim(), password);
    if (ok) {
      setLocalSuccess("Login efetuado com sucesso! Sincronização ativada.");
      setTimeout(() => {
        setLocalSuccess(null);
        onClose();
      }, 800);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setFormValidationMsg(null);

    if (!name.trim() || !email.trim() || !password.trim()) {
      setFormValidationMsg("Por favor, preencha todos os campos do cadastro.");
      return;
    }
    if (password.length < 6) {
      setFormValidationMsg("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    const ok = await signUpWithEmail(name.trim(), email.trim(), password);
    if (ok) {
      setLocalSuccess("Conta criada com sucesso! Sincronização ativada.");
      setTimeout(() => {
        setLocalSuccess(null);
        onClose();
      }, 800);
    }
  }

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    setFormValidationMsg(null);

    if (pairingCode?.length !== 6) {
      setFormValidationMsg("Insira o código de 6 dígitos numéricos.");
      return;
    }

    const ok = await pairWithCode(pairingCode);
    if (ok) {
      setLocalSuccess("Desktop vinculado com sucesso!");
      setTimeout(() => {
        setLocalSuccess(null);
        onClose();
      }, 800);
    }
  }

  const activeError = formValidationMsg || error;

  return (
    <div
      className="capabilities-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="capabilities-modal-container auth-modal-container">
        <header className="capabilities-modal-header auth-modal-header">
          <div className="capabilities-modal-header__title-group">
            <span className="auth-modal-logo" aria-hidden="true">
              N
            </span>
            <div>
              <h2 id="auth-modal-title" className="auth-modal-title">
                {tab === "login"
                  ? "Acessar sua Conta"
                  : tab === "signup"
                    ? "Criar Conta Gratuita"
                    : "Conectar ao Desktop"}
              </h2>
              <p className="capabilities-modal-subtitle">
                {tab === "pair"
                  ? "Vincule seu app desktop via código de 6 dígitos"
                  : "Sincronize histórico e preferências sem custo de processamento"}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="capabilities-modal-close"
            onClick={onClose}
            aria-label="Fechar janela de autenticação"
          >
            <X size={18} />
          </button>
        </header>

        {/* Abas */}
        <div className="auth-modal-tabs">
          <button
            type="button"
            className={`auth-modal-tab ${tab === "login" ? "auth-modal-tab--active" : ""}`}
            onClick={() => {
              setTab("login");
              setFormValidationMsg(null);
              clearError();
            }}
          >
            <LogIn size={15} />
            <span>Entrar</span>
          </button>
          <button
            type="button"
            className={`auth-modal-tab ${tab === "signup" ? "auth-modal-tab--active" : ""}`}
            onClick={() => {
              setTab("signup");
              setFormValidationMsg(null);
              clearError();
            }}
          >
            <UserPlus size={15} />
            <span>Cadastrar</span>
          </button>
          <button
            type="button"
            className={`auth-modal-tab ${tab === "pair" ? "auth-modal-tab--active" : ""}`}
            onClick={() => {
              setTab("pair");
              setFormValidationMsg(null);
              clearError();
            }}
          >
            <Monitor size={15} />
            <span>{isDesktop ? "Conectar com a Web" : "Parear com Desktop"}</span>
          </button>
        </div>

        {/* Mensagens de Feedback */}
        {activeError && (
          <div className="auth-modal-alert auth-modal-alert--error" role="alert">
            <AlertCircle size={16} />
            <span>{activeError}</span>
          </div>
        )}

        {localSuccess && (
          <div className="auth-modal-alert auth-modal-alert--success" role="status">
            <CheckCircle2 size={16} />
            <span>{localSuccess}</span>
          </div>
        )}

        <div className="auth-modal-body">
          {/* Formulário de Login */}
          {tab === "login" && (
            <form className="auth-modal-form" onSubmit={handleLogin}>
              <div className="auth-form-group">
                <label htmlFor="login-email">E-mail</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="auth-form-group">
                <label htmlFor="login-password">Senha</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Entrando...</span>
                  </>
                ) : (
                  <>
                    <LogIn size={16} />
                    <span>Entrar</span>
                  </>
                )}
              </Button>

              <div className="auth-divider">
                <span>ou</span>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="auth-social-btn"
                onClick={signInWithGoogle}
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continuar com Google</span>
              </Button>
            </form>
          )}

          {/* Formulário de Cadastro */}
          {tab === "signup" && (
            <form className="auth-modal-form" onSubmit={handleSignUp}>
              <div className="auth-form-group">
                <label htmlFor="signup-name">Nome Completo</label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  placeholder="Ex: Boni Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="auth-form-group">
                <label htmlFor="signup-email">E-mail</label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  placeholder="seu.email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="auth-form-group">
                <label htmlFor="signup-password">Senha</label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  placeholder="Mínimo de 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                className="auth-submit-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Criando conta...</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Cadastrar Gratuitamente</span>
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Pareamento com Desktop / Web */}
          {tab === "pair" && (
            <div className="auth-modal-form">
              {!isDesktop ? (
                /* Versão WEB: Gera código para conectar o app Desktop */
                <div className="auth-web-pairing-box">
                  <div className="auth-pairing-intro">
                    <KeyRound size={28} className="auth-pairing-icon" />
                    <p>
                      Use este <strong>código de 6 dígitos</strong> no seu aplicativo{" "}
                      <strong>NexoHub Desktop</strong> para conectar instantaneamente e sincronizar
                      suas preferências:
                    </p>
                  </div>

                  <div className="auth-generated-code-card">
                    <span className="auth-generated-code-value">{generatedWebCode}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      className="auth-copy-code-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedWebCode);
                        setCopiedCode(true);
                        setTimeout(() => setCopiedCode(false), 3000);
                      }}
                    >
                      {copiedCode ? (
                        <>
                          <Check size={16} />
                          <span>Código Copiado!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={16} />
                          <span>Copiar Código</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="auth-pairing-hint-step">
                    <small>
                      1. Abra o NexoHub Desktop no computador
                      <br />
                      2. Clique em <strong>Conectar com a Web</strong> no menu do usuário
                      <br />
                      3. Digite o código acima para vincular
                    </small>
                  </div>
                </div>
              ) : (
                /* Versão DESKTOP: Entrada de código gerado na Web */
                <form onSubmit={handlePair}>
                  <div className="auth-pairing-intro">
                    <KeyRound size={28} className="auth-pairing-icon" />
                    <p>
                      Insira o <strong>código de 6 dígitos</strong> gerado na versão Web do NexoHub
                      para vincular este aplicativo à sua conta.
                    </p>
                  </div>

                  <div className="auth-form-group">
                    <label htmlFor="pair-code">Código de Pareamento da Web</label>
                    <input
                      id="pair-code"
                      type="text"
                      required
                      maxLength={6}
                      placeholder="Ex: 849201"
                      value={pairingCode}
                      onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, ""))}
                      style={{ textAlign: "center", fontSize: "1.25rem", letterSpacing: "0.25em" }}
                      disabled={loading}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    className="auth-submit-btn"
                    disabled={loading || pairingCode.length !== 6}
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Vinculando...</span>
                      </>
                    ) : (
                      <>
                        <Monitor size={16} />
                        <span>Vincular Aplicativo</span>
                      </>
                    )}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
