import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ProcessingPreferenceControl } from "./ProcessingPreferenceControl";
import { resetProcessingPreferenceMemory } from "./processing-preference";

describe("ProcessingPreferenceControl", () => {
  beforeEach(() => {
    localStorage.clear();
    resetProcessingPreferenceMemory();
  });

  it("renderiza o seletor com as duas opções e destaca Estritamente Local por padrão", () => {
    render(<ProcessingPreferenceControl />);

    expect(screen.getByText("Preferência de processamento")).toBeTruthy();
    expect(screen.getByText("Estritamente Local (Recomendado)")).toBeTruthy();
    expect(screen.getByText("Híbrido Inteligente")).toBeTruthy();

    const localRadio = screen.getByRole("radio", { name: /Estritamente Local/i });
    const hybridRadio = screen.getByRole("radio", { name: /Híbrido Inteligente/i });

    expect((localRadio as HTMLInputElement).checked).toBe(true);
    expect((hybridRadio as HTMLInputElement).checked).toBe(false);
  });

  it("permite selecionar Híbrido Inteligente e atualiza o estado e storage", () => {
    render(<ProcessingPreferenceControl />);

    const hybridRadio = screen.getByRole("radio", { name: /Híbrido Inteligente/i });
    const localRadio = screen.getByRole("radio", { name: /Estritamente Local/i });

    fireEvent.click(hybridRadio);

    expect((hybridRadio as HTMLInputElement).checked).toBe(true);
    expect((localRadio as HTMLInputElement).checked).toBe(false);
    expect(localStorage.getItem("nexohub.cloud.processingPreference")).toBe("hybrid");
  });

  it("permite voltar para Estritamente Local", () => {
    render(<ProcessingPreferenceControl />);

    const hybridRadio = screen.getByRole("radio", { name: /Híbrido Inteligente/i });
    const localRadio = screen.getByRole("radio", { name: /Estritamente Local/i });

    fireEvent.click(hybridRadio);
    expect((hybridRadio as HTMLInputElement).checked).toBe(true);

    fireEvent.click(localRadio);
    expect((localRadio as HTMLInputElement).checked).toBe(true);
    expect(localStorage.getItem("nexohub.cloud.processingPreference")).toBe("local-first");
  });
});
