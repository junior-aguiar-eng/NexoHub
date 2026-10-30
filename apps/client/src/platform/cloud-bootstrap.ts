import {
  type CloudAccountPort,
  createCloudAccount,
  createDisabledCloudAccount,
  createTauriCloudAccount,
} from "./cloud-account";
import { CloudIdentityError } from "./cloud-identity";
import type { BrowserCloudIdentityConfig } from "./cloud-identity-browser";
export interface CloudBootstrapConfig {
  identityEnabled: boolean;
  firebase?: BrowserCloudIdentityConfig;
}
export const cloudBootstrapConfig: CloudBootstrapConfig = { identityEnabled: false };
export async function createCloudAccountRuntime(
  config: CloudBootstrapConfig = cloudBootstrapConfig,
): Promise<CloudAccountPort> {
  if (!config.identityEnabled) return createDisabledCloudAccount();
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    const native = window.__TAURI_INTERNALS__;
    return createTauriCloudAccount((command, args) => native.invoke(command, args));
  }
  if (!config.firebase) throw new CloudIdentityError("AUTH_UNAVAILABLE");
  const { createBrowserCloudIdentity } = await import("./cloud-identity-browser");
  return createCloudAccount(createBrowserCloudIdentity(config.firebase), "https://nexojuris.ia.br");
}
