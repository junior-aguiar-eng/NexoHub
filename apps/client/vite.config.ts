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
      name: "fix-hunspell-asm-nanoid",
      transform(code, id) {
        if (id.includes("hunspell-asm") || id.includes("emscripten-wasm-loader")) {
          return code.replace(
            /import\s+\*\s+as\s+nanoid\s+from\s+['"]nanoid['"];?/g,
            "import nanoidPkg from 'nanoid'; const nanoid = typeof nanoidPkg === 'function' ? nanoidPkg : (nanoidPkg?.nanoid || nanoidPkg?.default || ((len = 21) => Array.from({length: len}, () => Math.floor(Math.random() * 36).toString(36)).join('')));",
          );
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
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
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 15000,
    pool: "threads",
  },
});
