import type {
  CommandRequest,
  CommandResponse,
  DocumentCoreCommand,
  PdfToolResult,
} from "@nexohub/contracts";
import type { ImportedDocument } from "@nexohub/domain";
import { ToolRunError } from "@nexohub/tool-sdk";
import type { DocumentCorePort } from "./document-core";

export class HttpDocumentCorePort implements DocumentCorePort {
  readonly ocrEngine = "browser" as const;
  readonly translationEngine = "browser" as const;
  readonly supportedToolIds: ReadonlySet<string> = new Set([
    "pdf-organize",
    "pdf-merge",
    "pdf-split",
    "pdf-rotate",
    "pdf-crop",
    "pdf-sign",
    "pdf-compress",
    "text-compare",
    "images-to-pdf",
    "pdf-to-jpg",
    "pdf-watermark",
    "pdf-page-numbers",
    "pdf-ocr",
    "text-review",
    "text-translate",
    "pdf-extract-images",
    "pdf-to-markdown",
    "pdf-form-fill",
    "pdf-unlock",
  ]);

  private project: { path: string; name: string } | null = null;
  private projectRequest: Promise<{ path: string; name: string }> | null = null;
  private sessionToken: string | null = null;
  private sessionProjectPath: string | null = null;
  private sessionRequest: Promise<CommandResponse<"pick_project_folder">> | null = null;
  private readonly pendingFiles = new Map<string, File>();
  private readonly artifactBlobs = new Map<string, Blob>();
  private readonly createdBlobUrls = new Map<string, string>();
  private blobUrlAccessQueue: string[] = [];
  private static readonly MAX_ACTIVE_BLOB_URLS = 35;

  constructor(private readonly baseUrl: string = "") {}

  async saveOutputFile(request: { blob: Blob; fileName: string }): Promise<boolean> {
    if (typeof document === "undefined") {
      return false;
    }
    const url = URL.createObjectURL(request.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = request.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return true;
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

  getArtifactBlob(artifactId: string): Blob | null {
    return this.artifactBlobs.get(artifactId) || null;
  }

  getArtifactBlobUrl(artifactId: string): string | null {
    const blob = this.artifactBlobs.get(artifactId);
    if (!blob) return null;
    const existing = this.createdBlobUrls.get(artifactId);
    if (existing) {
      this.blobUrlAccessQueue = this.blobUrlAccessQueue.filter((id) => id !== artifactId);
      this.blobUrlAccessQueue.push(artifactId);
      return existing;
    }

    if (this.createdBlobUrls.size >= HttpDocumentCorePort.MAX_ACTIVE_BLOB_URLS) {
      const oldestId = this.blobUrlAccessQueue.shift();
      if (oldestId) {
        const oldUrl = this.createdBlobUrls.get(oldestId);
        if (oldUrl) {
          try {
            URL.revokeObjectURL(oldUrl);
          } catch {
            // Ignora erro de revogação
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
        // Ignora erro de revogação
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
        // Ignora erro de revogação
      }
    }
    this.createdBlobUrls.clear();
    this.blobUrlAccessQueue = [];
  }

  async ensureProject(): Promise<{ path: string; name: string }> {
    if (this.project) return this.project;
    if (this.projectRequest) return this.projectRequest;
    const pending = this.initializeProject();
    this.projectRequest = pending;
    try {
      return await pending;
    } finally {
      if (this.projectRequest === pending) this.projectRequest = null;
    }
  }

  private async initializeProject(): Promise<{ path: string; name: string }> {
    if (!this.project) {
      const folder = (await this.invoke("pick_project_folder", {})) as {
        path: string;
        name: string;
      };
      if (!folder?.path) {
        throw new ToolRunError("EXECUTION_FAILED", "Falha ao alocar sessão no servidor.");
      }
      const projectPath = folder.path;
      try {
        await this.invoke("open_project", { projectPath });
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "PROJECT_NOT_FOUND") {
          throw error;
        }
        await this.invoke("create_project", { projectPath, name: folder.name || "NexoHub Web" });
      }
      this.project = { path: projectPath, name: folder.name || "NexoHub Web" };
    }
    return this.project;
  }

  async executePdfTool(request: {
    toolId: "pdf-compress" | "pdf-organize";
    file: File;
    pageOrder?: readonly number[];
    pageRotations?: readonly number[];
    compressionLevel?: "less" | "recommended" | "extreme";
  }): Promise<Blob> {
    const project = await this.ensureProject();
    const buffer = await request.file.arrayBuffer();
    const imported = (await this.invoke("import_document_bytes", {
      projectPath: project.path,
      title: request.file.name,
      mimeType: "application/pdf",
      bytes: Array.from(new Uint8Array(buffer)),
    })) as ImportedDocument;

    const result = (
      request.toolId === "pdf-compress"
        ? await this.invoke("compress_pdf", {
            projectPath: project.path,
            documentId: imported.document.id,
            artifactId: imported.artifact.id,
            compressionLevel:
              request.compressionLevel === "extreme"
                ? 9
                : request.compressionLevel === "less"
                  ? 3
                  : 6,
          })
        : await this.invoke("organize_pdf", {
            projectPath: project.path,
            documentId: imported.document.id,
            artifactId: imported.artifact.id,
            pageOrder: request.pageOrder ?? [],
            pageRotations: request.pageRotations,
          })
    ) as PdfToolResult;

    const bytes = (await this.invoke("read_artifact_bytes", {
      projectPath: project.path,
      artifactId: result.artifact.id,
    })) as number[] | Uint8Array;

    const blob = new Blob(
      [(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)) as unknown as BlobPart],
      { type: "application/pdf" },
    );
    this.artifactBlobs.set(result.artifact.id, blob);
    return blob;
  }

  async persistLauncherResult(request: {
    toolId:
      | "pdf-merge"
      | "pdf-split"
      | "pdf-rotate"
      | "text-compare"
      | "images-to-pdf"
      | "pdf-to-jpg"
      | "pdf-watermark"
      | "pdf-page-numbers"
      | "pdf-ocr";
    files: readonly File[];
    output: Blob;
    parameters: Readonly<Record<string, unknown>>;
  }): Promise<Blob> {
    const project = await this.ensureProject();
    const importedList: ImportedDocument[] = [];
    for (const file of request.files) {
      const buffer = await file.arrayBuffer();
      const mimeType =
        file.type ||
        (request.toolId === "text-compare"
          ? "text/plain"
          : request.toolId === "images-to-pdf"
            ? "image/jpeg"
            : "application/pdf");
      const imported = (await this.invoke("import_document_bytes", {
        projectPath: project.path,
        title: file.name,
        mimeType,
        bytes: Array.from(new Uint8Array(buffer)),
      })) as ImportedDocument;
      importedList.push(imported);
    }

    const outputMimeType = request.output.type.split(";")[0].trim().toLowerCase();
    const mimeType =
      request.toolId === "text-compare"
        ? "text/plain"
        : outputMimeType === "application/zip"
          ? "application/zip"
          : outputMimeType === "image/jpeg"
            ? "image/jpeg"
            : outputMimeType === "text/plain"
              ? "text/plain"
              : "application/pdf";

    const outBytes = Array.from(new Uint8Array(await request.output.arrayBuffer()));
    const result = (await this.invoke("record_launcher_result", {
      projectPath: project.path,
      documentId: importedList[0].document.id,
      inputArtifactIds: importedList.map((i) => i.artifact.id),
      toolId: request.toolId,
      mimeType,
      bytes: outBytes,
      parameters: request.parameters,
    })) as PdfToolResult;

    const bytes = (await this.invoke("read_artifact_bytes", {
      projectPath: project.path,
      artifactId: result.artifact.id,
    })) as number[] | Uint8Array;

    const blob = new Blob(
      [(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)) as unknown as BlobPart],
      { type: mimeType },
    );
    this.artifactBlobs.set(result.artifact.id, blob);
    return blob;
  }

  async invoke<Command extends DocumentCoreCommand>(
    command: Command,
    request: CommandRequest<Command>,
  ): Promise<CommandResponse<Command>> {
    if (command === "pick_project_folder") {
      this.sessionRequest ??= this.invokeHttp("pick_project_folder", {}).catch((error) => {
        this.sessionRequest = null;
        throw error;
      });
      return this.sessionRequest as Promise<CommandResponse<Command>>;
    }
    return this.invokeHttp(command, request);
  }

  private async invokeHttp<Command extends DocumentCoreCommand>(
    command: Command,
    request: CommandRequest<Command>,
  ): Promise<CommandResponse<Command>> {
    const url = `${this.baseUrl}/api/v1/invoke/${encodeURIComponent(command)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(this.sessionToken ? { Authorization: `Bearer ${this.sessionToken}` } : {}),
        },
        body: JSON.stringify(request),
      });
    } catch (networkError) {
      const err = new Error(
        `Falha de comunicação com o servidor NexoHub: ${(networkError as Error).message}`,
      ) as Error & { code?: string };
      err.code = "NETWORK_ERROR";
      throw err;
    }

    if (!response.ok) {
      if (
        response.status === 403 &&
        typeof request === "object" &&
        request !== null &&
        "projectPath" in request &&
        request.projectPath === this.sessionProjectPath
      ) {
        // A operação falha é preservada como erro; a próxima seleção pode abrir nova sessão.
        this.sessionToken = null;
        this.sessionProjectPath = null;
        this.sessionRequest = null;
        this.project = null;
        this.projectRequest = null;
      }
      let errorData: { code?: string; message?: string } | null = null;
      try {
        errorData = (await response.json()) as { code?: string; message?: string };
      } catch {
        // Ignora falha de parse no corpo de erro
      }
      const message = errorData?.message || `Erro HTTP ${response.status}: ${response.statusText}`;
      const code = errorData?.code || "INTERNAL_ERROR";
      const err = new Error(message) as Error & { code?: string };
      err.code = code;
      throw err;
    }

    const result = (await response.json()) as CommandResponse<Command>;
    if (command === "pick_project_folder") {
      const token = response.headers.get("X-NexoHub-Session");
      const folder = result as CommandResponse<"pick_project_folder">;
      if (!token || !folder?.path) {
        throw new ToolRunError(
          "EXECUTION_FAILED",
          "O servidor não forneceu uma credencial de sessão.",
        );
      }
      this.sessionToken = token;
      this.sessionProjectPath = folder.path;
    }
    return result;
  }
}
