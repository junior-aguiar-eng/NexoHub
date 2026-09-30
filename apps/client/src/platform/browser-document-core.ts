import type {
  CommandRequest,
  CommandResponse,
  CompressPdfRequest,
  CreateAnchorRequest,
  CreatePdfOverlayRequest,
  CreateProjectRequest,
  CreateTextRevisionRequest,
  DocumentCoreCommand,
  DocumentLineage,
  DocumentLineageEdge,
  ImportDocumentRequest,
  ListAnchorsRequest,
  ListArtifactsRequest,
  ListDocumentsRequest,
  ListPdfOverlaysRequest,
  OpenProjectRequest,
  OrganizePdfRequest,
  PdfToolResult,
  PickDocumentFileResult,
  PickProjectFolderResult,
  TextToolResult,
} from "@nexohub/contracts";
import {
  type Anchor,
  type Artifact,
  asAnchorId,
  asArtifactId,
  asDocumentId,
  asOperationId,
  asOverlayId,
  asProjectId,
  type Document,
  type DocumentId,
  type Operation,
  type Overlay,
  type Project,
} from "@nexohub/domain";
import { DEFAULT_CAPABILITIES } from "@/features/capabilities/useCapabilities";
import type { DocumentCorePort } from "./document-core";
import { compressPdfDocument, reorganizePdfDocument } from "./pdf-engine";

async function computeSha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      let buffer: ArrayBuffer;
      if (typeof data === "string") {
        buffer = new TextEncoder().encode(data).buffer;
      } else if (data instanceof Uint8Array) {
        buffer = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength,
        ) as ArrayBuffer;
      } else {
        buffer = data;
      }
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fallback
    }
  }
  throw new Error("HASH_UNAVAILABLE");
}

interface StoredProjectData {
  project: Project & { path: string };
  documents: Document[];
  artifacts: Artifact[];
  operations: Operation[];
  edges: DocumentLineageEdge[];
  overlays: Overlay[];
  anchors: Anchor[];
}

export class BrowserDocumentCorePort implements DocumentCorePort {
  readonly supportedToolIds: ReadonlySet<string> = new Set([
    "pdf-organize",
    "pdf-merge",
    "pdf-split",
    "pdf-rotate",
    "pdf-compress",
    "text-compare",
  ]);
  private projectData: Map<string, StoredProjectData> = new Map();
  private pendingFiles: Map<string, File> = new Map();
  private artifactBlobs: Map<string, Blob> = new Map();
  private createdBlobUrls: Map<string, string> = new Map();
  private blobUrlAccessQueue: string[] = [];
  private static readonly MAX_ACTIVE_BLOB_URLS = 35;
  private activeProjectPath: string | null = null;

  constructor() {
    this.ensureDefaultProject();
  }

  getArtifactBlob(artifactId: string): Blob | null {
    return this.artifactBlobs.get(artifactId) || null;
  }

  getArtifactBlobUrl(artifactId: string): string | null {
    const blob = this.artifactBlobs.get(artifactId);
    if (!blob) return null;
    const existing = this.createdBlobUrls.get(artifactId);
    if (existing) {
      // Move para o final da fila de acesso (LRU)
      this.blobUrlAccessQueue = this.blobUrlAccessQueue.filter((id) => id !== artifactId);
      this.blobUrlAccessQueue.push(artifactId);
      return existing;
    }

    // Se ultrapassou o limite do cache de URLs, revoga a mais antiga
    if (this.createdBlobUrls.size >= BrowserDocumentCorePort.MAX_ACTIVE_BLOB_URLS) {
      const oldestId = this.blobUrlAccessQueue.shift();
      if (oldestId) {
        const oldUrl = this.createdBlobUrls.get(oldestId);
        if (oldUrl) {
          try {
            URL.revokeObjectURL(oldUrl);
          } catch {
            // Safe fallback
          }
          this.createdBlobUrls.delete(oldestId);
        }
      }
    }

    const url = URL.createObjectURL(blob);
    this.createdBlobUrls.set(artifactId, url);
    this.blobUrlAccessQueue.push(artifactId);
    return url;
  }

  revokeArtifactBlobUrl(artifactId: string): void {
    const existing = this.createdBlobUrls.get(artifactId);
    if (existing) {
      try {
        URL.revokeObjectURL(existing);
      } catch {
        // Safe fallback
      }
      this.createdBlobUrls.delete(artifactId);
      this.blobUrlAccessQueue = this.blobUrlAccessQueue.filter((id) => id !== artifactId);
    }
  }

  revokeAllBlobUrls(): void {
    for (const url of this.createdBlobUrls.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // Safe fallback
      }
    }
    this.createdBlobUrls.clear();
    this.blobUrlAccessQueue = [];
  }

  getActiveProjectPath(): string | null {
    return this.activeProjectPath;
  }

  private ensureDefaultProject(): StoredProjectData {
    const defaultPath = "/meus-documentos/pasta-local";
    let data = this.projectData.get(defaultPath);
    if (!data) {
      const project: Project & { path: string } = {
        id: asProjectId("proj-local"),
        name: "Meus Documentos",
        path: defaultPath,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      data = {
        project,
        documents: [],
        artifacts: [],
        operations: [],
        edges: [],
        overlays: [],
        anchors: [],
      };
      this.projectData.set(defaultPath, data);
      this.activeProjectPath = defaultPath;
    }
    return data;
  }

  private getData(path: string): StoredProjectData {
    let data = this.projectData.get(path);
    if (!data) {
      data = {
        project: {
          id: asProjectId(`proj-${Date.now()}`),
          name: "Novo Projeto",
          path,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        documents: [],
        artifacts: [],
        operations: [],
        edges: [],
        overlays: [],
        anchors: [],
      };
      this.projectData.set(path, data);
    }
    return data;
  }

  registerUploadedFile(file: File): { path: string; name: string; mimeType: string } {
    const path = file.name;
    this.pendingFiles.set(path, file);
    return {
      path,
      name: file.name,
      mimeType: file.type || "application/pdf",
    };
  }

  async invoke<Command extends DocumentCoreCommand>(
    command: Command,
    request: CommandRequest<Command>,
  ): Promise<CommandResponse<Command>> {
    switch (command) {
      case "pick_project_folder": {
        const data = this.ensureDefaultProject();
        const result: PickProjectFolderResult = {
          path: data.project.path,
          name: data.project.name,
        };
        return result as CommandResponse<Command>;
      }

      case "open_project": {
        const req = request as OpenProjectRequest;
        const data = this.getData(req.projectPath);
        this.activeProjectPath = data.project.path;
        return data.project as CommandResponse<Command>;
      }

      case "create_project": {
        const req = request as CreateProjectRequest;
        const data = this.getData(req.projectPath);
        data.project = {
          id: asProjectId(`proj-${Date.now()}`),
          name: req.name,
          path: req.projectPath,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.activeProjectPath = data.project.path;
        return data.project as CommandResponse<Command>;
      }

      case "pick_document_file": {
        if (typeof document === "undefined") {
          return null as CommandResponse<Command>;
        }
        const file = await new Promise<File | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept =
            ".pdf,.docx,.txt,.md,.json,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,application/json";
          input.style.display = "none";
          document.body.appendChild(input);

          input.onchange = () => {
            const picked = input.files?.[0] || null;
            document.body.removeChild(input);
            resolve(picked);
          };

          input.oncancel = () => {
            document.body.removeChild(input);
            resolve(null);
          };

          input.click();
        });

        if (!file) {
          return null as CommandResponse<Command>;
        }

        const registered = this.registerUploadedFile(file);
        const result: PickDocumentFileResult = {
          path: registered.path,
          name: registered.name,
          mimeType: registered.mimeType,
        };
        return result as CommandResponse<Command>;
      }

      case "import_document": {
        const req = request as ImportDocumentRequest;
        const file = this.pendingFiles.get(req.sourcePath);
        if (!file) throw new Error("DOCUMENT_NOT_FOUND");
        const data = this.getData(req.projectPath);

        const docId = asDocumentId(`doc-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`);
        const artId = asArtifactId(`art-orig-${Date.now()}`);

        const doc: Document = {
          id: docId,
          projectId: data.project.id,
          title: req.title || file.name || req.sourcePath.split("/").pop() || "Documento Importado",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const size = file.size;
        const hash = await computeSha256Hex(await file.arrayBuffer());

        const artifact: Artifact = {
          id: artId,
          documentId: docId,
          kind: "ORIGINAL",
          mimeType: req.mimeType || file.type || "application/pdf",
          hash,
          size,
          storagePath: `artifacts/${docId}/${artId}.bin`,
          createdAt: Date.now(),
        };

        data.documents.push(doc);
        data.artifacts.push(artifact);

        this.artifactBlobs.set(artId, file);

        return {
          document: doc,
          artifact,
        } as CommandResponse<Command>;
      }

      case "list_documents": {
        const req = request as ListDocumentsRequest;
        const data = this.getData(req.projectPath);
        return data.documents as CommandResponse<Command>;
      }

      case "get_document": {
        const req = request as { readonly projectPath: string; readonly documentId: DocumentId };
        const data = this.getData(req.projectPath);
        const doc = data.documents.find((d) => d.id === req.documentId);
        if (!doc) {
          throw new Error(`Documento não encontrado: ${req.documentId}`);
        }
        return doc as CommandResponse<Command>;
      }

      case "list_artifacts": {
        const req = request as ListArtifactsRequest;
        const data = this.getData(req.projectPath);
        const arts = data.artifacts.filter((a) => a.documentId === req.documentId);
        return arts as CommandResponse<Command>;
      }

      case "compress_pdf": {
        const req = request as CompressPdfRequest;
        const data = this.getData(req.projectPath);
        const parentArt = data.artifacts.find((a) => a.id === req.artifactId);
        const parentBlob = this.artifactBlobs.get(req.artifactId);
        if (!parentArt || !parentBlob || parentArt.documentId !== req.documentId) {
          throw new Error("ARTIFACT_NOT_FOUND");
        }

        const newArtId = asArtifactId(`art-cmp-${Date.now()}`);
        const buffer = new Uint8Array(await parentBlob.arrayBuffer());
        const compressed = await compressPdfDocument(
          buffer,
          req.compressionLevel >= 7
            ? "extreme"
            : req.compressionLevel <= 3
              ? "less"
              : "recommended",
        );
        const compressedBlob = new Blob([compressed.bytes as unknown as BlobPart], {
          type: "application/pdf",
        });
        const newSize = compressedBlob.size;
        const compHash = await computeSha256Hex(compressed.bytes);
        this.artifactBlobs.set(newArtId, compressedBlob);

        const newArt: Artifact = {
          id: newArtId,
          documentId: req.documentId,
          kind: "DERIVED",
          mimeType: "application/pdf",
          hash: compHash,
          size: newSize,
          storagePath: `artifacts/${req.documentId}/${newArtId}.pdf`,
          createdAt: Date.now(),
        };

        const opId = asOperationId(`op-cmp-${Date.now()}`);
        const op: Operation = {
          id: opId,
          toolId: "pdf-compress",
          status: "SUCCEEDED",
          parameters: { compressionLevel: req.compressionLevel },
          createdAt: Date.now(),
        };

        data.artifacts.push(newArt);
        data.operations.push(op);
        data.edges.push({
          operationId: opId,
          toolId: "pdf-compress",
          inputArtifactId: req.artifactId,
          outputArtifactId: newArtId,
          parameters: { compressionLevel: req.compressionLevel },
          createdAt: Date.now(),
        });

        const result: PdfToolResult = {
          artifact: newArt,
          operation: op,
        };
        return result as CommandResponse<Command>;
      }

      case "organize_pdf": {
        const req = request as OrganizePdfRequest;
        const data = this.getData(req.projectPath);
        const parentArt = data.artifacts.find((a) => a.id === req.artifactId);
        const parentBlob = this.artifactBlobs.get(req.artifactId);
        if (!parentArt || !parentBlob || parentArt.documentId !== req.documentId) {
          throw new Error("ARTIFACT_NOT_FOUND");
        }
        if (req.pageOrder.length === 0) throw new Error("INVALID_PAGE_ORDER");

        const newArtId = asArtifactId(`art-org-${Date.now()}`);
        const buffer = new Uint8Array(await parentBlob.arrayBuffer());
        const pageOrders = req.pageOrder.map((pg) => ({
          originalIndex: pg,
          rotation: req.rotationDegrees ?? 0,
        }));
        const organizedBytes = await reorganizePdfDocument(buffer, pageOrders);
        const organizedBlob = new Blob([organizedBytes as unknown as BlobPart], {
          type: "application/pdf",
        });
        const newSize = organizedBlob.size;
        const orgHash = await computeSha256Hex(organizedBytes);
        this.artifactBlobs.set(newArtId, organizedBlob);

        const newArt: Artifact = {
          id: newArtId,
          documentId: req.documentId,
          kind: "DERIVED",
          mimeType: "application/pdf",
          hash: orgHash,
          size: newSize,
          storagePath: `artifacts/${req.documentId}/${newArtId}.pdf`,
          createdAt: Date.now(),
        };

        const opId = asOperationId(`op-org-${Date.now()}`);
        const op: Operation = {
          id: opId,
          toolId: "pdf-organize",
          status: "SUCCEEDED",
          createdAt: Date.now(),
          parameters: { pageOrder: req.pageOrder, rotationDegrees: req.rotationDegrees ?? 0 },
        };

        data.artifacts.push(newArt);
        data.operations.push(op);
        data.edges.push({
          operationId: opId,
          toolId: "pdf-organize",
          inputArtifactId: req.artifactId,
          outputArtifactId: newArtId,
          parameters: { pageOrder: req.pageOrder },
          createdAt: Date.now(),
        });

        const result: PdfToolResult = {
          artifact: newArt,
          operation: op,
        };
        return result as CommandResponse<Command>;
      }

      case "extract_pdf_images": {
        throw new Error("TOOL_UNAVAILABLE");
      }

      case "create_text_revision": {
        const req = request as CreateTextRevisionRequest;
        const data = this.getData(req.projectPath);

        const newArtId = asArtifactId(`art-rev-${Date.now()}`);
        const newArt: Artifact = {
          id: newArtId,
          documentId: req.documentId,
          kind: "DERIVED",
          mimeType: "text/plain",
          hash: `blake3-${Math.random().toString(16).slice(2, 18)}`,
          size: new Blob([req.content]).size,
          storagePath: `artifacts/${req.documentId}/${newArtId}.txt`,
          createdAt: Date.now(),
        };

        const opId = asOperationId(`op-rev-${Date.now()}`);
        const op: Operation = {
          id: opId,
          toolId: "text-review",
          status: "SUCCEEDED",
          createdAt: Date.now(),
          parameters: { length: req.content.length },
        };

        data.artifacts.push(newArt);
        data.operations.push(op);
        data.edges.push({
          operationId: opId,
          toolId: "text-review",
          inputArtifactId: req.artifactId,
          outputArtifactId: newArtId,
          parameters: {},
          createdAt: Date.now(),
        });

        const result: TextToolResult = {
          artifact: newArt,
          operation: op,
        };
        return result as CommandResponse<Command>;
      }

      case "review_text": {
        throw new Error("REVIEW_UNAVAILABLE");
      }

      case "get_document_lineage": {
        const req = request as { readonly projectPath: string; readonly documentId: DocumentId };
        const data = this.getData(req.projectPath);
        const arts = data.artifacts.filter((a) => a.documentId === req.documentId);
        const lineage: DocumentLineage = {
          documentId: req.documentId,
          artifacts: arts,
          edges: data.edges,
        };
        return lineage as CommandResponse<Command>;
      }

      case "audit_project": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "list_capabilities": {
        return { capabilities: DEFAULT_CAPABILITIES } as CommandResponse<Command>;
      }

      case "install_capability": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "uninstall_capability": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "cancel_capability_download": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "inspect_docx": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "create_docx": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "execute_ocr": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "translate_text": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "list_translation_models": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "extract_information": {
        throw new Error("CAPABILITY_NOT_FOUND");
      }

      case "create_pdf_overlay": {
        const req = request as CreatePdfOverlayRequest;
        const data = this.getData(req.projectPath);
        const overlay: Overlay = {
          id: asOverlayId(`ovl-${Date.now()}`),
          artifactId: req.artifactId,
          kind: req.kind,
          data: {
            pageNumber: req.pageNumber,
            x: req.x,
            y: req.y,
            width: req.width,
            height: req.height,
            payload: req.payload,
          },
          createdAt: Date.now(),
        };
        data.overlays.push(overlay);
        return overlay as CommandResponse<Command>;
      }

      case "list_pdf_overlays": {
        const req = request as ListPdfOverlaysRequest;
        const data = this.getData(req.projectPath);
        const overlays = data.overlays.filter((o) => o.artifactId === req.artifactId);
        return overlays as CommandResponse<Command>;
      }

      case "create_anchor": {
        const req = request as CreateAnchorRequest;
        const data = this.getData(req.projectPath);
        const anchor: Anchor = {
          id: asAnchorId(`anc-${Date.now()}`),
          artifactId: req.artifactId,
          kind:
            req.selector.type === "TEXT_RANGE"
              ? "TEXT_RANGE"
              : req.selector.type === "PDF_REGION"
                ? "PDF_REGION"
                : "OCR_LINE",
          selector: req.selector,
          quote: req.quote,
          createdAt: Date.now(),
        };
        data.anchors.push(anchor);
        return anchor as CommandResponse<Command>;
      }

      case "list_anchors": {
        const req = request as ListAnchorsRequest;
        const data = this.getData(req.projectPath);
        const anchors = data.anchors.filter((a) => a.artifactId === req.artifactId);
        return anchors as CommandResponse<Command>;
      }

      default:
        throw new Error(`Comando IPC não implementado no navegador: ${String(command)}`);
    }
  }
}
