import { useCallback, useEffect, useState } from "react";

export interface RecentOperation {
  id: string;
  documentName: string;
  toolId: string;
  toolName: string;
  timestamp: number;
  originalSize?: number;
  resultSize?: number;
  sha256?: string;
  categoryKey: "recent.type.procedural" | "recent.type.contracts" | "recent.type.opinion";
  artifactPath?: string;
  downloadUrl?: string;
}

const STORAGE_KEY = "nexohub:recent-operations";

const INITIAL_FALLBACK: RecentOperation[] = [
  {
    id: "rec-1",
    documentName: "Apelação Cível – 0019284-82.2025.8.19.0001.pdf",
    toolId: "pdf-compress",
    toolName: "Compressão de Arquivo",
    timestamp: Date.now() - 1000 * 60 * 35,
    originalSize: 4_850_000,
    resultSize: 1_420_000,
    sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    categoryKey: "recent.type.procedural",
  },
  {
    id: "rec-2",
    documentName: "Contrato de Prestação de Serviços – Minuta v3.docx",
    toolId: "text-review",
    toolName: "Análise Linguística",
    timestamp: Date.now() - 1000 * 60 * 180,
    originalSize: 340_000,
    resultSize: 340_000,
    sha256: "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8",
    categoryKey: "recent.type.contracts",
  },
  {
    id: "rec-3",
    documentName: "Parecer Jurídico – Compliance Tributário.pdf",
    toolId: "pdf-ocr",
    toolName: "Extração de Texto",
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
    originalSize: 1_200_000,
    resultSize: 1_850_000,
    sha256: "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    categoryKey: "recent.type.opinion",
  },
];

export function useRecentOperations() {
  const [operations, setOperations] = useState<RecentOperation[]>(() => {
    if (typeof window === "undefined") return INITIAL_FALLBACK;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn("Falha ao ler histórico de operações:", e);
    }
    return INITIAL_FALLBACK;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(operations));
    } catch (e) {
      console.warn("Falha ao salvar histórico de operações:", e);
    }
  }, [operations]);

  const addOperation = useCallback((op: Omit<RecentOperation, "id" | "timestamp">) => {
    const newEntry: RecentOperation = {
      ...op,
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    setOperations((prev) => [newEntry, ...prev.slice(0, 19)]);
    return newEntry;
  }, []);

  const clearOperations = useCallback(() => {
    setOperations([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar falha de storage
    }
  }, []);

  return {
    operations,
    addOperation,
    clearOperations,
  };
}
