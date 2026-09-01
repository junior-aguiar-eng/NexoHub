import type {
  Artifact,
  ArtifactId,
  Document,
  DocumentId,
  ImportedDocument,
  Operation,
  Overlay,
  Project,
} from "@nexohub/domain";

export type IpcErrorCode =
  | "INVALID_ARGUMENT"
  | "PROJECT_ALREADY_EXISTS"
  | "PROJECT_NOT_FOUND"
  | "DOCUMENT_NOT_FOUND"
  | "ARTIFACT_NOT_FOUND"
  | "STORAGE_IO"
  | "DATABASE"
  | "INTEGRITY_VIOLATION"
  | "MIGRATION_FAILED"
  | "PDF_PROCESSING";

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

export interface CompressPdfRequest {
  readonly projectPath: string;
  readonly documentId: DocumentId;
  readonly artifactId: ArtifactId;
  readonly compressionLevel: number;
}

export interface PdfToolResult {
  readonly artifact: Artifact;
  readonly operation: Operation;
}

export interface CreateTextRevisionRequest {
  readonly projectPath: string;
  readonly documentId: DocumentId;
  readonly artifactId: ArtifactId;
  readonly content: string;
}

export interface TextToolResult {
  readonly artifact: Artifact;
  readonly operation: Operation;
}

export type PdfOverlayKind = "HIGHLIGHT" | "NOTE" | "DRAWING";

export interface CreatePdfOverlayRequest {
  readonly projectPath: string;
  readonly artifactId: ArtifactId;
  readonly kind: PdfOverlayKind;
  readonly pageNumber: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly payload: import("@nexohub/domain").JsonValue;
}

export interface ListPdfOverlaysRequest {
  readonly projectPath: string;
  readonly artifactId: ArtifactId;
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
  readonly compress_pdf: {
    readonly request: CompressPdfRequest;
    readonly response: PdfToolResult;
  };
  readonly create_text_revision: {
    readonly request: CreateTextRevisionRequest;
    readonly response: TextToolResult;
  };
  readonly create_pdf_overlay: {
    readonly request: CreatePdfOverlayRequest;
    readonly response: Overlay;
  };
  readonly list_pdf_overlays: {
    readonly request: ListPdfOverlaysRequest;
    readonly response: readonly Overlay[];
  };
}

export type DocumentCoreCommand = keyof DocumentCoreCommands;
export type CommandRequest<Command extends DocumentCoreCommand> =
  DocumentCoreCommands[Command]["request"];
export type CommandResponse<Command extends DocumentCoreCommand> =
  DocumentCoreCommands[Command]["response"];

export const contractsBoundary = "@nexohub/contracts" as const;
