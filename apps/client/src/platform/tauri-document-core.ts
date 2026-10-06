import type { CommandRequest, CommandResponse, DocumentCoreCommand } from "@nexohub/contracts";
import { ToolRunError } from "@nexohub/tool-sdk";
import type { DocumentCorePort } from "./document-core";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>;
    };
  }
}

export class TauriDocumentCorePort implements DocumentCorePort {
  readonly supportedToolIds: ReadonlySet<string> = new Set([
    "pdf-organize",
    "pdf-merge",
    "pdf-split",
    "pdf-rotate",
    "pdf-compress",
    "text-compare",
    "pdf-ocr",
    "text-review",
    "text-translate",
    "pdf-extract-images",
  ]);
  private projectPath: string | null = null;

  async saveOutputFile(request: { blob: Blob; fileName: string }): Promise<boolean> {
    if (request.blob.size > 64 * 1024 * 1024) {
      throw new ToolRunError(
        "INVALID_INPUT",
        "O arquivo excede o limite de 64 MiB para exportação.",
      );
    }
    const path = await this.invoke("save_launcher_output", {
      fileName: request.fileName,
      bytes: Array.from(new Uint8Array(await request.blob.arrayBuffer())),
    });
    return path !== null;
  }

  private async ensureProjectPath(): Promise<string> {
    if (!this.projectPath) {
      const folder = await this.invoke("pick_project_folder", {});
      if (!folder) throw new ToolRunError("CANCELLED", "Seleção da pasta cancelada.");
      const projectPath = `${folder.path.replace(/[\\/]$/, "")}/NexoHub.nexohub`;
      try {
        await this.invoke("open_project", { projectPath });
      } catch (error) {
        if (
          typeof error !== "object" ||
          error === null ||
          !("code" in error) ||
          error.code !== "PROJECT_NOT_FOUND"
        )
          throw error;
        await this.invoke("create_project", { projectPath, name: "NexoHub" });
      }
      this.projectPath = projectPath;
    }
    return this.projectPath;
  }

  async persistLauncherResult(request: {
    toolId: "pdf-merge" | "pdf-split" | "pdf-rotate" | "text-compare";
    files: readonly File[];
    output: Blob;
    parameters: Readonly<Record<string, unknown>>;
  }): Promise<Blob> {
    const limit = 64 * 1024 * 1024;
    if (
      request.files.length === 0 ||
      request.files.length > 32 ||
      request.files.some((file) => file.size > limit) ||
      request.output.size > limit
    ) {
      throw new ToolRunError("INVALID_INPUT", "A operação excede os limites da interface desktop.");
    }
    const projectPath = await this.ensureProjectPath();
    const imported = [];
    for (const file of request.files) {
      imported.push(
        await this.invoke("import_document_bytes", {
          projectPath,
          title: file.name,
          mimeType: request.toolId === "text-compare" ? "text/plain" : "application/pdf",
          bytes: Array.from(new Uint8Array(await file.arrayBuffer())),
        }),
      );
    }
    const mimeType =
      request.toolId === "text-compare"
        ? "text/plain"
        : request.output.type === "application/zip"
          ? "application/zip"
          : "application/pdf";
    const result = await this.invoke("record_launcher_result", {
      projectPath,
      documentId: imported[0].document.id,
      inputArtifactIds: imported.map((item) => item.artifact.id),
      toolId: request.toolId,
      mimeType,
      bytes: Array.from(new Uint8Array(await request.output.arrayBuffer())),
      parameters: request.parameters,
    });
    const bytes = await this.invoke("read_artifact_bytes", {
      projectPath,
      artifactId: result.artifact.id,
    });
    return new Blob([new Uint8Array(bytes)], { type: mimeType });
  }

  async executePdfTool(request: {
    toolId: "pdf-compress" | "pdf-organize";
    file: File;
    pageOrder?: readonly number[];
    compressionLevel?: "less" | "recommended" | "extreme";
  }): Promise<Blob> {
    if (request.file.size > 64 * 1024 * 1024) {
      throw new ToolRunError(
        "INVALID_INPUT",
        "O arquivo excede o limite de 64 MiB da interface desktop.",
      );
    }
    const projectPath = await this.ensureProjectPath();
    const imported = await this.invoke("import_document_bytes", {
      projectPath,
      title: request.file.name,
      mimeType: "application/pdf",
      bytes: Array.from(new Uint8Array(await request.file.arrayBuffer())),
    });
    const result =
      request.toolId === "pdf-compress"
        ? await this.invoke("compress_pdf", {
            projectPath,
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
            projectPath,
            documentId: imported.document.id,
            artifactId: imported.artifact.id,
            pageOrder: request.pageOrder ?? [],
          });
    const bytes = await this.invoke("read_artifact_bytes", {
      projectPath,
      artifactId: result.artifact.id,
    });
    return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  }
  async invoke<Command extends DocumentCoreCommand>(
    command: Command,
    request: CommandRequest<Command>,
  ): Promise<CommandResponse<Command>> {
    const tauri = window.__TAURI_INTERNALS__;
    if (!tauri || typeof tauri.invoke !== "function") {
      throw new Error("DOCUMENT_CORE_UNAVAILABLE");
    }

    return await tauri.invoke<CommandResponse<Command>>(command, {
      request,
    });
  }
}
