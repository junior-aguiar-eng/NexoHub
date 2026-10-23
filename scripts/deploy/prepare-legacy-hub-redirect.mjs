#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const OLD_HOST = "nexohub.nexojuris.ia.br";
const NEW_HOST = "nexojuris.ia.br";

export function buildLegacyHubRedirect(input) {
  const map = structuredClone(input);
  const hostRules = map.hostRules?.filter((rule) => rule.hosts?.includes(OLD_HOST)) ?? [];
  if (hostRules.length !== 1) {
    throw new Error(`Esperava uma regra de host única para ${OLD_HOST}.`);
  }

  const hostRule = hostRules[0];
  if (hostRule.hosts.length !== 1) {
    throw new Error(`O matcher de ${OLD_HOST} precisa ser isolado de outros hosts.`);
  }
  if (
    map.hostRules.some((rule) => rule !== hostRule && rule.pathMatcher === hostRule.pathMatcher)
  ) {
    throw new Error("O matcher também atende outra regra de host.");
  }

  const matchers =
    map.pathMatchers?.filter((matcher) => matcher.name === hostRule.pathMatcher) ?? [];
  if (matchers.length !== 1) {
    throw new Error(`Matcher ${hostRule.pathMatcher} ausente ou duplicado.`);
  }

  const matcher = matchers[0];
  if (matcher.routeRules?.length) {
    throw new Error("O matcher possui routeRules; não é seguro substituir sem análise manual.");
  }
  if (matcher.pathRules?.length) {
    throw new Error("O matcher possui pathRules; não é seguro substituir sem análise manual.");
  }
  if (matcher.defaultUrlRedirect) {
    throw new Error("O matcher já possui um redirecionamento padrão.");
  }
  if (matcher.defaultRouteAction) {
    throw new Error("O matcher possui defaultRouteAction; revise a ação antes de continuar.");
  }

  const redirect = {
    hostRedirect: NEW_HOST,
    redirectResponseCode: "MOVED_PERMANENTLY_DEFAULT",
    stripQuery: false,
  };

  // A default redirect prepends this prefix to the entire incoming path (including '/').
  matcher.defaultUrlRedirect = { ...redirect, prefixRedirect: "/hub" };
  matcher.pathRules = [
    ...(matcher.pathRules ?? []),
    { paths: ["/hub", "/hub/*"], urlRedirect: redirect },
  ];
  // URL map API allows only one default action per path matcher.
  delete matcher.defaultService;

  delete map.id;
  delete map.kind;
  delete map.creationTimestamp;
  delete map.selfLink;
  return map;
}

async function main() {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    throw new Error("Uso: prepare-legacy-hub-redirect.mjs MAPA_ATUAL.json MAPA_CANDIDATO.json");
  }
  const input = JSON.parse(await readFile(inputPath, "utf8"));
  const result = buildLegacyHubRedirect(input);
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`Mapa candidato gravado em ${outputPath}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
