import { coreToolRegistry } from "@nexohub/tool-registry";

/**
 * Conjunto canônico de identificadores de ferramentas ativas no NexoHub.
 * Derivado diretamente do Tool Registry oficial.
 */
export const activeToolIds: ReadonlySet<string> = new Set(
  coreToolRegistry.list("quick").map((manifest) => manifest.id),
);

/**
 * Ferramentas suportadas no contexto de navegador local (PWA/Website).
 * Todas as ferramentas do catálogo ativo possuem execução local (WebAssembly/Canvas/Workers).
 */
export const browserSupportedToolIds: ReadonlySet<string> = activeToolIds;

/**
 * Ferramentas suportadas no aplicativo desktop (Tauri/Windows).
 * Possui paridade total com o navegador, adicionando persistência documental local no SQLite/BLAKE3.
 */
export const tauriSupportedToolIds: ReadonlySet<string> = activeToolIds;

/**
 * Ferramentas suportadas via adapter HTTP Document Core.
 */
export const httpSupportedToolIds: ReadonlySet<string> = activeToolIds;
