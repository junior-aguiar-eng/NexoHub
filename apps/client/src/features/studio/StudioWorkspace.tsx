import type { DocumentId, NexoFlowSnapshot } from "@nexohub/domain";
import {
  BookOpen,
  CheckCircle2,
  FileCheck2,
  FileText,
  Minimize2,
  MoveVertical,
  PanelLeftClose,
  ScanText,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LauncherTool } from "@/features/launcher/model";
import { browserRecipeStorage, RecipePanel, runStudioRecipe } from "@/features/recipes";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";
import { ContextInspectorPanel } from "./ContextInspectorPanel";
import { DocumentHistoryModal } from "./DocumentHistoryModal";
import { DocumentTreeSidebar } from "./DocumentTreeSidebar";
import { DocumentViewerCanvas } from "./DocumentViewerCanvas";
import { OcrPanel } from "./OcrPanel";
import { PdfCompressPanel } from "./PdfCompressPanel";
import { PdfExtractImagesPanel } from "./PdfExtractImagesPanel";
import { PdfOrganizePanel } from "./PdfOrganizePanel";
import { PdfOverlayPanel } from "./PdfOverlayPanel";
import { ReviewPanel } from "./ReviewPanel";
import { TextComparePanel } from "./TextComparePanel";
import { TextEditor } from "./TextEditor";
import { TranslationPanel } from "./TranslationPanel";
import { useStudioWorkspace } from "./useStudioWorkspace";

export type AdaptiveCenterMode = "read" | "transform" | "review" | "automate";

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
  initialDocument?: import("@nexohub/domain").Document;
  initialProject?: { path: string; name: string };
};

function resolveInitialMode(promotedToolId?: string): AdaptiveCenterMode {
  if (!promotedToolId) return "read";
  if (["pdf-compress", "pdf-organize", "pdf-extract-images", "pdf-ocr"].includes(promotedToolId)) {
    return "transform";
  }
  if (
    [
      "text-review",
      "text-compare",
      "text-translate",
      "text-edit",
      "text-editor",
      "pdf-overlay",
    ].includes(promotedToolId)
  ) {
    return "review";
  }
  if (promotedToolId === "flow" || promotedToolId.includes("recipe")) {
    return "automate";
  }
  return "read";
}

export function StudioWorkspace({
  onClose,
  promotedFlow,
  documentCore,
  textRevisionContext,
  initialDocument,
  initialProject,
}: StudioWorkspaceProps) {
  const {
    activeProject,
    documents,
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
  } = useStudioWorkspace({ documentCore, initialDocument, initialProject });

  const [activeMode, setActiveMode] = useState<AdaptiveCenterMode>(() =>
    resolveInitialMode(promotedFlow?.tool.id),
  );

  const [selectedTransformTool, setSelectedTransformTool] = useState<string>(() =>
    promotedFlow && resolveInitialMode(promotedFlow.tool.id) === "transform"
      ? promotedFlow.tool.id
      : "pdf-compress",
  );

  const [selectedReviewTool, setSelectedReviewTool] = useState<string>(() =>
    promotedFlow && resolveInitialMode(promotedFlow.tool.id) === "review"
      ? promotedFlow.tool.id
      : "text-review",
  );

  useEffect(() => {
    if (promotedFlow) {
      const mode = resolveInitialMode(promotedFlow.tool.id);
      setActiveMode(mode);
      if (mode === "transform") {
        setSelectedTransformTool(promotedFlow.tool.id);
      } else if (mode === "review") {
        setSelectedReviewTool(promotedFlow.tool.id);
      }
    }
  }, [promotedFlow]);

  const MODES = [
    {
      id: "read" as const,
      labelKey: "studio.mode.read" as const,
      descKey: "studio.mode.readDesc" as const,
      icon: BookOpen,
    },
    {
      id: "transform" as const,
      labelKey: "studio.mode.transform" as const,
      descKey: "studio.mode.transformDesc" as const,
      icon: Wrench,
    },
    {
      id: "review" as const,
      labelKey: "studio.mode.review" as const,
      descKey: "studio.mode.reviewDesc" as const,
      icon: FileCheck2,
    },
    {
      id: "automate" as const,
      labelKey: "studio.mode.automate" as const,
      descKey: "studio.mode.automateDesc" as const,
      icon: Workflow,
    },
  ];

  function handleTabKeyDown(e: React.KeyboardEvent) {
    const currentIndex = MODES.findIndex((m) => m.id === activeMode);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % MODES.length;
      setActiveMode(MODES[nextIndex].id);
      document.getElementById(`tab-${MODES[nextIndex].id}`)?.focus();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + MODES.length) % MODES.length;
      setActiveMode(MODES[prevIndex].id);
      document.getElementById(`tab-${MODES[prevIndex].id}`)?.focus();
    }
  }

  const recipePanelElement = (
    <RecipePanel
      flow={promotedFlow?.flow}
      onSave={(recipe) => browserRecipeStorage.save(recipe)}
      onOpenArtifact={(_artifactId) => {
        // Artifact selection callback
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
          <Search size={14} className="studio-header__search-icon" aria-hidden="true" />
          <input
            type="text"
            className="studio-header__search-input"
            placeholder="Buscar no documento ou conteúdo..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            aria-label="Buscar no documento"
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
            <ShieldCheck size={15} className="studio-integrity-pill__icon" aria-hidden="true" />
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

          <div className="studio-header__avatar" title="Usuário Ativo" aria-hidden="true">
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
          onSearchClick={() => {
            const input = document.querySelector<HTMLInputElement>(".studio-header__search-input");
            input?.focus();
          }}
          onStrategyClick={() => {
            setInspectorOpen(true);
          }}
          onMonitoringClick={() => setIsHistoryModalOpen(true)}
          onProductionClick={() => setActiveMode("automate")}
          onReportsClick={handleAuditProject}
        />

        <section className="studio-canvas" aria-labelledby="studio-adaptive-title">
          <h2 id="studio-adaptive-title" className="visually-hidden">
            {translate("studio.adaptiveCenter.label")}
          </h2>

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
              role="alert"
            >
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
                aria-label="Dispensar mensagem de erro"
              >
                ✕
              </button>
            </div>
          )}

          {/* Barra de Navegação do Centro Adaptativo (5 Modos Canônicos WAI-ARIA) */}
          <div
            className="studio-canvas-nav"
            role="tablist"
            aria-label={translate("studio.adaptiveCenter.label")}
            onKeyDown={handleTabKeyDown}
          >
            <div className="studio-canvas-nav__tabs">
              {MODES.map((mode) => {
                const isActive = activeMode === mode.id;
                const isPromoted =
                  Boolean(promotedFlow) && resolveInitialMode(promotedFlow?.tool.id) === mode.id;
                const IconComponent = mode.icon;

                return (
                  <button
                    key={mode.id}
                    id={`tab-${mode.id}`}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${mode.id}`}
                    tabIndex={isActive ? 0 : -1}
                    className={`studio-canvas-nav__tab ${
                      isActive ? "studio-canvas-nav__tab--active" : ""
                    } ${isPromoted ? "studio-canvas-nav__tab--promoted" : ""}`}
                    onClick={() => setActiveMode(mode.id)}
                    title={translate(mode.descKey)}
                  >
                    <IconComponent size={14} aria-hidden="true" />
                    <span>{translate(mode.labelKey)}</span>
                    {isPromoted && (
                      <span className="status-badge status-badge--compact" aria-hidden="true">
                        Ativa
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Ações rápidas contextuais do modo ativo */}
            <div className="studio-canvas-nav__actions">
              {activeMode === "transform" && (
                <>
                  {selectedTransformTool === "pdf-compress" && (
                    <Button
                      variant="primary"
                      size="compact"
                      onClick={handleCompressPdf}
                      disabled={isLoading}
                    >
                      <Minimize2 size={13} style={{ marginRight: "0.3rem" }} aria-hidden="true" />
                      Comprimir PDF
                    </Button>
                  )}
                  {selectedTransformTool === "pdf-organize" && (
                    <Button
                      variant="primary"
                      size="compact"
                      onClick={handleOrganizePdf}
                      disabled={isLoading}
                    >
                      <MoveVertical
                        size={13}
                        style={{ marginRight: "0.3rem" }}
                        aria-hidden="true"
                      />
                      Organizar Páginas
                    </Button>
                  )}
                  {selectedTransformTool === "pdf-ocr" && (
                    <Button
                      variant="primary"
                      size="compact"
                      onClick={handleExecuteOcr}
                      disabled={isLoading}
                    >
                      <ScanText size={13} style={{ marginRight: "0.3rem" }} aria-hidden="true" />
                      Reconhecer OCR
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Painel do Centro Adaptativo (WAI-ARIA tabpanel) */}
          <div
            id={`panel-${activeMode}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeMode}`}
            className="studio-adaptive-panel"
            style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
          >
            {/* 1. MODO LER */}
            {activeMode === "read" && (
              <DocumentViewerCanvas
                documentTitle={selectedDocument?.title}
                hasDocument={Boolean(selectedDocument)}
                pageCount={selectedDocument ? Math.max(1, artifacts.length) : 0}
                currentPage={activePage}
                onPageChange={setActivePage}
                activeEvidenceId={activeEvidenceId}
                onSelectEvidence={(ev) => setActiveEvidenceId(ev.id)}
                scrollTargetRef={scrollTargetRef}
                pdfBlobUrl={activeBlobUrl}
                onDropFile={handleFileSelected}
                onImportClick={handleImportDocument}
                activeArtifactVersionName={
                  selectedArtifact
                    ? selectedArtifact.kind === "ORIGINAL"
                      ? "Original"
                      : "Derivado"
                    : undefined
                }
              />
            )}

            {/* 2. MODO TRANSFORMAR */}
            {activeMode === "transform" && (
              <div
                className="studio-tool-wrapper"
                style={{ display: "flex", flexDirection: "column", height: "100%" }}
              >
                {/* Seletor de sub-ferramentas de transformação */}
                <div
                  className="studio-subtool-selector"
                  role="toolbar"
                  aria-label="Ferramentas de transformação"
                >
                  <button
                    type="button"
                    className={`studio-subtool-pill ${
                      selectedTransformTool === "pdf-compress" ? "studio-subtool-pill--active" : ""
                    }`}
                    onClick={() => setSelectedTransformTool("pdf-compress")}
                  >
                    <Minimize2 size={13} aria-hidden="true" />
                    <span>Comprimir PDF</span>
                  </button>
                  <button
                    type="button"
                    className={`studio-subtool-pill ${
                      selectedTransformTool === "pdf-organize" ? "studio-subtool-pill--active" : ""
                    }`}
                    onClick={() => setSelectedTransformTool("pdf-organize")}
                  >
                    <MoveVertical size={13} aria-hidden="true" />
                    <span>Organizar Páginas</span>
                  </button>
                  <button
                    type="button"
                    className={`studio-subtool-pill ${
                      selectedTransformTool === "pdf-extract-images"
                        ? "studio-subtool-pill--active"
                        : ""
                    }`}
                    onClick={() => setSelectedTransformTool("pdf-extract-images")}
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    <span>Extrair Imagens</span>
                  </button>
                  <button
                    type="button"
                    className={`studio-subtool-pill ${
                      selectedTransformTool === "pdf-ocr" ? "studio-subtool-pill--active" : ""
                    }`}
                    onClick={() => setSelectedTransformTool("pdf-ocr")}
                  >
                    <ScanText size={13} aria-hidden="true" />
                    <span>Reconhecer OCR</span>
                  </button>
                </div>

                <div style={{ flex: 1, overflow: "auto" }}>
                  {selectedTransformTool === "pdf-compress" && (
                    <PdfCompressPanel
                      documentCore={documentCore}
                      projectPath={activeProject?.path}
                      document={selectedDocument}
                      artifacts={artifacts}
                      onSuccess={() => {
                        if (activeProject && selectedDocument) {
                          refreshDocumentState(activeProject.path, selectedDocument.id);
                        }
                      }}
                    />
                  )}
                  {selectedTransformTool === "pdf-organize" && (
                    <PdfOrganizePanel
                      documentCore={documentCore}
                      projectPath={activeProject?.path}
                      document={selectedDocument}
                      artifacts={artifacts}
                      onSuccess={() => {
                        if (activeProject && selectedDocument) {
                          refreshDocumentState(activeProject.path, selectedDocument.id);
                        }
                      }}
                    />
                  )}
                  {selectedTransformTool === "pdf-extract-images" && (
                    <PdfExtractImagesPanel
                      documentCore={documentCore}
                      projectPath={activeProject?.path}
                      activeDocument={selectedDocument}
                      artifacts={artifacts}
                      onSuccess={() => {
                        if (activeProject && selectedDocument) {
                          refreshDocumentState(activeProject.path, selectedDocument.id);
                        }
                      }}
                    />
                  )}
                  {selectedTransformTool === "pdf-ocr" && (
                    <OcrPanel
                      documentCore={documentCore}
                      projectPath={activeProject?.path}
                      documentId={selectedDocument?.id}
                      artifactId={artifacts[artifacts.length - 1]?.id}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 3. MODO REVISAR */}
            {activeMode === "review" && (
              <div
                className="studio-tool-wrapper"
                style={{ display: "flex", flexDirection: "column", height: "100%" }}
              >
                {/* Seletor de sub-ferramentas de revisão */}
                <div
                  className="studio-subtool-selector"
                  role="toolbar"
                  aria-label="Ferramentas de revisão"
                >
                  <button
                    type="button"
                    className={`studio-subtool-pill ${
                      selectedReviewTool === "text-review" ? "studio-subtool-pill--active" : ""
                    }`}
                    onClick={() => setSelectedReviewTool("text-review")}
                  >
                    <CheckCircle2 size={13} aria-hidden="true" />
                    <span>Revisar Texto</span>
                  </button>
                  <button
                    type="button"
                    className={`studio-subtool-pill ${
                      selectedReviewTool === "text-compare" ? "studio-subtool-pill--active" : ""
                    }`}
                    onClick={() => setSelectedReviewTool("text-compare")}
                  >
                    <FileText size={13} aria-hidden="true" />
                    <span>Comparar Versões</span>
                  </button>
                  <button
                    type="button"
                    className={`studio-subtool-pill ${
                      selectedReviewTool === "text-translate" ? "studio-subtool-pill--active" : ""
                    }`}
                    onClick={() => setSelectedReviewTool("text-translate")}
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    <span>Traduzir Texto</span>
                  </button>
                  <button
                    type="button"
                    className={`studio-subtool-pill ${
                      selectedReviewTool === "text-editor" || selectedReviewTool === "text-edit"
                        ? "studio-subtool-pill--active"
                        : ""
                    }`}
                    onClick={() => setSelectedReviewTool("text-editor")}
                  >
                    <FileText size={13} aria-hidden="true" />
                    <span>Editor UTF-8</span>
                  </button>
                  <button
                    type="button"
                    className={`studio-subtool-pill ${
                      selectedReviewTool === "pdf-overlay" ? "studio-subtool-pill--active" : ""
                    }`}
                    onClick={() => setSelectedReviewTool("pdf-overlay")}
                  >
                    <FileCheck2 size={13} aria-hidden="true" />
                    <span>Overlay PDF</span>
                  </button>
                </div>

                <div style={{ flex: 1, overflow: "auto" }}>
                  {selectedReviewTool === "text-review" && (
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
                  )}
                  {selectedReviewTool === "text-compare" && (
                    <TextComparePanel
                      documentCore={documentCore}
                      projectPath={activeProject?.path}
                      documentId={selectedDocument?.id}
                      artifactId={artifacts[artifacts.length - 1]?.id}
                    />
                  )}
                  {selectedReviewTool === "text-translate" && (
                    <TranslationPanel
                      documentCore={documentCore}
                      projectPath={activeProject?.path}
                      documentId={selectedDocument?.id}
                      artifactId={artifacts[artifacts.length - 1]?.id}
                    />
                  )}
                  {(selectedReviewTool === "text-editor" || selectedReviewTool === "text-edit") && (
                    <TextEditor />
                  )}
                  {selectedReviewTool === "pdf-overlay" && <PdfOverlayPanel />}
                </div>
              </div>
            )}

            {/* 4. MODO AUTOMATIZAR */}
            {activeMode === "automate" && (
              <div className="studio-canvas__flow-view" style={{ flex: 1, overflow: "auto" }}>
                {recipePanelElement}
              </div>
            )}
          </div>
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
          isFlowView={activeMode === "automate"}
          onOpenHistory={() => setIsHistoryModalOpen(true)}
          onSelectArtifact={(art) => setSelectedArtifact(art)}
          selectedArtifactId={selectedArtifact?.id}
          facts={currentFacts}
          onAddFact={handleAddFact}
          onRemoveFact={handleRemoveFact}
          timelineSteps={currentTimeline}
          onAddTimelineStep={handleAddTimelineStep}
        />

        {/* Modal de Histórico e Linhagem SQLite */}
        <DocumentHistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          document={selectedDocument}
          artifacts={artifacts}
          edges={lineageEdges}
          selectedArtifactId={selectedArtifact?.id}
          onSelectArtifact={(art) => {
            setSelectedArtifact(art);
            setIsHistoryModalOpen(false);
          }}
        />

        <input
          ref={fileInputRef}
          type="file"
          className="visually-hidden"
          accept=".pdf,.docx,.txt,.md,.json,image/*"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileSelected(e.target.files[0]);
              e.target.value = "";
            }
          }}
          aria-label="Selecionar arquivo para o Studio"
        />
      </main>
    </div>
  );
}
