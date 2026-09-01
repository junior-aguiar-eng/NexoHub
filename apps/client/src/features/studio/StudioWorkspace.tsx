import { FileText, FolderOpen, Library, PanelLeftClose, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type StudioWorkspaceProps = {
  onClose: () => void;
};

export function StudioWorkspace({ onClose }: StudioWorkspaceProps) {
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
          </div>
        </section>

        <aside className="studio-panel studio-inspector" aria-labelledby="studio-inspector-title">
          <div className="studio-panel__heading">
            <PanelRight size={17} aria-hidden="true" />
            <h2 id="studio-inspector-title">{translate("studio.inspector.title")}</h2>
          </div>
          <p>{translate("studio.inspector.empty")}</p>
        </aside>
      </main>
    </div>
  );
}
