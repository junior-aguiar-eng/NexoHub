import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("identifica a fundação do NexoHub", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "NexoHub" })).toBeInTheDocument();
    expect(screen.getByText("Fundação local-first")).toBeInTheDocument();
  });
});
