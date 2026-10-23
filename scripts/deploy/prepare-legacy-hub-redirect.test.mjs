import assert from "node:assert/strict";
import test from "node:test";
import { buildLegacyHubRedirect } from "./prepare-legacy-hub-redirect.mjs";

const source = () => ({
  name: "ratione-urlmap",
  id: "readonly-id",
  creationTimestamp: "readonly-time",
  defaultService:
    "https://www.googleapis.com/compute/v1/projects/ratione-nexojuris/global/backendServices/ratione-backend",
  hostRules: [{ hosts: ["nexohub.nexojuris.ia.br"], pathMatcher: "nexohub-matcher" }],
  pathMatchers: [
    {
      name: "nexohub-matcher",
      defaultService:
        "https://www.googleapis.com/compute/v1/projects/ratione-nexojuris/global/backendServices/nexohub-backend",
    },
  ],
});

test("redireciona somente o matcher antigo, preservando caminhos e query", () => {
  const input = source();
  const result = buildLegacyHubRedirect(input);
  const matcher = result.pathMatchers[0];

  assert.deepEqual(matcher.defaultUrlRedirect, {
    hostRedirect: "nexojuris.ia.br",
    redirectResponseCode: "MOVED_PERMANENTLY_DEFAULT",
    stripQuery: false,
    prefixRedirect: "/hub",
  });
  assert.deepEqual(matcher.pathRules, [
    {
      paths: ["/hub", "/hub/*"],
      urlRedirect: {
        hostRedirect: "nexojuris.ia.br",
        redirectResponseCode: "MOVED_PERMANENTLY_DEFAULT",
        stripQuery: false,
      },
    },
  ]);
  assert.equal(matcher.defaultService, undefined);
  assert.equal(input.pathMatchers[0].defaultService, source().pathMatchers[0].defaultService);
  assert.equal(result.defaultService, input.defaultService);
  assert.deepEqual(input.pathMatchers[0], source().pathMatchers[0]);
  assert.equal(result.id, undefined);
});

test("gera destinos sem barra duplicada na raiz e nas rotas antigas", () => {
  const matcher = buildLegacyHubRedirect(source()).pathMatchers[0];
  // Semantics observed in the public GCP responses: default prefix is prepended to the full path.
  for (const [path, expected] of [
    ["/?origem=subdominio", "https://nexojuris.ia.br/hub/?origem=subdominio"],
    ["/pdf?origem=subdominio", "https://nexojuris.ia.br/hub/pdf?origem=subdominio"],
  ]) {
    assert.equal(
      `https://${matcher.defaultUrlRedirect.hostRedirect}${matcher.defaultUrlRedirect.prefixRedirect}${path}`,
      expected,
    );
  }
});

test("recusa host compartilhado, matcher ausente, route rules ou redirect preexistente", () => {
  const shared = source();
  shared.hostRules[0].hosts.push("other.nexojuris.ia.br");
  assert.throws(() => buildLegacyHubRedirect(shared), /isolado/);

  const anotherRule = source();
  anotherRule.hostRules.push({ hosts: ["other.nexojuris.ia.br"], pathMatcher: "nexohub-matcher" });
  assert.throws(() => buildLegacyHubRedirect(anotherRule), /outra regra/);

  const missingMatcher = source();
  missingMatcher.pathMatchers = [];
  assert.throws(() => buildLegacyHubRedirect(missingMatcher), /ausente/);

  const advanced = source();
  advanced.pathMatchers[0].routeRules = [{ priority: 1 }];
  assert.throws(() => buildLegacyHubRedirect(advanced), /routeRules/);

  const pathRules = source();
  pathRules.pathMatchers[0].pathRules = [{ paths: ["/legacy/*"], service: "backend" }];
  assert.throws(() => buildLegacyHubRedirect(pathRules), /pathRules/);

  const existing = source();
  existing.pathMatchers[0].defaultUrlRedirect = { httpsRedirect: true };
  assert.throws(() => buildLegacyHubRedirect(existing), /redirecionamento/);

  const routeAction = source();
  routeAction.pathMatchers[0].defaultRouteAction = { urlRewrite: { pathPrefixRewrite: "/" } };
  assert.throws(() => buildLegacyHubRedirect(routeAction), /defaultRouteAction/);
});
