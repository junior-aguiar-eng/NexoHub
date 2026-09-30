import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const tauriHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 15000,
  },
});
