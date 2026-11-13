import { coreToolRegistry } from "@nexohub/tool-registry";
import type { ToolPlatformAvailability } from "@nexohub/tool-sdk";

const quickManifests = coreToolRegistry.list("quick");

/**
 * Conjunto canônico de identificadores de ferramentas registradas no catálogo do NexoHub.
 */
export const activeToolIds: ReadonlySet<string> = new Set(
  quickManifests.map((manifest) => manifest.id),
);

/**
 * Ferramentas 100% locais em navegador offline (WebAssembly/Canvas/Workers).
 */
export const universalBrowserToolIds: ReadonlySet<string> = new Set(
  quickManifests
    .filter((manifest) => !manifest.availability || manifest.availability === "universal")
    .map((manifest) => manifest.id),
);

/**
 * Conjunto de ferramentas disponíveis no navegador offline (PWA/Website sem backend híbrido).
 * Ferramentas que dependem de Superpoder Desktop ou Nuvem Opcional não aparecem como locais offline.
 */
export const browserSupportedToolIds: ReadonlySet<string> = universalBrowserToolIds;

/**
 * Ferramentas suportadas no aplicativo desktop (Tauri/Windows).
 * Inclui todas as ferramentas universais além das que exigem Superpoderes instaláveis localmente.
 */
export const tauriSupportedToolIds: ReadonlySet<string> = activeToolIds;

/**
 * Ferramentas suportadas via adapter HTTP Document Core (Web Híbrida).
 * Exclui ferramentas exclusivas de Superpoder Desktop quando não há rota equivalente em nuvem.
 */
export const httpSupportedToolIds: ReadonlySet<string> = new Set(
  quickManifests
    .filter((manifest) => manifest.availability !== "desktop-superpower")
    .map((manifest) => manifest.id),
);

export const OFFICE_TOOL_IDS: ReadonlySet<string> = new Set([
  "word-to-pdf",
  "excel-to-pdf",
  "powerpoint-to-pdf",
  "pdf-to-powerpoint",
]);

export function isOfficeToolId(toolId: string): boolean {
  return OFFICE_TOOL_IDS.has(toolId);
}

export function getToolPlatformAvailability(toolId: string): ToolPlatformAvailability {
  return coreToolRegistry.get(toolId)?.availability ?? "universal";
}
