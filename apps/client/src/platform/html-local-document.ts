/** Documento inerte: nunca inserir o HTML do usuário no DOM ativo. */
export function parseLocalHtml(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  template.content
    .querySelectorAll("script,iframe,object,embed,link,meta,base,template,noscript")
    .forEach((node) => {
      node.remove();
    });
  for (const element of template.content.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (
        attribute.name.startsWith("on") ||
        ["src", "srcset", "href", "poster", "action", "data", "background", "xlink:href"].includes(
          attribute.name.toLowerCase(),
        )
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return template.content;
}

export function localHtmlPreview(html: string): string {
  const root = parseLocalHtml(html);
  const container = document.createElement("div");
  container.append(root);
  const policy =
    "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${policy}"><meta charset="utf-8"></head><body>${container.innerHTML}</body></html>`;
}
