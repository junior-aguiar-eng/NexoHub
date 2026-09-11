import { ArrowUpRight, Play } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { LauncherTool } from "./model";

type ToolCardProps = {
  tool: LauncherTool;
  index: number;
  onPromote: (tool: LauncherTool) => void;
  onRunTool?: (tool: LauncherTool) => void;
};

export function ToolCard({ tool, index, onPromote, onRunTool }: ToolCardProps) {
  const reduceMotion = useReducedMotion();
  const Icon = tool.icon;
  const unavailableReason = tool.availability.available
    ? undefined
    : tool.availability.reasons.join(" ");

  return (
    <motion.article
      className="tool-card"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : index * 0.04 }}
      tabIndex={0}
      role="region"
      aria-label={translate(tool.titleKey)}
      style={{ cursor: tool.availability.available ? "pointer" : "default" }}
      onClick={(e) => {
        // Se o clique não foi em um botão filho, abre a ferramenta
        if ((e.target as HTMLElement).closest("button")) return;
        if (tool.availability.available && onRunTool) {
          onRunTool(tool);
        }
      }}
    >
      <div className="tool-card__topline">
        <span className="tool-card__icon" aria-hidden="true">
          <Icon size={21} />
        </span>
        <span className="status-badge" title={unavailableReason}>
          {translate(tool.availability.available ? "tools.available" : "tools.comingSoon")}
        </span>
      </div>
      <div className="tool-card__content">
        <h3>{translate(tool.titleKey)}</h3>
        <p>{translate(tool.descriptionKey)}</p>
      </div>
      <div
        className="tool-card__footer"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        {tool.availability.available && onRunTool ? (
          <Button
            variant="primary"
            className="tool-card__run-btn"
            onClick={() => onRunTool(tool)}
            style={{ padding: "0.35rem 0.75rem", fontSize: "0.8rem", gap: "0.35rem" }}
          >
            <Play size={13} aria-hidden="true" />
            <span>Executar</span>
          </Button>
        ) : (
          <div />
        )}
        <Button variant="ghost" className="tool-card__action-btn" onClick={() => onPromote(tool)}>
          <span className="tool-card__action-label">{translate("tools.openStudio")}</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </motion.article>
  );
}
