import type { CommandRequest, CommandResponse, DocumentCoreCommand } from "@nexohub/contracts";

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
