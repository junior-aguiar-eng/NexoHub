import type { CommandRequest, CommandResponse, DocumentCoreCommand } from "@nexohub/contracts";
import { withAppBase } from "./app-paths";
import { BrowserDocumentCorePort } from "./browser-document-core";
import { HttpDocumentCorePort } from "./http-document-core";
import { TauriDocumentCorePort } from "./tauri-document-core";

export { BrowserDocumentCorePort, HttpDocumentCorePort, TauriDocumentCorePort };

export interface DocumentCorePort {
  readonly supportedToolIds: ReadonlySet<string>;
  /** Motor que atende idioma, contraste e PDF pesquisável na superfície atual. */
  readonly ocrEngine?: "browser" | "core";
  readonly translationEngine?: "browser" | "core";
  saveOutputFile?(request: { blob: Blob; fileName: string }): Promise<boolean>;
  registerUploadedFile?(file: File): { path: string; name: string; mimeType: string };
  executePdfTool?(request: {
    toolId: "pdf-compress" | "pdf-organize";
    file: File;
    pageOrder?: readonly number[];
    pageRotations?: readonly number[];
    compressionLevel?: "less" | "recommended" | "extreme";
  }): Promise<Blob>;
  persistLauncherResult?(request: {
    toolId:
      | "pdf-merge"
      | "pdf-split"
      | "pdf-rotate"
      | "text-compare"
      | "images-to-pdf"
      | "pdf-to-jpg"
      | "pdf-watermark"
      | "pdf-page-numbers"
      | "pdf-ocr"
      | "text-translate"
      | "text-review";
    files: readonly File[];
    output: Blob;
    parameters: Readonly<Record<string, unknown>>;
  }): Promise<Blob>;
  invoke<Command extends DocumentCoreCommand>(
    command: Command,
    request: CommandRequest<Command>,
  ): Promise<CommandResponse<Command>>;
  getArtifactBlobUrl?(artifactId: string): string | null;
  getArtifactBlob?(artifactId: string): Blob | null;
  revokeArtifactBlobUrl?(artifactId: string): void;
  revokeAllBlobUrls?(): void;
}

export class UnavailableDocumentCorePort implements DocumentCorePort {
  readonly supportedToolIds = new Set<string>();
  async invoke<Command extends DocumentCoreCommand>(
    _command: Command,
    _request: CommandRequest<Command>,
  ): Promise<CommandResponse<Command>> {
    throw new Error("DOCUMENT_CORE_UNAVAILABLE");
  }
}

let browserPortSingleton: BrowserDocumentCorePort | null = null;
let httpPortSingleton: HttpDocumentCorePort | null = null;

export function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.__TAURI_INTERNALS__ || (window as unknown as { __TAURI__?: unknown }).__TAURI__)
  );
}

export function isHttpBackendConfigured(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as {
    __NEXOHUB_BACKEND_URL__?: string;
    __NEXOHUB_WEB_MODE__?: boolean;
  };
  return Boolean(win.__NEXOHUB_BACKEND_URL__ || win.__NEXOHUB_WEB_MODE__);
}

export function createDocumentCorePort(
  forceMode?: "tauri" | "http" | "browser",
  httpBaseUrl?: string,
): DocumentCorePort {
  if (forceMode === "tauri" || (!forceMode && isTauriEnvironment())) {
    return new TauriDocumentCorePort();
  }
  if (forceMode === "http" || (!forceMode && isHttpBackendConfigured())) {
    if (!httpPortSingleton || httpBaseUrl) {
      httpPortSingleton = new HttpDocumentCorePort(
        httpBaseUrl ??
          (typeof window !== "undefined"
            ? ((window as unknown as { __NEXOHUB_BACKEND_URL__?: string })
                .__NEXOHUB_BACKEND_URL__ ?? withAppBase("").replace(/\/$/, ""))
            : withAppBase("").replace(/\/$/, "")),
      );
    }
    return httpPortSingleton;
  }
  if (!browserPortSingleton) {
    browserPortSingleton = new BrowserDocumentCorePort();
  }
  return browserPortSingleton;
}
