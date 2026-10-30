import { useEffect, useState } from "react";
import { NexoHubLogoIcon } from "@/components/NexoHubLogoIcon";
import { translate as t } from "@/i18n";
import { withAppBase } from "@/platform/app-paths";
import type { CloudAccountPort } from "@/platform/cloud-account";
import { parseDesktopBinding } from "@/platform/desktop-handoff";
import { useCloudAccount } from "./CloudAccountContext";
export function CloudLoginPage({
  account: provided,
  identityAvailable = false,
}: {
  account?: CloudAccountPort;
  identityAvailable?: boolean;
}) {
  const runtime = useCloudAccount();
  const account = provided ?? runtime;
  const [available, setAvailable] = useState(identityAvailable);
  useEffect(() => {
    let active = true;
    void account
      .status()
      .then((s) => {
        if (active) setAvailable(s.identityAvailable);
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [account]);
  const [email, setEmail] = useState(""),
    [notice, setNotice] = useState(""),
    [signedIn, setSignedIn] = useState(false),
    [busy, setBusy] = useState(false);
  const params = new URL(window.location.href).searchParams;
  const completingEmail = params.get("mode") === "signIn" && params.has("oobCode");
  const requestedMethod = params.has("state") ? params.get("method") : null;
  const run = async (method: "google" | "emailLink", complete = false) => {
    setBusy(true);
    setNotice("");
    try {
      const binding = new URL(window.location.href).searchParams.has("state")
        ? parseDesktopBinding(window.location.href)
        : undefined;
      if (complete) {
        if (!account.completeEmailLink) throw new Error();
        await account.completeEmailLink(email, window.location.href);
      } else await account.signIn(binding?.method ?? method, email, binding);
      if (!complete && (binding?.method ?? method) === "emailLink") {
        setNotice(t("account.emailSent"));
        return;
      }
      await account.me();
      if (binding) {
        if (!account.completeDesktop) throw new Error();
        await account.completeDesktop(binding);
        setNotice(t("account.returned"));
      } else {
        setSignedIn(true);
        setNotice(t("account.signedIn"));
      }
    } catch {
      setNotice(t("account.failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="cloud-login">
      <a className="account-brand" href={withAppBase("/pdf")} aria-label="NexoHub">
        <NexoHubLogoIcon />
        <span>NexoHub</span>
      </a>
      <h1>{t(signedIn ? "account.mine" : "account.signIn")}</h1>
      {!signedIn && (
        <>
          <p>{t("account.welcome")}</p>
          {!available && <p role="status">{t("account.unavailable")}</p>}
          {!completingEmail && requestedMethod !== "emailLink" && (
            <button type="button" disabled={!available || busy} onClick={() => void run("google")}>
              {t("account.google")}
            </button>
          )}
          {!completingEmail && !requestedMethod && (
            <p className="account-divider">{t("account.or")}</p>
          )}
          {(requestedMethod !== "google" || completingEmail) && (
            <>
              <label>
                {t("account.email")}
                <input
                  type="email"
                  value={email}
                  autoComplete="email"
                  disabled={!available || busy}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={!available || busy || !email.trim()}
                onClick={() => void run("emailLink", completingEmail)}
              >
                {t(completingEmail ? "account.completeEmail" : "account.emailLink")}
              </button>
            </>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {signedIn && <a href={withAppBase("/pdf")}>{t("account.continue")}</a>}
    </main>
  );
}
