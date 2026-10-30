import { type ChildProcess, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { type Browser, chromium, expect, type Page, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { degrees, PDFDocument, PDFName } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { basicPdfPages, createBasicPdfCorpus } from "../src/platform/__fixtures__/q-c0-pdf/corpus";

let app: ChildProcess;
let browser: Browser;
let page: Page;
let profile: string;

async function launchWindowsApp() {
  const executable = process.env.NEXOHUB_DESKTOP_EXE;
  test.skip(process.platform !== "win32" || !executable, "Informe NEXOHUB_DESKTOP_EXE no Windows");
  if (!executable) throw new Error("Executável Windows não informado");
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Porta indisponível");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  profile ||= await mkdtemp(path.join(os.tmpdir(), "nexohub-pages-e2e-"));
  app = spawn(executable, [], {
    env: {
      ...process.env,
      WEBVIEW2_USER_DATA_FOLDER: profile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}${process.env.NEXOHUB_NETWORK_HTTP1 === "1" ? " --disable-http2 --disable-quic" : ""}${process.env.NEXOHUB_NETWORK_LOG ? ` --log-net-log="${process.env.NEXOHUB_NETWORK_LOG}"` : ""}`,
    },
  });
  const endpoint = `http://127.0.0.1:${port}`;
  await expect
    .poll(
      async () => {
        try {
          return (await fetch(`${endpoint}/json/version`)).ok;
        } catch {
          return false;
        }
      },
      { timeout: 30000 },
    )
    .toBe(true);
  browser = await chromium.connectOverCDP(endpoint);
  page = browser.contexts()[0].pages()[0];
  await expect(page.getByRole("button", { name: "Todas as ferramentas PDF" })).toBeVisible({
    timeout: 30000,
  });
}

test.beforeAll(launchWindowsApp);

test.afterAll(async () => {
  if (browser) await browser.close();
  if (app) app.kill();
  if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
});

for (const tool of [
  "juntar-pdf",
  "dividir-pdf",
  "organizar-pdf",
  "rotacionar-pdf",
  "remover-paginas",
  "extrair-paginas",
] as const) {
  test(`Windows: ${tool} gera PDF com páginas e texto esperados`, async () => {
    test.setTimeout(180000);
    const source = await createBasicPdfCorpus(
      new Uint8Array(await readFile("src/platform/fixtures/extraction-red-2x1.jpg")),
    );
    const file = { name: "corpus.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) };
    await page.evaluate((route) => {
      window.history.pushState({}, "", `/${route}`);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, tool);
    const projectFolder = path.resolve("../../target/qa/windows-pages-project");
    await mkdir(projectFolder, { recursive: true });
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(tool === "juntar-pdf" ? [file, { ...file, name: "segundo.pdf" }] : file);
    let indices = [0, 1, 2, 3];
    let rotation = 0;
    if (tool === "juntar-pdf") indices = [...indices, ...indices];
    if (tool === "organizar-pdf") {
      await expect(page.locator(".pdf-page-card")).toHaveCount(4);
      await page.getByTitle("Excluir esta página").last().click();
      indices = [0, 1, 2];
    }
    if (tool === "dividir-pdf") {
      await page.getByRole("button", { name: "Páginas", exact: true }).click();
      await page.locator(".ilovepdf-page-mini-card").nth(0).click();
      await page.locator(".ilovepdf-page-mini-card").nth(2).click();
      indices = [2];
    }
    if (tool === "rotacionar-pdf") {
      await page.getByRole("button", { name: /Girar Direita/ }).click();
      rotation = 90;
    }
    if (tool === "remover-paginas" || tool === "extrair-paginas") {
      await page
        .locator(tool === "remover-paginas" ? "#quick-remove-range" : "#quick-extract-range")
        .fill(tool === "remover-paginas" ? "2,4" : "1,3");
      indices = [0, 2];
    }
    await page.locator(".ilovepdf-action-red-btn").click();
    const download = page.getByRole("button", { name: /Baixar arquivo gerado/i });
    await expect(download).toBeVisible({ timeout: 120000 });
    await page.evaluate(() => {
      const original = Blob.prototype.arrayBuffer;
      Object.assign(window, { windowsPagesOriginalArrayBuffer: original });
      Blob.prototype.arrayBuffer = async function () {
        const data = await original.call(this);
        Object.assign(window, { windowsPagesOutput: Array.from(new Uint8Array(data)) });
        throw new Error("CAPTURA_E2E_SAIDA");
      };
    });
    await download.click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { windowsPagesOutput?: number[] }).windowsPagesOutput?.length ??
            0,
        ),
      )
      .toBeGreaterThan(0);
    const bytes = new Uint8Array(
      await page.evaluate(
        () => (window as unknown as { windowsPagesOutput: number[] }).windowsPagesOutput,
      ),
    );
    await page.evaluate(() => {
      Blob.prototype.arrayBuffer = (
        window as unknown as { windowsPagesOriginalArrayBuffer: typeof Blob.prototype.arrayBuffer }
      ).windowsPagesOriginalArrayBuffer;
    });
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(indices.length);
    const task = getDocument({ data: bytes.slice(), useSystemFonts: true });
    const reader = await task.promise;
    try {
      for (const [i, original] of indices.entries()) {
        expect(pdf.getPage(i).getRotation().angle).toBe(
          (basicPdfPages[original].rotation + rotation) % 360,
        );
        const text = (await (await reader.getPage(i + 1)).getTextContent()).items
          .flatMap((item) => ("str" in item ? [item.str] : []))
          .join(" ");
        expect(text).toBe(basicPdfPages[original].text);
      }
    } finally {
      await task.destroy();
    }
  });
}

async function navigate(route: string) {
  await page.evaluate((name) => {
    window.history.pushState({}, "", `/${name}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
}

async function uploadPdf(route: string, bytes: Uint8Array) {
  await navigate(route);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "amostra.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });
}

async function resultBytes() {
  const download = page.getByRole("button", { name: /Baixar arquivo gerado/i });
  await expect(download).toBeVisible({ timeout: 120000 });
  await page.evaluate(() => {
    const original = Blob.prototype.arrayBuffer;
    Object.assign(window, {
      windowsPagesOriginalArrayBuffer: original,
      windowsPagesOutput: undefined,
    });
    Blob.prototype.arrayBuffer = async function () {
      const data = await original.call(this);
      Object.assign(window, { windowsPagesOutput: Array.from(new Uint8Array(data)) });
      throw new Error("CAPTURA_E2E_SAIDA");
    };
  });
  await download.click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { windowsPagesOutput?: number[] }).windowsPagesOutput?.length ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  const bytes = new Uint8Array(
    await page.evaluate(
      () => (window as unknown as { windowsPagesOutput: number[] }).windowsPagesOutput,
    ),
  );
  await page.evaluate(() => {
    Blob.prototype.arrayBuffer = (
      window as unknown as { windowsPagesOriginalArrayBuffer: typeof Blob.prototype.arrayBuffer }
    ).windowsPagesOriginalArrayBuffer;
  });
  return bytes;
}

async function sample() {
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 300]).drawText("Conteudo original", { x: 20, y: 230, size: 12 });
  return pdf;
}

test("Windows: recortar PDF mantém conteúdo e geometria", async () => {
  const pdf = await sample();
  pdf.getPage(0).setRotation(degrees(90));
  await uploadPdf("recortar-pdf", await pdf.save());
  await page.locator(".ilovepdf-action-red-btn").click();
  const output = await PDFDocument.load(await resultBytes());
  expect(output.getPage(0).getCropBox()).toEqual({ x: 40, y: 30, width: 320, height: 240 });
  expect(output.getPage(0).node.Contents()).toBeDefined();
});

test("Windows: preencher formulário preserva os campos e o valor", async () => {
  const pdf = await sample();
  pdf
    .getForm()
    .createTextField("Nome")
    .addToPage(pdf.getPage(0), { x: 20, y: 40, width: 160, height: 25 });
  await uploadPdf("preencher-formulario", await pdf.save());
  await page.getByPlaceholder("Preencha este campo...").fill("Maria");
  await page.locator(".ilovepdf-action-red-btn").click();
  const output = await PDFDocument.load(await resultBytes());
  expect(output.getForm().getTextField("Nome").getText()).toBe("Maria");
});

test("Windows: assinatura digitada é inserida no PDF", async () => {
  await uploadPdf("assinar-pdf", await (await sample()).save());
  await page.getByRole("button", { name: "Digitar", exact: true }).click();
  await page.getByPlaceholder("Digite seu nome completo...").fill("Maria da Silva");
  await page.locator(".ilovepdf-action-red-btn").click();
  const output = await PDFDocument.load(await resultBytes());
  expect(output.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"))).toBeDefined();
});

test("Windows: desbloqueio reconhece senha exata e preserva formulário", async () => {
  const bytes = await readFile("src/platform/__fixtures__/pdf-unlock/AES-256.pdf");
  await uploadPdf("desbloquear-pdf", bytes);
  await page.getByPlaceholder("Digite a senha do PDF...").fill(" senha com espacos ");
  await page.locator(".ilovepdf-action-red-btn").click();
  const output = await PDFDocument.load(await resultBytes());
  expect(output.context.trailerInfo.Encrypt).toBeUndefined();
  expect(output.getForm().getTextField("nome").getText()).toBe("Valor editavel");
});

test("Windows: proteger PDF exige senha e preserva texto", async () => {
  await uploadPdf("proteger-pdf", await (await sample()).save());
  await page.getByLabel("Senha de abertura do documento", { exact: true }).fill(" senha exata ");
  await page.getByLabel("Confirmar senha", { exact: true }).fill(" senha exata ");
  await page.getByRole("checkbox", { name: "Permitir impressão do documento" }).uncheck();
  await page.locator(".ilovepdf-action-red-btn").click();
  const bytes = await resultBytes();
  const wrong = getDocument({ data: bytes.slice(), password: "senha exata" });
  await expect(wrong.promise).rejects.toThrow();
  await wrong.destroy();
  const task = getDocument({ data: bytes.slice(), password: " senha exata " });
  try {
    const doc = await task.promise;
    expect((await (await doc.getPage(1)).getTextContent()).items.length).toBeGreaterThan(0);
  } finally {
    await task.destroy();
  }
});

test("Windows: ocultar PDF remove texto da saída", async () => {
  await uploadPdf("ocultar-pdf", await (await sample()).save());
  await page.getByRole("button", { name: "Adicionar Tarja Manual" }).click();
  await page.getByLabel("Posição horizontal (%)").fill("0");
  await page.getByLabel("Posição vertical (%)").fill("0");
  await page.getByLabel("Largura (%)").fill("100");
  await page.getByLabel("Altura (%)").fill("100");
  await page.locator(".ilovepdf-action-red-btn").click();
  const task = getDocument({ data: (await resultBytes()).slice() });
  try {
    const doc = await task.promise;
    expect((await (await doc.getPage(1)).getTextContent()).items).toHaveLength(0);
  } finally {
    await task.destroy();
  }
});

test("Windows: PDF para Excel exporta dados da tabela", async () => {
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([600, 400]);
  for (const [i, row] of [
    ["Codigo", "Produto", "Valor"],
    ["00123", "Papel", "15.50"],
  ].entries()) {
    row.forEach((text, j) => {
      sheet.drawText(text, { x: 40 + j * 180, y: 330 - i * 30, size: 12 });
    });
  }
  await uploadPdf("pdf-para-excel", await pdf.save());
  await expect(page.getByTestId("excel-preview-table")).toContainText("00123");
  await page.locator(".ilovepdf-action-red-btn").click();
  const files = unzipSync(await resultBytes());
  expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain("00123");
});

test("Windows: comprimir PDF preserva páginas e texto", async () => {
  test.setTimeout(180000);
  await uploadPdf("comprimir-pdf", await (await sample()).save());
  await page.locator(".ilovepdf-action-red-btn").click();
  const task = getDocument({ data: (await resultBytes()).slice(), useSystemFonts: true });
  try {
    const doc = await task.promise;
    expect(doc.numPages).toBe(1);
    const content = await (await doc.getPage(1)).getTextContent();
    expect(content.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" ")).toContain(
      "Conteudo original",
    );
  } finally {
    await task.destroy();
  }
});

for (const [route, stamp] of [
  ["marca-dagua", "MARCA TESTE"],
  ["numeros-de-pagina", "Página 1 de 1"],
] as const) {
  test(`Windows: ${route} adiciona texto e preserva o original`, async () => {
    test.setTimeout(180000);
    await uploadPdf(route, await (await sample()).save());
    if (route === "marca-dagua") await page.locator("#watermark-input-text").fill(stamp);
    await page.locator(".ilovepdf-action-red-btn").click();
    const task = getDocument({ data: (await resultBytes()).slice(), useSystemFonts: true });
    try {
      const doc = await task.promise;
      const content = await (await doc.getPage(1)).getTextContent();
      const text = content.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" ");
      expect(text).toContain("Conteudo original");
      expect(text).toContain(stamp);
    } finally {
      await task.destroy();
    }
  });
}

test("Windows: imagens para PDF preserva número de páginas", async () => {
  test.setTimeout(180000);
  const png = await readFile("src/assets/nexohub-camaleao.png");
  await navigate("imagem-para-pdf");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles([
      { name: "primeira.png", mimeType: "image/png", buffer: png },
      { name: "segunda.png", mimeType: "image/png", buffer: png },
    ]);
  await page.getByRole("button", { name: "Converter em PDF", exact: true }).click();
  const output = await PDFDocument.load(await resultBytes());
  expect(output.getPageCount()).toBe(2);
});

test("Windows: juntar PDF repetido preserva os resultados em sequência", async () => {
  test.setTimeout(180000);
  const source = await (await sample()).save();
  for (let iteration = 0; iteration < 5; iteration++) {
    await navigate("juntar-pdf");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles([
        { name: "a.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) },
        { name: "b.pdf", mimeType: "application/pdf", buffer: Buffer.from(source) },
      ]);
    await page.locator(".ilovepdf-action-red-btn").click();
    const pdf = await PDFDocument.load(await resultBytes());
    expect(pdf.getPageCount(), `execução ${iteration + 1}`).toBe(2);
    if (iteration < 4) await page.getByRole("button", { name: "Processar outro arquivo" }).click();
  }
});

for (const [route, width, height] of [
  ["comprimir-imagem", 96, 48],
  ["converter-imagem", 96, 48],
  ["redimensionar-imagem", 48, 24],
  ["recortar-imagem", 96, 48],
  ["girar-imagem", 48, 96],
  ["marca-dagua-imagem", 96, 48],
] as const) {
  test(`Windows: ${route} gera imagem decodificável`, async () => {
    await navigate(route);
    const input = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 96;
      canvas.height = 48;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível");
      context.fillStyle = "#e11d48";
      context.fillRect(0, 0, 48, 48);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG indisponível");
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(input) });
    await expect(page.locator(".image-tool-panel img").first()).toBeVisible();
    await page.locator(".ilovepdf-action-red-btn").click();
    const bytes = await resultBytes();
    const result = await page.evaluate(
      async (data) => {
        const image = await createImageBitmap(new Blob([new Uint8Array(data)]));
        const result = { width: image.width, height: image.height };
        image.close();
        return result;
      },
      [...bytes],
    );
    expect(result).toEqual({ width, height });
  });
}

test("Windows: PDF para JPG gera imagem com dimensões esperadas", async () => {
  test.setTimeout(180000);
  await uploadPdf("pdf-para-jpg", await (await sample()).save());
  await page.locator(".ilovepdf-action-red-btn").click();
  const bytes = await resultBytes();
  const dimensions = await page.evaluate(
    async (data) => {
      const image = await createImageBitmap(
        new Blob([new Uint8Array(data)], { type: "image/jpeg" }),
      );
      const value = [image.width, image.height];
      image.close();
      return value;
    },
    [...bytes],
  );
  expect(dimensions).toEqual([833, 625]);
});

test("Windows: HTML para PDF preserva texto convertido", async () => {
  await navigate("html-para-pdf");
  await page.getByRole("button", { name: "Digitar / Colar Código HTML", exact: true }).click();
  await page
    .getByTestId("html-code-input")
    .fill("<h1>Titulo de teste</h1><p>Conteudo de exemplo</p>");
  await page.locator(".ilovepdf-action-red-btn").click();
  const task = getDocument({ data: (await resultBytes()).slice(), useSystemFonts: true });
  try {
    const doc = await task.promise;
    const content = await (await doc.getPage(1)).getTextContent();
    expect(content.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" ")).toContain(
      "Conteudo de exemplo",
    );
  } finally {
    await task.destroy();
  }
});

test("Windows: digitalizar imagens produz PDF com duas páginas", async () => {
  await navigate("digitalizar-pdf");
  const png = await readFile("src/assets/nexohub-camaleao.png");
  await page.locator('input[accept="image/jpeg,image/png,image/webp"]').setInputFiles([
    { name: "a.png", mimeType: "image/png", buffer: png },
    { name: "b.png", mimeType: "image/png", buffer: png },
  ]);
  await page.locator(".ilovepdf-action-red-btn").click();
  expect((await PDFDocument.load(await resultBytes())).getPageCount()).toBe(2);
});

test("Windows: PDF para Word exporta texto em DOCX", async () => {
  await uploadPdf("pdf-para-word", await (await sample()).save());
  await page
    .getByTestId("pdf-word-idle")
    .getByRole("button", { name: /Converter para Word/i })
    .click();
  const link = page.getByRole("link", { name: /Baixar documento Word/i });
  await expect(link).toBeVisible({ timeout: 30000 });
  const bytes = new Uint8Array(
    await link.evaluate(async (element) =>
      Array.from(
        new Uint8Array(await (await fetch((element as HTMLAnchorElement).href)).arrayBuffer()),
      ),
    ),
  );
  expect(strFromU8(unzipSync(bytes)["word/document.xml"])).toContain("Conteudo original");
});

test("Windows: revisão aplica correção ao texto", async () => {
  test.setTimeout(120000);
  await navigate("revisar-texto");
  await page.getByRole("button", { name: "Digitar Texto", exact: true }).click();
  await page.locator("#dedicated-tool-direct-textarea").fill("Eu fasso isso.");
  await page.getByRole("button", { name: "Revisar Texto", exact: true }).click();
  await expect(page.locator(".text-review-findings-list")).toContainText("faço", {
    timeout: 90000,
  });
  await page.getByRole("button", { name: "Aplicar Todas as Correções", exact: true }).click();
  await expect(page.locator(".text-review-textarea")).toHaveValue("Eu faço isso.");
});

test("Windows: extração de imagem recupera JPEG original", async () => {
  const jpeg = await readFile("src/platform/fixtures/extraction-red-2x1.jpg");
  const pdf = await sample();
  const image = await pdf.embedJpg(jpeg);
  pdf.getPage(0).drawImage(image, { x: 20, y: 20, width: 100, height: 50 });
  await uploadPdf("extrair-imagens", await pdf.save());
  await page.getByRole("checkbox").uncheck();
  await page.locator(".ilovepdf-action-red-btn").click();
  await expect(page.getByRole("button", { name: /Selecionar imagem_p1/ })).toBeVisible();
  const link = page.getByRole("link", { name: /Baixar imagens selecionadas/ });
  await expect(link).toBeVisible();
  const bytes = new Uint8Array(
    await link.evaluate(async (element) =>
      Array.from(
        new Uint8Array(await (await fetch((element as HTMLAnchorElement).href)).arrayBuffer()),
      ),
    ),
  );
  expect(Buffer.from(bytes)).toEqual(jpeg);
});

test("Windows: PDF para Markdown apresenta texto original", async () => {
  await uploadPdf("pdf-para-markdown", await (await sample()).save());
  await page.locator(".ilovepdf-action-red-btn").click();
  await expect(page.getByRole("button", { name: "Baixar .md", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText("Conteudo original");
});

test("Windows: comparação de textos exporta as diferenças", async () => {
  test.setTimeout(180000);
  await navigate("comparar-textos");
  const editors = page.locator(".doc-compare-textarea");
  await editors.nth(0).fill("Texto original");
  await editors.nth(1).fill("Texto revisado");
  await page.getByRole("button", { name: /Exportar/i }).click();
  const report = new TextDecoder().decode(await resultBytes());
  expect(report).toContain("Texto original");
  expect(report).toContain("Texto revisado");
});

test("Windows: salvar o resultado abre diálogo nativo e grava PDF", async () => {
  test.setTimeout(180000);
  await navigate("html-para-pdf");
  await page.getByRole("button", { name: "Digitar / Colar Código HTML", exact: true }).click();
  await page.getByTestId("html-code-input").fill("<p>Resultado salvo no Windows</p>");
  await page.locator(".ilovepdf-action-red-btn").click();
  await page.getByRole("button", { name: /Baixar arquivo gerado/i }).click();
  const output = test.info().outputPath("resultado.pdf");
  console.log(`Selecione o destino de teste: ${output}`);
  await expect
    .poll(
      async () => {
        try {
          return (await readFile(output)).length;
        } catch {
          return 0;
        }
      },
      { timeout: 120000 },
    )
    .toBeGreaterThan(0);
  const task = getDocument({ data: new Uint8Array(await readFile(output)), useSystemFonts: true });
  try {
    const doc = await task.promise;
    const content = await (await doc.getPage(1)).getTextContent();
    expect(content.items.flatMap((item) => ("str" in item ? [item.str] : [])).join(" ")).toContain(
      "Resultado salvo no Windows",
    );
  } finally {
    await task.destroy();
  }
});

for (const [route, extension] of [
  ["comprimir-imagem", "png"],
  ["converter-imagem", "jpg"],
  ["pdf-para-excel", "xlsx"],
] as const) {
  test(`Windows: exportação nativa ${extension} grava arquivo utilizável`, async () => {
    test.setTimeout(180000);
    if (extension === "xlsx") {
      const pdf = await PDFDocument.create();
      const sheet = pdf.addPage([600, 400]);
      for (const [i, row] of [
        ["Codigo", "Produto"],
        ["00123", "Papel"],
      ].entries()) {
        row.forEach((text, j) => {
          sheet.drawText(text, { x: 40 + j * 180, y: 330 - i * 30, size: 12 });
        });
      }
      await uploadPdf(route, await pdf.save());
      await expect(page.getByTestId("excel-preview-table")).toContainText("00123");
    } else {
      await navigate(route);
      const png = await readFile("src/assets/nexohub-camaleao.png");
      await page
        .locator('input[type="file"]')
        .first()
        .setInputFiles({ name: "imagem.png", mimeType: "image/png", buffer: png });
      await expect(page.getByRole("region", { name: "Imagens do lote" })).toBeVisible();
    }
    await page.locator(".ilovepdf-action-red-btn").click();
    await page.getByRole("button", { name: /Baixar arquivo gerado/i }).click();
    const output = test.info().outputPath(`resultado.${extension}`);
    console.log(`Selecione o destino de teste: ${output}`);
    await expect
      .poll(
        async () => {
          try {
            return (await readFile(output)).length;
          } catch {
            return 0;
          }
        },
        { timeout: 120000 },
      )
      .toBeGreaterThan(0);
    const bytes = await readFile(output);
    if (extension === "xlsx") {
      expect(strFromU8(unzipSync(bytes)["xl/worksheets/sheet1.xml"])).toContain("00123");
    } else {
      const dimensions = await page.evaluate(
        async (data) => {
          const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
          const result = [bitmap.width, bitmap.height];
          bitmap.close();
          return result;
        },
        [...bytes],
      );
      expect(dimensions[0]).toBeGreaterThan(0);
      expect(dimensions[1]).toBeGreaterThan(0);
    }
  });
}

test("Windows: medir OCR na fotografia privada", async () => {
  test.setTimeout(180000);
  const source = process.env.NEXOHUB_PRIVATE_OCR_PDF;
  test.skip(
    !source || !process.env.NEXOHUB_PRIVATE_OCR_REFERENCES,
    "Informe os caminhos privados do PDF e das referências",
  );
  if (!source) return;
  await uploadPdf("ocr-pdf", await readFile(source));
  await page.locator(".ilovepdf-action-red-btn").click();
  await expect
    .poll(() => page.locator(".ocr-result-textarea").inputValue(), { timeout: 120000 })
    .not.toBe("");
  const text = (await page.locator(".ocr-result-textarea").inputValue())
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const referenceFile = process.env.NEXOHUB_PRIVATE_OCR_REFERENCES;
  if (!referenceFile) throw new Error("Informe NEXOHUB_PRIVATE_OCR_REFERENCES");
  const referenceData: { anchorMatches: { reference: string }[] } = JSON.parse(
    await readFile(referenceFile, "utf8"),
  );
  const anchors = referenceData.anchorMatches.map(({ reference }) => reference);
  console.log(
    `OCR privado: ${text.length} caracteres; ${anchors.filter((anchor) => text.includes(anchor)).length}/4 referências encontradas`,
  );
  expect(text.trim().length).toBeGreaterThan(0);
});

test("Windows: medir tradução real de frase autoral", async () => {
  test.setTimeout(720000);
  test.skip(process.env.NEXOHUB_TRANSLATION_REAL !== "1", "Defina NEXOHUB_TRANSLATION_REAL=1");
  await navigate("traduzir-texto");
  await page.getByRole("button", { name: "Digitar Texto" }).click();
  await page
    .locator("#dedicated-tool-direct-textarea")
    .fill("Maria Silva did not authorize the payment of 125 euros on 14/03/2026.");
  const failures: string[] = [];
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    failures.push(`${url.origin}${url.pathname}: ${request.failure()?.errorText}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      const url = new URL(response.url());
      failures.push(`${url.origin}${url.pathname}: HTTP ${response.status()}`);
    }
  });
  await page.getByRole("button", { name: "Executar agora", exact: true }).click();
  const output = page.locator(".text-translate-output-textarea");
  await expect
    .poll(
      async () =>
        (await output.inputValue()) || (await page.getByRole("alert").allTextContents()).join(" "),
      { timeout: 660000 },
    )
    .not.toBe("");
  const translated = await output.inputValue();
  console.log(`Falhas de recursos: ${JSON.stringify(failures)}`);
  expect(translated, (await page.getByRole("alert").allTextContents()).join(" ")).not.toBe("");
  console.log(
    `Tradução autoral: nome=${translated.includes("Maria Silva")}; números=${["125", "14", "03", "2026"].every((value) => translated.includes(value))}; negação=${/\bnão\b/i.test(translated)}`,
  );
  expect(translated).toContain("Maria Silva");
  for (const number of ["125", "14", "03", "2026"]) expect(translated).toContain(number);
  expect(translated).toMatch(/\bnão\b/i);
  await page.route("**/*", async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host === "huggingface.co" || host.endsWith(".hf.co")) await route.abort();
    else await route.continue();
  });
  await page.reload();
  await page.getByRole("button", { name: "Digitar Texto" }).click();
  await page.locator("#dedicated-tool-direct-textarea").fill("The payment was not authorized.");
  await page.getByRole("button", { name: "Executar agora", exact: true }).click();
  await expect
    .poll(
      async () =>
        (await output.inputValue()) || (await page.getByRole("alert").allTextContents()).join(" "),
      { timeout: 180000 },
    )
    .not.toBe("");
  const cached = await output.inputValue();
  expect(cached, (await page.getByRole("alert").allTextContents()).join(" ")).not.toBe("");
  console.log(
    `Tradução após recarregar com rede do modelo bloqueada: negação=${/\bnão\b/i.test(cached)}`,
  );
  expect(cached).toMatch(/\bnão\b/i);
});

test("Windows: tradução persiste após fechar e reabrir online e offline", async () => {
  test.setTimeout(1200000);
  test.skip(
    process.env.NEXOHUB_TRANSLATION_PERSISTENCE !== "1",
    "Defina NEXOHUB_TRANSLATION_PERSISTENCE=1",
  );
  const phases: { phase: string; modelRequests: number; offline: boolean }[] = [];
  async function translate(phase: string, offline: boolean) {
    let requests = 0;
    page.on("request", (request) => {
      const host = new URL(request.url()).hostname;
      if (host === "huggingface.co" || host.endsWith(".hf.co")) requests++;
    });
    if (offline) await browser.contexts()[0].setOffline(true);
    await navigate("traduzir-texto");
    await page.getByRole("button", { name: "Digitar Texto" }).click();
    await page
      .locator("#dedicated-tool-direct-textarea")
      .fill("The payment of 125 euros was not authorized.");
    await page.getByRole("button", { name: "Executar agora", exact: true }).click();
    const output = page.locator(".text-translate-output-textarea");
    await expect
      .poll(
        async () =>
          (await output.inputValue()) ||
          (await page.getByRole("alert").allTextContents()).join(" "),
        { timeout: 660000 },
      )
      .not.toBe("");
    const value = await output.inputValue();
    expect(value, (await page.getByRole("alert").allTextContents()).join(" ")).toMatch(/não/i);
    expect(value).toContain("125");
    phases.push({ phase, modelRequests: requests, offline });
    console.log(`PERSISTENCIA ${JSON.stringify(phases.at(-1))}`);
    if (phase !== "primeira-carga") expect(requests).toBe(0);
  }
  async function closeAndReopen() {
    console.log(`FECHAR JANELA DE TESTE: pid=${app.pid}; perfil=${profile}`);
    await expect.poll(() => app.exitCode, { timeout: 180000 }).not.toBeNull();
    await browser.close().catch(() => {});
    await launchWindowsApp();
  }
  await translate("primeira-carga", false);
  await closeAndReopen();
  await translate("reabertura-online", false);
  await closeAndReopen();
  await translate("reabertura-offline", true);
  const evidence = test.info().outputPath("persistencia.json");
  await writeFile(evidence, JSON.stringify(phases, null, 2));
  await test
    .info()
    .attach("persistencia.json", { path: evidence, contentType: "application/json" });
});
