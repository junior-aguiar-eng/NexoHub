import { expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  factory: vi.fn(() => ({
    signIn: vi.fn(async () => {}),
    completeEmailLink: vi.fn(),
    getIdToken: vi.fn(async () => "synthetic"),
    signOut: vi.fn(),
  })),
}));
vi.mock("./cloud-identity-browser", () => ({ createBrowserCloudIdentity: sdk.factory }));

import { createCloudAccountRuntime } from "./cloud-bootstrap";

it("identidade habilitada não carrega SDK nem exige rede para abrir o modo local", async () => {
  const account = await createCloudAccountRuntime({
    identityEnabled: true,
    firebase: {
      apiKey: "synthetic",
      projectId: "demo-test",
      authDomain: "demo-test.firebaseapp.com",
      redirectUrl: "https://nexojuris.ia.br/hub/cloud/login",
    },
  });
  expect(sdk.factory).not.toHaveBeenCalled();
  await account.signIn("google");
  expect(sdk.factory).toHaveBeenCalledOnce();
});
