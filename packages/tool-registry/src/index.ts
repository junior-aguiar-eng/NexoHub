import { type ToolManifest, ToolRegistry } from "@nexohub/tool-sdk";

const pdfCapabilities = ["documents.read", "documents.write", "pdf.transform"] as const;

export const coreToolManifests = [
  {
    id: "pdf-organize",
    version: "1.0.0",
    name: "Organizar PDF",
    category: "pdf",
    surfaces: ["quick", "studio"],
    accepts: ["application/pdf"],
    produces: ["application/pdf"],
    capabilities: pdfCapabilities,
    executor: "native",
  },
  {
    id: "pdf-compress",
    version: "1.0.0",
    name: "Comprimir PDF",
    category: "pdf",
    surfaces: ["quick", "studio"],
    accepts: ["application/pdf"],
    produces: ["application/pdf"],
    capabilities: pdfCapabilities,
    executor: "native",
  },
  {
    id: "pdf-ocr",
    version: "1.0.0",
    name: "OCR em PDF",
    category: "pdf",
    surfaces: ["quick", "studio"],
    accepts: ["application/pdf", "image/*"],
    produces: ["text/plain", "application/pdf"],
    capabilities: ["documents.read", "documents.write", "ocr.execute"],
    executor: "python",
  },
  {
    id: "text-compare",
    version: "1.0.0",
    name: "Comparar textos",
    category: "text",
    surfaces: ["quick", "studio"],
    accepts: ["text/plain"],
    produces: ["application/vnd.nexohub.diff+json"],
    capabilities: ["documents.read", "documents.write", "text.compare"],
    executor: "browser",
  },
  {
    id: "text-review",
    version: "1.0.0",
    name: "Revisar texto",
    category: "text",
    surfaces: ["quick", "studio"],
    accepts: ["text/plain"],
    produces: ["text/plain"],
    capabilities: ["documents.read", "documents.write", "text.review"],
    executor: "browser",
  },
  {
    id: "text-translate",
    version: "1.0.0",
    name: "Traduzir texto",
    category: "text",
    surfaces: ["quick", "studio"],
    accepts: ["text/plain", "text/markdown"],
    produces: ["text/plain"],
    capabilities: ["documents.read", "documents.write", "translation.execute"],
    executor: "python",
  },
  {
    id: "intelligence-extract",
    version: "1.0.0",
    name: "Extrair informações",
    category: "intelligence",
    surfaces: ["quick", "studio"],
    accepts: ["text/plain", "application/pdf"],
    produces: ["application/json"],
    capabilities: ["documents.read", "documents.write", "intelligence.extract"],
    executor: "python",
  },
] as const satisfies readonly ToolManifest[];

export function createCoreToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const manifest of coreToolManifests) registry.register(manifest);
  return registry;
}

export const coreToolRegistry = createCoreToolRegistry();
