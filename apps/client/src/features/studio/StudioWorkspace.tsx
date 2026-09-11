import type { DocumentLineageEdge, IntegrityAuditReport } from "@nexohub/contracts";
import type { Artifact, Document, DocumentId, NexoFlowSnapshot } from "@nexohub/domain";
import {
  FileText,
  Minimize2,
  MoveVertical,
  PanelLeftClose,
  ScanText,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LauncherTool } from "@/features/launcher/model";
import { browserRecipeStorage, RecipePanel, runStudioRecipe } from "@/features/recipes";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";
import { ContextInspectorPanel } from "./ContextInspectorPanel";
import { DocumentTreeSidebar } from "./DocumentTreeSidebar";
import { DocumentViewerCanvas } from "./DocumentViewerCanvas";
import { InformationExtractPanel } from "./InformationExtractPanel";
import { OcrPanel } from "./OcrPanel";
import { PdfOverlayPanel } from "./PdfOverlayPanel";
import { ReviewPanel } from "./ReviewPanel";
import { TextComparePanel } from "./TextComparePanel";
import { TextEditor } from "./TextEditor";
import { TranslationPanel } from "./TranslationPanel";

type StudioWorkspaceProps = {
  onClose: () => void;
  documentCore?: DocumentCorePort;
  textRevisionContext?: {
    readonly projectPath: string;
    readonly documentId: DocumentId;
    readonly artifactId: import("@nexohub/domain").ArtifactId;
  };
  promotedFlow?: {
    tool: LauncherTool;
    flow: NexoFlowSnapshot;
  };
};

export function StudioWorkspace({
  onClose,
  promotedFlow,
  documentCore,
  textRevisionContext,
}: StudioWorkspaceProps) {
  const [activeProject, setActiveProject] = useState<{ path: string; name: string } | null>(null);
  const [documents, setDocuments] = useState<readonly Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [artifacts, setArtifacts] = useState<readonly Artifact[]>([]);
  const [_lineageEdges, setLineageEdges] = useState<readonly DocumentLineageEdge[]>([]);
  const [auditReport, setAuditReport] = useState<IntegrityAuditReport | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [activeCanvasTab, setActiveCanvasTab] = useState<"document" | "tool" | "flow">(
    promotedFlow ? "tool" : "document",
  );
  const [activeEvidenceId, setActiveEvidenceId] = useState<string>("f-1");
  const [searchFilter, setSearchFilter] = useState("");
  const [activePage, setActivePage] = useState(8);
  const scrollTargetRef = useRef<HTMLDivElement | null>(null);

  function handleSelectCanvasTab(tab: "document" | "tool" | "flow") {
    setActiveCanvasTab(tab);
  }

  useEffect(() => {
    if (promotedFlow) {
      setActiveCanvasTab("tool");
    }
  }, [promotedFlow]);

  useEffect(() => {
    if (!documentCore || activeProject) return;
    documentCore
      .invoke("pick_project_folder", {})
      .then((picked) => {
        if (!picked) return;
        documentCore
          .invoke("open_project", { projectPath: picked.path })
          .then((proj) => {
            setActiveProject({ path: picked.path, name: proj.name });
            return documentCore.invoke("list_documents", { projectPath: picked.path });
          })
          .then((docs) => {
            if (docs) {
              setDocuments(docs);
              if (docs.length > 0) {
                setSelectedDocument(docs[0]);
              }
            }
          })
          .catch(() => {
            documentCore
              .invoke("create_project", { projectPath: picked.path, name: picked.name })
              .then((proj) => {
                setActiveProject({ path: picked.path, name: proj.name });
              })
              .catch(() => {});
          });
      })
      .catch(() => {});
  }, [documentCore, activeProject]);

  useEffect(() => {
    if (!documentCore || !activeProject || !selectedDocument) {
      setArtifacts([]);
      setLineageEdges([]);
      return;
    }
    documentCore
      .invoke("list_artifacts", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
      })
      .then(setArtifacts)
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : String(err));
      });

    documentCore
      .invoke("get_document_lineage", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
      })
      .then((lineage) => setLineageEdges(lineage.edges))
      .catch(() => {
        setLineageEdges([]);
      });
  }, [documentCore, activeProject, selectedDocument]);

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

  async function handleImportDocument() {
    if (!documentCore || !activeProject) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const file = await documentCore.invoke("pick_document_file", {});
      if (!file) {
        setIsLoading(false);
        return;
      }

      await documentCore.invoke("import_document", {
        projectPath: activeProject.path,
        sourcePath: file.path,
        mimeType: file.mimeType,
        title: file.name,
      });

      const docs = await documentCore.invoke("list_documents", { projectPath: activeProject.path });
      setDocuments(docs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
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
      const updated = await documentCore.invoke("list_artifacts", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
      });
      setArtifacts(updated);
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
      const updated = await documentCore.invoke("list_artifacts", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
      });
      setArtifacts(updated);
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
      const updated = await documentCore.invoke("list_artifacts", {
        projectPath: activeProject.path,
        documentId: selectedDocument.id,
      });
      setArtifacts(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const recipePanelElement = (
    <RecipePanel
      flow={promotedFlow?.flow}
      onSave={(recipe) => browserRecipeStorage.save(recipe)}
      onOpenArtifact={(artifactId) => {
        const found = artifacts.find((a) => a.id === artifactId);
        if (found) {
          // Artifact presente na lista
        }
      }}
      onRun={async (recipe, cancellationToken, onProgress) => {
        if (activeProject && selectedDocument && documentCore) {
          const initialArtifactId = artifacts[artifacts.length - 1]?.id ?? selectedDocument.id;
          await runStudioRecipe(
            {
              documentCore,
              projectPath: activeProject.path,
              documentId: selectedDocument.id,
              initialArtifactId,
            },
            recipe,
            cancellationToken,
            onProgress,
          );
          const updated = await documentCore.invoke("list_artifacts", {
            projectPath: activeProject.path,
            documentId: selectedDocument.id,
          });
          setArtifacts(updated);
          try {
            const lineage = await documentCore.invoke("get_document_lineage", {
              projectPath: activeProject.path,
              documentId: selectedDocument.id,
            });
            setLineageEdges(lineage.edges);
          } catch {
            // Sem linhagem adicional
          }
        } else {
          for (let i = 0; i < recipe.steps.length; i++) {
            if (cancellationToken.aborted) break;
            onProgress({
              recipeId: recipe.id,
              status: "RUNNING",
              currentStepIndex: i,
              steps: recipe.steps.map((s, idx) => ({
                stepId: s.id,
                toolId: s.toolId,
                status: idx < i ? "SUCCEEDED" : idx === i ? "RUNNING" : "PENDING",
                artifactIds: idx < i ? [`artifact-${s.id}`] : [],
              })),
            });
            await new Promise((r) => setTimeout(r, 500));
          }
          if (!cancellationToken.aborted) {
            onProgress({
              recipeId: recipe.id,
              status: "SUCCEEDED",
              steps: recipe.steps.map((s) => ({
                stepId: s.id,
                toolId: s.toolId,
                status: "SUCCEEDED",
                artifactIds: [`artifact-${s.id}`],
              })),
            });
          }
        }
      }}
    />
  );

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="studio-header__identity">
          <span className="brand__mark" aria-hidden="true">
            N
          </span>
          <div>
            <span className="eyebrow">NexoJuri</span>
            <strong>
              {activeProject
                ? `${activeProject.name} — Mesa de Trabalho`
                : "Estação de trabalho local"}
            </strong>
          </div>
        </div>

        <div className="studio-header__search">
          <Search size={14} className="studio-header__search-icon" />
          <input
            type="text"
            className="studio-header__search-input"
            placeholder="Buscar no dossiê, jurisprudência ou pergunta..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
        </div>

        <div className="studio-header__center-tools">
          <div
            className={`studio-integrity-pill ${
              auditReport
                ? auditReport.isHealthy
                  ? "studio-integrity-pill--healthy"
                  : "studio-integrity-pill--warning"
                : ""
            }`}
          >
            <ShieldCheck size={15} className="studio-integrity-pill__icon" />
            <span className="studio-integrity-pill__label">
              {auditReport
                ? auditReport.isHealthy
                  ? `BLAKE3 Íntegro (${auditReport.validArtifacts}/${auditReport.totalArtifacts})`
                  : `Inconsistência (${auditReport.corruptedArtifacts.length})`
                : "BLAKE3 Protegido"}
            </span>
            <Button
              variant="ghost"
              size="compact"
              onClick={handleAuditProject}
              disabled={!activeProject || isLoading}
              className="studio-integrity-pill__btn"
              title="Auditar integridade criptográfica BLAKE3"
            >
              Auditar
            </Button>
          </div>

          <div className="studio-header__avatar" title="Usuário Ativo">
            <span>AB</span>
          </div>
        </div>

        <div className="studio-header__actions">
          <Button variant="ghost" onClick={onClose} title={translate("studio.workspace.close")}>
            <PanelLeftClose size={18} aria-hidden="true" />
            {translate("studio.workspace.close")}
          </Button>
        </div>
      </header>

      <main id="main-content" className="studio-layout">
        <DocumentTreeSidebar
          activeProject={activeProject}
          documents={documents}
          selectedDocument={selectedDocument}
          onSelectDocument={setSelectedDocument}
          onOpenProject={handleOpenProject}
          onImportDocument={handleImportDocument}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen((prev) => !prev)}
          isLoading={isLoading}
        />

        <section className="studio-canvas" aria-labelledby="studio-canvas-title">
          {errorMessage && (
            <div
              style={{
                padding: "0.6rem 1rem",
                background: "rgba(239, 68, 68, 0.1)",
                borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#ef4444",
                fontSize: "0.8rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Clean Canvas Navigation Bar */}
          <div className="studio-canvas-nav">
            <div className="studio-canvas-nav__tabs">
              <button
                type="button"
                className={`studio-canvas-nav__tab ${
                  activeCanvasTab === "document" ? "studio-canvas-nav__tab--active" : ""
                }`}
                onClick={() => handleSelectCanvasTab("document")}
              >
                <FileText size={14} />
                <span>Mesa de Leitura</span>
              </button>

              {promotedFlow && (
                <button
                  type="button"
                  className={`studio-canvas-nav__tab studio-canvas-nav__tab--promoted ${
                    activeCanvasTab === "tool" ? "studio-canvas-nav__tab--active" : ""
                  }`}
                  onClick={() => handleSelectCanvasTab("tool")}
                >
                  <Sparkles size={14} className="text-emerald-600" />
                  <span>Ferramenta: {translate(promotedFlow.tool.titleKey)}</span>
                  <span className="status-badge status-badge--compact">Ativa</span>
                </button>
              )}

              <button
                type="button"
                className={`studio-canvas-nav__tab ${
                  activeCanvasTab === "flow" ? "studio-canvas-nav__tab--active" : ""
                }`}
                onClick={() => handleSelectCanvasTab("flow")}
              >
                <Workflow size={14} />
                <span>NexoFlow & Receitas</span>
              </button>
            </div>

            {promotedFlow && activeCanvasTab === "tool" && (
              <div className="studio-canvas-nav__actions">
                {promotedFlow.tool.id === "pdf-compress" && (
                  <Button
                    variant="primary"
                    size="compact"
                    onClick={handleCompressPdf}
                    disabled={isLoading}
                  >
                    <Minimize2 size={13} style={{ marginRight: "0.3rem" }} />
                    Comprimir PDF
                  </Button>
                )}
                {promotedFlow.tool.id === "pdf-organize" && (
                  <Button
                    variant="primary"
                    size="compact"
                    onClick={handleOrganizePdf}
                    disabled={isLoading}
                  >
                    <MoveVertical size={13} style={{ marginRight: "0.3rem" }} />
                    Organizar Páginas
                  </Button>
                )}
                {promotedFlow.tool.id === "pdf-ocr" && (
                  <Button
                    variant="primary"
                    size="compact"
                    onClick={handleExecuteOcr}
                    disabled={isLoading}
                  >
                    <ScanText size={13} style={{ marginRight: "0.3rem" }} />
                    Reconhecer OCR
                  </Button>
                )}
              </div>
            )}
          </div>

          {activeCanvasTab === "flow" ? (
            <div className="studio-canvas__flow-view">{recipePanelElement}</div>
          ) : activeCanvasTab === "tool" && promotedFlow ? (
            <div className="studio-tool-wrapper">
              {promotedFlow.tool.id === "text-review" ? (
                <ReviewPanel
                  documentCore={documentCore}
                  revisionContext={
                    textRevisionContext ||
                    (activeProject && selectedDocument && artifacts.length > 0
                      ? {
                          projectPath: activeProject.path,
                          documentId: selectedDocument.id,
                          artifactId: artifacts[artifacts.length - 1].id,
                        }
                      : undefined)
                  }
                  onSuccess={async () => {
                    if (activeProject && selectedDocument && documentCore) {
                      const updated = await documentCore.invoke("list_artifacts", {
                        projectPath: activeProject.path,
                        documentId: selectedDocument.id,
                      });
                      setArtifacts(updated);
                    }
                  }}
                />
              ) : promotedFlow.tool.id === "text-translate" ? (
                <TranslationPanel
                  documentCore={documentCore}
                  projectPath={activeProject?.path}
                  documentId={selectedDocument?.id}
                  artifactId={artifacts[artifacts.length - 1]?.id}
                />
              ) : promotedFlow.tool.id === "text-compare" ? (
                <TextComparePanel
                  documentCore={documentCore}
                  projectPath={activeProject?.path}
                  documentId={selectedDocument?.id}
                  artifactId={artifacts[artifacts.length - 1]?.id}
                />
              ) : promotedFlow.tool.id === "pdf-ocr" ? (
                <OcrPanel
                  documentCore={documentCore}
                  projectPath={activeProject?.path}
                  documentId={selectedDocument?.id}
                  artifactId={artifacts[artifacts.length - 1]?.id}
                />
              ) : promotedFlow.tool.id === "intelligence-extract" ? (
                <InformationExtractPanel
                  documentCore={documentCore}
                  projectPath={activeProject?.path}
                  documentId={selectedDocument?.id}
                  artifactId={artifacts[artifacts.length - 1]?.id}
                />
              ) : promotedFlow.tool.manifest.category === "pdf" ? (
                <PdfOverlayPanel />
              ) : promotedFlow.tool.manifest.category === "text" ? (
                <TextEditor />
              ) : (
                <DocumentViewerCanvas
                  documentTitle={
                    selectedDocument ? selectedDocument.title : "Doc. 02 - Laudo pericial.pdf"
                  }
                  pageCount={selectedDocument ? Math.max(12, artifacts.length * 4) : 42}
                  currentPage={activePage}
                  onPageChange={setActivePage}
                  activeEvidenceId={activeEvidenceId}
                  onSelectEvidence={(ev) => setActiveEvidenceId(ev.id)}
                  scrollTargetRef={scrollTargetRef}
                />
              )}
            </div>
          ) : (
            <DocumentViewerCanvas
              documentTitle={
                selectedDocument ? selectedDocument.title : "Doc. 02 - Laudo pericial.pdf"
              }
              pageCount={selectedDocument ? Math.max(12, artifacts.length * 4) : 42}
              currentPage={activePage}
              onPageChange={setActivePage}
              activeEvidenceId={activeEvidenceId}
              onSelectEvidence={(ev) => setActiveEvidenceId(ev.id)}
              scrollTargetRef={scrollTargetRef}
            />
          )}
        </section>

        <ContextInspectorPanel
          isOpen={inspectorOpen}
          onToggleOpen={() => setInspectorOpen((prev) => !prev)}
          activeEvidenceId={activeEvidenceId}
          onSelectEvidenceRow={(id) => {
            setActiveEvidenceId(id);
            scrollTargetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          auditHealthy={auditReport ? auditReport.isHealthy : true}
          onAuditClick={handleAuditProject}
          promotedFlow={promotedFlow}
          artifacts={artifacts}
          isFlowView={activeCanvasTab === "flow"}
        />
      </main>
    </div>
  );
}
