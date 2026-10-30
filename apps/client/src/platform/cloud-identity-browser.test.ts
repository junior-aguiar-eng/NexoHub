import { beforeEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  app: vi.fn(() => ({})),
  auth: {
    currentUser: null as null | { emailVerified: boolean; getIdToken: () => Promise<string> },
  },
  init: vi.fn(),
  popup: vi.fn(),
  send: vi.fn(),
  complete: vi.fn(),
  isLink: vi.fn(),
  out: vi.fn(),
}));
vi.mock("firebase/app", () => ({ initializeApp: sdk.app }));
vi.mock("firebase/auth", () => ({
  initializeAuth: sdk.init,
  inMemoryPersistence: "MEMORY",
  browserPopupRedirectResolver: "POPUP",
  GoogleAuthProvider: class {},
  signInWithPopup: sdk.popup,
  sendSignInLinkToEmail: sdk.send,
  signInWithEmailLink: sdk.complete,
  isSignInWithEmailLink: sdk.isLink,
  signOut: sdk.out,
}));

import { createBrowserCloudIdentity } from "./cloud-identity-browser";

const config = {
  apiKey: "synthetic-public-config",
  projectId: "demo-hybrid",
  authDomain: "demo-hybrid.firebaseapp.com",
  redirectUrl: "https://example.invalid/hub/auth",
};
beforeEach(() => {
  vi.clearAllMocks();
  sdk.auth.currentUser = null;
  sdk.init.mockReturnValue(sdk.auth);
  sdk.popup.mockImplementation(async () => {
    sdk.auth.currentUser = { emailVerified: true, getIdToken: async () => "synthetic-id-token" };
  });
  sdk.complete.mockImplementation(async () => {
    sdk.auth.currentUser = { emailVerified: true, getIdToken: async () => "synthetic-id-token" };
  });
  sdk.out.mockImplementation(async () => {
    sdk.auth.currentUser = null;
  });
  sdk.isLink.mockReturnValue(true);
});
it("não inicializa nem contata autenticação para uso local sem login", async () => {
  const identity = createBrowserCloudIdentity(config);
  expect(await identity.getIdToken()).toBeNull();
  expect(sdk.app).not.toHaveBeenCalled();
});
it("usa Google com sessão somente em memória e não publica token em URL", async () => {
  const identity = createBrowserCloudIdentity(config);
  await identity.signIn("google");
  expect(sdk.init).toHaveBeenCalledWith(expect.anything(), {
    persistence: "MEMORY",
    popupRedirectResolver: "POPUP",
  });
  expect(await identity.getIdToken()).toBe("synthetic-id-token");
  await identity.signOut();
  expect(await identity.getIdToken()).toBeNull();
});
it("envia link de confirmação sem salvar o e-mail no localStorage", async () => {
  const store = vi.spyOn(Storage.prototype, "setItem");
  const identity = createBrowserCloudIdentity(config);
  await identity.signIn("emailLink", "person@example.invalid");
  expect(sdk.send).toHaveBeenCalledWith(sdk.auth, "person@example.invalid", {
    url: config.redirectUrl,
    handleCodeInApp: true,
  });
  expect(await identity.getIdToken()).toBeNull();
  expect(store).not.toHaveBeenCalled();
  store.mockRestore();
});
it("recusa e-mail não confirmado e callback em outra origem", async () => {
  const identity = createBrowserCloudIdentity(config);
  await expect(
    identity.completeEmailLink(
      "person@example.invalid",
      "https://attacker.invalid/?oobCode=example",
    ),
  ).rejects.toThrow("AUTH_INVALID_CALLBACK");
  expect(sdk.complete).not.toHaveBeenCalled();
  sdk.popup.mockImplementation(async () => {
    sdk.auth.currentUser = { emailVerified: false, getIdToken: async () => "never" };
  });
  await expect(identity.signIn("google")).rejects.toThrow("EMAIL_UNVERIFIED");
  expect(await identity.getIdToken()).toBeNull();
});
it("completa e-mail confirmado e não expõe mensagens sensíveis do SDK", async () => {
  const identity = createBrowserCloudIdentity(config);
  await identity.completeEmailLink(
    "person@example.invalid",
    `${config.redirectUrl}?oobCode=synthetic`,
  );
  expect(await identity.getIdToken()).toBe("synthetic-id-token");
  sdk.popup.mockRejectedValueOnce(new Error("sensitive-provider-data"));
  await expect(identity.signIn("google")).rejects.toThrow("AUTH_UNAVAILABLE");
});

it("link de e-mail preserva o vínculo público da instância Windows", async () => {
  const identity = createBrowserCloudIdentity(config);
  const binding = {
    state: "a".repeat(64),
    challenge: "b".repeat(64),
    publicKey: "c".repeat(588),
    port: 12345,
    method: "emailLink" as const,
  };
  await identity.signIn("emailLink", "person@example.invalid", binding);
  const target = new URL(sdk.send.mock.calls.at(-1)?.[2]?.url);
  expect(target.searchParams.get("state")).toBe(binding.state);
  expect(target.searchParams.get("challenge")).toBe(binding.challenge);
  expect(target.searchParams.has("refreshToken")).toBe(false);
});
