/** Guard único da ferramenta ativa; protege navegação SPA sem guardar conteúdo documental. */
let guard: (() => boolean) | undefined;
export function registerToolNavigationGuard(next: () => boolean): () => void {
  guard = next;
  return () => {
    if (guard === next) guard = undefined;
  };
}
export function allowToolNavigation(): boolean {
  return guard?.() ?? true;
}
