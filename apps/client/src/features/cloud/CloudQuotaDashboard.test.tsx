import type { CloudUsage } from "@nexohub/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CloudQuotaDashboard } from "./CloudQuotaDashboard";

const syntheticUsage: CloudUsage = {
  ocrPages: { used: 10, reserved: 2, remaining: 40 },
  translationCharacters: { used: 25000, reserved: 0, remaining: 75000 },
  officeFiles: { used: 5, reserved: 1, remaining: 15 },
  budgetUsdMicros: { used: 50000, reserved: 10000, remaining: 140000 },
  resetAt: "2026-12-01T00:00:00Z",
};

describe("CloudQuotaDashboard", () => {
  it("renderiza os cartões de cota com valores usados, restantes e barras de progresso", () => {
    render(<CloudQuotaDashboard usage={syntheticUsage} processingEnabled={true} />);

    expect(screen.getByText("Cotas mensais gratuitas")).toBeTruthy();
    expect(screen.getByText("OCR na nuvem")).toBeTruthy();
    expect(screen.getByText(/40 páginas restantes/)).toBeTruthy();
    expect(screen.getByText(/10 de 50 usados/)).toBeTruthy();

    expect(screen.getByText("Tradução de documentos")).toBeTruthy();
    expect(screen.getByText(/75\.000 caracteres restantes/)).toBeTruthy();

    expect(screen.getByText("Conversão Office")).toBeTruthy();
    expect(screen.getByText(/15 arquivos restantes/)).toBeTruthy();

    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBe(3);
    // OCR: 10/50 = 20%
    expect(progressBars[0].getAttribute("aria-valuenow")).toBe("20");
    // Tradução: 25000/100000 = 25%
    expect(progressBars[1].getAttribute("aria-valuenow")).toBe("25");
    // Office: 5/20 = 25%
    expect(progressBars[2].getAttribute("aria-valuenow")).toBe("25");
  });

  it("exibe a data de renovação formatada", () => {
    render(<CloudQuotaDashboard usage={syntheticUsage} processingEnabled={true} />);
    expect(screen.getByText(/Renovação em:/)).toBeTruthy();
  });

  it("calcula 0% de progresso sem divisão por zero quando o total é zero", () => {
    const zeroUsage: CloudUsage = {
      ocrPages: { used: 0, reserved: 0, remaining: 0 },
      translationCharacters: { used: 0, reserved: 0, remaining: 0 },
      officeFiles: { used: 0, reserved: 0, remaining: 0 },
      budgetUsdMicros: { used: 0, reserved: 0, remaining: 0 },
      resetAt: "2026-12-01T00:00:00Z",
    };

    render(<CloudQuotaDashboard usage={zeroUsage} processingEnabled={true} />);
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars[0].getAttribute("aria-valuenow")).toBe("0");
  });

  it("exibe aviso de preparação para piloto quando usage é nulo e processamento desabilitado", () => {
    render(<CloudQuotaDashboard usage={null} processingEnabled={false} />);
    expect(screen.getByText(/preparação para o piloto fechado/)).toBeTruthy();
  });

  it("exibe aviso de indisponibilidade quando usage é nulo mas processamento está habilitado", () => {
    render(<CloudQuotaDashboard usage={null} processingEnabled={true} />);
    expect(screen.getByText(/temporariamente indisponíveis/)).toBeTruthy();
  });
});
