import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Prepara um mapa candidato; não acessa o Google Cloud nem aplica alterações. */
export function buildHubUrlMap(input, backend) {
  if (
    !/^https:\/\/(www\.)?googleapis\.com\/compute\/v1\/projects\/[^/]+\/global\/backendServices\/[^/]+$/.test(
      backend,
    )
  ) {
    throw new Error("Informe o selfLink de um backend global do Google Cloud.");
  }
  const map = structuredClone(input);
  const host = "nexojuris.ia.br";
  const rules = map.hostRules?.filter((rule) => rule.hosts.includes(host));
  if (rules?.length !== 1)
    throw new Error("É necessário um host explícito e único para nexojuris.ia.br.");
  const rule = rules[0];
  const matcher = map.pathMatchers?.find((item) => item.name === rule.pathMatcher);
  if (!matcher) throw new Error("Path matcher da raiz não encontrado.");
  if (matcher.routeRules?.length) throw new Error("routeRules existentes exigem revisão manual.");
  if (matcher.pathRules?.some((item) => item.paths.some((path) => path.startsWith("/hub")))) {
    throw new Error("Conflito: já existem rotas no namespace /hub.");
  }
  const matcherName = "nexohub-root";
  if (map.pathMatchers.some((item) => item.name === matcherName)) {
    throw new Error("Conflito: path matcher nexohub-root já existe.");
  }
  const root = structuredClone(matcher);
  root.name = matcherName;
  root.pathRules = [
    ...(root.pathRules ?? []),
    {
      paths: ["/hub"],
      urlRedirect: {
        pathRedirect: "/hub/",
        redirectResponseCode: "MOVED_PERMANENTLY_DEFAULT",
        stripQuery: false,
      },
    },
    {
      paths: ["/hub/*"],
      service: backend,
      routeAction: { urlRewrite: { pathPrefixRewrite: "/" } },
    },
  ];
  if (rule.hosts.length === 1) rule.pathMatcher = matcherName;
  else {
    rule.hosts = rule.hosts.filter((name) => name !== host);
    map.hostRules.push({ hosts: [host], pathMatcher: matcherName });
  }
  map.pathMatchers.push(root);
  // Campos somente de leitura não integram o documento importável; fingerprint preserva a versão.
  for (const key of ["id", "kind", "creationTimestamp", "selfLink"]) delete map[key];
  return map;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [source, backend, destination] = process.argv.slice(2);
  if (!source || !backend || !destination || resolve(source) === resolve(destination)) {
    throw new Error(
      "Uso: node prepare-hub-url-map.mjs antes.json <backend-selfLink> candidato.json (arquivos distintos)",
    );
  }
  const candidate = buildHubUrlMap(JSON.parse(await readFile(source, "utf8")), backend);
  await writeFile(destination, `${JSON.stringify(candidate, null, 2)}\n`, { flag: "wx" });
  console.log("Mapa candidato preparado. Nenhuma alteração remota aplicada.");
}
