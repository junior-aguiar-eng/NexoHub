import firebasePublic from "../../../../scripts/cloud/firebase-public.json";
import {
  type CloudAccountPort,
  createCloudAccount,
  createDisabledCloudAccount,
  createTauriCloudAccount,
} from "./cloud-account";
import type { CloudIdentityPort } from "./cloud-identity";
import { CloudIdentityError } from "./cloud-identity";
import type { BrowserCloudIdentityConfig } from "./cloud-identity-browser";
export interface CloudBootstrapConfig {
  identityEnabled: boolean;
  firebase?: BrowserCloudIdentityConfig;
}
const identityOrigin =
  typeof window !== "undefined" && window.location.origin === firebasePublic.previewOrigin
    ? firebasePublic.previewOrigin
    : firebasePublic.productionOrigin;
export const cloudBootstrapConfig: CloudBootstrapConfig = {
  identityEnabled: true,
  firebase: { ...firebasePublic, redirectUrl: `${identityOrigin}/hub/cloud/login` },
};
export async function createCloudAccountRuntime(
  config: CloudBootstrapConfig = cloudBootstrapConfig,
): Promise<CloudAccountPort> {
  if (!config.identityEnabled) return createDisabledCloudAccount();
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    const native = window.__TAURI_INTERNALS__;
    return createTauriCloudAccount((command, args) => native.invoke(command, args));
  }
  if (!config.firebase) throw new CloudIdentityError("AUTH_UNAVAILABLE");
  const firebase = config.firebase;
  let pending: Promise<CloudIdentityPort> | null = null;
  const ready = () =>
    (pending ??= import("./cloud-identity-browser").then(({ createBrowserCloudIdentity }) =>
      createBrowserCloudIdentity(firebase),
    ));
  const lazyIdentity: CloudIdentityPort = {
    signIn: async (method, email, binding) => (await ready()).signIn(method, email, binding),
    completeEmailLink: async (email, url) => (await ready()).completeEmailLink(email, url),
    getIdToken: async () => (await ready()).getIdToken(),
    signOut: async () => {
      if (pending) await (await pending).signOut();
    },
    prepareDesktopHandoff: async (binding) => {
      const identity = await ready();
      if (!identity.prepareDesktopHandoff) throw new CloudIdentityError("AUTH_UNAVAILABLE");
      return identity.prepareDesktopHandoff(binding);
    },
  };
  return createCloudAccount(lazyIdentity, identityOrigin);
}
