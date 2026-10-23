/** Caminhos da aplicação independentes do ponto de montagem no domínio. */
export function withAppBase(path: string, base = import.meta.env.BASE_URL): string {
  return `${base.replace(/\/?$/, "/")}${path.replace(/^\/+/, "")}`;
}

export function withoutAppBase(pathname: string, base = import.meta.env.BASE_URL): string {
  const prefix = base.replace(/\/$/, "");
  if (!prefix) return pathname;
  if (pathname === prefix) return "/";
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}
