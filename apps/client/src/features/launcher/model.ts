import type { ToolAvailability, ToolManifest } from "@nexohub/tool-sdk";
import type { LucideIcon } from "lucide-react";
import type { MessageKey } from "@/i18n/pt-BR";

export type SuiteId =
  | "overview"
  | "processing"
  | "review"
  | "compliance"
  | "extraction"
  | "flow"
  | "pdf"
  | "security"
  | "text";

export type Suite = {
  id: SuiteId;
  labelKey: MessageKey;
  ariaLabel?: string;
};

export type LauncherTool = {
  manifest: ToolManifest;
  availability: ToolAvailability;
  id: ToolManifest["id"];
  suite: Exclude<SuiteId, "overview">;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
};
