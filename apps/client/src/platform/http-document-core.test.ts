import { asArtifactId, asDocumentId } from "@nexohub/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpDocumentCorePort } from "./http-document-core";

describe("HttpDocumentCorePort", () => {
  let port: HttpDocumentCorePort;
  const baseUrl = "https://nexohub.nexojuris.ia.br";

  beforeEach(() => {
    vi.restoreAllMocks();
    port = new HttpDocumentCorePort(baseUrl);
  });

  it("envia comandos via HTTP POST para /api/v1/invoke/:command e retorna resposta", async () => {
    const fakeResponse = {
      project: { id: "proj-1", name: "Projeto Teste", path: "/tmp/teste" },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(fakeResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await port.invoke("create_project", {
      projectPath: "/tmp/teste",
      name: "Projeto Teste",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/invoke/create_project`,
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          projectPath: "/tmp/teste",
          name: "Projeto Teste",
        }),
      }),
    );
    expect(result).toEqual(fakeResponse);
  });

  it("propaga código estruturado e mensagem de erro quando a API HTTP retorna erro", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          code: "INVALID_ARGUMENT",
          message: "Parâmetro inválido fornecido.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      port.invoke("compress_pdf", {
        projectPath: "/tmp/teste",
        documentId: asDocumentId("doc-1"),
        artifactId: asArtifactId("art-1"),
        compressionLevel: 6,
      }),
    ).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
      message: "Parâmetro inválido fornecido.",
    });
  });

  it("trata erro de conexão de rede como NETWORK_ERROR estruturado", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Failed to fetch"));

    await expect(
      port.invoke("list_documents", {
        projectPath: "/tmp/teste",
      }),
    ).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: expect.stringContaining("Failed to fetch"),
    });
  });

  it("gerencia o ciclo de vida completo de ensureProject e executePdfTool", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            path: "/tmp/sessao-1.nexohub",
            name: "Sessão Web",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "proj-1",
            path: "/tmp/sessao-1.nexohub",
            name: "Sessão Web",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            document: { id: "doc-1", title: "contrato.pdf" },
            artifact: { id: "art-orig-1" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            artifact: { id: "art-cmp-1" },
            operation: { id: "op-cmp-1" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([37, 80, 68, 70]), {
          status: 200,
        }),
      );

    const file = new File([new Uint8Array([1, 2, 3, 4])], "contrato.pdf", {
      type: "application/pdf",
    });

    const resultBlob = await port.executePdfTool({
      toolId: "pdf-compress",
      file,
      compressionLevel: "recommended",
    });

    expect(resultBlob).toBeInstanceOf(Blob);
    expect(resultBlob.type).toBe("application/pdf");
    expect(fetchSpy).toHaveBeenCalledTimes(5);

    // Verifica que o blob foi armazenado e pode ser recuperado
    const cachedBlob = port.getArtifactBlob("art-cmp-1");
    expect(cachedBlob).toBe(resultBlob);

    // Gera URL de visualização
    const blobUrl = port.getArtifactBlobUrl("art-cmp-1");
    expect(blobUrl).toBeDefined();
    port.revokeArtifactBlobUrl("art-cmp-1");
  });

  it("salva arquivo no navegador disparando download", async () => {
    const clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName === "a") {
        el.click = clickSpy;
      }
      return el;
    });

    const blob = new Blob(["conteudo"], { type: "text/plain" });
    const success = await port.saveOutputFile({ blob, fileName: "resultado.txt" });

    expect(success).toBe(true);
    expect(clickSpy).toHaveBeenCalled();
  });
});
