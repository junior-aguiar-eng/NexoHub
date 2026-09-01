import type { ToolAvailability, ToolManifest } from "@nexohub/tool-sdk";
import type { LucideIcon } from "lucide-react";
import type { MessageKey } from "@/i18n/pt-BR";

export type SuiteId = "overview" | "pdf" | "text" | "intelligence";

export type Suite = {
  id: SuiteId;
  labelKey: MessageKey;
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
