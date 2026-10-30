import { expect, it, vi } from "vitest";
import {
  createCloudAccount,
  createDisabledCloudAccount,
  createTauriCloudIdentity,
} from "./cloud-account";

it("modo local não consulta conta, SDK, rede nem IPC", async () => {
  const fetcher = vi.fn();
  const account = createDisabledCloudAccount();
  expect(await account.status()).toEqual({ enabled: false, identityAvailable: false });
  await expect(account.signIn("google")).rejects.toMatchObject({ code: "CLOUD_DISABLED" });
  expect(fetcher).not.toHaveBeenCalled();
});
it("consulta saldo com Bearer, sem cookies ou documento, recusando origem arbitrária", async () => {
  const identity = {
    signIn: vi.fn(),
    completeEmailLink: vi.fn(),
    getIdToken: vi.fn(async () => "synthetic-token"),
    signOut: vi.fn(),
  };
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify({ participantId: "p", admitted: true, emailVerified: true }), {
        status: 200,
      }),
  );
  const account = createCloudAccount(identity, "https://nexojuris.ia.br", fetcher);
  await account.me();
  expect(fetcher).toHaveBeenCalledWith(
    "https://nexojuris.ia.br/hub/api/v1/cloud/me",
    expect.objectContaining({
      headers: { Authorization: "Bearer synthetic-token" },
      credentials: "omit",
      cache: "no-store",
    }),
  );
  expect(() => createCloudAccount(identity, "https://evil.invalid", fetcher)).toThrow();
});
it("Windows delega login/token/logout ao port nativo sem SDK Google no WebView", async () => {
  const invoke = vi.fn(async () => "synthetic-token");
  const identity = createTauriCloudIdentity(invoke);
  await identity.signIn("google");
  expect(invoke).toHaveBeenCalledWith("cloud_identity_sign_in", { method: "google" });
  expect(await identity.getIdToken()).toBe("synthetic-token");
  await identity.signOut();
  expect(invoke).toHaveBeenCalledWith("cloud_identity_sign_out");
});
it("falhas da API não expõem corpo nem tokens e não provocam fallback", async () => {
  const identity = {
    signIn: vi.fn(),
    completeEmailLink: vi.fn(),
    getIdToken: vi.fn(async () => "synthetic-token"),
    signOut: vi.fn(),
  };
  const account = createCloudAccount(
    identity,
    "https://nexojuris.ia.br",
    vi.fn(async () => new Response("sensitive upstream", { status: 503 })),
  );
  await expect(account.me()).rejects.toMatchObject({ code: "CLOUD_DISABLED" });
  expect(identity.signIn).not.toHaveBeenCalled();
});

it("bootstrap desligado não importa SDK, não invoca Windows nem consulta servidor", async () => {
  const { createCloudAccountRuntime } = await import("./cloud-bootstrap");
  const fetcher = vi.spyOn(globalThis, "fetch");
  const account = await createCloudAccountRuntime();
  expect(await account.status()).toEqual({ enabled: false, identityAvailable: false });
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockRestore();
});

it("conta Windows usa somente IPC para status e saldo, sem fetch do WebView", async () => {
  const { createTauriCloudAccount } = await import("./cloud-account");
  const invoke = vi.fn(async (_command: string, _args?: Record<string, unknown>) => ({
    enabled: false,
    identityAvailable: true,
  }));
  const fetcher = vi.spyOn(globalThis, "fetch");
  const account = createTauriCloudAccount(invoke);
  await account.status();
  await account.me();
  await account.usage();
  expect(invoke.mock.calls.map((v) => v[0])).toEqual([
    "cloud_account_request",
    "cloud_account_request",
    "cloud_account_request",
  ]);
  expect(fetcher).not.toHaveBeenCalled();
  fetcher.mockRestore();
});
