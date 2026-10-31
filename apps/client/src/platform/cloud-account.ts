import type { CloudParticipant, CloudUsage } from "@nexohub/contracts";
import firebasePublic from "../../../../scripts/cloud/firebase-public.json";
import type { CloudIdentityPort, CloudProfile } from "./cloud-identity";
import { CloudIdentityError } from "./cloud-identity";
import type { DesktopBinding } from "./desktop-handoff";
export interface CloudAccountPort {
  /** No Windows, signIn aguarda o retorno e a gravação da sessão; na web, só envia o link. */
  readonly emailLinkCompletesSession?: boolean;
  status(): Promise<{ enabled: boolean; identityAvailable: boolean }>;
  signIn(method: "google" | "emailLink", email?: string, binding?: DesktopBinding): Promise<void>;
  completeEmailLink?(email: string, url: string): Promise<void>;
  completeDesktop?(binding: DesktopBinding): Promise<void>;
  signOut(): Promise<void>;
  me(): Promise<CloudParticipant>;
  usage(): Promise<CloudUsage>;
  /** Lido do próprio aparelho; falha ou ausência nunca impede o uso da conta. */
  profile(): Promise<CloudProfile | null>;
}
/** Só o código estruturado do 403 chega à interface; mensagem e corpo nunca são repassados. */
async function failureCode(response: Response): Promise<CloudIdentityError["code"]> {
  if (response.status === 503) return "CLOUD_DISABLED";
  if (response.status === 401) return "AUTH_REQUIRED";
  if (response.status === 403) {
    const code = await response.json().then(
      (value: { code?: unknown } | null) => value?.code,
      () => undefined,
    );
    if (code === "PARTICIPANT_NOT_ADMITTED" || code === "EMAIL_UNVERIFIED") return code;
  }
  return "AUTH_UNAVAILABLE";
}

export function createDisabledCloudAccount(): CloudAccountPort {
  const disabled = async (): Promise<never> => {
    throw new CloudIdentityError("CLOUD_DISABLED");
  };
  return {
    status: async () => ({ enabled: false, identityAvailable: false }),
    signIn: disabled,
    signOut: async () => {},
    me: disabled,
    usage: disabled,
    profile: async () => null,
  };
}
export function createCloudAccount(
  identity: CloudIdentityPort,
  origin: string,
  fetcher: typeof fetch = fetch,
): CloudAccountPort {
  const parsed = new URL(origin);
  if (
    ![firebasePublic.productionOrigin, firebasePublic.previewOrigin].includes(parsed.origin) ||
    parsed.pathname !== "/" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  )
    throw new CloudIdentityError("AUTH_INVALID_CALLBACK");
  const request = async <T>(path: string, body?: unknown): Promise<T> => {
    const token = await identity.getIdToken();
    if (!token) throw new CloudIdentityError("AUTH_REQUIRED");
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
      response = await fetcher(`${parsed.origin}/hub/api/v1/cloud/${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(15_000),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new CloudIdentityError("AUTH_UNAVAILABLE");
    }
    if (!response.ok) throw new CloudIdentityError(await failureCode(response));
    try {
      return (await response.json()) as T;
    } catch {
      throw new CloudIdentityError("AUTH_UNAVAILABLE");
    }
  };
  return {
    async status() {
      try {
        const response = await fetcher(`${parsed.origin}/hub/api/v1/cloud/status`, {
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error();
        const value = (await response.json()) as { enabled?: unknown; identityAvailable?: unknown };
        return {
          enabled: value.enabled === true,
          identityAvailable: value.identityAvailable === true,
        };
      } catch {
        throw new CloudIdentityError("AUTH_UNAVAILABLE");
      }
    },
    signIn: (method, email, binding) => identity.signIn(method, email, binding),
    completeEmailLink: (email, url) => identity.completeEmailLink(email, url),
    signOut: () => identity.signOut(),
    me: () => request<CloudParticipant>("me"),
    usage: () => request<CloudUsage>("usage"),
    profile: async () => (await identity.profile?.()) ?? null,
    async completeDesktop(binding) {
      if (!identity.prepareDesktopHandoff) throw new CloudIdentityError("AUTH_UNAVAILABLE");
      const envelope = await identity.prepareDesktopHandoff(binding);
      const issued = await request<{ code: string; expiresAt: number }>("auth/desktop/code", {
        state: binding.state,
        challenge: binding.challenge,
        envelope,
      });
      if (!/^[a-f0-9]{64}$/.test(issued.code) || !Number.isInteger(issued.expiresAt))
        throw new CloudIdentityError("AUTH_INVALID_CALLBACK");
      const callback = new URL(`http://127.0.0.1:${binding.port}/callback`);
      callback.searchParams.set("code", issued.code);
      callback.searchParams.set("state", binding.state);
      window.location.assign(callback.href);
    },
  };
}
type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
export function createTauriCloudIdentity(invoke: Invoke): CloudIdentityPort {
  const safe = async <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
    try {
      return (args ? await invoke(command, args) : await invoke(command)) as T;
    } catch {
      throw new CloudIdentityError("AUTH_UNAVAILABLE");
    }
  };
  return {
    signIn: async (method) => {
      await safe("cloud_identity_sign_in", { method });
    },
    completeEmailLink: async () => {
      throw new CloudIdentityError("AUTH_INVALID_CALLBACK");
    },
    getIdToken: () => safe<string | null>("cloud_identity_get_token"),
    signOut: async () => {
      await safe("cloud_identity_sign_out");
    },
  };
}
// Gate fechado no produto: não ler configuração remota nem inicializar SDK ao abrir o aplicativo.
export const cloudAccount = createDisabledCloudAccount();

export function createTauriCloudAccount(invoke: Invoke): CloudAccountPort {
  const identity = createTauriCloudIdentity(invoke);
  const request = async <T>(operation: "status" | "me" | "usage"): Promise<T> => {
    try {
      return (await invoke("cloud_account_request", { operation })) as T;
    } catch {
      throw new CloudIdentityError("AUTH_UNAVAILABLE");
    }
  };
  return {
    emailLinkCompletesSession: true,
    status: () => request("status"),
    me: () => request("me"),
    usage: () => request("usage"),
    async profile() {
      try {
        const value = (await invoke("cloud_identity_profile")) as {
          name?: string | null;
          picture?: string | null;
        } | null;
        return {
          ...(value?.name ? { name: value.name } : {}),
          ...(value?.picture ? { picture: value.picture } : {}),
        };
      } catch {
        return null;
      }
    },
    signIn: (method, email) => identity.signIn(method, email),
    signOut: () => identity.signOut(),
  };
}
