import type { CloudParticipant } from "@nexohub/contracts";
import { useEffect, useState } from "react";
import { NexoHubLogoIcon } from "@/components/NexoHubLogoIcon";
import { translate as t } from "@/i18n";
import { withAppBase } from "@/platform/app-paths";
import type { CloudAccountPort } from "@/platform/cloud-account";
import { CloudIdentityError, type CloudProfile } from "@/platform/cloud-identity";
import { AccountAvatar } from "./AccountAvatar";
import { useCloudAccount } from "./CloudAccountContext";

type View =
  | { kind: "loading" }
  | { kind: "signedOut" | "unavailable" | "notAdmitted" | "unverified" }
  | { kind: "ready"; participant: CloudParticipant };

function failureView(error: unknown): View {
  const code = error instanceof CloudIdentityError ? error.code : undefined;
  if (code === "AUTH_REQUIRED") return { kind: "signedOut" };
  if (code === "PARTICIPANT_NOT_ADMITTED") return { kind: "notAdmitted" };
  if (code === "EMAIL_UNVERIFIED") return { kind: "unverified" };
  return { kind: "unavailable" };
}

export function CloudAccountPage({ account: provided }: { account?: CloudAccountPort }) {
  const runtime = useCloudAccount();
  const account = provided ?? runtime;
  const [view, setView] = useState<View>({ kind: "loading" });
  const [profile, setProfile] = useState<CloudProfile | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    void account
      .status()
      .then(async (status) => {
        if (!status.identityAvailable) return { kind: "unavailable" } as View;
        return { kind: "ready", participant: await account.me() } as View;
      })
      .catch(failureView)
      .then((next) => {
        if (!alive) return;
        setView(next);
        if (next.kind === "ready") {
          void account
            .profile()
            .then((value) => alive && setProfile(value))
            .catch(() => {});
        }
      });
    return () => {
      alive = false;
    };
  }, [account]);
  const signOut = async () => {
    setBusy(true);
    try {
      await account.signOut();
      setProfile(null);
      setView({ kind: "signedOut" });
    } finally {
      setBusy(false);
    }
  };
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const signOutButton = (label: "account.signOut" | "account.page.signOutDevice") => (
    <button type="button" className="cloud-account-action" disabled={busy} onClick={signOut}>
      {t(label)}
    </button>
  );
  return (
    <main className="cloud-account-page">
      <a className="account-brand" href={withAppBase("/pdf")} aria-label="NexoHub">
        <NexoHubLogoIcon />
        <span>NexoHub</span>
      </a>
      <h1>{t("account.mine")}</h1>
      {view.kind === "loading" && <p role="status">{t("account.loading")}</p>}
      {view.kind === "unavailable" && <p role="status">{t("account.unavailable")}</p>}
      {view.kind === "signedOut" && (
        <section className="cloud-account-card">
          <p>{t("account.page.signedOut")}</p>
          <a className="cloud-account-action" href={withAppBase("/cloud/login")}>
            {t("account.signIn")}
          </a>
        </section>
      )}
      {(view.kind === "notAdmitted" || view.kind === "unverified") && (
        <section className="cloud-account-card">
          <p role="status">
            {t(
              view.kind === "notAdmitted" ? "account.page.notAdmitted" : "account.page.unverified",
            )}
          </p>
          {signOutButton("account.signOut")}
        </section>
      )}
      {view.kind === "ready" && (
        <>
          <section className="cloud-account-card" aria-labelledby="conta-perfil">
            <h2 id="conta-perfil">{t("account.page.profile")}</h2>
            <div className="account-identity">
              <AccountAvatar profile={profile} email={view.participant.email} size="lg" />
              {profile?.name && <strong>{profile.name}</strong>}
            </div>
            <dl>
              {view.participant.email && (
                <div>
                  <dt>{t("account.email")}</dt>
                  <dd className="account-email">
                    {view.participant.email}
                    {view.participant.emailVerified && (
                      <span className="account-badge">{t("account.page.emailConfirmed")}</span>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt>{t("account.page.participantId")}</dt>
                <dd>
                  <code>{view.participant.participantId}</code>
                  <button
                    type="button"
                    className="cloud-account-action"
                    onClick={() => void copy(view.participant.participantId)}
                  >
                    {t(copied ? "account.page.copied" : "account.page.copy")}
                  </button>
                </dd>
              </div>
            </dl>
          </section>
          <section className="cloud-account-card" aria-labelledby="conta-metodos">
            <h2 id="conta-metodos">{t("account.page.methods")}</h2>
            <p>{t("account.page.methodsLead")}</p>
          </section>
          <section className="cloud-account-card" aria-labelledby="conta-sessao">
            <h2 id="conta-sessao">{t("account.page.session")}</h2>
            <p>{t("account.page.sessionLead")}</p>
            {signOutButton("account.page.signOutDevice")}
          </section>
          <section className="cloud-account-card" aria-labelledby="conta-privacidade">
            <h2 id="conta-privacidade">{t("account.page.privacy")}</h2>
            <p>{t("account.page.privacyLead")}</p>
            <p>{t("account.page.profilePrivacy")}</p>
          </section>
          <p className="cloud-account-note">{t("account.page.localNote")}</p>
        </>
      )}
      <a className="cloud-account-back" href={withAppBase("/pdf")}>
        {t("account.page.back")}
      </a>
    </main>
  );
}
