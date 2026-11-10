import "./polyfills";
import fs from "node:fs";
import path from "node:path";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Polyfill de localStorage para compatibilidade com Node.js 22/26+ no ambiente JSDOM
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    get length() {
      return map.size;
    },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
  };
}

try {
  const store = createMemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: store,
    writable: true,
    configurable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: store,
      writable: true,
      configurable: true,
    });
  }
} catch {
  // Preserva se não for redefinível
}

afterEach(() => cleanup());

// Carregador de dicionários pt-BR para ambiente Vitest/jsdom
(
  globalThis as unknown as {
    __nexohub_dict_loader__?: () => Promise<{ aff: Uint8Array; dic: Uint8Array }>;
  }
).__nexohub_dict_loader__ = async () => {
  const candidateAffPaths = [
    path.resolve(process.cwd(), "public/dictionaries/pt-BR/pt_BR.aff"),
    path.resolve(process.cwd(), "apps/client/public/dictionaries/pt-BR/pt_BR.aff"),
  ];
  const candidateDicPaths = [
    path.resolve(process.cwd(), "public/dictionaries/pt-BR/pt_BR.dic"),
    path.resolve(process.cwd(), "apps/client/public/dictionaries/pt-BR/pt_BR.dic"),
  ];

  const affPath = candidateAffPaths.find((p) => fs.existsSync(p));
  const dicPath = candidateDicPaths.find((p) => fs.existsSync(p));

  if (!affPath || !dicPath) {
    throw new Error(
      "Não foi possível localizar os arquivos de dicionário pt-BR no ambiente de teste.",
    );
  }

  return {
    aff: new Uint8Array(fs.readFileSync(affPath)),
    dic: new Uint8Array(fs.readFileSync(dicPath)),
  };
};
