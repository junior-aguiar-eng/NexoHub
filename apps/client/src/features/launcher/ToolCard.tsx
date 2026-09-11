import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { LauncherTool } from "./model";

type ToolCardProps = {
  tool: LauncherTool;
  index: number;
  onPromote: (tool: LauncherTool) => void;
};

export function ToolCard({ tool, index, onPromote }: ToolCardProps) {
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
      <div className="tool-card__footer">
        <Button variant="ghost" className="tool-card__action-btn" onClick={() => onPromote(tool)}>
          <span className="tool-card__action-label">{translate("tools.openStudio")}</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </motion.article>
  );
}
