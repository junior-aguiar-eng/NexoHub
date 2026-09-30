import type { CapabilityId, CapabilityItem } from "@nexohub/contracts";
import { useCallback, useEffect, useState } from "react";
import type { DocumentCorePort } from "@/platform/document-core";

export const DEFAULT_CAPABILITIES: readonly CapabilityItem[] = [
  {
    id: "translation.neural",
    title: "Tradutor de Documentos com Inteligência Privada",
    summary:
      "Tradução de textos e documentos em inglês para português com fluência profissional humana.",
    benefit:
      "Permite traduzir contratos e relatórios com sigilo absoluto, sem que nenhum dado saia do seu computador.",
    category: "translation",
    diskSizeBytes: 367001600, // ~350 MB
    status: "not_installed",
    isOptional: true,
  },
  {
    id: "ocr.vision",
    title: "Leitor de Documentos Digitalizados (OCR)",
    summary: "Reconhecimento óptico de caracteres em imagens e PDFs escaneados.",
    benefit:
      "Extrai texto de recibos, fotos de folhas e contratos digitalizados sem precisar redigitar nada.",
    category: "vision",
    diskSizeBytes: 157286400, // ~150 MB
    status: "not_installed",
    isOptional: true,
  },
  {
    id: "text.deep_review",
    title: "Revisor Gramatical Profundo",
    summary: "Análise sintática avançada com mais de 2.000 regras formais da língua culta.",
    benefit:
      "Caça erros sutis de concordância, regência e pontuação formal para garantir textos impecáveis.",
    category: "review",
    diskSizeBytes: 188743680, // ~180 MB
    status: "not_installed",
    isOptional: true,
  },
  {
    id: "pdf.super_compress",
    title: "Super-Compactador de PDFs",
    summary:
      "Compactação profunda com reamostragem inteligente de imagens para envio por e-mail e web.",
    benefit:
      "Reduz arquivos pesados mantendo a legibilidade visual para respeitar limites de envio.",
    category: "compression",
    diskSizeBytes: 41943040, // ~40 MB
    status: "not_installed",
    isOptional: true,
  },
];

export function useCapabilities(documentCore?: DocumentCorePort) {
  const [capabilities, setCapabilities] = useState<readonly CapabilityItem[]>(DEFAULT_CAPABILITIES);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!documentCore) {
      setCapabilities(DEFAULT_CAPABILITIES);
      return;
    }
    setIsLoading(true);
    try {
      const res = await documentCore.invoke("list_capabilities", {});
      setCapabilities(res.capabilities);
    } catch {
      setCapabilities(DEFAULT_CAPABILITIES);
    } finally {
      setIsLoading(false);
    }
  }, [documentCore]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const install = useCallback(
    async (id: CapabilityId) => {
      if (documentCore) {
        await documentCore.invoke("install_capability", { capabilityId: id });
        await refresh();
      } else {
        throw new Error("CAPABILITY_NOT_FOUND");
      }
    },
    [documentCore, refresh],
  );

  const uninstall = useCallback(
    async (id: CapabilityId): Promise<number> => {
      if (documentCore) {
        const res = await documentCore.invoke("uninstall_capability", { capabilityId: id });
        await refresh();
        return res.freedBytes;
      } else {
        throw new Error("CAPABILITY_NOT_FOUND");
      }
    },
    [documentCore, refresh],
  );

  return {
    capabilities,
    isLoading,
    refresh,
    install,
    uninstall,
  };
}
