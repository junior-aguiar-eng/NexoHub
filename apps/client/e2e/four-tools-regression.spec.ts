import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

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
  await page.getByRole("button", { name: /Alternar|Trocar.*[Cc]âmera/ }).click();
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
