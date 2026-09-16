import type { DocumentLineageEdge, IntegrityAuditReport } from "@nexohub/contracts";
import type { Artifact, Document, DocumentId } from "@nexohub/domain";
import { useEffect, useRef, useState } from "react";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import type { DocumentCorePort } from "@/platform/document-core";
import type { FactItem, TimelineStep } from "./ContextInspectorPanel";

export interface UseStudioWorkspaceOptions {
  documentCore?: DocumentCorePort;
  initialDocument?: Document;
  initialProject?: { path: string; name: string };
}

export function useStudioWorkspace({
  documentCore,
  initialDocument,
  initialProject,
}: UseStudioWorkspaceOptions) {
  const [activeProject, setActiveProject] = useState<{ path: string; name: string } | null>(
    () => initialProject ?? { path: "/meus-documentos/dossie-local", name: "Dossiê Local" },
  );
  const [documents, setDocuments] = useState<readonly Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(
    () => initialDocument ?? null,
  );
  const [artifacts, setArtifacts] = useState<readonly Artifact[]>([]);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [lineageEdges, setLineageEdges] = useState<readonly DocumentLineageEdge[]>([]);
  const [activeBlobUrl, setActiveBlobUrl] = useState<string | null>(null);
  const [documentFacts, setDocumentFacts] = useState<Record<string, FactItem[]>>({});
  const [documentTimeline, setDocumentTimeline] = useState<Record<string, TimelineStep[]>>({});
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [auditReport, setAuditReport] = useState<IntegrityAuditReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 1280 : true,
  );
  const [activeEvidenceId, setActiveEvidenceId] = useState<string>("f-1");
  const [searchFilter, setSearchFilter] = useState("");
  const [activePage, setActivePage] = useState(8);
  const scrollTargetRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Carrega documentos do projeto ativo
  useEffect(() => {
    if (!documentCore || !activeProject) return;
    let isCancelled = false;

    documentCore
      .invoke("list_documents", { projectPath: activeProject.path })
      .then((docs) => {
        if (!isCancelled && docs) {
          setDocuments(docs);
          if (docs.length > 0) {
            setSelectedDocument((prev) => {
              if (prev && docs.some((d) => d.id === prev.id)) return prev;
              return initialDocument || docs[0];
            });
          }
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [documentCore, activeProject, initialDocument]);

  // Carrega artefatos e linhagem do documento selecionado
  useEffect(() => {
    if (!documentCore || !activeProject || !selectedDocument) {
      setArtifacts([]);
      setLineageEdges([]);
      return;
    }
    let isCancelled = false;

    documentCore
      .invoke("list_artifacts", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
      })
      .then((arts) => {
        if (!isCancelled) {
          setArtifacts(arts);
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setErrorMessage(err instanceof Error ? err.message : String(err));
        }
      });

    documentCore
      .invoke("get_document_lineage", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
      })
      .then((lineage) => {
        if (!isCancelled) {
          setLineageEdges(lineage.edges);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLineageEdges([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [documentCore, activeProject, selectedDocument]);

  // Sincroniza a URL do Blob real para o visualizador de PDF e previne memory leak
  useEffect(() => {
    if (!selectedArtifact || !documentCore?.getArtifactBlobUrl) {
      setActiveBlobUrl(null);
      return;
    }
    const currentArtifactId = selectedArtifact.id;
    const url = documentCore.getArtifactBlobUrl(currentArtifactId);
    setActiveBlobUrl(url);

    return () => {
      if (documentCore.revokeArtifactBlobUrl) {
        documentCore.revokeArtifactBlobUrl(currentArtifactId);
      }
    };
  }, [selectedArtifact, documentCore]);

  const currentFacts = selectedDocument ? documentFacts[selectedDocument.id] || [] : [];
  const currentTimeline = selectedDocument ? documentTimeline[selectedDocument.id] || [] : [];

  const handleAddFact = (fact: FactItem) => {
    if (!selectedDocument) return;
    setDocumentFacts((prev) => ({
      ...prev,
      [selectedDocument.id]: [...(prev[selectedDocument.id] || []), fact],
    }));
  };

  const handleRemoveFact = (factId: string) => {
    if (!selectedDocument) return;
    setDocumentFacts((prev) => ({
      ...prev,
      [selectedDocument.id]: (prev[selectedDocument.id] || []).filter((f) => f.id !== factId),
    }));
  };

  const handleAddTimelineStep = (step: TimelineStep) => {
    if (!selectedDocument) return;
    setDocumentTimeline((prev) => ({
      ...prev,
      [selectedDocument.id]: [...(prev[selectedDocument.id] || []), step],
    }));
  };

  async function handleAuditProject() {
    if (!documentCore || !activeProject) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const report = await documentCore.invoke("audit_project", {
        projectPath: activeProject.path,
      });
      setAuditReport(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOpenProject() {
    if (!documentCore) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const picked = await documentCore.invoke("pick_project_folder", {});
      if (!picked) {
        setIsLoading(false);
        return;
      }

      let project: { name: string };
      try {
        project = await documentCore.invoke("open_project", { projectPath: picked.path });
      } catch {
        project = await documentCore.invoke("create_project", {
          projectPath: picked.path,
          name: picked.name,
        });
      }

      setActiveProject({ path: picked.path, name: project.name });
      const docs = await documentCore.invoke("list_documents", { projectPath: picked.path });
      setDocuments(docs);
      if (docs.length > 0) {
        setSelectedDocument(docs[0]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleFileSelected(file: File) {
    if (!documentCore || !activeProject) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      if (documentCore instanceof BrowserDocumentCorePort) {
        documentCore.registerUploadedFile(file);
      }
      const imported = await documentCore.invoke("import_document", {
        projectPath: activeProject.path,
        sourcePath: file.name,
        mimeType: file.type || "application/pdf",
        title: file.name,
      });

      const docs = await documentCore.invoke("list_documents", { projectPath: activeProject.path });
      setDocuments(docs);
      setSelectedDocument(imported.document);
      setActivePage(1);

      const arts = await documentCore.invoke("list_artifacts", {
        projectPath: activeProject.path,
        documentId: imported.document.id,
      });
      setArtifacts(arts);
      if (arts.length > 0) {
        setSelectedArtifact(arts[arts.length - 1]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImportDocument() {
    if (!documentCore || !activeProject) return;
    if (documentCore instanceof BrowserDocumentCorePort) {
      fileInputRef.current?.click();
      return;
    }
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const file = await documentCore.invoke("pick_document_file", {});
      if (!file) {
        setIsLoading(false);
        return;
      }

      const imported = await documentCore.invoke("import_document", {
        projectPath: activeProject.path,
        sourcePath: file.path,
        mimeType: file.mimeType,
        title: file.name,
      });

      const docs = await documentCore.invoke("list_documents", { projectPath: activeProject.path });
      setDocuments(docs);
      setSelectedDocument(imported.document);
      setActivePage(1);

      const arts = await documentCore.invoke("list_artifacts", {
        projectPath: activeProject.path,
        documentId: imported.document.id,
      });
      setArtifacts(arts);
      if (arts.length > 0) {
        setSelectedArtifact(arts[arts.length - 1]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshDocumentState(projPath: string, docId: DocumentId) {
    if (!documentCore) return;
    try {
      const [updatedArts, lineage] = await Promise.all([
        documentCore.invoke("list_artifacts", { projectPath: projPath, documentId: docId }),
        documentCore.invoke("get_document_lineage", { projectPath: projPath, documentId: docId }),
      ]);
      setArtifacts(updatedArts);
      setLineageEdges(lineage.edges);
    } catch {
      // Ignora erro secundário de linhagem
    }
  }

  async function handleCompressPdf() {
    if (!documentCore || !activeProject || !selectedDocument || artifacts.length === 0) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const latest = artifacts[artifacts.length - 1];
      await documentCore.invoke("compress_pdf", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
        artifactId: latest.id,
        compressionLevel: 6,
      });
      await refreshDocumentState(activeProject.path, selectedDocument.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOrganizePdf() {
    if (!documentCore || !activeProject || !selectedDocument || artifacts.length === 0) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const latest = artifacts[artifacts.length - 1];
      await documentCore.invoke("organize_pdf", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
        artifactId: latest.id,
        pageOrder: [1],
      });
      await refreshDocumentState(activeProject.path, selectedDocument.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleExecuteOcr() {
    if (!documentCore || !activeProject || !selectedDocument || artifacts.length === 0) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const latest = artifacts[artifacts.length - 1];
      await documentCore.invoke("execute_ocr", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
        artifactId: latest.id,
      });
      await refreshDocumentState(activeProject.path, selectedDocument.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    activeProject,
    setActiveProject,
    documents,
    setDocuments,
    selectedDocument,
    setSelectedDocument,
    artifacts,
    setArtifacts,
    selectedArtifact,
    setSelectedArtifact,
    lineageEdges,
    setLineageEdges,
    activeBlobUrl,
    currentFacts,
    currentTimeline,
    isHistoryModalOpen,
    setIsHistoryModalOpen,
    auditReport,
    errorMessage,
    setErrorMessage,
    isLoading,
    sidebarOpen,
    setSidebarOpen,
    inspectorOpen,
    setInspectorOpen,
    activeEvidenceId,
    setActiveEvidenceId,
    searchFilter,
    setSearchFilter,
    activePage,
    setActivePage,
    scrollTargetRef,
    fileInputRef,
    handleAddFact,
    handleRemoveFact,
    handleAddTimelineStep,
    handleAuditProject,
    handleOpenProject,
    handleFileSelected,
    handleImportDocument,
    refreshDocumentState,
    handleCompressPdf,
    handleOrganizePdf,
    handleExecuteOcr,
  };
}
