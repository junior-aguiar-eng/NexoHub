import type { NexoFlowSnapshot } from "@nexohub/domain";
import { FileText, FolderOpen, Library, PanelLeftClose, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LauncherTool } from "@/features/launcher/model";
import { browserRecipeStorage, RecipePanel } from "@/features/recipes";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";
import { AnchorPanel } from "./AnchorPanel";
import { OcrPanel } from "./OcrPanel";
import { PdfOverlayPanel } from "./PdfOverlayPanel";
import { ReviewPanel } from "./ReviewPanel";
import { TextEditor } from "./TextEditor";
import { TranslationPanel } from "./TranslationPanel";

type StudioWorkspaceProps = {
  onClose: () => void;
  documentCore?: DocumentCorePort;
  textRevisionContext?: {
    readonly projectPath: string;
    readonly documentId: import("@nexohub/domain").DocumentId;
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
  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="studio-header__identity">
          <span className="brand__mark" aria-hidden="true">
            N
          </span>
          <div>
            <span className="eyebrow">{translate("studio.workspace.eyebrow")}</span>
            <strong>{translate("studio.workspace.title")}</strong>
          </div>
        </div>
        <Button variant="ghost" onClick={onClose}>
          <PanelLeftClose size={18} aria-hidden="true" />
          {translate("studio.workspace.close")}
        </Button>
      </header>

      <main id="main-content" className="studio-layout">
        <aside className="studio-panel studio-tree" aria-labelledby="studio-tree-title">
          <div className="studio-panel__heading">
            <Library size={17} aria-hidden="true" />
            <h2 id="studio-tree-title">{translate("studio.tree.title")}</h2>
          </div>
          <div className="studio-panel__empty">
            <FolderOpen size={24} aria-hidden="true" />
            <p>{translate("studio.tree.empty")}</p>
          </div>
        </aside>

        <section className="studio-canvas" aria-labelledby="studio-canvas-title">
          <div className="studio-tabs" role="tablist" aria-label={translate("studio.tabs.label")}>
            <span role="tab" aria-selected="true" tabIndex={0}>
              {translate("studio.tabs.welcome")}
            </span>
          </div>
          <div className="studio-canvas__empty">
            <span className="studio-canvas__icon" aria-hidden="true">
              <FileText size={30} />
            </span>
            <p className="eyebrow">{translate("studio.canvas.eyebrow")}</p>
            <h1 id="studio-canvas-title">{translate("studio.canvas.title")}</h1>
            <p>{translate("studio.canvas.description")}</p>
            <Button variant="primary" disabled>
              {translate("studio.canvas.openProject")}
              <span className="status-badge">{translate("tools.comingSoon")}</span>
            </Button>
            {promotedFlow?.tool.manifest.category === "text" &&
              !["text-translate", "text-review"].includes(promotedFlow.tool.id) && <TextEditor />}
            {promotedFlow?.tool.id === "text-translate" && <TranslationPanel />}
            {promotedFlow?.tool.id === "text-review" && (
              <ReviewPanel documentCore={documentCore} revisionContext={textRevisionContext} />
            )}
            {promotedFlow?.tool.manifest.category === "pdf" && <PdfOverlayPanel />}
            {promotedFlow?.tool.id === "pdf-ocr" && <OcrPanel />}
          </div>
        </section>

        <aside className="studio-panel studio-inspector" aria-labelledby="studio-inspector-title">
          <div className="studio-panel__heading">
            <PanelRight size={17} aria-hidden="true" />
            <h2 id="studio-inspector-title">{translate("studio.inspector.title")}</h2>
          </div>
          <section className="studio-inspector__section" aria-labelledby="studio-layers-title">
            <h3 id="studio-layers-title">{translate("studio.layers.title")}</h3>
            <p>{translate("studio.layers.empty")}</p>
          </section>
          <section className="studio-inspector__section" aria-labelledby="studio-flow-title">
            <h3 id="studio-flow-title">{translate("studio.flow.title")}</h3>
            {promotedFlow ? (
              <div className="studio-flow-card">
                <span className="status-badge">{translate("studio.flow.draft")}</span>
                <strong>{translate(promotedFlow.tool.titleKey)}</strong>
                <p>{translate("studio.flow.promoted")}</p>
                <ol>
                  {promotedFlow.flow.steps.map((step) => (
                    <li key={step.id}>{step.toolId}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p>{translate("studio.flow.empty")}</p>
            )}
            <RecipePanel
              flow={promotedFlow?.flow}
              onSave={(recipe) => browserRecipeStorage.save(recipe)}
            />
          </section>
          <AnchorPanel />
        </aside>
      </main>
    </div>
  );
}
