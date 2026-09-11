import type { CommandRequest, CommandResponse, DocumentCoreCommand } from "@nexohub/contracts";
import { BrowserDocumentCorePort } from "./browser-document-core";
import { TauriDocumentCorePort } from "./tauri-document-core";

export interface DocumentCorePort {
  invoke<Command extends DocumentCoreCommand>(
    command: Command,
    request: CommandRequest<Command>,
  ): Promise<CommandResponse<Command>>;
}

export class UnavailableDocumentCorePort implements DocumentCorePort {
  async invoke<Command extends DocumentCoreCommand>(
    _command: Command,
    _request: CommandRequest<Command>,
  ): Promise<CommandResponse<Command>> {
    throw new Error("DOCUMENT_CORE_UNAVAILABLE");
  }
}

let browserPortSingleton: BrowserDocumentCorePort | null = null;

export function createDocumentCorePort(): DocumentCorePort {
  if (typeof window !== "undefined" && window.__TAURI_INTERNALS__) {
    return new TauriDocumentCorePort();
  }
  if (!browserPortSingleton) {
    browserPortSingleton = new BrowserDocumentCorePort();
  }
  return browserPortSingleton;
}
