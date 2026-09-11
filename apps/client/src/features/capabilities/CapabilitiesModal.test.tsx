import type { CapabilityItem } from "@nexohub/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentCorePort } from "@/platform/document-core";
import { CapabilitiesModal } from "./CapabilitiesModal";

const mockCapabilities: readonly CapabilityItem[] = [
  {
    id: "translation.neural",
    title: "Tradutor de Documentos com Inteligência Privada",
    summary:
      "Tradução de textos e documentos em inglês para português com fluência profissional humana.",
    benefit: "Permite traduzir contratos e relatórios com sigilo absoluto.",
    category: "translation",
    diskSizeBytes: 367001600,
    status: "installed",
    isOptional: true,
  },
  {
    id: "ocr.vision",
    title: "Leitor de Documentos Digitalizados (OCR)",
    summary: "Reconhecimento óptico de caracteres em imagens e PDFs escaneados.",
    benefit: "Extrai texto de recibos e folhas sem redigitar nada.",
    category: "vision",
    diskSizeBytes: 157286400,
    status: "not_installed",
    isOptional: true,
  },
];

describe("CapabilitiesModal", () => {
  it("renderiza os superpoderes com status e informações didáticas", async () => {
    const invoke = vi.fn().mockImplementation((cmd: string) => {
      if (cmd === "list_capabilities") {
        return Promise.resolve({ capabilities: mockCapabilities });
      }
      return Promise.resolve({});
    });
    const documentCore = { invoke } as unknown as DocumentCorePort;

    render(<CapabilitiesModal open={true} onClose={() => {}} documentCore={documentCore} />);

    await waitFor(() => {
      expect(
        screen.getByText("Tradutor de Documentos com Inteligência Privada"),
      ).toBeInTheDocument();
      expect(screen.getByText("Leitor de Documentos Digitalizados (OCR)")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Ativo e pronto").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Disponível para ativar")).toBeInTheDocument();
    expect(screen.getByTestId("disk-size-translation.neural")).toHaveTextContent("350 MB");
    expect(screen.getByTestId("disk-size-ocr.vision")).toHaveTextContent("150 MB");
  });

  it("permite instalar um superpoder em 1 clique", async () => {
    const invoke = vi.fn().mockImplementation((cmd: string) => {
      if (cmd === "list_capabilities") {
        return Promise.resolve({ capabilities: mockCapabilities });
      }
      if (cmd === "install_capability") {
        return Promise.resolve({ success: true });
      }
      return Promise.resolve({});
    });
    const documentCore = { invoke } as unknown as DocumentCorePort;

    render(<CapabilitiesModal open={true} onClose={() => {}} documentCore={documentCore} />);

    await waitFor(() => {
      expect(screen.getByText("Ativar Superpoder")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Ativar Superpoder"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("install_capability", {
        capabilityId: "ocr.vision",
      });
    });
  });

  it("permite desinstalar e reverter um superpoder liberando espaço em disco", async () => {
    const invoke = vi.fn().mockImplementation((cmd: string) => {
      if (cmd === "list_capabilities") {
        return Promise.resolve({ capabilities: mockCapabilities });
      }
      if (cmd === "uninstall_capability") {
        return Promise.resolve({ success: true, freedBytes: 367001600 });
      }
      return Promise.resolve({});
    });
    const documentCore = { invoke } as unknown as DocumentCorePort;

    render(<CapabilitiesModal open={true} onClose={() => {}} documentCore={documentCore} />);

    await waitFor(() => {
      expect(screen.getByText("Desinstalar e liberar espaço")).toBeInTheDocument();
    });

    // Clica no botão de desinstalar para abrir a confirmação
    fireEvent.click(screen.getByText("Desinstalar e liberar espaço"));

    expect(
      screen.getByText(/Você liberará o espaço em disco ocupado por este módulo/),
    ).toBeInTheDocument();
    expect(screen.getByText("Sim, desinstalar")).toBeInTheDocument();

    // Confirma a desinstalação
    fireEvent.click(screen.getByText("Sim, desinstalar"));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("uninstall_capability", {
        capabilityId: "translation.neural",
      });
      expect(screen.getByText(/Espaço liberado com sucesso: 350 MB/)).toBeInTheDocument();
    });
  });
});
