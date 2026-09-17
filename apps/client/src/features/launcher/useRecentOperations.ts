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
  categoryKey:
    | "recent.type.general"
    | "recent.type.document"
    | "recent.type.pdf"
    | "recent.type.procedural"
    | "recent.type.contracts"
    | "recent.type.opinion";
  artifactPath?: string;
  downloadUrl?: string;
}

const STORAGE_KEY = "nexohub:recent-operations:v2";
const LEGACY_STORAGE_KEY = "nexohub:recent-operations";

function isMockDocumentName(name: string): boolean {
  const n = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    n.includes("apresentacao") ||
    n.includes("relatorio") ||
    n.includes("digitalizado") ||
    n.includes("dossie") ||
    n.includes("peticao") ||
    n.includes("apelacao") ||
    n.includes("parecer") ||
    n.includes("minuta") ||
    n.includes("contrato")
  );
}

export function useRecentOperations() {
  const [operations, setOperations] = useState<RecentOperation[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      // Limpeza forçada de dados legados do storage antigo
      localStorage.removeItem(LEGACY_STORAGE_KEY);

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(
            (item) => item?.documentName && !isMockDocumentName(item.documentName),
          );
          if (clean.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
          }
          return clean;
        }
      }
    } catch (e) {
      console.warn("Falha ao ler histórico de operações:", e);
    }
    return [];
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
