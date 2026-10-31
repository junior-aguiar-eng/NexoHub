import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { AccountAvatar, safePictureSource } from "./AccountAvatar";

it("aceita só https sem credenciais ou imagem raster em data:", () => {
  expect(safePictureSource("https://lh3.googleusercontent.com/a/x=s96-c")).toBe(
    "https://lh3.googleusercontent.com/a/x=s96-c",
  );
  expect(safePictureSource("data:image/png;base64,iVBORw==")).toBe(
    "data:image/png;base64,iVBORw==",
  );
  for (const bad of [
    undefined,
    "",
    "http://lh3.googleusercontent.com/a",
    "javascript:alert(1)",
    "https://user:pass@lh3.googleusercontent.com/a",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:text/html;base64,PGh0bWw+",
    "blob:https://exemplo.invalid/abc",
    "não é url",
  ])
    expect(safePictureSource(bad)).toBeNull();
});
it("mostra a foto sem enviar referência e cai na inicial se ela falhar", () => {
  const { container } = render(
    <AccountAvatar
      profile={{ name: "Ana Souza", picture: "https://lh3.googleusercontent.com/a/x" }}
      size="sm"
    />,
  );
  const image = container.querySelector("img");
  expect(image?.getAttribute("referrerpolicy")).toBe("no-referrer");
  if (image) fireEvent.error(image);
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText("A")).toBeTruthy();
});
it("sem perfil usa a inicial do e-mail", () => {
  render(<AccountAvatar profile={null} email="beto@example.invalid" size="lg" />);
  expect(screen.getByText("B")).toBeTruthy();
});
