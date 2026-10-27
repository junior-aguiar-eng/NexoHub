import { afterEach, describe, expect, it, vi } from "vitest";
import * as translator from "./browser-translator";
import { HttpDocumentCorePort } from "./http-document-core";
import { type LauncherToolInput, runLauncherTool } from "./launcher-tool-runner";

const input: LauncherToolInput = {
  files: [new File(["Hello"], "texto.txt", { type: "text/plain" })],
  firstText: "Hello",
  secondText: "",
  splitMode: "interval",
  splitIntervals: [],
  mergeIntervals: false,
  selectedPages: [],
  pages: [],
  rotateAngle: 0,
  compressionLevel: "recommended",
  translationSourceLang: "en",
  translationTargetLang: "pt",
};
afterEach(() => vi.restoreAllMocks());
describe("tradução local no website", () => {
  it("não espera um tradutor remoto antes de iniciar o motor do navegador", async () => {
    const port = new HttpDocumentCorePort();
    const remote = vi.spyOn(port, "invoke").mockResolvedValue({ text: "Servidor" } as never);
    const local = vi.spyOn(translator, "performBrowserTranslation").mockResolvedValue({
      translatedText: "Olá",
      sourceLang: "en",
      targetLang: "pt",
      engine: "transformers.js-m2m100",
    });
    const result = await runLauncherTool(port, "text-translate", input);
    expect(local).toHaveBeenCalledOnce();
    expect(remote).not.toHaveBeenCalled();
    expect(await result.blob.text()).toBe("Olá");
  });
  it("propaga o cancelamento ao motor local", async () => {
    const port = new HttpDocumentCorePort();
    vi.spyOn(port, "invoke").mockRejectedValue(new Error("CAPABILITY_NOT_FOUND"));
    const controller = new AbortController();
    const local = vi
      .spyOn(translator, "performBrowserTranslation")
      .mockImplementation(async (_text, options) => {
        expect(options.signal).toBe(controller.signal);
        throw new Error("OPERACAO_CANCELADA");
      });
    await expect(
      runLauncherTool(port, "text-translate", { ...input, translationSignal: controller.signal }),
    ).rejects.toMatchObject({ code: "CANCELLED" });
    expect(local).toHaveBeenCalledOnce();
  });
});
