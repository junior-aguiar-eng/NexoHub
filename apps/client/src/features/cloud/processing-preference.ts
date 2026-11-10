import { useEffect, useState } from "react";

export type ProcessingPreference = "local-first" | "hybrid";

const STORAGE_KEY = "nexohub.cloud.processingPreference";
const DEFAULT_PREFERENCE: ProcessingPreference = "local-first";

let memoryFallback: ProcessingPreference | null = null;
const listeners = new Set<(pref: ProcessingPreference) => void>();

function safeGetStorage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function resetProcessingPreferenceMemory(): void {
  memoryFallback = null;
}

export function getProcessingPreference(): ProcessingPreference {
  const storage = safeGetStorage();
  if (storage) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw === "local-first" || raw === "hybrid") {
        return raw;
      }
    } catch {
      // Ignora falhas de leitura no storage
    }
  }

  return memoryFallback ?? DEFAULT_PREFERENCE;
}

export function setProcessingPreference(preference: ProcessingPreference): void {
  memoryFallback = preference;
  const storage = safeGetStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, preference);
    } catch {
      // Ignora falhas de escrita no storage (ex: modo anônimo)
    }
  }

  listeners.forEach((listener) => {
    try {
      listener(preference);
    } catch {
      // Ignora falha de listener
    }
  });
}

export function useProcessingPreference(): [
  ProcessingPreference,
  (pref: ProcessingPreference) => void,
] {
  const [preference, setPreference] = useState<ProcessingPreference>(() =>
    getProcessingPreference(),
  );

  useEffect(() => {
    const handler = (next: ProcessingPreference) => {
      setPreference(next);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return [preference, setProcessingPreference];
}
