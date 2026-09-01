import { translate } from "@/i18n";
import type { LauncherTool } from "./model";
import { ToolCard } from "./ToolCard";

type QuickToolGridProps = {
  tools: readonly LauncherTool[];
  onPromote: (tool: LauncherTool) => void;
};

export function QuickToolGrid({ tools, onPromote }: QuickToolGridProps) {
  return (
    <section className="section-block" aria-labelledby="quick-tools-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{translate("tools.eyebrow")}</p>
          <h2 id="quick-tools-title">{translate("tools.title")}</h2>
        </div>
        <p>{translate("tools.description")}</p>
      </div>
      {tools.length > 0 ? (
        <div className="tool-grid">
          {tools.map((tool, index) => (
            <ToolCard key={tool.id} tool={tool} index={index} onPromote={onPromote} />
          ))}
        </div>
      ) : (
        <p className="empty-search" role="status">
          {translate("tools.empty")}
        </p>
      )}
    </section>
  );
}
