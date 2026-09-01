import type { Artifact, Document, DocumentId, ImportedDocument, Project } from "@nexohub/domain";

export type IpcErrorCode =
  | "INVALID_ARGUMENT"
  | "PROJECT_ALREADY_EXISTS"
  | "PROJECT_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "ARTIFACT_NOT_FOUND"
  | "STORAGE_IO"
  | "DATABASE"
  | "INTEGRITY_VIOLATION"
  | "MIGRATION_FAILED";

export interface IpcError {
  readonly code: IpcErrorCode;
  readonly message: string;
}

export interface CreateProjectRequest {
  readonly projectPath: string;
  readonly name: string;
}

export interface OpenProjectRequest {
  readonly projectPath: string;
}

export interface ImportDocumentRequest {
  readonly projectPath: string;
  readonly sourcePath: string;
  readonly title?: string;
  readonly mimeType: string;
}

export interface ListDocumentsRequest {
  readonly projectPath: string;
}

export interface GetDocumentRequest {
  readonly projectPath: string;
  readonly documentId: DocumentId;
}

export interface ListArtifactsRequest {
  readonly projectPath: string;
  readonly documentId: DocumentId;
}

export interface DocumentCoreCommands {
  readonly create_project: {
    readonly request: CreateProjectRequest;
    readonly response: Project;
  };
  readonly open_project: {
    readonly request: OpenProjectRequest;
    readonly response: Project;
  };
  readonly import_document: {
    readonly request: ImportDocumentRequest;
    readonly response: ImportedDocument;
  };
  readonly list_documents: {
    readonly request: ListDocumentsRequest;
    readonly response: readonly Document[];
  };
  readonly get_document: {
    readonly request: GetDocumentRequest;
    readonly response: Document;
  };
  readonly list_artifacts: {
    readonly request: ListArtifactsRequest;
    readonly response: readonly Artifact[];
  };
}

export type DocumentCoreCommand = keyof DocumentCoreCommands;
export type CommandRequest<Command extends DocumentCoreCommand> =
  DocumentCoreCommands[Command]["request"];
export type CommandResponse<Command extends DocumentCoreCommand> =
  DocumentCoreCommands[Command]["response"];

export const contractsBoundary = "@nexohub/contracts" as const;
