import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const tauriHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "pdfjs-unlock-internals",
      enforce: "pre",
      transform(code, id) {
        if (id.includes("pdf.worker.mjs?nexohub-unlock-internals")) {
          return `${code}\nexport { LocalPdfManager, Ref, RefMap, incrementalUpdate, BaseStream, Dict, Name };`;
        }
      },
    },
    {
      name: "fix-hunspell-esm-interop",
      transform(code, id) {
        if (id.includes("hunspell-asm") || id.includes("emscripten-wasm-loader")) {
          const fixed = code
            .replace(/import\s+.*?\s+from\s+['"]nanoid['"];?/g, "import { nanoid } from 'nanoid';")
            .replace(/import\s+\*\s+as\s+runtime\s+from/g, "import runtime from")
            .replace(
              /import\s+\{\s*root\s*\}\s+from\s+['"]getroot['"];?/g,
              "const root = globalThis;",
            );
          return id.split("?")[0].replaceAll("\\", "/").endsWith("/lib/browser/hunspell.js")
            ? fixed.replace(/\nif \(typeof exports === [\s\S]*$/, "\nexport default Module;")
            : fixed;
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      nanoid: path.resolve(import.meta.dirname, "./src/shims/nanoid.ts"),
    },
  },
  // Estes módulos ESM antigos tratam imports namespace como funções.
  // A transformação acima precisa ocorrer antes de qualquer pré-bundle.
  optimizeDeps: { exclude: ["hunspell-asm", "emscripten-wasm-loader"] },
  clearScreen: false,
  server: {
    host: tauriHost || false,
    port: 5180,
    strictPort: Boolean(tauriHost),
    hmr: tauriHost
      ? {
          protocol: "ws",
          host: tauriHost,
          port: 5181,
        }
      : undefined,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // O parser de desbloqueio só é necessário ao executar essa ferramenta.
          if (id.includes("nexohub-unlock-internals")) return "pdf-unlock-internals";
          if (id.includes("pdfjs-dist")) {
            return "pdfjs";
          }
          if (id.includes("pdf-lib")) {
            return "pdf-lib";
          }
          if (id.includes("lucide-react")) {
            return "lucide";
          }
          if (id.includes("hunspell-asm")) {
            return "hunspell";
          }
        },
      },
    },
  },
  test: {
    server: { deps: { inline: [/pdfjs-dist/] } },
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 15000,
    pool: "threads",
  },
});
