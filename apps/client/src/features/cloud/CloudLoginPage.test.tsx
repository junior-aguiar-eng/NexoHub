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
  };
  render(<CloudLoginPage account={account} />);
  const email = screen.getByRole("textbox", { name: "E-mail confirmado" });
  await waitFor(() => expect(email).not.toBeDisabled());
  fireEvent.change(email, { target: { value: "person@example.invalid" } });
  fireEvent.click(screen.getByRole("button", { name: "Concluir entrada por e-mail" }));
  await waitFor(() => expect(completeEmailLink).toHaveBeenCalledOnce());
  expect(completeDesktop).not.toHaveBeenCalled();
});
