import { readFile, writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  explicitHtmlBreaks,
  longHtmlTable,
  oversizedHtmlHeader,
  wideUnicodeHtmlTable,
} from "../src/platform/__fixtures__/doc-c3/corpus";

async function inspectHtmlOutput(bytes: Uint8Array) {
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const width = page.view[2] - page.view[0],
        height = page.view[3] - page.view[1];
      for (const item of content.items)
        if ("str" in item && item.str.trim()) {
          expect(item.transform[4]).toBeGreaterThanOrEqual(0);
          expect(item.transform[4] + item.width).toBeLessThanOrEqual(width + 0.5);
          expect(item.transform[5]).toBeGreaterThan(0);
          expect(item.transform[5] + item.height).toBeLessThanOrEqual(height);
        }
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " "),
      );
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

for (const [name, html] of [
  ["tabela longa", longHtmlTable],
  ["tabela larga Unicode", wideUnicodeHtmlTable],
  ["quebras explícitas", explicitHtmlBreaks],
  [
    "quebras de lista",
    '<ul><li>PRIMEIRO</li><li style="break-before:page">SEGUNDO</li><li style="break-after:page">TERCEIRO</li><li>QUARTO</li></ul>',
  ],
  [
    "quebras de tabela",
    '<table><thead><tr><th>Cabecalho</th></tr></thead><tr><td>PRIMEIRO</td></tr><tr style="page-break-before:always"><td>SEGUNDO</td></tr><tr style="break-after:page"><td>TERCEIRO</td></tr><tr><td>QUARTO</td></tr></table>',
  ],
] as const) {
  test(`DOC-C3 preserva ${name} no PDF exportado`, async ({ page }, testInfo) => {
    await open(page, "HTML para PDF");
    await page.getByRole("button", { name: "Digitar / Colar Código HTML", exact: true }).click();
    await page.getByTestId("html-code-input").fill(html);
    const runs = [];
    for (let run = 0; run < 2; run++) {
      const started = performance.now();
      const bytes = await exportFile(page);
      const elapsedMs = performance.now() - started;
      const pages = await inspectHtmlOutput(bytes);
      if (name === "tabela longa") {
        expect(pages.length).toBeGreaterThan(2);
        for (const text of pages) expect(text).toContain("Identificador");
        expect(pages.at(-1)).toContain("FIM-TABELA");
        for (let row = 0; row < 110; row++) expect(pages.join(" ")).toContain(`Registro ${row}`);
      } else if (name === "tabela larga Unicode") {
        expect(pages.at(-1)).toContain("ULTIMO-UNICODE");
        const all = pages.join(" ").replace(/\s/g, "");
        for (let row = 0; row < 12; row++)
          for (let col = 0; col < 8; col++)
            expect(all).toContain(`R${row}C${col}—中文✅${"L".repeat(35)}`);
      } else {
        expect(pages).toHaveLength(3);
        expect(pages[0]).toContain("PRIMEIRO");
        expect(pages[1]).toContain("SEGUNDO");
        expect(pages[1]).toContain("TERCEIRO");
        expect(pages[2]).toContain("QUARTO");
        if (name === "quebras de tabela")
          for (const text of pages) expect(text).toContain("Cabecalho");
      }
      runs.push({ run, elapsedMs, bytes: bytes.length, pages: pages.length });
      const pdfPath = testInfo.outputPath(`doc-c3-${run}.pdf`);
      await writeFile(pdfPath, bytes);
      await testInfo.attach(`doc-c3-${run}.pdf`, { path: pdfPath, contentType: "application/pdf" });
      await page.getByRole("button", { name: "Processar outro arquivo", exact: true }).click();
      await page.getByRole("button", { name: "Digitar / Colar Código HTML", exact: true }).click();
      await page.getByTestId("html-code-input").fill(html);
    }
    const metricsPath = testInfo.outputPath("doc-c3-metrics.json");
    await writeFile(metricsPath, JSON.stringify({ name, runs }, null, 2));
    await testInfo.attach("doc-c3-metrics.json", {
      path: metricsPath,
      contentType: "application/json",
    });
  });
}

test("DOC-C3 recusa cabeçalho excessivo com orientação simples", async ({ page }) => {
  await open(page, "HTML para PDF");
  await page.getByRole("button", { name: "Digitar / Colar Código HTML", exact: true }).click();
  await page.getByTestId("html-code-input").fill(oversizedHtmlHeader);
  await page.locator(".ilovepdf-action-red-btn").click();
  await expect(
    page.getByText(
      "O cabeçalho da tabela não cabe na página. Reduza o texto ou escolha uma página maior.",
    ),
  ).toBeVisible();
  await expect(page.locator("a[download]")).toHaveCount(0);
});

for (const width of [390, 768, 1024, 1440])
  for (const dark of [false, true]) {
    test(`DOC-C3 mesa ${width} tema ${dark ? "escuro" : "claro"}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await open(page, "HTML para PDF");
      await page.evaluate(
        (value) => document.documentElement.setAttribute("data-theme", value),
        dark ? "dark" : "light",
      );
      await expect(page.locator("html")).toHaveAttribute("data-theme", dark ? "dark" : "light");
      await page.getByRole("button", { name: "Digitar / Colar Código HTML", exact: true }).click();
      await page.getByTestId("html-code-input").fill(longHtmlTable);
      await page.getByTestId("html-code-input").evaluate((input) => {
        input.scrollTop = 0;
        input.blur();
      });
      await expect(page.frameLocator("iframe").getByText("FIM-TABELA")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await expect(page.locator(".ilovepdf-action-red-btn")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("doc-c3-mesa.png") });
    });
  }

async function open(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: title, exact: true }).click();
}
async function source() {
  const doc = await PDFDocument.create();
  for (let i = 1; i <= 3; i++) doc.addPage([500, 700]).drawText(`Pagina ${i}`);
  return Buffer.from(await doc.save());
}
async function upload(page: Page, name = "original.pdf") {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name, mimeType: "application/pdf", buffer: await source() });
}
async function exportFile(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  const waiting = page.waitForEvent("download");
  await page.locator("a[download]").click();
  return new Uint8Array(await readFile(await (await waiting).path()));
}
async function texts(bytes: Uint8Array) {
  const task = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++)
      pages.push(
        (await (await doc.getPage(i)).getTextContent()).items
          .map((t) => ("str" in t ? t.str : ""))
          .join(" "),
      );
    return pages;
  } finally {
    await task.destroy();
  }
}
for (const title of ["Remover Páginas", "Extrair Páginas", "HTML para PDF", "Digitalizar para PDF"])
  test(`rota de ${title} sobrevive ao reload`, async ({ page }) => {
    await open(page, title);
    await page.reload();
    await expect(page.locator("h1,h2").filter({ hasText: title }).first()).toBeVisible();
  });

test("prévia HTML não acessa rede nem executa código", async ({ page }) => {
  const requests: string[] = [];
  await page.route("https://audit.invalid/**", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ body: "" });
  });
  await open(page, "HTML para PDF");
  await page.getByRole("button", { name: "Digitar / Colar Código HTML", exact: true }).click();
  await page
    .getByTestId("html-code-input")
    .fill(
      '<p>Documento</p><img src="https://audit.invalid/foto"><style>@import "https://audit.invalid/css";</style><meta http-equiv="refresh" content="0;url=https://audit.invalid/redirecionar"><script>fetch("https://audit.invalid/script")</script>',
    );
  await expect(page.frameLocator("iframe").getByText("Documento")).toBeVisible();
  await page.waitForTimeout(500);
  expect(requests).toEqual([]);
});

for (const [kind, html, end] of [
  [
    "tabela",
    `<table><tr><td>${"Conteudo longo ".repeat(300)}FIM-TABELA</td></tr></table>`,
    "FIM-TABELA",
  ],
  ["parágrafo", `<p>${"Documento para paginacao ".repeat(650)}FIM-PARAGRAFO</p>`, "FIM-PARAGRAFO"],
  ["texto misto", "<div>ANTES<p>INTERNO</p>DEPOIS</div>", "ANTES INTERNO DEPOIS"],
  ["código", `<pre>${"x".repeat(150)}FIM-CODIGO</pre>`, "FIM-CODIGO"],
  ["Unicode", "<p>Aprovado ✅ — 中文</p>", "Aprovado ✅ — 中文"],
] as const)
  test(`HTML preserva ${kind} na saída`, async ({ page }) => {
    await open(page, "HTML para PDF");
    await page.getByRole("button", { name: "Digitar / Colar Código HTML", exact: true }).click();
    await page.getByTestId("html-code-input").fill(html);
    const pages = await texts(await exportFile(page));
    expect(pages.join(" ").replace(/\s+/g, " ")).toContain(end);
    expect(pages.every((p) => p.replace(/Página \d+ de \d+/g, "").trim().length > 0)).toBe(true);
  });

for (const [title, field, prefix] of [
  ["Remover Páginas", "quick-remove-range", "page-card"],
  ["Extrair Páginas", "quick-extract-range", "extract-page"],
]) {
  test(`${title} limpa intervalo e reinicia seleção sem transbordar`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await open(page, title);
    await upload(page);
    await expect(page.getByTestId(`${prefix}-3`)).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    await page.locator(`#${field}`).fill("2");
    await page.locator(`#${field}`).fill("");
    await expect(page.getByText(/0 página\(s\) selecionada/)).toBeVisible();
    await page.locator(`#${field}`).fill("2,999");
    await expect(page.locator(`#${field}`)).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
    await page.locator(`#${field}`).fill("2");
    await exportFile(page);
    await page.getByRole("button", { name: "Processar outro arquivo", exact: true }).click();
    await upload(page, "novo.pdf");
    await expect(page.getByTestId(`${prefix}-3`)).toBeVisible();
    await expect(page.getByTestId(`${prefix}-2`)).toHaveAttribute("aria-pressed", "false");
  });
}

test("HTML mantém a ordem de linhas Unicode entre linhas vetoriais", async ({ page }) => {
  await open(page, "HTML para PDF");
  await page.getByRole("button", { name: "Digitar / Colar Código HTML", exact: true }).click();
  await page.getByTestId("html-code-input").fill("<p>ANTES</p><p>中文 ✅</p><p>DEPOIS</p>");
  expect((await texts(await exportFile(page))).join(" ").replace(/\s+/g, " ")).toContain(
    "ANTES 中文 ✅ DEPOIS",
  );
});

test("câmera conecta vídeo, troca dispositivo e encerra tracks", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { requests: [] as string[], stops: 0 };
    Object.assign(window, { cameraAudit: state });
    Object.defineProperty(HTMLMediaElement.prototype, "play", { value: () => Promise.resolve() });
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: async (options: MediaStreamConstraints) => {
          state.requests.push(
            String(
              (options.video as MediaTrackConstraints).facingMode &&
                (
                  (options.video as MediaTrackConstraints)
                    .facingMode as ConstrainDOMStringParameters
                ).ideal,
            ),
          );
          const stream = new MediaStream();
          stream.getTracks = () => [{ stop: () => state.stops++ } as MediaStreamTrack];
          return stream;
        },
      },
    });
  });
  await open(page, "Digitalizar para PDF");
  await page.getByRole("button", { name: "Iniciar Câmera", exact: true }).first().click();
  await expect
    .poll(() => page.locator("video").evaluate((v) => !!(v as HTMLVideoElement).srcObject))
    .toBe(true);
  await page.getByRole("button", { name: /(?:Alternar|Trocar).*?[Cc]âmera/ }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "cameraAudit").requests))
    .toEqual(["environment", "user"]);
  await page.getByRole("button", { name: "Todas as ferramentas", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "cameraAudit").stops)).toBe(2);
});

test("scanner exporta WebP e libera miniaturas ao sair", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { created: 0, revoked: 0 };
    Object.assign(window, { urlAudit: state });
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (b) => {
      state.created++;
      return create(b);
    };
    URL.revokeObjectURL = (u) => {
      state.revoked++;
      return revoke(u);
    };
  });
  await open(page, "Digitalizar para PDF");
  const bytes = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 60;
    const ctx = c.getContext("2d");
    if (!ctx) throw Error("Canvas");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 40, 60);
    const b = await new Promise<Blob>((resolve, reject) =>
      c.toBlob((b) => (b ? resolve(b) : reject(Error("Blob"))), "image/webp"),
    );
    return Array.from(new Uint8Array(await b.arrayBuffer()));
  });
  await page
    .locator('input[accept="image/jpeg,image/png,image/webp"]')
    .setInputFiles({ name: "foto.webp", mimeType: "image/webp", buffer: Buffer.from(bytes) });
  await expect(page.getByTestId("scanned-item-1")).toBeVisible();
  for (const margin of ["none", "normal", "small"])
    await page.locator("#scan-margins").selectOption(margin);
  expect((await PDFDocument.load(await exportFile(page))).getPageCount()).toBe(1);
  await page.getByRole("button", { name: "Processar outro arquivo", exact: true }).click();
  await expect(page.getByTestId("scanned-item-1")).toHaveCount(0);
  await page.getByRole("button", { name: "Todas as ferramentas", exact: true }).click();
  expect(
    await page.evaluate(
      () => Reflect.get(window, "urlAudit").created - Reflect.get(window, "urlAudit").revoked,
    ),
  ).toBe(0);
});

test("câmera autorizada após sair da ferramenta encerra o fluxo tardio", async ({ page }) => {
  await page.addInitScript(() => {
    const state = { stops: 0, requested: false, authorize: () => {} };
    Object.assign(window, { lateCamera: state });
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: () =>
          new Promise<MediaStream>((resolve) => {
            state.requested = true;
            state.authorize = () => {
              const stream = new MediaStream();
              stream.getTracks = () => [{ stop: () => state.stops++ } as MediaStreamTrack];
              resolve(stream);
            };
          }),
      },
    });
  });
  await open(page, "Digitalizar para PDF");
  await page.getByRole("button", { name: "Iniciar Câmera", exact: true }).first().click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "lateCamera").requested))
    .toBe(true);
  await page.getByRole("button", { name: "Todas as ferramentas", exact: true }).click();
  await page.evaluate(() => Reflect.get(window, "lateCamera").authorize());
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "lateCamera").stops)).toBe(1);
});
