export type Brand<Value, Name extends string> = Value & { readonly __brand: Name };

export type ProjectId = Brand<string, "ProjectId">;
export type DocumentId = Brand<string, "DocumentId">;
export type ArtifactId = Brand<string, "ArtifactId">;
export type RepresentationId = Brand<string, "RepresentationId">;
export type AssetId = Brand<string, "AssetId">;
export type OverlayId = Brand<string, "OverlayId">;
export type OperationId = Brand<string, "OperationId">;
export type ExportId = Brand<string, "ExportId">;

export type Timestamp = number;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface Project {
  readonly id: ProjectId;
  readonly name: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export interface Document {
  readonly id: DocumentId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

export type ArtifactKind = "ORIGINAL" | "DERIVED" | "EXPORT";

export interface Artifact {
  readonly id: ArtifactId;
  readonly documentId: DocumentId;
  readonly kind: ArtifactKind;
  readonly mimeType: string;
  readonly hash: string;
  readonly size: number;
  readonly storagePath: string;
  readonly createdAt: Timestamp;
}

export type RepresentationType =
  | "PDF"
  | "TEXT"
  | "MARKDOWN"
  | "OCR"
  | "DOCLING_JSON"
  | "LEXICAL_JSON";

export interface Representation {
  readonly id: RepresentationId;
  readonly artifactId: ArtifactId;
  readonly representationType: RepresentationType;
  readonly createdAt: Timestamp;
}

export type AssetKind = "IMAGE" | "TABLE" | "ATTACHMENT" | "FONT";

export interface Asset {
  readonly id: AssetId;
  readonly artifactId: ArtifactId;
  readonly kind: AssetKind;
  readonly mimeType: string;
  readonly hash: string;
  readonly size: number;
  readonly storagePath: string;
  readonly createdAt: Timestamp;
}

export interface Overlay {
  readonly id: OverlayId;
  readonly artifactId: ArtifactId;
  readonly kind: string;
  readonly data: JsonValue;
  readonly createdAt: Timestamp;
}

export type OperationStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

export interface OperationFailure {
  readonly code: string;
  readonly message: string;
}

export interface Operation {
  readonly id: OperationId;
  readonly toolId: string;
  readonly status: OperationStatus;
  readonly parameters: JsonValue;
  readonly createdAt: Timestamp;
  readonly startedAt?: Timestamp;
  readonly finishedAt?: Timestamp;
  readonly error?: OperationFailure;
}

export interface OperationInput {
  readonly operationId: OperationId;
  readonly artifactId: ArtifactId;
}

export interface OperationOutput {
  readonly operationId: OperationId;
  readonly artifactId: ArtifactId;
}

export interface Export {
  readonly id: ExportId;
  readonly documentId: DocumentId;
  readonly artifactId: ArtifactId;
  readonly destinationName: string;
  readonly createdAt: Timestamp;
}

export interface ImportedDocument {
  readonly document: Document;
  readonly artifact: Artifact;
}

function asIdentifier<Value extends string>(value: string, label: string): Brand<string, Value> {
  if (value.trim().length === 0) {
    throw new DomainError("INVALID_IDENTIFIER", `O identificador de ${label} é obrigatório.`);
  }
  return value as Brand<string, Value>;
}

export const asProjectId = (value: string): ProjectId => asIdentifier(value, "projeto");
export const asDocumentId = (value: string): DocumentId => asIdentifier(value, "documento");
export const asArtifactId = (value: string): ArtifactId => asIdentifier(value, "artifact");
export const asRepresentationId = (value: string): RepresentationId =>
  asIdentifier(value, "representação");
export const asAssetId = (value: string): AssetId => asIdentifier(value, "asset");
export const asOverlayId = (value: string): OverlayId => asIdentifier(value, "overlay");
export const asOperationId = (value: string): OperationId => asIdentifier(value, "operação");
export const asExportId = (value: string): ExportId => asIdentifier(value, "exportação");

export class DomainError extends Error {
  constructor(
    readonly code: "INVALID_IDENTIFIER" | "DUPLICATE_ENTITY" | "BROKEN_REFERENCE",
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
