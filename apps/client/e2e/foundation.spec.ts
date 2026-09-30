import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDocument, PDFName, type PDFNumber, PDFRawStream, StandardFonts } from "pdf-lib";

test("abre o Launcher compartilhado com vitrine de ferramentas", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Olá, o que faremos hoje?",
    }),
  ).toBeVisible();
  await expect(page.getByText(/ferramentas disponíveis neste dispositivo/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Organizar PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comprimir PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Juntar PDF" })).toBeVisible();
});

test("mantém o menu de ferramentas dentro da janela do desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.goto("/");
  await page.getByRole("button", { name: "Todas as ferramentas PDF" }).click();

  const menu = page.locator(".megamenu-panel--all");
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  if (!bounds) throw new Error("O menu não possui dimensões visíveis.");
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1100);
});

test("renderiza miniatura real após selecionar um PDF", async ({ page }) => {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  await page.goto("/organizar-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "teste.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  });

  await expect(page.locator(".pdf-page-thumbnail-img").first()).toHaveAttribute(
    "src",
    /^data:image\/jpeg/,
  );
});

test("renderiza todas as miniaturas de um PDF de 47 páginas", async ({ page }) => {
  const document = await PDFDocument.create();
  for (let pageNumber = 0; pageNumber < 47; pageNumber++) document.addPage([200, 200]);
  await page.goto("/organizar-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "47-paginas.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  });
  await expect(page.locator('.pdf-page-thumbnail-img[src^="data:image/jpeg"]')).toHaveCount(47, {
    timeout: 20000,
  });
});

test("permite adicionar outro PDF na tela de junção", async ({ page }) => {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  const file = Buffer.from(await document.save());
  await page.goto("/juntar-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "primeiro.pdf",
    mimeType: "application/pdf",
    buffer: file,
  });

  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Adicionar mais arquivos" }).click();
  await (await fileChooser).setFiles({
    name: "segundo.pdf",
    mimeType: "application/pdf",
    buffer: file,
  });
  await expect(page.getByText("segundo.pdf")).toBeVisible();
  await expect(page.locator(".ilovepdf-merge-img")).toHaveCount(2);
});

test("junta dois PDFs e baixa o resultado", async ({ page }) => {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  const file = Buffer.from(await document.save());
  await page.goto("/juntar-pdf");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "primeiro.pdf", mimeType: "application/pdf", buffer: file },
    { name: "segundo.pdf", mimeType: "application/pdf", buffer: file },
  ]);
  await page.getByRole("button", { name: "Juntar PDF", exact: true }).last().click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  const result = await download;
  const bytes = await readFile(await result.path());
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
});

test("perfis de compressão reduzem imagem incorporada e preservam texto", async ({ page }) => {
  await page.goto("/comprimir-pdf");
  const jpegBase64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    const pixels = context.createImageData(1600, 1600);
    let state = 0x12345678;
    const next = () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return state & 255;
    };
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = next();
      pixels.data[i + 1] = next();
      pixels.data[i + 2] = next();
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
  });
  expect(jpegBase64.startsWith("/9j/"), jpegBase64.slice(0, 32)).toBe(true);
  const pdf = await PDFDocument.create();
  const pdfPage = pdf.addPage([595, 842]);
  pdfPage.drawImage(await pdf.embedJpg(Uint8Array.from(Buffer.from(jpegBase64, "base64"))), {
    x: 0,
    y: 0,
    width: 595,
    height: 760,
  });
  pdfPage.drawText("Texto selecionavel", {
    x: 30,
    y: 800,
    font: await pdf.embedFont(StandardFonts.Helvetica),
  });
  const input = Buffer.from(await pdf.save());
  const sizes: number[] = [];
  const widths: number[] = [];
  for (const profile of ["baixa", "recomendada", "extrema"]) {
    await page.goto("/comprimir-pdf");
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: input });
    await page.getByRole("button", { name: new RegExp(`Compressão ${profile}`, "i") }).click();
    await page.getByRole("button", { name: "Comprimir PDF", exact: true }).last().click();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
    const bytes = await readFile(await (await download).path());
    sizes.push(bytes.length);
    const output = await PDFDocument.load(bytes);
    const image = output.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .find(
        (object) =>
          object instanceof PDFRawStream &&
          object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image",
      ) as PDFRawStream;
    widths.push((image.dict.get(PDFName.of("Width")) as PDFNumber).asNumber());
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
    const rendered = await loadingTask.promise;
    const content = await (await rendered.getPage(1)).getTextContent();
    expect(
      content.items.some((item) => "str" in item && item.str.includes("Texto selecionavel")),
    ).toBe(true);
    await loadingTask.destroy();
  }
  expect(sizes[0]).toBeLessThan(input.length);
  expect(sizes[1]).toBeLessThan(sizes[0]);
  expect(sizes[2]).toBeLessThan(sizes[1]);
  expect(widths).toEqual([1600, 1600, 1400]);
});

test("organiza páginas e baixa somente as páginas mantidas", async ({ page }) => {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  document.addPage([300, 300]);
  await page.goto("/organizar-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "original.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  });
  await expect(page.locator(".pdf-page-card")).toHaveCount(2);
  await page.getByTitle("Excluir esta página").last().click();
  await page.getByRole("button", { name: "Salvar PDF Organizado" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  const output = await PDFDocument.load(await readFile(await (await download).path()));
  expect(output.getPageCount()).toBe(1);
  expect(output.getPage(0).getWidth()).toBe(200);
});

test("divide PDF e baixa somente a página selecionada", async ({ page }) => {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  document.addPage([300, 300]);
  await page.goto("/dividir-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "original.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  });
  await page.getByRole("button", { name: "Páginas", exact: true }).click();
  await page.locator(".ilovepdf-page-mini-card").first().click();
  await page.locator(".ilovepdf-page-mini-card").nth(1).click();
  await page.getByRole("button", { name: "Dividir PDF", exact: true }).last().click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  const output = await PDFDocument.load(await readFile(await (await download).path()));
  expect(output.getPageCount()).toBe(1);
  expect(output.getPage(0).getWidth()).toBe(300);
});

test("rotaciona PDF e baixa página com ângulo aplicado", async ({ page }) => {
  const document = await PDFDocument.create();
  document.addPage([200, 300]);
  await page.goto("/rotacionar-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "original.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await document.save()),
  });
  await page.getByRole("button", { name: /Girar Direita/ }).click();
  await page.getByRole("button", { name: "Rotacionar PDF", exact: true }).last().click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  const output = await PDFDocument.load(await readFile(await (await download).path()));
  expect(output.getPage(0).getRotation().angle).toBe(90);
});

test("compara textos e baixa relatório com diferenças", async ({ page }) => {
  await page.goto("/comparar-textos");
  await page.getByPlaceholder("Cole ou digite o texto do Documento 1 (Original)...").fill("A");
  await page.getByPlaceholder("Cole ou digite o texto do Documento 2 (Alterado)...").fill("B");
  await page.getByRole("button", { name: "Comparar Textos", exact: true }).last().click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  const report = await readFile(await (await download).path(), "utf8");
  expect(report).toContain("+ B");
  expect(report).toContain("- A");
});

test("exportação da comparação usa o mesmo fluxo da ferramenta", async ({ page }) => {
  await page.goto("/comparar-textos");
  await page.getByPlaceholder("Cole ou digite o texto do Documento 1 (Original)...").fill("A");
  await page.getByPlaceholder("Cole ou digite o texto do Documento 2 (Alterado)...").fill("B");
  await page.getByRole("button", { name: "Exportar .diff" }).click();
  await expect(page.getByRole("heading", { name: "Pronto! Arquivo processado" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Baixar arquivo gerado/i })).toBeVisible();
});

test("troca de suíte e filtra os cards", async ({ page }) => {
  await page.goto("/");
  const suiteNav = page.getByRole("navigation", { name: "Categorias de ferramentas" });
  await suiteNav.getByRole("button", { name: "Organizar PDF", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Organizar PDF" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comparar textos" })).toHaveCount(0);
});

test("navega entre suítes pelo teclado", async ({ page }) => {
  await page.goto("/");
  const suiteNav = page.getByRole("navigation", { name: "Categorias de ferramentas" });
  await suiteNav.getByRole("button", { name: "Todas", exact: true }).focus();
  await page.keyboard.press("ArrowRight");

  await expect(
    suiteNav.getByRole("button", { name: "Organizar PDF", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "Organizar PDF" })).toBeVisible();
});

test("abre e fecha a paleta de comandos", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Buscar no NexoHub" })).toBeVisible();
  await page.keyboard.press("Control+k");

  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
  await expect(page.getByPlaceholder("Digite uma suíte ou ferramenta...")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toHaveCount(0);
});

test("abre a tela dedicada de Comprimir PDF e retorna ao Launcher", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Comprimir PDF" });
  await card.click();

  await expect(page.getByRole("heading", { name: "Comprimir PDF", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Selecionar arquivo PDF" })).toBeVisible();
  await expect(page.getByText("ou arraste e solte seus arquivos aqui")).toBeVisible();

  // Retorna ao Launcher via botão Voltar
  await page.getByRole("button", { name: "Todas as ferramentas", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Olá, o que faremos hoje?" })).toBeVisible();
});

test("abre a tela dedicada de Organizar PDF e retorna clicando no logo NexoHub", async ({
  page,
}) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Organizar PDF" });
  await card.click();

  await expect(page.getByRole("heading", { name: "Organizar PDF", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Selecionar arquivo PDF" })).toBeVisible();

  // Retorna clicando no Logo NexoHub no cabeçalho
  await page.getByRole("button", { name: "NexoHub - Página Inicial" }).click();
  await expect(page.getByRole("heading", { name: "Olá, o que faremos hoje?" })).toBeVisible();
});

test("digita e compara textos na tela dedicada de Comparação", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("article").filter({ hasText: "Comparar textos" });
  await card.click();

  await expect(page.getByRole("heading", { name: "Comparar textos", level: 1 })).toBeVisible();

  const originalInput = page.getByPlaceholder(
    "Cole ou digite o texto do Documento 1 (Original)...",
  );
  await originalInput.fill("Primeira versão do texto.");
  await expect(originalInput).toHaveValue("Primeira versão do texto.");

  const modifiedInput = page.getByPlaceholder(
    "Cole ou digite o texto do Documento 2 (Alterado)...",
  );
  await modifiedInput.fill("Segunda versão alterada.");
  await expect(modifiedInput).toHaveValue("Segunda versão alterada.");
});

test("não anuncia revisão sem executor web", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Revisar texto" })).toHaveCount(0);
  await page.goto("/revisar-texto");
  await expect(page.getByRole("heading", { name: "Revisar texto" })).toHaveCount(0);
});

test("não anuncia OCR de PDF sem renderização validada", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Reconhecer texto" })).toHaveCount(0);
});

test("não anuncia conversores ou proteção sem executor", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "PDF para Word" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Proteger PDF" })).toHaveCount(0);
});

test("comprime PDF real e disponibiliza PDF válido", async ({ page }) => {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  const original = await document.save();
  await page.goto("/comprimir-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "contrato.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(original),
  });
  await page.getByRole("button", { name: "Comprimir PDF", exact: true }).last().click();
  const downloadLink = page.getByRole("link", { name: /Baixar arquivo gerado/i });
  await expect(downloadLink).toBeVisible();
  const outputBytes = await page.evaluate(
    async (href) => {
      const response = await fetch(href);
      return Array.from(new Uint8Array(await response.arrayBuffer()));
    },
    (await downloadLink.getAttribute("href")) ?? "",
  );
  expect((await PDFDocument.load(Uint8Array.from(outputBytes))).getPageCount()).toBe(1);
  const displayedPercent = Math.abs(
    Math.round(((original.length - outputBytes.length) / original.length) * 100),
  );
  const percentageLabel =
    original.length !== outputBytes.length && displayedPercent === 0
      ? "<1%"
      : `${displayedPercent}%`;
  await expect(page.locator(".ilovepdf-savings-val")).toHaveText(percentageLabel);
  await expect(page.getByText(/de aumento|de redução|sem alteração de tamanho/i)).toBeVisible();
});

test("junção interrompe ao receber segundo PDF inválido", async ({ page }) => {
  const document = await PDFDocument.create();
  document.addPage([200, 200]);
  await page.goto("/juntar-pdf");
  await page.locator('input[type="file"]').setInputFiles([
    {
      name: "primeiro.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await document.save()),
    },
    { name: "segundo.pdf", mimeType: "application/pdf", buffer: Buffer.from("não é um PDF") },
  ]);
  await page.getByRole("button", { name: "Juntar PDF", exact: true }).last().click();
  await expect(page.getByRole("alert")).toContainText("segundo.pdf");
  await expect(page.getByRole("link", { name: /Baixar arquivo gerado/i })).toHaveCount(0);
});
