/** Guards da ferramenta ativa se compõem sem expor conteúdo documental. */
export type ToolNavigationReason = "tool" | "zone";
const guards = new Set<(reason: ToolNavigationReason) => boolean>();
export function registerToolNavigationGuard(
  next: (reason: ToolNavigationReason) => boolean,
): () => void {
  guards.add(next);
  return () => {
    guards.delete(next);
  };
}
export function allowToolNavigation(reason: ToolNavigationReason = "tool"): boolean {
  for (const guard of guards) if (!guard(reason)) return false;
  return true;
}
