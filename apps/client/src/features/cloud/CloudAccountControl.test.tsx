import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createDisabledCloudAccount } from "@/platform/cloud-account";
import { CloudIdentityError } from "@/platform/cloud-identity";
import { CloudAccountControl } from "./CloudAccountControl";

it("conta indisponível mantém formulário claro sem avisos de arquitetura", async () => {
  render(<CloudAccountControl account={createDisabledCloudAccount()} />);
  fireEvent.click(screen.getByRole("button", { name: "Conta" }));
  expect(
    await screen.findByText("Entre com sua conta Google ou com um link enviado ao seu e-mail."),
  ).toBeTruthy();
  expect(screen.getByRole("button", { name: "Continuar com Google" })).toBeDisabled();
});
it("entrada nativa por e-mail não pede o endereço antes de abrir o navegador", async () => {
  let authenticated = false;
  const signIn = vi.fn(async () => {
    authenticated = true;
  });
  render(
    <CloudAccountControl
      account={{
        ...createDisabledCloudAccount(),
        emailLinkCompletesSession: true,
        status: async () => ({ enabled: false, identityAvailable: true }),
        signIn,
        me: async () => {
          if (!authenticated) throw new Error("AUTH_REQUIRED");
          return {
            participantId: "native-participant",
            email: "person@example.invalid",
            admitted: true,
            emailVerified: true,
          };
        },
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Conta" }));
  const emailButton = await screen.findByRole("button", { name: "Continuar com e-mail" });
  await waitFor(() => expect(emailButton).not.toBeDisabled());
  expect(screen.queryByRole("textbox", { name: "E-mail" })).toBeNull();
  fireEvent.click(emailButton);
  expect(await screen.findByText("person@example.invalid")).toBeTruthy();
  expect(signIn).toHaveBeenCalledWith("emailLink", "");
  expect(
    screen.queryByText("Enviamos um link de acesso para seu e-mail. Abra o link para continuar."),
  ).toBeNull();
});
it("login é explícito; exibe saldo compartilhado e logout local", async () => {
  let authenticated = false;
  const signIn = vi.fn(async () => {
      authenticated = true;
    }),
    signOut = vi.fn(async () => {});
  const b = { used: 1, reserved: 2, remaining: 3 };
  const account = {
    status: async () => ({ enabled: true, identityAvailable: true }),
    signIn,
    signOut,
    me: async () => {
      if (!authenticated) throw new Error("AUTH_REQUIRED");
      return {
        participantId: "p",
        email: "person@example.invalid",
        admitted: true,
        emailVerified: true,
      };
    },
    usage: async () => ({
      ocrPages: b,
      translationCharacters: b,
      officeFiles: b,
      budgetUsdMicros: b,
      resetAt: "2026-11-01T00:00:00Z",
    }),
    profile: async () => null,
  };
  render(<CloudAccountControl account={account} />);
  fireEvent.click(screen.getByRole("button", { name: "Conta" }));
  const google = await screen.findByRole("button", { name: "Continuar com Google" });
  await waitFor(() => expect(google).not.toBeDisabled());
  expect(signIn).not.toHaveBeenCalled();
  fireEvent.click(google);
  expect(await screen.findByText("Meu uso")).toBeTruthy();
  expect(screen.getByText("OCR: 3 páginas disponíveis")).toBeTruthy();
  expect(screen.getByText("person@example.invalid")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sair" }));
  await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
});

it("com sessão oferece abrir a página da conta", async () => {
  render(
    <CloudAccountControl
      account={{
        ...createDisabledCloudAccount(),
        status: async () => ({ enabled: false, identityAvailable: true }),
        me: async () => ({
          participantId: "participant-synthetic",
          email: "person@example.invalid",
          admitted: true,
          emailVerified: true,
        }),
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Conta" }));
  const link = await screen.findByRole("link", { name: "Abrir minha conta" });
  expect(link.getAttribute("href")).toMatch(/conta$/);
});
it("conta sem convite mostra o motivo no lugar do formulário de entrada", async () => {
  render(
    <CloudAccountControl
      account={{
        ...createDisabledCloudAccount(),
        status: async () => ({ enabled: false, identityAvailable: true }),
        me: async () => {
          throw new CloudIdentityError("PARTICIPANT_NOT_ADMITTED");
        },
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Conta" }));
  expect(await screen.findByText(/ainda não foi liberada/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Continuar com Google" })).toBeNull();
  expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();
});

it("painel mostra o nome do Google ao lado do e-mail", async () => {
  render(
    <CloudAccountControl
      account={{
        ...createDisabledCloudAccount(),
        status: async () => ({ enabled: false, identityAvailable: true }),
        me: async () => ({
          participantId: "participant-synthetic",
          email: "person@example.invalid",
          admitted: true,
          emailVerified: true,
        }),
        profile: async () => ({ name: "Ana Souza" }),
      }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Conta" }));
  expect(await screen.findByText("Ana Souza")).toBeTruthy();
  expect(screen.getByText("person@example.invalid")).toBeTruthy();
});
