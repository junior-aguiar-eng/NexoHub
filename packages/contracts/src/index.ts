import type {
  Anchor,
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
  | "PROJECT_CORRUPTED"
  | "INTEGRITY_VIOLATION"
  | "MIGRATION_FAILED"
  | "RESOURCE_LIMIT"
  | "PDF_PROCESSING"
  | "REVIEW_UNAVAILABLE"
  | "REVIEW_PROCESSING"
  | "SIDECAR_TIMEOUT";

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

export interface ReviewTextRequest {
  readonly text: string;
}

export interface LanguageToolMatch {
  readonly message: string;
  readonly shortMessage: string;
  readonly offset: number;
  readonly length: number;
  readonly replacements: readonly { readonly value: string }[];
  readonly rule: {
    readonly id: string;
    readonly description: string;
    readonly issueType: string;
  };
}

export interface ReviewTextResult {
  readonly language: "pt-BR";
  readonly engine: "languagetool-community";
  readonly version: string;
  readonly matches: readonly LanguageToolMatch[];
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

export type AnchorSelector =
  | { readonly type: "TEXT_RANGE"; readonly start: number; readonly end: number }
  | {
      readonly type: "PDF_REGION";
      readonly pageNumber: number;
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    }
  | { readonly type: "OCR_LINE"; readonly pageNumber: number; readonly lineIndex: number };

export interface CreateAnchorRequest {
  readonly projectPath: string;
  readonly artifactId: ArtifactId;
  readonly selector: AnchorSelector;
  readonly quote?: string;
}

export interface ListAnchorsRequest {
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
  readonly review_text: {
    readonly request: ReviewTextRequest;
    readonly response: ReviewTextResult;
  };
  readonly create_pdf_overlay: {
    readonly request: CreatePdfOverlayRequest;
    readonly response: Overlay;
  };
  readonly list_pdf_overlays: {
    readonly request: ListPdfOverlaysRequest;
    readonly response: readonly Overlay[];
  };
  readonly create_anchor: {
    readonly request: CreateAnchorRequest;
    readonly response: Anchor;
  };
  readonly list_anchors: {
    readonly request: ListAnchorsRequest;
    readonly response: readonly Anchor[];
  };
}

export type DocumentCoreCommand = keyof DocumentCoreCommands;
export type CommandRequest<Command extends DocumentCoreCommand> =
  DocumentCoreCommands[Command]["request"];
export type CommandResponse<Command extends DocumentCoreCommand> =
  DocumentCoreCommands[Command]["response"];

export const contractsBoundary = "@nexohub/contracts" as const;
