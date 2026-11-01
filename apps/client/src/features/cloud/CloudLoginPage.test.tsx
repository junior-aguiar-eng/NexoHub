import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CloudLoginPage } from "./CloudLoginPage";

afterEach(() => {
  window.history.replaceState({}, "", "/");
});
it("conclui link web sem exigir vínculo Windows ou redirecionar ao loopback", async () => {
  window.history.replaceState({}, "", "/cloud/login?mode=signIn&oobCode=synthetic");
  const completeEmailLink = vi.fn(async () => {}),
    completeDesktop = vi.fn();
  const account = {
    status: async () => ({ enabled: false, identityAvailable: true }),
    signIn: vi.fn(),
    completeEmailLink,
    completeDesktop,
    signOut: vi.fn(),
    me: async () => ({ participantId: "p", admitted: true, emailVerified: true }),
    usage: vi.fn(),
    profile: async () => null,
  };
  render(<CloudLoginPage account={account} />);
  const email = screen.getByRole("textbox", { name: "E-mail" });
  await waitFor(() => expect(email).not.toBeDisabled());
  fireEvent.change(email, { target: { value: "person@example.invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirmar e-mail e entrar" }));
  await waitFor(() => expect(completeEmailLink).toHaveBeenCalledOnce());
  expect(completeDesktop).not.toHaveBeenCalled();
});

it("volta do link no mesmo navegador e conclui sozinho com o e-mail lembrado", async () => {
  window.history.replaceState({}, "", "/cloud/login?mode=signIn&oobCode=synthetic");
  const completeEmailLink = vi.fn(async () => {});
  const account = {
    status: async () => ({ enabled: false, identityAvailable: true }),
    signIn: vi.fn(),
    completeEmailLink,
    signOut: vi.fn(),
    me: async () => ({ participantId: "p", admitted: true, emailVerified: true }),
    usage: vi.fn(),
    profile: async () => null,
    rememberedEmail: () => "person@example.invalid",
  };
  render(<CloudLoginPage account={account} />);
  await waitFor(() => expect(completeEmailLink).toHaveBeenCalledOnce());
  expect(completeEmailLink).toHaveBeenCalledWith(
    "person@example.invalid",
    expect.stringContaining("oobCode=synthetic"),
  );
  expect(await screen.findByText("Você entrou na sua conta.")).toBeTruthy();
});
