import type { CloudParticipant, CloudUsage } from "@nexohub/contracts";
import { UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { translate as t } from "@/i18n";
import type { CloudAccountPort } from "@/platform/cloud-account";
import { useCloudAccount } from "./CloudAccountContext";
export function CloudAccountControl({ account: provided }: { account?: CloudAccountPort }) {
  const runtime = useCloudAccount();
  const account = provided ?? runtime;
  const [open, setOpen] = useState(false),
    [available, setAvailable] = useState(false),
    [checking, setChecking] = useState(true),
    [processingEnabled, setProcessingEnabled] = useState(false),
    [participant, setParticipant] = useState<CloudParticipant | null>(null),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(""),
    [notice, setNotice] = useState(""),
    [usage, setUsage] = useState<CloudUsage | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        event.target instanceof Node &&
        container.current?.contains(event.target)
      ) {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setChecking(true);
    void account
      .status()
      .then(async (s) => {
        if (alive) setAvailable(s.identityAvailable);
        if (alive) setProcessingEnabled(s.enabled);
        if (!s.identityAvailable) return;
        try {
          const member = await account.me();
          if (alive) setParticipant(member);
          if (s.enabled) {
            const value = await account.usage();
            if (alive) setUsage(value);
          }
        } catch {
          // Uma sessão ausente mantém o formulário de entrada disponível.
        }
      })
      .catch(() => {
        if (alive) setAvailable(false);
      })
      .finally(() => {
        if (alive) setChecking(false);
      });
    return () => {
      alive = false;
    };
  }, [account, open]);
  const login = async (method: "google" | "emailLink") => {
    setBusy(true);
    setNotice("");
    try {
      await account.signIn(method, email);
      if (method === "emailLink" && !account.emailLinkCompletesSession) {
        setNotice(t("account.emailSent"));
        return;
      }
      setParticipant(await account.me());
      if (processingEnabled) setUsage(await account.usage());
      setNotice("");
    } catch {
      setNotice(t("account.failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cloud-account" ref={container}>
      <button
        ref={trigger}
        type="button"
        className="cloud-account-trigger"
        aria-label={t(participant ? "account.mine" : "account.title")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <UserRound size={18} aria-hidden="true" />
        <span className="cloud-account-label">
          {t(participant ? "account.mine" : "account.title")}
        </span>
      </button>
      {open && (
        <section aria-label={t("account.title")} className="cloud-account-panel">
          <h2>{t(participant ? "account.mine" : "account.signIn")}</h2>
          {checking && <p role="status">{t("account.loading")}</p>}
          {!checking && !available && <p role="status">{t("account.unavailable")}</p>}
          {participant ? (
            <>
              {participant.email && <p className="account-email">{participant.email}</p>}
              {processingEnabled && usage && (
                <>
                  <h3>{t("cloud.balance")}</h3>
                  <p>
                    {t("cloud.ocrAvailable").replace("{pages}", String(usage.ocrPages.remaining))}
                  </p>
                  <p>
                    {t("cloud.charactersAvailable").replace(
                      "{characters}",
                      String(usage.translationCharacters.remaining),
                    )}
                  </p>
                  <p>
                    {t("cloud.filesAvailable").replace(
                      "{files}",
                      String(usage.officeFiles.remaining),
                    )}
                  </p>
                  <p>
                    {t("cloud.financialBalance")
                      .replace(
                        "{remaining}",
                        (usage.budgetUsdMicros.remaining / 1_000_000).toFixed(3),
                      )
                      .replace(
                        "{reserved}",
                        (usage.budgetUsdMicros.reserved / 1_000_000).toFixed(3),
                      )}
                  </p>
                  <p>
                    {t("cloud.resetAt").replace(
                      "{date}",
                      new Date(usage.resetAt).toLocaleString("pt-BR"),
                    )}
                  </p>
                </>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await account.signOut();
                    setParticipant(null);
                    setUsage(null);
                    setNotice("");
                  } catch {
                    setNotice(t("account.failed"));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("account.signOut")}
              </button>
            </>
          ) : (
            <>
              <p>{t("account.welcome")}</p>
              <button
                type="button"
                disabled={checking || !available || busy}
                onClick={() => void login("google")}
              >
                {t("account.google")}
              </button>
              <p className="account-divider">{t("account.or")}</p>
              {!account.emailLinkCompletesSession && (
                <label>
                  {t("account.email")}
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    disabled={checking || !available || busy}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              )}
              <button
                type="button"
                disabled={
                  checking ||
                  !available ||
                  busy ||
                  (!account.emailLinkCompletesSession && !email.trim())
                }
                onClick={() => void login("emailLink")}
              >
                {t("account.emailLink")}
              </button>
            </>
          )}
          {notice && <p role="status">{notice}</p>}
        </section>
      )}
    </div>
  );
}
