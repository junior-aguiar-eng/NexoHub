import type { CommandRequest, CommandResponse, DocumentCoreCommand } from "@nexohub/contracts";
import type { DocumentCorePort } from "./document-core";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
    };
  }
}

export class TauriDocumentCorePort implements DocumentCorePort {
  async invoke<Command extends DocumentCoreCommand>(
    command: Command,
    request: CommandRequest<Command>,
  ): Promise<CommandResponse<Command>> {
    const tauri = window.__TAURI_INTERNALS__;
    if (!tauri || typeof tauri.invoke !== "function") {
      throw new Error("DOCUMENT_CORE_UNAVAILABLE");
    }

    return await tauri.invoke<CommandResponse<Command>>(command, {
      request,
    });
  }
}
