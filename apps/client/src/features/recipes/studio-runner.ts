import type { ArtifactId, DocumentId, RecipeRunProgress, RecipeSnapshot } from "@nexohub/domain";
import { coreToolRegistry } from "@nexohub/tool-registry";
import {
  RecipeRunner,
  StaticCapabilityProvider,
  type ToolExecutor,
  ToolRunError,
  ToolRunner,
} from "@nexohub/tool-sdk";
import type { DocumentCorePort } from "@/platform/document-core";

export interface StudioRecipeRunContext {
  readonly documentCore: DocumentCorePort;
  readonly projectPath: string;
  readonly documentId: DocumentId;
  readonly initialArtifactId: ArtifactId;
}

export function createStudioRecipeRunner(context: StudioRecipeRunContext): RecipeRunner {
  const { documentCore, projectPath, documentId } = context;

  const nativeExecutor: ToolExecutor = {
    kind: "native",
    async execute(request) {
      const inputId = (
        Array.isArray(request.input) ? request.input[0] : String(request.input)
      ) as ArtifactId;

      if (request.toolId === "pdf-compress") {
        const compressionLevel =
          typeof request.parameters?.compressionLevel === "number"
            ? request.parameters.compressionLevel
            : typeof request.parameters?.level === "number"
              ? request.parameters.level
              : 6;
        const res = await documentCore.invoke("compress_pdf", {
          projectPath,
          documentId,
          artifactId: inputId,
          compressionLevel,
        });
        return { artifacts: [res.artifact.id] };
      }
      if (request.toolId === "pdf-organize") {
        const pageOrder = Array.isArray(request.parameters?.pageOrder)
          ? (request.parameters.pageOrder as number[])
          : [0];
        const res = await documentCore.invoke("organize_pdf", {
          projectPath,
          documentId,
          artifactId: inputId,
          pageOrder,
        });
        return { artifacts: [res.artifact.id] };
      }
      if (request.toolId === "text-review") {
        const review = await documentCore.invoke("review_text", {
          text: "Texto para revisão",
        });
        const res = await documentCore.invoke("create_text_revision", {
          projectPath,
          documentId,
          artifactId: inputId,
          content: `Revisão textual com ${review.matches.length} apontamentos`,
        });
        return { artifacts: [res.artifact.id] };
      }
      throw new ToolRunError(
        "EXECUTOR_NOT_FOUND",
        `Executor nativo não encontrado para ${request.toolId}`,
      );
    },
  };

  const pythonExecutor: ToolExecutor = {
    kind: "python",
    async execute(request) {
      const inputId = (
        Array.isArray(request.input) ? request.input[0] : String(request.input)
      ) as ArtifactId;

      if (request.toolId === "pdf-ocr") {
        const res = await documentCore.invoke("execute_ocr", {
          projectPath,
          documentId,
          artifactId: inputId,
        });
        return { artifacts: [res.artifact.id] };
      }
      if (request.toolId === "intelligence-extract") {
        const res = await documentCore.invoke("extract_information", {
          projectPath,
          documentId,
          artifactId: inputId,
        });
        return { artifacts: [res.artifact ? res.artifact.id : inputId] };
      }
      if (request.toolId === "text-translate") {
        const targetLanguage =
          typeof request.parameters?.targetLanguage === "string"
            ? request.parameters.targetLanguage
            : "en";
        const res = await documentCore.invoke("translate_text", {
          text: "Texto a traduzir",
          targetLanguage,
          projectPath,
          documentId,
          artifactId: inputId,
        });
        return { artifacts: [res.artifact ? res.artifact.id : inputId] };
      }
      throw new ToolRunError(
        "EXECUTOR_NOT_FOUND",
        `Executor python não encontrado para ${request.toolId}`,
      );
    },
  };

  const browserExecutor: ToolExecutor = {
    kind: "browser",
    async execute(request) {
      if (request.toolId === "text-compare") {
        return { artifacts: [`diff-${Date.now()}`] };
      }
      throw new ToolRunError(
        "EXECUTOR_NOT_FOUND",
        `Executor browser não encontrado para ${request.toolId}`,
      );
    },
  };

  const capabilityProvider = new StaticCapabilityProvider({
    "documents.read": { available: true },
    "documents.write": { available: true },
    "pdf.transform": { available: true },
    "ocr.execute": { available: true },
    "text.compare": { available: true },
    "text.review": { available: true },
    "translation.execute": { available: true },
    "intelligence.extract": { available: true },
  });

  const toolRunner = new ToolRunner(coreToolRegistry, capabilityProvider, [
    nativeExecutor,
    pythonExecutor,
    browserExecutor,
  ]);

  return new RecipeRunner(toolRunner);
}

export async function runStudioRecipe(
  context: StudioRecipeRunContext,
  recipe: RecipeSnapshot,
  cancellationToken: AbortSignal,
  onProgress: (progress: RecipeRunProgress) => void,
): Promise<RecipeRunProgress> {
  const runner = createStudioRecipeRunner(context);
  return runner.run({
    recipe,
    input: context.initialArtifactId,
    signal: cancellationToken,
    onProgress,
  });
}
