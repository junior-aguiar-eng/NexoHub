import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { translate } from "@/i18n";
import type { LauncherTool } from "./model";

type ToolCardProps = {
  tool: LauncherTool;
  index: number;
};

export function ToolCard({ tool, index }: ToolCardProps) {
  const reduceMotion = useReducedMotion();
  const Icon = tool.icon;

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
        <span className="status-badge">{translate("tools.comingSoon")}</span>
      </div>
      <div>
        <h3>{translate(tool.titleKey)}</h3>
        <p>{translate(tool.descriptionKey)}</p>
      </div>
      <span className="tool-card__future" aria-hidden="true">
        <ArrowUpRight size={18} />
      </span>
    </motion.article>
  );
}
