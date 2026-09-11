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
  | "SIDECAR_TIMEOUT"
  | "PERMISSION_DENIED"
  | "CAPABILITY_NOT_FOUND"
  | "CAPABILITY_INSTALLATION_FAILED";

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

export interface OrganizePdfRequest {
  readonly projectPath: string;
  readonly documentId: DocumentId;
  readonly artifactId: ArtifactId;
  readonly pageOrder: readonly number[];
  readonly rotationDegrees?: number;
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

export interface PickProjectFolderRequest {
  readonly defaultPath?: string;
}

export interface PickProjectFolderResult {
  readonly path: string;
  readonly name: string;
}

export interface PickDocumentFileRequest {
  readonly defaultPath?: string;
  readonly mimeTypes?: readonly string[];
}

export interface PickDocumentFileResult {
  readonly path: string;
  readonly name: string;
  readonly mimeType: string;
}

export interface ExecuteOcrRequest {
  readonly projectPath: string;
  readonly documentId: DocumentId;
  readonly artifactId: ArtifactId;
}

export interface OcrLineResult {
  readonly pageNumber: number;
  readonly text: string;
  readonly confidence: number;
  readonly bounds: readonly [number, number, number, number];
}

export interface OcrToolResult {
  readonly text: string;
  readonly pages: number;
  readonly lines: readonly OcrLineResult[];
  readonly engine: string;
  readonly artifact: Artifact;
  readonly operation: Operation;
}

export interface InspectDocxRequest {
  readonly projectPath: string;
  readonly documentId: DocumentId;
  readonly artifactId: ArtifactId;
}

export interface DocxParagraphResult {
  readonly text: string;
  readonly style: string;
}

export interface DocxInspectionResult {
  readonly paragraphs: readonly DocxParagraphResult[];
  readonly tables: readonly (readonly (readonly string[])[])[];
  readonly title: string | null;
}

export interface CreateDocxRequest {
  readonly projectPath: string;
  readonly documentId?: DocumentId;
  readonly name: string;
  readonly title?: string;
  readonly paragraphs?: readonly { readonly text: string; readonly style?: string }[];
  readonly tables?: readonly (readonly (readonly string[])[])[];
}

export interface CreateDocxResult {
  readonly artifact: Artifact;
  readonly operation?: Operation;
}

export interface TranslationModelInfo {
  readonly modelId: string;
  readonly name: string;
  readonly family: string;
  readonly sourceLanguages: readonly string[];
  readonly targetLanguages: readonly string[];
  readonly license: string;
  readonly isReady: boolean;
}

export interface ListTranslationModelsRequest {
  readonly projectPath?: string;
}

export interface ListTranslationModelsResult {
  readonly models: readonly TranslationModelInfo[];
}

export interface TranslateTextRequest {
  readonly text: string;
  readonly sourceLanguage?: string;
  readonly targetLanguage: string;
  readonly modelId?: string;
  readonly projectPath?: string;
  readonly documentId?: DocumentId;
  readonly artifactId?: ArtifactId;
}

export interface TranslateTextResult {
  readonly text: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly modelId: string;
  readonly segments: number;
  readonly artifact?: Artifact;
  readonly operation?: Operation;
}

export interface ExtractedEntity {
  readonly category: string;
  readonly value: string;
  readonly normalizedValue: string;
  readonly confidence: number;
  readonly count: number;
}

export interface ExtractedTable {
  readonly title?: string;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface ExtractedSection {
  readonly title: string;
  readonly level: number;
  readonly lineNumber: number;
}

export interface ExtractionMetrics {
  readonly charCount: number;
  readonly wordCount: number;
  readonly lineCount: number;
  readonly pageCount: number;
  readonly language: string;
}

export interface ExtractInformationRequest {
  readonly projectPath?: string;
  readonly documentId?: DocumentId;
  readonly artifactId?: ArtifactId;
  readonly text?: string;
  readonly mode?: "all" | "entities" | "key_values" | "tables" | "sections" | string;
}

export interface ExtractInformationResult {
  readonly text: string;
  readonly markdown?: string;
  readonly mode: string;
  readonly metrics: ExtractionMetrics;
  readonly entities: readonly ExtractedEntity[];
  readonly keyValues: Readonly<Record<string, string>>;
  readonly tables: readonly ExtractedTable[];
  readonly sections: readonly ExtractedSection[];
  readonly artifact?: Artifact;
  readonly operation?: Operation;
}

export interface CorruptedArtifactItem {
  readonly artifactId: ArtifactId;
  readonly expectedHash: string;
  readonly actualHash: string;
}

export interface IntegrityAuditReport {
  readonly totalArtifacts: number;
  readonly validArtifacts: number;
  readonly corruptedArtifacts: readonly CorruptedArtifactItem[];
  readonly missingBlobs: readonly ArtifactId[];
  readonly isHealthy: boolean;
}

export interface AuditProjectRequest {
  readonly projectPath: string;
}

export interface DocumentLineageEdge {
  readonly operationId: string;
  readonly toolId: string;
  readonly inputArtifactId: ArtifactId;
  readonly outputArtifactId: ArtifactId;
  readonly parameters: import("@nexohub/domain").JsonValue;
  readonly createdAt: number;
}

export interface DocumentLineage {
  readonly documentId: DocumentId;
  readonly artifacts: readonly Artifact[];
  readonly edges: readonly DocumentLineageEdge[];
}

export interface GetDocumentLineageRequest {
  readonly projectPath: string;
  readonly documentId: DocumentId;
}

export type CapabilityId =
  | "translation.neural"
  | "ocr.vision"
  | "text.deep_review"
  | "pdf.super_compress";

export type CapabilityStatus = "not_installed" | "downloading" | "installed" | "error";

export interface CapabilityItem {
  readonly id: CapabilityId;
  readonly title: string;
  readonly summary: string;
  readonly benefit: string;
  readonly category: "translation" | "vision" | "review" | "compression";
  readonly diskSizeBytes: number;
  readonly status: CapabilityStatus;
  readonly progressPercent?: number;
  readonly isOptional: boolean;
}

export interface CapabilityProgressEvent {
  readonly capabilityId: CapabilityId;
  readonly status: "downloading" | "verifying" | "extracting" | "ready" | "failed";
  readonly bytesDownloaded: number;
  readonly totalBytes: number;
  readonly progressPercent: number;
  readonly errorMessage?: string;
}

export interface ListCapabilitiesRequest {
  readonly category?: string;
}
export interface ListCapabilitiesResult {
  readonly capabilities: readonly CapabilityItem[];
}

export interface InstallCapabilityRequest {
  readonly capabilityId: CapabilityId;
}
export interface InstallCapabilityResult {
  readonly success: boolean;
  readonly message?: string;
}

export interface CancelCapabilityDownloadRequest {
  readonly capabilityId: CapabilityId;
}
export interface CancelCapabilityDownloadResult {
  readonly success: boolean;
}

export interface UninstallCapabilityRequest {
  readonly capabilityId: CapabilityId;
}
export interface UninstallCapabilityResult {
  readonly success: boolean;
  readonly freedBytes: number;
}

export interface DocumentCoreCommands {
  readonly audit_project: {
    readonly request: AuditProjectRequest;
    readonly response: IntegrityAuditReport;
  };
  readonly get_document_lineage: {
    readonly request: GetDocumentLineageRequest;
    readonly response: DocumentLineage;
  };
  readonly execute_ocr: {
    readonly request: ExecuteOcrRequest;
    readonly response: OcrToolResult;
  };
  readonly inspect_docx: {
    readonly request: InspectDocxRequest;
    readonly response: DocxInspectionResult;
  };
  readonly create_docx: {
    readonly request: CreateDocxRequest;
    readonly response: CreateDocxResult;
  };
  readonly translate_text: {
    readonly request: TranslateTextRequest;
    readonly response: TranslateTextResult;
  };
  readonly list_translation_models: {
    readonly request: ListTranslationModelsRequest;
    readonly response: ListTranslationModelsResult;
  };
  readonly extract_information: {
    readonly request: ExtractInformationRequest;
    readonly response: ExtractInformationResult;
  };
  readonly pick_project_folder: {
    readonly request: PickProjectFolderRequest;
    readonly response: PickProjectFolderResult | null;
  };
  readonly pick_document_file: {
    readonly request: PickDocumentFileRequest;
    readonly response: PickDocumentFileResult | null;
  };
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
  readonly organize_pdf: {
    readonly request: OrganizePdfRequest;
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
  readonly list_capabilities: {
    readonly request: ListCapabilitiesRequest;
    readonly response: ListCapabilitiesResult;
  };
  readonly install_capability: {
    readonly request: InstallCapabilityRequest;
    readonly response: InstallCapabilityResult;
  };
  readonly cancel_capability_download: {
    readonly request: CancelCapabilityDownloadRequest;
    readonly response: CancelCapabilityDownloadResult;
  };
  readonly uninstall_capability: {
    readonly request: UninstallCapabilityRequest;
    readonly response: UninstallCapabilityResult;
  };
}

export type DocumentCoreCommand = keyof DocumentCoreCommands;
export type CommandRequest<Command extends DocumentCoreCommand> =
  DocumentCoreCommands[Command]["request"];
export type CommandResponse<Command extends DocumentCoreCommand> =
  DocumentCoreCommands[Command]["response"];

export const contractsBoundary = "@nexohub/contracts" as const;
