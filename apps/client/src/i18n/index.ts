import { type MessageKey, ptBR } from "./pt-BR";

export const defaultLocale = "pt-BR" as const;

export function translate(key: MessageKey): string {
  return ptBR[key];
}
