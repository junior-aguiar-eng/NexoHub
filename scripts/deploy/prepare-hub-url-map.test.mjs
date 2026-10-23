import assert from "node:assert/strict";
import test from "node:test";
import { buildHubUrlMap } from "./prepare-hub-url-map.mjs";

const backend = "https://www.googleapis.com/compute/v1/projects/example/global/backendServices/hub";
const fixture = () => ({
  name: "existing-map",
  fingerprint: "version-1",
  defaultService: "original-default",
  hostRules: [{ hosts: ["nexojuris.ia.br", "hml.nexojuris.ia.br"], pathMatcher: "shared" }],
  pathMatchers: [
    {
      name: "shared",
      defaultService: "forgelex",
      pathRules: [{ paths: ["/api/*"], service: "api" }],
    },
  ],
});

test("isola a raiz e preserva HML, API e backend padrão sem alterar o original", () => {
  const original = fixture();
  const before = structuredClone(original);
  const result = buildHubUrlMap(original, backend);
  assert.deepEqual(original, before);
  assert.equal(result.defaultService, "original-default");
  assert.equal(result.fingerprint, "version-1");
  assert.deepEqual(result.pathMatchers[0], original.pathMatchers[0]);
  assert.deepEqual(result.hostRules[0], { hosts: ["hml.nexojuris.ia.br"], pathMatcher: "shared" });
  const root = result.pathMatchers.find((item) => item.name === result.hostRules[1].pathMatcher);
  assert.equal(root.defaultService, "forgelex");
  assert.deepEqual(root.pathRules[0], original.pathMatchers[0].pathRules[0]);
  assert.deepEqual(
    root.pathRules.find((rule) => rule.paths.includes("/hub/*")),
    {
      paths: ["/hub/*"],
      service: backend,
      routeAction: { urlRewrite: { pathPrefixRewrite: "/" } },
    },
  );
  assert.equal(
    root.pathRules.find((rule) => rule.paths.includes("/hub")).urlRedirect.pathRedirect,
    "/hub/",
  );
});

test("recusa colisão com rotas existentes em /hub", () => {
  for (const path of ["/hub", "/hub/*", "/hub/arquivo", "/hub*"]) {
    const map = fixture();
    map.pathMatchers[0].pathRules.push({ paths: [path], service: "other" });
    assert.throws(() => buildHubUrlMap(map, backend), /conflito/i);
  }
});

test("recusa routeRules avançadas e host sem regra explícita", () => {
  const map = fixture();
  map.pathMatchers[0].routeRules = [{ priority: 1 }];
  assert.throws(() => buildHubUrlMap(map, backend), /routeRules/);
  const wildcard = fixture();
  wildcard.hostRules[0].hosts = ["*"];
  assert.throws(() => buildHubUrlMap(wildcard, backend), /host/i);
});

test("recusa backend inválido e preserva outras regras do mesmo host matcher", () => {
  assert.throws(() => buildHubUrlMap(fixture(), "https://example.com"), /backend/i);
  const map = fixture();
  map.pathMatchers[0].pathRules.push({ paths: ["/*"], service: "fallback" });
  assert.equal(buildHubUrlMap(map, backend).pathMatchers[1].pathRules[1].service, "fallback");
});
