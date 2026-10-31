import { beforeEach, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  app: vi.fn(() => ({})),
  auth: {
    languageCode: null as string | null,
    authStateReady: vi.fn(async () => {}),
    currentUser: null as null | {
      uid?: string;
      email?: string;
      providerData?: { providerId: string }[];
      displayName?: string | null;
      photoURL?: string | null;
      emailVerified: boolean;
      getIdToken: () => Promise<string>;
    },
  },
  init: vi.fn(),
  popup: vi.fn(),
  send: vi.fn(),
  complete: vi.fn(),
  isLink: vi.fn(),
  out: vi.fn(),
  link: vi.fn(),
  reauth: vi.fn(),
  credential: vi.fn(() => ({ kind: "email-link" })),
}));
vi.mock("firebase/app", () => ({ initializeApp: sdk.app }));
vi.mock("firebase/auth", () => ({
  initializeAuth: sdk.init,
  browserSessionPersistence: "SESSION",
  browserPopupRedirectResolver: "POPUP",
  GoogleAuthProvider: class {},
  signInWithPopup: sdk.popup,
  sendSignInLinkToEmail: sdk.send,
  signInWithEmailLink: sdk.complete,
  isSignInWithEmailLink: sdk.isLink,
  signOut: sdk.out,
  linkWithCredential: sdk.link,
  reauthenticateWithCredential: sdk.reauth,
  EmailAuthProvider: { credentialWithLink: sdk.credential },
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
  createBrowserCloudIdentity(config);
  expect(sdk.app).not.toHaveBeenCalled();
});
it("aguarda restaurar a sessão antes de consultar a conta", async () => {
  sdk.auth.authStateReady.mockImplementationOnce(async () => {
    sdk.auth.currentUser = {
      emailVerified: true,
      getIdToken: async () => "restored-synthetic-token",
    };
  });
  const identity = createBrowserCloudIdentity(config);
  expect(await identity.getIdToken()).toBe("restored-synthetic-token");
  expect(sdk.auth.authStateReady).toHaveBeenCalledOnce();
});
it("usa Google com sessão da aba e não publica token em URL", async () => {
  const identity = createBrowserCloudIdentity(config);
  await identity.signIn("google");
  expect(sdk.auth.languageCode).toBe("pt-BR");
  expect(sdk.init).toHaveBeenCalledWith(expect.anything(), {
    persistence: "SESSION",
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

it("vincula e-mail à conta Google autenticada sem trocar seu UID", async () => {
  const identity = createBrowserCloudIdentity(config);
  const user = {
    uid: "shared-uid",
    email: "person@example.invalid",
    providerData: [{ providerId: "google.com" }],
    emailVerified: true,
    getIdToken: async () => "synthetic-token",
  };
  sdk.auth.currentUser = user;
  sdk.link.mockImplementationOnce(async () => ({ user }));
  await identity.completeEmailLink(
    "person@example.invalid",
    `${config.redirectUrl}?oobCode=synthetic`,
  );
  expect(sdk.link).toHaveBeenCalledWith(user, { kind: "email-link" });
  expect(sdk.complete).not.toHaveBeenCalled();
  expect(sdk.auth.currentUser?.uid).toBe("shared-uid");
});
it("não associa link de outro e-mail à conta já autenticada", async () => {
  const identity = createBrowserCloudIdentity(config);
  sdk.auth.currentUser = {
    uid: "shared-uid",
    email: "person@example.invalid",
    providerData: [{ providerId: "google.com" }],
    emailVerified: true,
    getIdToken: async () => "synthetic-token",
  };
  await expect(
    identity.completeEmailLink("other@example.invalid", `${config.redirectUrl}?oobCode=synthetic`),
  ).rejects.toThrow("AUTH_ACCOUNT_MISMATCH");
  expect(sdk.link).not.toHaveBeenCalled();
  expect(sdk.complete).not.toHaveBeenCalled();
});

it("perfil traz nome e foto do SDK só com e-mail confirmado, sem rede nem token", async () => {
  const identity = createBrowserCloudIdentity(config);
  sdk.auth.currentUser = {
    emailVerified: true,
    displayName: "Ana Souza",
    photoURL: "https://lh3.googleusercontent.com/a/synthetic=s96-c",
    getIdToken: vi.fn(async () => "synthetic-id-token"),
  };
  expect(await identity.profile?.()).toEqual({
    name: "Ana Souza",
    picture: "https://lh3.googleusercontent.com/a/synthetic=s96-c",
  });
  expect(sdk.auth.currentUser.getIdToken).not.toHaveBeenCalled();
  sdk.auth.currentUser = { emailVerified: true, getIdToken: async () => "t" };
  expect(await identity.profile?.()).toEqual({});
  sdk.auth.currentUser = { emailVerified: false, displayName: "Ana", getIdToken: async () => "t" };
  expect(await identity.profile?.()).toBeNull();
  sdk.auth.currentUser = null;
  expect(await identity.profile?.()).toBeNull();
});
