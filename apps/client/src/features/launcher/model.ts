import type { LucideIcon } from "lucide-react";
import type { MessageKey } from "@/i18n/pt-BR";

export type SuiteId = "overview" | "pdf" | "text" | "intelligence";

export type Suite = {
  id: SuiteId;
  labelKey: MessageKey;
};

export type LauncherTool = {
  id: string;
  suite: Exclude<SuiteId, "overview">;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  icon: LucideIcon;
  status: "coming-soon";
};
