import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createDisabledCloudAccount } from "@/platform/cloud-account";
import { CloudAccountControl } from "./CloudAccountControl";

it("nuvem desligada explica uso local gratuito e não faz login ao abrir", async () => {
  render(<CloudAccountControl account={createDisabledCloudAccount()} />);
  fireEvent.click(screen.getByRole("button", { name: "Nuvem opcional" }));
  expect(await screen.findByText("O uso local continua gratuito e não exige conta.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Entrar com Google" })).toBeDisabled();
});
it("login é explícito; exibe saldo compartilhado e logout local", async () => {
  const signIn = vi.fn(async () => {}),
    signOut = vi.fn(async () => {});
  const b = { used: 1, reserved: 2, remaining: 3 };
  const account = {
    status: async () => ({ enabled: false, identityAvailable: true }),
    signIn,
    signOut,
    me: async () => ({ participantId: "p", admitted: true, emailVerified: true }),
    usage: async () => ({
      ocrPages: b,
      translationCharacters: b,
      officeFiles: b,
      budgetUsdMicros: b,
      resetAt: "2026-11-01T00:00:00Z",
    }),
  };
  render(<CloudAccountControl account={account} />);
  fireEvent.click(screen.getByRole("button", { name: "Nuvem opcional" }));
  const google = await screen.findByRole("button", { name: "Entrar com Google" });
  await waitFor(() => expect(google).not.toBeDisabled());
  expect(signIn).not.toHaveBeenCalled();
  fireEvent.click(google);
  expect(await screen.findByText("Saldo de uso na nuvem")).toBeTruthy();
  expect(screen.getByText("OCR: 3 páginas disponíveis")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sair deste dispositivo" }));
  await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
});
