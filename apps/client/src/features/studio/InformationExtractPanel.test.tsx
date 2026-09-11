import { asArtifactId, asDocumentId } from "@nexohub/domain";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentCorePort } from "@/platform/document-core";
import { InformationExtractPanel } from "./InformationExtractPanel";

describe("InformationExtractPanel", () => {
  const mockResult = {
    text: "Contrato NexoHub. Contratante: Empresa Modelo. CPF: 529.982.247-25. Valor: R$ 1.500,00",
    mode: "all",
    metrics: {
      charCount: 88,
      wordCount: 11,
      lineCount: 1,
      pageCount: 1,
      language: "pt-BR",
    },
    entities: [
      {
        category: "cpf",
        value: "529.982.247-25",
        normalizedValue: "529.982.247-25",
        confidence: 1.0,
        count: 1,
      },
      {
        category: "money",
        value: "R$ 1.500,00",
        normalizedValue: "1500.00",
        confidence: 0.92,
        count: 1,
      },
    ],
    keyValues: {
      Contratante: "Empresa Modelo",
    },
    tables: [
      {
        title: "Tabela de Serviços",
        headers: ["Serviço", "Valor"],
        rows: [["Licença", "R$ 1.500,00"]],
      },
    ],
    sections: [
      {
        title: "Cláusula Primeira",
        level: 2,
        lineNumber: 1,
      },
    ],
  };

  it("executa a extração estruturada e exibe os dados nas abas correspondentes", async () => {
    const invoke = vi.fn().mockResolvedValue(mockResult);
    const documentCore = { invoke } as unknown as DocumentCorePort;

    render(
      <InformationExtractPanel
        initialText="Texto de teste"
        documentCore={documentCore}
        projectPath="C:/projeto"
        documentId={asDocumentId("doc-1")}
        artifactId={asArtifactId("art-1")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Extrair informações" }));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith("extract_information", {
        projectPath: "C:/projeto",
        documentId: "doc-1",
        artifactId: "art-1",
        text: "Texto de teste",
        mode: "all",
      });
    });

    // Visão geral com contadores
    expect(screen.getByText("Resumo do Documento")).toBeInTheDocument();
    expect(screen.getByText("Cláusula Primeira")).toBeInTheDocument();

    // Alternar para aba de Entidades
    const entitiesTab = screen.getByRole("button", { name: /Entidades/i });
    fireEvent.click(entitiesTab);

    expect(screen.getByText("529.982.247-25")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
    expect(screen.getByText("Validado")).toBeInTheDocument();

    // Alternar para aba de Chave-Valor
    const keyValuesTab = screen.getByRole("button", { name: /Chave-Valor/i });
    fireEvent.click(keyValuesTab);

    expect(screen.getByText("Contratante")).toBeInTheDocument();
    expect(screen.getByText("Empresa Modelo")).toBeInTheDocument();

    // Alternar para aba de Tabelas
    const tablesTab = screen.getByRole("button", { name: /Tabelas/i });
    fireEvent.click(tablesTab);

    expect(screen.getByText("Serviço")).toBeInTheDocument();
    expect(screen.getByText("Licença")).toBeInTheDocument();
  });

  it("permite salvar o resultado da extração como nova camada documental JSON", async () => {
    const invoke = vi.fn().mockResolvedValue(mockResult);
    const documentCore = { invoke } as unknown as DocumentCorePort;
    const onSuccess = vi.fn();

    render(
      <InformationExtractPanel
        initialText="Texto de teste"
        documentCore={documentCore}
        projectPath="C:/projeto"
        documentId={asDocumentId("doc-1")}
        artifactId={asArtifactId("art-1")}
        onSuccess={onSuccess}
      />,
    );

    // Primeiro extrai
    fireEvent.click(screen.getByRole("button", { name: "Extrair informações" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Salvar como nova versão JSON" }),
      ).toBeInTheDocument();
    });

    // Clica em Salvar como nova versão
    fireEvent.click(screen.getByRole("button", { name: "Salvar como nova versão JSON" }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
      expect(
        screen.getByText("Dados estruturados adicionados como nova versão JSON no Nexo Layers."),
      ).toBeInTheDocument();
    });
  });
});
