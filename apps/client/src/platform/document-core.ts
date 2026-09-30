import type { CommandRequest, CommandResponse, DocumentCoreCommand } from "@nexohub/contracts";
import { BrowserDocumentCorePort } from "./browser-document-core";
import { TauriDocumentCorePort } from "./tauri-document-core";

export interface DocumentCorePort {
  readonly supportedToolIds: ReadonlySet<string>;
  saveOutputFile?(request: { blob: Blob; fileName: string }): Promise<boolean>;
  registerUploadedFile?(file: File): { path: string; name: string; mimeType: string };
  executePdfTool?(request: {
    toolId: "pdf-compress" | "pdf-organize";
    file: File;
    pageOrder?: readonly number[];
    compressionLevel?: "less" | "recommended" | "extreme";
  }): Promise<Blob>;
  persistLauncherResult?(request: {
    toolId: "pdf-merge" | "pdf-split" | "pdf-rotate" | "text-compare";
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

export function isTauriEnvironment(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.__TAURI_INTERNALS__ || (window as unknown as { __TAURI__?: unknown }).__TAURI__)
  );
}

export function createDocumentCorePort(): DocumentCorePort {
  if (isTauriEnvironment()) {
    return new TauriDocumentCorePort();
  }
  if (!browserPortSingleton) {
    browserPortSingleton = new BrowserDocumentCorePort();
  }
  return browserPortSingleton;
}
