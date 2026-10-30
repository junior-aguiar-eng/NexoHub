import { useEffect, useState } from "react";
import { translate as t } from "@/i18n";
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
    [busy, setBusy] = useState(false);
  const run = async (complete = false) => {
    setBusy(true);
    try {
      const binding = new URL(window.location.href).searchParams.has("state")
        ? parseDesktopBinding(window.location.href)
        : undefined;
      if (complete) {
        if (!account.completeEmailLink) throw new Error();
        await account.completeEmailLink(email, window.location.href);
      } else await account.signIn(binding?.method ?? "emailLink", email, binding);
      if (!complete && (!binding || binding.method === "emailLink")) {
        setNotice(t("cloud.emailSent"));
        return;
      }
      await account.me();
      if (binding) {
        if (!account.completeDesktop) throw new Error();
        await account.completeDesktop(binding);
        setNotice(t("cloud.returned"));
      } else setNotice(t("cloud.signedIn"));
    } catch {
      setNotice(t("cloud.failed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="cloud-login">
      <h1>{t("cloud.windowsTitle")}</h1>
      <p>{t("cloud.localFree")}</p>
      {!available && <p>{t("cloud.disabled")}</p>}
      <label>
        {t("cloud.email")}
        <input
          type="email"
          value={email}
          autoComplete="email"
          disabled={!available || busy}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button type="button" disabled={!available || busy} onClick={() => void run()}>
        {t("cloud.continueBrowser")}
      </button>
      <button
        type="button"
        disabled={!available || busy || !email.trim()}
        onClick={() => void run(true)}
      >
        {t("cloud.completeEmail")}
      </button>
      {notice && <p role="status">{notice}</p>}
    </main>
  );
}
