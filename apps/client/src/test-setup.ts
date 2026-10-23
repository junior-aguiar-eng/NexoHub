import fs from "node:fs";
import path from "node:path";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// Polyfill de Uint8Array.prototype.toHex exigido por pdfjs-dist em ambientes Node.js/Vitest
const uint8Proto = Uint8Array.prototype as unknown as { toHex?: () => string };
if (typeof uint8Proto.toHex !== "function") {
  Object.defineProperty(Uint8Array.prototype, "toHex", {
    value: function toHex(this: Uint8Array): string {
      return Array.from(this, (byte) => byte.toString(16).padStart(2, "0")).join("");
    },
    writable: true,
    configurable: true,
  });
}

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
