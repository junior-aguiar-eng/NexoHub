import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type DragEvent, useState } from "react";
import { translate } from "@/i18n";
import type { LauncherTool } from "./model";

type ToolCardProps = {
  tool: LauncherTool;
  index: number;
  onPromote?: (tool: LauncherTool) => void;
  onRunTool?: (tool: LauncherTool, initialFiles?: File[]) => void;
};

export function ToolCard({ tool, index, onPromote, onRunTool }: ToolCardProps) {
  const reduceMotion = useReducedMotion();
  const [isDragOver, setIsDragOver] = useState(false);
  const Icon = tool.icon;
  const accent = tool.accentColor || "var(--color-brand)";
  const isAvailable = tool.availability.available;

  function handleMouseEnter() {
    // Pré-carregamento dinâmico e silencioso de módulos pesados ao passar o mouse
    if (tool.id === "pdf-ocr") {
      import("tesseract.js").catch(() => {
        // Silencioso em caso de pre-warm
      });
    }
  }

  function handleDragOver(e: DragEvent<HTMLElement>) {
    if (!isAvailable) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    if (!isAvailable) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      onRunTool?.(tool, droppedFiles);
    }
  }

  return (
    <motion.article
      className={`tool-card ${isDragOver ? "tool-card--drag-over" : ""}`}
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
          borderColor: isDragOver ? accent : undefined,
          backgroundColor: isDragOver ? `${accent}12` : undefined,
        } as React.CSSProperties
      }
      onMouseEnter={handleMouseEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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

      {onPromote && (
        <button
          type="button"
          className="tool-card__promote-btn"
          style={{
            marginTop: "8px",
            fontSize: "0.75rem",
            color: "var(--color-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
            textDecoration: "underline",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onPromote(tool);
          }}
        >
          Continuar no Studio
        </button>
      )}

      <div className="tool-card__hover-arrow" aria-hidden="true">
        <ArrowRight size={14} style={{ color: accent }} />
      </div>
    </motion.article>
  );
}
