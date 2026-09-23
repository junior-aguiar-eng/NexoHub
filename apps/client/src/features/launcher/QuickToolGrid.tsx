import { translate } from "@/i18n";
import type { LauncherTool } from "./model";
import { ToolCard } from "./ToolCard";

type QuickToolGridProps = {
  tools: readonly LauncherTool[];
  onRunTool?: (tool: LauncherTool, initialFiles?: File[]) => void;
};

export function QuickToolGrid({ tools, onRunTool }: QuickToolGridProps) {
  return (
    <section
      className="section-block quick-tools-section quick-tools-section--clean"
      aria-label="Ferramentas"
    >
      {tools.length > 0 ? (
        <div className="tool-grid">
          {tools.map((tool, index) => (
            <ToolCard key={tool.id} tool={tool} index={index} onRunTool={onRunTool} />
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
