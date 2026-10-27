import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, ".."),
  out = resolve(root, ".superpowers/sdd/2026-10-26-im-c4-avif");
const require = createRequire(resolve(root, "apps/client/package.json")),
  { chromium } = require("@playwright/test");
const requests = [];
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  const local = {
    "/worker.mjs": "worker.mjs",
    "/metrics.mjs": "metrics.mjs",
    "/corpus.mjs": "corpus.mjs",
  };
  if (path === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end("<!doctype html><title>IM-C4 ensaio isolado</title>");
    return;
  }
  const file = local[path]
    ? resolve(root, "scripts/avif", local[path])
    : resolve(out, `.${decodeURIComponent(path)}`);
  if (
    !local[path] &&
    (!file.startsWith(out + sep) ||
      (!/^\/(avif|jpeg|webp|wasm-feature-detect)\//.test(path) &&
        !/^\/(chelsea|coffee)\.png$/.test(path)))
  ) {
    res.writeHead(404);
    res.end();
    return;
  }
  try {
    let raw = readFileSync(file);
    requests.push(path);
    const mime = file.endsWith(".wasm")
      ? "application/wasm"
      : file.endsWith(".png")
        ? "image/png"
        : "text/javascript";
    if (mime === "text/javascript")
      raw = Buffer.from(
        raw
          .toString()
          .replace(/(['"])wasm-feature-detect\1/g, "'/wasm-feature-detect/dist/esm/index.js'"),
      );
    res.setHeader("Content-Type", mime);
    res.end(raw);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(4196, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("**/*", (route) =>
    route.request().url().startsWith("http://127.0.0.1:4196/") ? route.continue() : route.abort(),
  );
  await page.goto("http://127.0.0.1:4196/");
  const corpus = await page.evaluate(async () => {
    const { createCorpus } = await import("/corpus.mjs");
    const cases = await createCorpus();
    window.avifCases = cases;
    window.avifOutputs = new Map();
    return Promise.all(
      [...cases].map(async ([id, data]) => ({
        id,
        width: data.width,
        height: data.height,
        rgbaSha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", data.data))]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join(""),
      })),
    );
  });
  if (requests.some((path) => path.endsWith(".wasm")))
    throw Error("Codec carregado antes da seleção");
  const profiles = [
    { id: "jpeg75", codec: "jpeg", options: { quality: 75 } },
    { id: "webp75", codec: "webp", options: { quality: 75, alpha_quality: 100 } },
    {
      id: "avif50",
      codec: "avif",
      options: { quality: 50, qualityAlpha: 100, speed: 6, bitDepth: 8, subsample: 1 },
    },
    {
      id: "avif70",
      codec: "avif",
      options: { quality: 70, qualityAlpha: 100, speed: 6, bitDepth: 8, subsample: 1 },
    },
  ];
  const rows = [];
  for (const source of corpus)
    for (const profile of profiles) {
      await page.evaluate(() => {
        window.avifWorker = new Worker("/worker.mjs", { type: "module" });
      });
      for (let run = 0; run < 2; run++) {
        const row = await page.evaluate(
          async ({ id, profile }) => {
            const source = window.avifCases.get(id),
              worker = window.avifWorker;
            const result = await new Promise((resolve, reject) => {
              const timer = setTimeout(() => {
                worker.terminate();
                reject(Error("TIMEOUT_30000"));
              }, 30000);
              worker.onmessage = ({ data }) => {
                if (data.phase) return;
                clearTimeout(timer);
                resolve(data);
              };
              worker.onerror = (e) => {
                clearTimeout(timer);
                reject(Error(e.message));
              };
              const pixels = source.data.slice();
              worker.postMessage(
                { ...profile, pixels, width: source.width, height: source.height },
                [pixels.buffer],
              );
            });
            if (result.error) throw Error(result.error);
            const { comparePixels } = await import("/metrics.mjs");
            const mime = profile.codec === "jpeg" ? "image/jpeg" : `image/${profile.codec}`;
            let native;
            try {
              const bitmap = await createImageBitmap(new Blob([result.bytes], { type: mime }));
              const canvas = new OffscreenCanvas(bitmap.width, bitmap.height),
                ctx = canvas.getContext("2d");
              ctx.drawImage(bitmap, 0, 0);
              native = comparePixels(source, ctx.getImageData(0, 0, canvas.width, canvas.height));
              bitmap.close();
            } catch (error) {
              native = { error: String(error) };
            }
            window.avifOutputs.set(`${id}/${profile.id}`, new Blob([result.bytes], { type: mime }));
            return { ...result, native, bytes: Array.from(new Uint8Array(result.bytes)) };
          },
          { id: source.id, profile },
        );
        const bytes = Buffer.from(row.bytes);
        delete row.bytes;
        writeFileSync(resolve(out, `${source.id}-${profile.id}-${run}.${profile.codec}`), bytes);
        rows.push({
          source: source.id,
          profile: profile.id,
          run,
          ...row,
          outputBytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
        console.log(JSON.stringify(rows.at(-1)));
      }
      await page.evaluate(() => window.avifWorker.terminate());
    }
  const cancellation = await page.evaluate(async () => {
    const source = window.avifCases.get("coffee-upscale-6mp"),
      worker = new Worker("/worker.mjs", { type: "module" });
    let lateResults = 0;
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.terminate();
        reject(Error("CANCEL_PROBE_TIMEOUT"));
      }, 30000);
      worker.onerror = (e) => {
        clearTimeout(timer);
        reject(Error(e.message));
      };
      worker.onmessage = ({ data }) => {
        if (data.phase === "encode") {
          const start = performance.now();
          setTimeout(() => {
            worker.terminate();
            clearTimeout(timer);
            resolve({ terminatedAfterPhaseMs: performance.now() - start });
          }, 10);
        } else lateResults++;
      };
      const pixels = source.data.slice();
      worker.postMessage(
        {
          codec: "avif",
          options: { quality: 50, speed: 6 },
          pixels,
          width: source.width,
          height: source.height,
        },
        [pixels.buffer],
      );
    });
    await new Promise((done) => setTimeout(done, 200));
    return { ...result, lateResults };
  });
  const invalid = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const worker = new Worker("/worker.mjs", { type: "module" });
        const timer = setTimeout(() => {
          worker.terminate();
          reject(Error("INVALID_PROBE_TIMEOUT"));
        }, 5000);
        worker.onmessage = ({ data }) => {
          clearTimeout(timer);
          worker.terminate();
          resolve(data);
        };
        worker.onerror = (e) => {
          clearTimeout(timer);
          worker.terminate();
          reject(Error(e.message));
        };
        worker.postMessage({ codec: "avif", invalid: true });
      }),
  );
  const recovery = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const source = window.avifCases.get("coffee"),
          worker = new Worker("/worker.mjs", { type: "module" });
        const timer = setTimeout(() => {
          worker.terminate();
          reject(Error("RECOVERY_TIMEOUT"));
        }, 10000);
        worker.onerror = (event) => {
          clearTimeout(timer);
          worker.terminate();
          reject(Error(event.message));
        };
        worker.onmessage = async ({ data }) => {
          if (data.phase) return;
          clearTimeout(timer);
          worker.terminate();
          if (data.error) {
            reject(Error(data.error));
            return;
          }
          resolve({
            outputBytes: data.bytes.byteLength,
            sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", data.bytes))]
              .map((x) => x.toString(16).padStart(2, "0"))
              .join(""),
          });
        };
        const pixels = source.data.slice();
        worker.postMessage(
          {
            codec: "avif",
            options: { quality: 50, qualityAlpha: 100, speed: 6, bitDepth: 8, subsample: 1 },
            pixels,
            width: source.width,
            height: source.height,
          },
          [pixels.buffer],
        );
      }),
  );
  const unchanged = await page.evaluate(async () =>
    Promise.all(
      [...window.avifCases].map(async ([id, data]) => ({
        id,
        rgbaSha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", data.data))]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join(""),
      })),
    ),
  );
  if (
    unchanged.some(
      (row) => row.rgbaSha256 !== corpus.find((source) => source.id === row.id).rgbaSha256,
    )
  )
    throw Error("Original alterado");
  const sheet = await page.evaluate(async (profiles) => {
    const ids = ["chelsea", "coffee", "alpha-ramps", "text", "edges", "odd-alpha"],
      canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = ids.length * 260;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [row, id] of ids.entries())
      for (let col = 0; col < 5; col++) {
        const source = window.avifCases.get(id);
        let image;
        if (col === 0) {
          image = new OffscreenCanvas(source.width, source.height);
          image.getContext("2d").putImageData(source, 0, 0);
        } else
          image = await createImageBitmap(window.avifOutputs.get(`${id}/${profiles[col - 1].id}`));
        ctx.fillStyle = "#111";
        ctx.font = "16px sans-serif";
        ctx.fillText(
          `${id} / ${col === 0 ? "original" : profiles[col - 1].id}`,
          col * 320 + 4,
          row * 260 + 20,
        );
        const scale = Math.min(310 / source.width, 230 / source.height);
        ctx.drawImage(
          image,
          col * 320 + 4,
          row * 260 + 25,
          source.width * scale,
          source.height * scale,
        );
        image.close?.();
      }
    return canvas.toDataURL("image/png").split(",")[1];
  }, profiles);
  writeFileSync(resolve(out, "comparison-sheet.png"), Buffer.from(sheet, "base64"));
  const result = {
    measuredAtUtc: new Date().toISOString(),
    base: "fc24a3b",
    scope: "ensaio isolado; sem integração ao aplicativo",
    userAgent: await page.evaluate(() => navigator.userAgent),
    device: "Windows; Ryzen 5 3550H; 32 GB RAM",
    crossOriginIsolated: await page.evaluate(() => crossOriginIsolated),
    profiles,
    corpus,
    rows,
    cancellation,
    invalid,
    recovery,
    originalsUnchanged: true,
    requests: [...new Set(requests)],
    memoryScope:
      "Soma dos buffers WebAssembly.Memory observados e retidos pelo instrumento; não é pico físico, RSS, Canvas ou heap total. Cold inclui import/init, warm reutiliza o mesmo worker por caso/perfil.",
  };
  writeFileSync(resolve(out, "comparison.json"), `${JSON.stringify(result, null, 2)}\n`);
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
