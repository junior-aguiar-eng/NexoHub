import { type ReactNode, useEffect, useState } from "react";
import { translate } from "@/i18n";
import "./ToolWorkspace.css";

export type WorkspaceView = "document" | "options" | "pages";
export function WorkspaceTabs({
  view,
  onChange,
  pages = false,
}: {
  readonly pages?: boolean;
  readonly view: WorkspaceView;
  readonly onChange: (view: WorkspaceView) => void;
}) {
  return (
    <fieldset className="workspace-tabs" aria-label={translate("workspaceLayout.views")}>
      {(pages
        ? (["document", "pages", "options"] as const)
        : (["document", "options"] as const)
      ).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={view === value}
          onClick={() => onChange(value)}
        >
          {translate(
            value === "document"
              ? "workspaceLayout.document"
              : value === "pages"
                ? "workspaceLayout.pages"
                : "workspaceLayout.options",
          )}
        </button>
      ))}
    </fieldset>
  );
}
interface Props {
  readonly titleId: string;
  readonly header: ReactNode;
  readonly toolbar?: ReactNode;
  readonly options: ReactNode;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly documentReady?: boolean;
}
/** Apresentação apenas: alternar regiões nunca desmonta o documento nem as opções. */
export function ToolWorkspace({
  titleId,
  header,
  toolbar,
  options,
  actions,
  children,
  className = "",
  documentReady,
}: Props) {
  const [view, setView] = useState<WorkspaceView>("document");
  useEffect(() => {
    if (documentReady) setView("document");
  }, [documentReady]);
  return (
    <section
      className={`tool-workspace ${className}`}
      aria-labelledby={titleId}
      data-workspace-view={view}
    >
      <header className="tool-workspace-header">{header}</header>
      {toolbar && <div className="tool-workspace-toolbar">{toolbar}</div>}
      <WorkspaceTabs view={view} onChange={setView} />
      <div className="tool-workspace-body">
        <section
          className="tool-workspace-document"
          data-workspace-part="document"
          aria-label={translate("workspaceLayout.documentRegion")}
        >
          {children}
        </section>
        <aside className="tool-workspace-sidebar" aria-label={translate("workspaceLayout.options")}>
          <div className="tool-workspace-options" data-workspace-part="options">
            {options}
          </div>
        </aside>
        {actions && (
          <section
            className="tool-workspace-actions"
            aria-label={translate("workspaceLayout.actions")}
          >
            {actions}
          </section>
        )}
      </div>
    </section>
  );
}
