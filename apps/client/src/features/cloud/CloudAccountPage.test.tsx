import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { type CloudAccountPort, createDisabledCloudAccount } from "@/platform/cloud-account";
import { CloudIdentityError } from "@/platform/cloud-identity";
import { CloudAccountPage } from "./CloudAccountPage";

const participant = {
  participantId: "participant-synthetic",
  email: "person@example.invalid",
  admitted: true,
  emailVerified: true,
};
const account = (overrides: Partial<CloudAccountPort> = {}): CloudAccountPort => ({
  ...createDisabledCloudAccount(),
  status: async () => ({ enabled: false, identityAvailable: true }),
  me: async () => participant,
  profile: async () => null,
  ...overrides,
});

it("mostra e-mail, identificador e o aviso de que o uso local segue sem conta", async () => {
  render(<CloudAccountPage account={account()} />);
  expect(await screen.findByText("person@example.invalid")).toBeTruthy();
  expect(screen.getByText("Confirmado")).toBeTruthy();
  expect(screen.getByText("participant-synthetic")).toBeTruthy();
  expect(screen.getByText(/continua gratuito e sem conta/)).toBeTruthy();
  expect(screen.queryByText(/saldo|OCR|tradução/i)).toBeNull();
});
it("sair deste dispositivo remove a sessão e volta ao convite para entrar", async () => {
  const signOut = vi.fn(async () => {});
  render(<CloudAccountPage account={account({ signOut })} />);
  fireEvent.click(await screen.findByRole("button", { name: "Sair deste dispositivo" }));
  await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
  expect(await screen.findByText("Entre na sua conta para ver seus dados.")).toBeTruthy();
  expect(screen.queryByText("person@example.invalid")).toBeNull();
});
it("sem sessão não é erro: oferece entrar", async () => {
  render(
    <CloudAccountPage
      account={account({
        me: async () => {
          throw new CloudIdentityError("AUTH_REQUIRED");
        },
      })}
    />,
  );
  expect(await screen.findByRole("link", { name: "Entrar na sua conta" })).toBeTruthy();
});
it("conta sem convite é nomeada, mantém o uso local à vista e só oferece sair", async () => {
  render(
    <CloudAccountPage
      account={account({
        me: async () => {
          throw new CloudIdentityError("PARTICIPANT_NOT_ADMITTED");
        },
      })}
    />,
  );
  expect(await screen.findByText(/ainda não foi liberada/)).toBeTruthy();
  expect(screen.getByText(/uso local continua disponível/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Sair" })).toBeTruthy();
  expect(screen.queryByText("Dados da conta")).toBeNull();
});
it("e-mail não confirmado pede a confirmação", async () => {
  render(
    <CloudAccountPage
      account={account({
        me: async () => {
          throw new CloudIdentityError("EMAIL_UNVERIFIED");
        },
      })}
    />,
  );
  expect(await screen.findByText(/Confirme seu e-mail/)).toBeTruthy();
});
it("serviço indisponível não expõe detalhes técnicos", async () => {
  render(<CloudAccountPage account={createDisabledCloudAccount()} />);
  expect(await screen.findByText(/Não foi possível acessar sua conta/)).toBeTruthy();
  expect(screen.queryByText(/CLOUD_DISABLED|AUTH_/)).toBeNull();
});

it("mostra nome e foto do Google só como exibição local e explica que não são guardados", async () => {
  const { container } = render(
    <CloudAccountPage
      account={account({
        profile: async () => ({
          name: "Ana Souza",
          picture: "https://lh3.googleusercontent.com/a/synthetic=s96-c",
        }),
      })}
    />,
  );
  expect(await screen.findByText("Ana Souza")).toBeTruthy();
  await waitFor(() => expect(container.querySelector("img")).not.toBeNull());
  expect(screen.getByText(/O NexoHub não os guarda/)).toBeTruthy();
});
it("falha ao ler o perfil não afeta a conta e usa a inicial do e-mail", async () => {
  render(
    <CloudAccountPage
      account={account({
        profile: async () => {
          throw new Error("falha");
        },
      })}
    />,
  );
  expect(await screen.findByText("person@example.invalid")).toBeTruthy();
  expect(screen.getByText("P")).toBeTruthy();
});
