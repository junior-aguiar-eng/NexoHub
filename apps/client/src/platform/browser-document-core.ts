import type {
  AuditProjectRequest,
  CapabilityId,
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
  DocxInspectionResult,
  ExecuteOcrRequest,
  ExtractInformationRequest,
  ExtractInformationResult,
  ExtractPdfImagesRequest,
  ExtractPdfImagesResult,
  ImportDocumentRequest,
  IntegrityAuditReport,
  LanguageToolMatch,
  ListAnchorsRequest,
  ListArtifactsRequest,
  ListDocumentsRequest,
  ListPdfOverlaysRequest,
  ListTranslationModelsRequest,
  ListTranslationModelsResult,
  OpenProjectRequest,
  OrganizePdfRequest,
  PdfToolResult,
  PickDocumentFileResult,
  PickProjectFolderResult,
  ReviewTextRequest,
  ReviewTextResult,
  TextToolResult,
  TranslateTextRequest,
  TranslateTextResult,
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
  reviewText,
} from "@nexohub/domain";
import {
  getStoredCapabilities,
  saveStoredCapabilities,
} from "@/features/capabilities/useCapabilities";
import { performBrowserOcr } from "./browser-ocr";
import {
  compressPdfBytes,
  createZipArchive,
  extractJpegsFromPdfAsync,
  reorganizePdfBytes,
} from "./browser-pdf-utils";
import { translateTextLocally } from "./browser-translation";
import type { DocumentCorePort } from "./document-core";

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
  return `sha256-${Date.now()}`;
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
        const data = this.getData(req.projectPath);
        const file = this.pendingFiles.get(req.sourcePath);

        const docId = asDocumentId(`doc-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`);
        const artId = asArtifactId(`art-orig-${Date.now()}`);

        const doc: Document = {
          id: docId,
          projectId: data.project.id,
          title:
            req.title || file?.name || req.sourcePath.split("/").pop() || "Documento Importado",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        const size = file?.size ?? 120000;
        let hash = `blake3-${Date.now()}`;
        if (file) {
          try {
            const buf = await file.arrayBuffer();
            hash = await computeSha256Hex(buf);
          } catch {
            hash = `sha256-${Date.now()}`;
          }
        }

        const artifact: Artifact = {
          id: artId,
          documentId: docId,
          kind: "ORIGINAL",
          mimeType: req.mimeType || file?.type || "application/pdf",
          hash,
          size,
          storagePath: `artifacts/${docId}/${artId}.bin`,
          createdAt: Date.now(),
        };

        data.documents.push(doc);
        data.artifacts.push(artifact);

        if (file) {
          this.artifactBlobs.set(artId, file);
        } else {
          // Se for mock/teste, cria um blob mínimo de fallback
          this.artifactBlobs.set(
            artId,
            new Blob([`Documento ${doc.title}`], { type: artifact.mimeType }),
          );
        }

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

        const newArtId = asArtifactId(`art-cmp-${Date.now()}`);
        let newSize = 50000;
        let compressedBlob: Blob | null = null;
        let compHash = `blake3-${Math.random().toString(16).slice(2, 18)}`;

        if (parentBlob) {
          const buffer = new Uint8Array(await parentBlob.arrayBuffer());
          const compLevel =
            req.compressionLevel === 3
              ? "extreme"
              : req.compressionLevel === 1
                ? "less"
                : "recommended";
          const res = await compressPdfBytes(buffer, compLevel);
          compressedBlob = new Blob([res.bytes as unknown as BlobPart], {
            type: "application/pdf",
          });
          newSize = compressedBlob.size;
          compHash = await computeSha256Hex(res.bytes);
          this.artifactBlobs.set(newArtId, compressedBlob);
        } else {
          const originalSize = parentArt?.size ?? 500000;
          const reductionRatio = Math.max(0.35, 1 - req.compressionLevel * 0.08);
          newSize = Math.floor(originalSize * reductionRatio);
        }

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

        const newArtId = asArtifactId(`art-org-${Date.now()}`);
        let newSize = parentArt?.size ?? 150000;
        let orgHash = `blake3-${Math.random().toString(16).slice(2, 18)}`;

        if (parentBlob) {
          const buffer = new Uint8Array(await parentBlob.arrayBuffer());
          const pageOrders = (req.pageOrder || [1]).map((pg) => ({
            originalIndex: pg,
            rotation: req.rotationDegrees ?? 0,
          }));
          const organizedBytes = await reorganizePdfBytes(buffer, pageOrders);
          const organizedBlob = new Blob([organizedBytes as unknown as BlobPart], {
            type: "application/pdf",
          });
          newSize = organizedBlob.size;
          orgHash = await computeSha256Hex(organizedBytes);
          this.artifactBlobs.set(newArtId, organizedBlob);
        }

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
        const req = request as ExtractPdfImagesRequest;
        const data = this.getData(req.projectPath);

        const newArtId = asArtifactId(`art-img-zip-${Date.now()}`);
        const inputBlob = this.artifactBlobs.get(req.artifactId);
        let extractedImages: import("./browser-pdf-utils").ExtractedImageItem[] = [];
        let zipBase64 = "";
        let zipHash = `blake3-${Math.random().toString(16).slice(2, 18)}`;
        let zipSize = 15420;

        if (inputBlob) {
          const buffer = new Uint8Array(await inputBlob.arrayBuffer());
          const allFound = await extractJpegsFromPdfAsync(buffer);
          const minW = req.minWidth ?? 0;
          const minH = req.minHeight ?? 0;
          extractedImages = allFound.filter((img) => img.width >= minW && img.height >= minH);

          if (extractedImages.length > 0) {
            const filesForZip = extractedImages.map((img, idx) => {
              const binaryStr = atob(img.dataBase64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let b = 0; b < binaryStr.length; b++) {
                bytes[b] = binaryStr.charCodeAt(b);
              }
              return {
                name: `imagem_${idx + 1}.${img.format.toLowerCase()}`,
                data: bytes,
              };
            });

            const zipBytes = createZipArchive(filesForZip);
            let zipStr = "";
            const chunkSize = 8192;
            for (let c = 0; c < zipBytes.length; c += chunkSize) {
              const chunk = zipBytes.subarray(c, Math.min(c + chunkSize, zipBytes.length));
              zipStr += String.fromCharCode.apply(null, Array.from(chunk));
            }
            zipBase64 = btoa(zipStr);
            zipHash = await computeSha256Hex(zipBytes);
            zipSize = zipBytes.length;

            this.artifactBlobs.set(
              newArtId,
              new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" }),
            );
          }
        }

        const newArt: Artifact = {
          id: newArtId,
          documentId: req.documentId,
          kind: "DERIVED",
          mimeType: "application/zip",
          hash: zipHash,
          size: zipSize,
          storagePath: `artifacts/${req.documentId}/${newArtId}.zip`,
          createdAt: Date.now(),
        };

        const opId = asOperationId(`op-img-${Date.now()}`);
        const op: Operation = {
          id: opId,
          toolId: "pdf-extract-images",
          status: "SUCCEEDED",
          createdAt: Date.now(),
          parameters: {
            pageNumbers: req.pageNumbers ?? [],
            minWidth: req.minWidth ?? 0,
            minHeight: req.minHeight ?? 0,
          },
        };

        data.artifacts.push(newArt);
        data.operations.push(op);
        data.edges.push({
          operationId: opId,
          toolId: "pdf-extract-images",
          inputArtifactId: req.artifactId,
          outputArtifactId: newArtId,
          parameters: {},
          createdAt: Date.now(),
        });

        const result: ExtractPdfImagesResult = {
          totalImages: extractedImages.length,
          pagesScanned: 1,
          images: extractedImages,
          zipBase64,
          artifact: newArt,
          operation: op,
        };
        return result as CommandResponse<Command>;
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
        const req = request as ReviewTextRequest;
        const findings = reviewText(req.text);
        const matches: LanguageToolMatch[] = findings.map((f) => ({
          message: f.message,
          shortMessage: f.message,
          offset: f.start,
          length: f.end - f.start,
          replacements: f.replacement ? [{ value: f.replacement }] : [],
          rule: {
            id: f.id,
            description: f.message,
            issueType: f.severity === "warning" ? "typographical" : "grammar",
          },
        }));
        const result: ReviewTextResult = {
          language: "pt-BR",
          engine: "languagetool-community",
          version: "6.9-SNAPSHOT",
          matches,
        };
        return result as CommandResponse<Command>;
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
        const req = request as AuditProjectRequest;
        const data = this.getData(req.projectPath);
        const total = data.artifacts.length;
        const report: IntegrityAuditReport = {
          totalArtifacts: total,
          validArtifacts: total,
          corruptedArtifacts: [],
          missingBlobs: [],
          isHealthy: true,
        };
        return report as CommandResponse<Command>;
      }

      case "list_capabilities": {
        const items = getStoredCapabilities();
        return { capabilities: items } as CommandResponse<Command>;
      }

      case "install_capability": {
        const req = request as { capabilityId: CapabilityId };
        const items = getStoredCapabilities();
        const updated = items.map((c) =>
          c.id === req.capabilityId ? { ...c, status: "installed" as const } : c,
        );
        saveStoredCapabilities(updated);
        return {
          success: true,
          message: "Superpoder ativado no navegador!",
        } as CommandResponse<Command>;
      }

      case "uninstall_capability": {
        const req = request as { capabilityId: CapabilityId };
        const items = getStoredCapabilities();
        const target = items.find((c) => c.id === req.capabilityId);
        const updated = items.map((c) =>
          c.id === req.capabilityId ? { ...c, status: "not_installed" as const } : c,
        );
        saveStoredCapabilities(updated);
        return {
          success: true,
          freedBytes: target?.diskSizeBytes || 50000000,
        } as CommandResponse<Command>;
      }

      case "cancel_capability_download": {
        return { success: true } as CommandResponse<Command>;
      }

      case "inspect_docx": {
        const result: DocxInspectionResult = {
          title: "Documento DOCX Inspecionado",
          paragraphs: [
            { text: "Primeiro parágrafo do documento DOCX importado.", style: "Normal" },
            { text: "Segundo parágrafo com termos contratuais.", style: "Heading1" },
          ],
          tables: [],
        };
        return result as CommandResponse<Command>;
      }

      case "create_docx": {
        return {
          artifact: {
            id: asArtifactId(`art-docx-${Date.now()}`),
            documentId: asDocumentId("doc-docx"),
            kind: "DERIVED",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            hash: `blake3-${Math.random().toString(16).slice(2, 18)}`,
            size: 24500,
            storagePath: "artifacts/doc-docx/art-docx.docx",
            createdAt: Date.now(),
          },
          operation: {
            id: asOperationId(`op-docx-${Date.now()}`),
            toolId: "docx-create",
            status: "SUCCEEDED",
            createdAt: Date.now(),
            parameters: {},
          },
        } as CommandResponse<Command>;
      }

      case "execute_ocr": {
        const req = request as ExecuteOcrRequest;
        const data = this.getData(req.projectPath);
        const inputBlob =
          this.artifactBlobs.get(req.artifactId) ||
          new Blob(["Documento de Exemplo"], { type: "text/plain" });

        const ocrOutcome = await performBrowserOcr(inputBlob, "por");
        const textBlob = new Blob([ocrOutcome.text], { type: "text/plain;charset=utf-8" });
        const textHash = await computeSha256Hex(await textBlob.arrayBuffer());

        const newArtId = asArtifactId(`art-ocr-${Date.now()}`);
        const newArt: Artifact = {
          id: newArtId,
          documentId: req.documentId,
          kind: "DERIVED",
          mimeType: "text/plain",
          hash: textHash,
          size: textBlob.size,
          storagePath: `artifacts/${req.documentId}/${newArtId}.txt`,
          createdAt: Date.now(),
        };

        const opId = asOperationId(`op-ocr-${Date.now()}`);
        const op: Operation = {
          id: opId,
          toolId: "pdf-ocr",
          status: "SUCCEEDED",
          createdAt: Date.now(),
          parameters: { engine: ocrOutcome.engine },
        };

        data.artifacts.push(newArt);
        data.operations.push(op);
        data.edges.push({
          operationId: opId,
          toolId: "pdf-ocr",
          inputArtifactId: req.artifactId,
          outputArtifactId: newArtId,
          parameters: {},
          createdAt: Date.now(),
        });

        this.artifactBlobs.set(newArtId, textBlob);

        return {
          text: ocrOutcome.text,
          pages: ocrOutcome.pages,
          lines: ocrOutcome.lines,
          engine: ocrOutcome.engine,
          artifact: newArt,
          operation: op,
        } as CommandResponse<Command>;
      }

      case "translate_text": {
        const req = request as TranslateTextRequest;
        const sourceLang = req.sourceLanguage || "en";
        const targetLang = req.targetLanguage || "pt";
        const translatedContent = translateTextLocally(req.text, sourceLang, targetLang);
        const segmentsCount = req.text.split("\n").filter((s) => s.trim().length > 0).length || 1;

        let derivedArtifact: Artifact | undefined;
        let derivedOperation: Operation | undefined;

        if (req.projectPath && req.documentId && req.artifactId) {
          const data = this.getData(req.projectPath);
          const newArtId = asArtifactId(`art-trans-${Date.now()}`);
          const textBlob = new Blob([translatedContent], { type: "text/plain;charset=utf-8" });
          const textHash = await computeSha256Hex(await textBlob.arrayBuffer());

          derivedArtifact = {
            id: newArtId,
            documentId: req.documentId,
            kind: "DERIVED",
            mimeType: "text/plain",
            hash: textHash,
            size: textBlob.size,
            storagePath: `artifacts/${req.documentId}/${newArtId}.txt`,
            createdAt: Date.now(),
          };

          const opId = asOperationId(`op-trans-${Date.now()}`);
          derivedOperation = {
            id: opId,
            toolId: "text-translate",
            status: "SUCCEEDED",
            createdAt: Date.now(),
            parameters: { sourceLang, targetLang },
          };

          data.artifacts.push(derivedArtifact);
          data.operations.push(derivedOperation);
          data.edges.push({
            operationId: opId,
            toolId: "text-translate",
            inputArtifactId: req.artifactId,
            outputArtifactId: newArtId,
            parameters: { sourceLang, targetLang },
            createdAt: Date.now(),
          });

          this.artifactBlobs.set(newArtId, textBlob);
        }

        const result: TranslateTextResult = {
          text: translatedContent,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
          modelId: "nexohub-opus-mt-local",
          segments: segmentsCount,
          artifact: derivedArtifact,
          operation: derivedOperation,
        };
        return result as CommandResponse<Command>;
      }

      case "list_translation_models": {
        const _req = request as ListTranslationModelsRequest;
        const items = getStoredCapabilities();
        const hasTranslator = items.some(
          (c) => c.id === "translation.neural" && c.status === "installed",
        );
        const result: ListTranslationModelsResult = {
          models: hasTranslator
            ? [
                {
                  modelId: "opus-mt-tc-big-en-pt",
                  name: "OPUS-MT TC Big Inglês para Português",
                  family: "opus-mt",
                  sourceLanguages: ["en"],
                  targetLanguages: ["pt", "pt-BR"],
                  license: "CC-BY-4.0",
                  isReady: true,
                },
              ]
            : [],
        };
        return result as CommandResponse<Command>;
      }

      case "extract_information": {
        const req = request as ExtractInformationRequest;
        const text = req.text || "Exemplo de documento para extração estruturada.";
        const result: ExtractInformationResult = {
          text,
          markdown: `### Resumo da Extração\n- Caracteres: ${text.length}\n- Palavras: ${text.split(/\s+/).length}`,
          mode: req.mode || "all",
          metrics: {
            charCount: text.length,
            wordCount: text.split(/\s+/).length,
            lineCount: text.split("\n").length,
            pageCount: 1,
            language: "pt-BR",
          },
          entities: [],
          keyValues: {},
          tables: [],
          sections: [],
        };
        return result as CommandResponse<Command>;
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
