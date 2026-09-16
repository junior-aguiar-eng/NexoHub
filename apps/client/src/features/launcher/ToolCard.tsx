import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { translate } from "@/i18n";
import type { LauncherTool } from "./model";

type ToolCardProps = {
  tool: LauncherTool;
  index: number;
  onPromote?: (tool: LauncherTool) => void;
  onRunTool?: (tool: LauncherTool) => void;
};

export function ToolCard({ tool, index, onRunTool }: ToolCardProps) {
  const reduceMotion = useReducedMotion();
  const Icon = tool.icon;
  const accent = tool.accentColor || "var(--color-brand)";
  const isAvailable = tool.availability.available;
  const unavailableReason = isAvailable ? undefined : tool.availability.reasons.join(" ");

  return (
    <motion.article
      className="tool-card"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.25, delay: reduceMotion ? 0 : index * 0.03 }}
      tabIndex={isAvailable ? 0 : -1}
      role="button"
      aria-label={translate(tool.titleKey)}
      style={
        {
          cursor: isAvailable ? "pointer" : "default",
          "--tool-accent": accent,
        } as React.CSSProperties
      }
      onClick={() => {
        if (isAvailable && onRunTool) {
          onRunTool(tool);
        }
      }}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && isAvailable && onRunTool) {
          e.preventDefault();
          onRunTool(tool);
        }
      }}
    >
      <div className="tool-card__topline">
        <span
          className="tool-card__icon"
          style={{
            color: accent,
            backgroundColor: `${accent}18`,
          }}
          aria-hidden="true"
        >
          <Icon size={24} />
        </span>
      </div>

      <div className="tool-card__content">
        <h3 className="tool-card__title">{translate(tool.titleKey)}</h3>
        <p className="tool-card__desc">{translate(tool.descriptionKey)}</p>
      </div>

      <div className="tool-card__hover-arrow" aria-hidden="true">
        <ArrowRight size={14} style={{ color: accent }} />
      </div>
    </motion.article>
  );
}
