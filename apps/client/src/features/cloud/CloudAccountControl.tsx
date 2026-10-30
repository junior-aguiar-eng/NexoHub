import type { CloudUsage } from "@nexohub/contracts";
import { Cloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { translate as t } from "@/i18n";
import type { CloudAccountPort } from "@/platform/cloud-account";
import { useCloudAccount } from "./CloudAccountContext";
export function CloudAccountControl({ account: provided }: { account?: CloudAccountPort }) {
  const runtime = useCloudAccount();
  const account = provided ?? runtime;
  const [open, setOpen] = useState(false),
    [available, setAvailable] = useState(false),
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
    void account
      .status()
      .then((s) => {
        if (alive) setAvailable(s.identityAvailable);
      })
      .catch(() => {
        if (alive) setAvailable(false);
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
      if (method === "emailLink") {
        setNotice(t("cloud.emailSent"));
        return;
      }
      await account.me();
      setUsage(await account.usage());
    } catch {
      setNotice(t("cloud.failed"));
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
        aria-label={t("cloud.optional")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Cloud size={18} aria-hidden="true" />
        <span className="cloud-account-label">{t("cloud.optional")}</span>
      </button>
      {open && (
        <section aria-label={t("cloud.optional")} className="cloud-account-panel">
          <p>{t("cloud.localFree")}</p>
          <p>{t("cloud.disabled")}</p>
          {usage ? (
            <>
              <h3>{t("cloud.balance")}</h3>
              <p>{t("cloud.ocrAvailable").replace("{pages}", String(usage.ocrPages.remaining))}</p>
              <p>
                {t("cloud.charactersAvailable").replace(
                  "{characters}",
                  String(usage.translationCharacters.remaining),
                )}
              </p>
              <p>
                {t("cloud.filesAvailable").replace("{files}", String(usage.officeFiles.remaining))}
              </p>
              <p>
                {t("cloud.financialBalance")
                  .replace("{remaining}", (usage.budgetUsdMicros.remaining / 1_000_000).toFixed(3))
                  .replace("{reserved}", (usage.budgetUsdMicros.reserved / 1_000_000).toFixed(3))}
              </p>
              <p>
                {t("cloud.resetAt").replace(
                  "{date}",
                  new Date(usage.resetAt).toLocaleString("pt-BR"),
                )}
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await account.signOut();
                    setUsage(null);
                  } catch {
                    setNotice(t("cloud.failed"));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t("cloud.signOut")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={!available || busy}
                onClick={() => void login("google")}
              >
                {t("cloud.google")}
              </button>
              <label>
                {t("cloud.email")}
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  disabled={!available || busy}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={!available || busy || !email.trim()}
                onClick={() => void login("emailLink")}
              >
                {t("cloud.emailLink")}
              </button>
            </>
          )}
          {notice && <p role="status">{notice}</p>}
        </section>
      )}
    </div>
  );
}
