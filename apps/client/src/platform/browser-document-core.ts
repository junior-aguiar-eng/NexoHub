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
import type { DocumentCorePort } from "./document-core";

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
  private activeProjectPath: string | null = null;

  constructor() {
    this.ensureDefaultProject();
  }

  getActiveProjectPath(): string | null {
    return this.activeProjectPath;
  }

  private ensureDefaultProject(): StoredProjectData {
    const defaultPath = "/meus-documentos/dossie-local";
    let data = this.projectData.get(defaultPath);
    if (!data) {
      const project: Project & { path: string } = {
        id: asProjectId("proj-local"),
        name: "Dossiê Pessoal e Jurídico",
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
        const hash = `blake3-${Math.random().toString(16).slice(2, 18)}`;

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

        const newArtId = asArtifactId(`art-cmp-${Date.now()}`);
        const originalSize = parentArt?.size ?? 500000;
        const reductionRatio = Math.max(0.35, 1 - req.compressionLevel * 0.08);
        const newSize = Math.floor(originalSize * reductionRatio);

        const newArt: Artifact = {
          id: newArtId,
          documentId: req.documentId,
          kind: "DERIVED",
          mimeType: "application/pdf",
          hash: `blake3-${Math.random().toString(16).slice(2, 18)}`,
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

        const newArtId = asArtifactId(`art-org-${Date.now()}`);
        const newArt: Artifact = {
          id: newArtId,
          documentId: req.documentId,
          kind: "DERIVED",
          mimeType: "application/pdf",
          hash: `blake3-${Math.random().toString(16).slice(2, 18)}`,
          size: parentArt?.size ?? 150000,
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
        const newArtId = asArtifactId(`art-ocr-${Date.now()}`);
        const newArt: Artifact = {
          id: newArtId,
          documentId: req.documentId,
          kind: "DERIVED",
          mimeType: "text/plain",
          hash: `blake3-${Math.random().toString(16).slice(2, 18)}`,
          size: 8192,
          storagePath: `artifacts/${req.documentId}/${newArtId}.txt`,
          createdAt: Date.now(),
        };
        data.artifacts.push(newArt);
        return {
          text: "Texto reconhecido via OCR local.\nParágrafo extraído do documento original.",
          pages: 1,
          lines: [
            {
              pageNumber: 1,
              text: "Texto reconhecido via OCR local.",
              confidence: 0.98,
              bounds: [10, 10, 200, 30],
            },
          ],
          engine: "tesseract-ocr-local",
          artifact: newArt,
          operation: {
            id: asOperationId(`op-ocr-${Date.now()}`),
            toolId: "pdf-ocr",
            status: "SUCCEEDED",
            createdAt: Date.now(),
            parameters: {},
          },
        } as CommandResponse<Command>;
      }

      case "translate_text": {
        const req = request as TranslateTextRequest;
        const result: TranslateTextResult = {
          text: `[Tradução para ${req.targetLanguage}]: ${req.text}`,
          sourceLanguage: req.sourceLanguage || "en",
          targetLanguage: req.targetLanguage,
          modelId: "opus-mt-tc-big-en-pt",
          segments: 1,
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
