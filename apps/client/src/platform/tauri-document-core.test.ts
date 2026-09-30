import { afterEach, describe, expect, it, vi } from "vitest";
import { TauriDocumentCorePort } from "./tauri-document-core";

describe("TauriDocumentCorePort", () => {
  afterEach(() => {
    delete window.__TAURI_INTERNALS__;
  });

  it("envia o resultado ao diálogo nativo de salvamento", async () => {
    const invoke = vi.fn(async () => "C:/Saidas/resultado.pdf");
    window.__TAURI_INTERNALS__ = {
      invoke: invoke as unknown as NonNullable<Window["__TAURI_INTERNALS__"]>["invoke"],
    };
    const port = new TauriDocumentCorePort();

    const saved = await port.saveOutputFile({
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }),
      fileName: "resultado.pdf",
    });

    expect(saved).toBe(true);
    expect(invoke).toHaveBeenCalledWith("save_launcher_output", {
      request: { fileName: "resultado.pdf", bytes: [1, 2, 3] },
    });
  });

  it("importa o original, executa compressão nativa e lê o artifact derivado", async () => {
    const calls: Array<{ command: string; request: Record<string, unknown> }> = [];
    window.__TAURI_INTERNALS__ = {
      invoke: vi.fn(async (command: string, args?: Record<string, unknown>) => {
        const request = args?.request as Record<string, unknown>;
        calls.push({ command, request });
        if (command === "pick_project_folder") return { path: "C:/Projetos", name: "Projetos" };
        if (command === "open_project") throw { code: "PROJECT_NOT_FOUND" };
        if (command === "create_project") return { id: "project-1" };
        if (command === "import_document_bytes")
          return {
            document: { id: "document-1" },
            artifact: { id: "original-1" },
          };
        if (command === "compress_pdf")
          return { artifact: { id: "derived-1" }, operation: { id: "operation-1" } };
        if (command === "read_artifact_bytes") return [1, 2, 3];
        throw new Error(`Comando inesperado: ${command}`);
      }) as unknown as NonNullable<Window["__TAURI_INTERNALS__"]>["invoke"],
    };

    const port = new TauriDocumentCorePort();
    const file = new File([new Uint8Array([7, 8, 9])], "contrato.pdf", { type: "application/pdf" });
    const result = await port.executePdfTool({
      toolId: "pdf-compress",
      file,
      compressionLevel: "extreme",
    });
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls.map(({ command }) => command)).toEqual([
      "pick_project_folder",
      "open_project",
      "create_project",
      "import_document_bytes",
      "compress_pdf",
      "read_artifact_bytes",
    ]);
    expect(calls.find(({ command }) => command === "import_document_bytes")?.request).toMatchObject(
      {
        projectPath: "C:/Projetos/NexoHub.nexohub",
        bytes: [7, 8, 9],
        title: "contrato.pdf",
      },
    );
    expect(calls.find(({ command }) => command === "read_artifact_bytes")?.request).toMatchObject({
      artifactId: "derived-1",
    });
    expect(calls.find(({ command }) => command === "compress_pdf")?.request).toMatchObject({
      compressionLevel: 9,
    });
  });

  it("registra a junção com os dois originals e retorna os bytes persistidos", async () => {
    const calls: Array<{ command: string; request: Record<string, unknown> }> = [];
    window.__TAURI_INTERNALS__ = {
      invoke: vi.fn(async (command: string, args?: Record<string, unknown>) => {
        const request = args?.request as Record<string, unknown>;
        calls.push({ command, request });
        if (command === "pick_project_folder") return { path: "C:/Projetos" };
        if (command === "open_project") return { id: "project-1" };
        if (command === "import_document_bytes") {
          const index = calls.filter((call) => call.command === "import_document_bytes").length;
          return { document: { id: `document-${index}` }, artifact: { id: `original-${index}` } };
        }
        if (command === "record_launcher_result") return { artifact: { id: "derived-1" } };
        if (command === "read_artifact_bytes") return [1, 2, 3];
        throw new Error(`Comando inesperado: ${command}`);
      }) as unknown as NonNullable<Window["__TAURI_INTERNALS__"]>["invoke"],
    };

    const port = new TauriDocumentCorePort();
    const result = await port.persistLauncherResult({
      toolId: "pdf-merge",
      files: [new File(["a"], "a.pdf"), new File(["b"], "b.pdf")],
      output: new Blob([new Uint8Array([4, 5, 6])], { type: "application/pdf" }),
      parameters: {},
    });
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(calls.find((call) => call.command === "record_launcher_result")?.request).toMatchObject({
      projectPath: "C:/Projetos/NexoHub.nexohub",
      documentId: "document-1",
      inputArtifactIds: ["original-1", "original-2"],
      toolId: "pdf-merge",
      bytes: [4, 5, 6],
    });
  });
});
