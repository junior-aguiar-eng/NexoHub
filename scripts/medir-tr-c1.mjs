import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(new URL("../apps/client/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { createServer } = await import(pathToFileURL(require.resolve("vite")).href);
const profiles = {
  m2m100: {
    id: "Xenova/m2m100_418M",
    revision: "9c374f0b7aca709787cea97b047bfbbd1559d177",
    family: "m2m100",
  },
  "opus-en": {
    id: "Xenova/opus-mt-en-ROMANCE",
    revision: "9d2ba69ac80c8e8453c3d9a1e2323a0e7b8ca3cd",
    family: "opus-en",
  },
  "opus-romance": {
    id: "Xenova/opus-mt-ROMANCE-en",
    revision: "f60feaabe8bb435a5871e7702b25f53a01e770f8",
    family: "opus-romance",
  },
};
const profileName = process.argv[2] ?? "m2m100";
const probe = process.argv.includes("--cache-probe");
const segmented = process.argv.includes("--segmented");
const runtimeProbe = process.argv.includes("--runtime-probe");
const artifact = `${profileName}${runtimeProbe ? "-runtime-probe" : probe ? "-cache-probe" : segmented ? "-segmented" : ""}`;
// RevisÃµes resolvidas da API pÃºblica sÃ£o passadas explicitamente pelo controlador.
const profile = {
  ...profiles[profileName],
  revision:
    process.argv[3] && !process.argv[3].startsWith("--")
      ? process.argv[3]
      : profiles[profileName].revision,
};
const output = resolve(root, ".superpowers/sdd/2026-10-26-tr-c1");
mkdirSync(output, { recursive: true });
writeFileSync(resolve(output, ".gitignore"), "*\n");
const record = { profile, probe, passes: [], requests: [], userAgent: "", errors: [] };
const save = () =>
  writeFileSync(resolve(output, `${artifact}-browser.json`), JSON.stringify(record, null, 2));
const server = await createServer({
  root: resolve(root, "apps/client"),
  server: {
    host: "127.0.0.1",
    port: 4193,
    strictPort: true,
    hmr: false,
    watch: { ignored: ["**/*"] },
  },
});
server.middlewares.use((req, res, next) => {
  if (req.url !== "/__tr_bench__") return next();
  res.setHeader("Content-Type", "text/html");
  res.end("<!doctype html><html lang='pt-BR'><title>TR-C1 local</title></html>");
});
let browser;
try {
  await server.listen();
  const profileDirectory =
    process.env.TR_C1_PROFILE ?? mkdtempSync(join(tmpdir(), `nh-${artifact}-`));
  console.log(JSON.stringify({ profileDirectory }));
  const context = await chromium.launchPersistentContext(profileDirectory, { headless: true });
  browser = context;
  record.context = "persistent";
  context.on("request", (request) => {
    if (request.url().startsWith("https://"))
      record.requests.push({
        url: new URL(request.url()).origin + new URL(request.url()).pathname,
        method: request.method(),
      });
  });
  const page = await context.newPage();
  await page.exposeFunction("recordTranslationEvent", (value) => {
    const pass = record.passes.at(-1);
    if (value.type === "sample") {
      pass.samples.push(value.sample);
      console.log(
        JSON.stringify({
          profile: profileName,
          source: value.sample.source,
          target: value.sample.target,
          id: value.sample.id,
          ms: value.sample.ms,
        }),
      );
    } else if (value.type === "initialized") pass.initializationMs = value.initializationMs;
    else if (value.type === "progress") {
      if (value.progress) {
        pass.runtimeProgress = value.progress;
        save();
        return;
      }
      const event = value.event;
      if (event.status === "progress")
        pass.files[event.file] = { loaded: event.loaded, total: event.total };
      if (event.status === "done") pass.doneFiles.push(event.file);
    }
    save();
  });
  await page.goto("http://127.0.0.1:4193/__tr_bench__");
  record.cacheProbeBefore = await page.evaluate(async () => {
    try {
      const cache = await caches.open("tr-c1-probe");
      await cache.put("/cache-probe", new Response("local"));
      return { available: true };
    } catch (error) {
      return { available: false, error: String(error) };
    }
  });
  record.userAgent = await page.evaluate(() => navigator.userAgent);
  for (const warm of segmented ? [false] : [false, true]) {
    if ((probe || runtimeProbe) && warm)
      await context.route("https://huggingface.co/**", (route) => route.abort("blockedbyclient"));
    record.passes.push({ warm, initializationMs: null, files: {}, doneFiles: [], samples: [] });
    save();
    console.log(JSON.stringify({ phase: warm ? "cached" : "first-load", profile: profileName }));
    await page.evaluate(
      async (data) => {
        await new Promise((done, fail) => {
          const worker = new Worker(
            new URL(
              data.runtimeProbe
                ? "/src/platform/translation.worker.ts"
                : "/src/platform/__fixtures__/tr-c1/candidate.worker.ts",
              location.href,
            ),
            { type: "module" },
          );
          const begun = performance.now();
          worker.onmessage = async ({ data: message }) => {
            if (data.runtimeProbe && message.type === "result") {
              await window.recordTranslationEvent({
                type: "sample",
                sample: {
                  id: "runtime-worker",
                  source: "pt",
                  target: "en",
                  input: data.text,
                  output: message.result.translatedText,
                  engine: message.result.engine,
                  ms: performance.now() - begun,
                },
              });
              worker.terminate();
              done();
              return;
            }
            await window.recordTranslationEvent(message);
            if (message.type === "done") {
              worker.terminate();
              done();
            }
            if (message.type === "error") {
              worker.terminate();
              fail(new Error(message.error ?? message.code));
            }
          };
          worker.onerror = (event) => {
            worker.terminate();
            fail(new Error(event.message));
          };
          worker.postMessage(data);
        });
      },
      {
        ...profile,
        warm: warm || probe,
        longOnly: segmented,
        baseline: !segmented && !probe && !runtimeProbe,
        runtimeProbe,
        id: runtimeProbe ? 1 : profile.id,
        text: "Maria Silva não autorizou o pagamento de 125 euros em 14/03/2026.",
        sourceLang: "pt",
        targetLang: "en",
      },
    );
  }
  record.cacheEntries = await page.evaluate(async () => {
    const result = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        if (!request.url.includes("huggingface.co")) continue;
        const response = await cache.match(request);
        if (!response) continue;
        const bytes = await response.arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
          .map((value) => value.toString(16).padStart(2, "0"))
          .join("");
        result.push({ url: request.url, bytes: bytes.byteLength, sha256: hash });
      }
    }
    return result;
  });
  record.completed = true;
} catch (error) {
  record.errors.push(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  save();
  await browser?.close();
  await server.close();
}
