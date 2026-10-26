import { PDFDocument } from "pdf-lib";
import { expect, it } from "vitest";
import { createMdC1Corpus, mdLeft, mdRight } from "./__fixtures__/md-c1/corpus";
import { convertPdfToMarkdown } from "./markdown-converter";

it("lê uma coluna inteira antes da seguinte e mantém blocos abrangentes fora da tabela", async () => {
  const { markdown } = await convertPdfToMarkdown(await createMdC1Corpus());
  const leftEnd = markdown.indexOf(mdLeft[3]);
  expect(leftEnd).toBeGreaterThan(markdown.indexOf(mdLeft[0]));
  expect(markdown.indexOf(mdRight[0])).toBeGreaterThan(leftEnd);
  expect(markdown.indexOf("Notas ao final")).toBeGreaterThan(markdown.indexOf(mdRight[3]));
  expect(markdown).toContain("# Relatório de leitura em duas colunas");
  expect(markdown).toContain("- Primeiro item da coluna esquerda.");
  expect(markdown).toContain("1. Item numerado na coluna direita.");
  for (const line of [...mdLeft, ...mdRight])
    expect(markdown.split(line.replace(/^• /, "- "))).toHaveLength(2);
});

it("alinha vazios e códigos sem deslocar células e escapa barras/HTML na tabela", async () => {
  const { markdown } = await convertPdfToMarkdown(await createMdC1Corpus());
  expect(markdown).toContain("| Código | Descrição | Valor |");
  expect(markdown).toContain("| 00123 |  | 1.234,56 |");
  expect(markdown).toContain("| 123 | A \\| B &lt;teste&gt; &amp; condição | 0,50 |");
  expect(markdown).not.toContain("| A leitura começa");
});

it("indica página sem texto mesmo sem separadores e não confunde texto curto com imagem", async () => {
  const result = await convertPdfToMarkdown(await createMdC1Corpus(), { includePageBreaks: false });
  expect(result.markdown).toContain("<!-- Página 3: sem texto selecionável -->");
  expect(result.markdown).toContain("Fim.");
  expect(result).toMatchObject({
    pagesWithoutText: [3],
    pageReports: [
      { pageNumber: 1, readingOrder: "columns" },
      { pageNumber: 2, readingOrder: "rows" },
      { pageNumber: 3, readingOrder: "none" },
      { pageNumber: 4, readingOrder: "rows" },
    ],
  });
});

it("permite escolher explicitamente a leitura por linhas sem perder conteúdo", async () => {
  const result = await convertPdfToMarkdown(await createMdC1Corpus(), {
    readingOrder: "rows",
    detectTables: false,
  });
  expect(result.markdown.indexOf(mdRight[0])).toBeLessThan(result.markdown.indexOf(mdLeft[3]));
  expect(result.markdown).toContain(mdLeft[3]);
});

it.each([90, 180, 270])(
  "mantém a ordem lógica do conteúdo ao rotacionar a página %s",
  async (angle) => {
    const result = await convertPdfToMarkdown(await createMdC1Corpus(angle));
    expect(result.markdown.indexOf(mdRight[0])).toBeGreaterThan(result.markdown.indexOf(mdLeft[3]));
  },
);

it("cancela antes de carregar e não transforma PDF vazio de texto em entrega falsa", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    convertPdfToMarkdown(await createMdC1Corpus(), { signal: controller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  const pdf = await PDFDocument.create();
  pdf.addPage();
  await expect(convertPdfToMarkdown(await pdf.save())).rejects.toThrow(
    "PDF_SEM_TEXTO_SELECIONAVEL",
  );
});

it("preserva todas as linhas de um documento longo sem truncar a saída", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  const lines = Array.from(
    { length: 180 },
    (_, i) => `Linha ${String(i).padStart(3, "0")} com conteúdo integral.`,
  );
  lines.forEach((text, i) => {
    page.drawText(text, { x: 40, y: 780 - i * 4, size: 3 });
  });
  const result = await convertPdfToMarkdown(await pdf.save());
  for (const line of lines) expect(result.markdown.split(line)).toHaveLength(2);
});

it("distingue células com traços literais do separador sintático da tabela", async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  [
    ["A", "B"],
    ["---", "---"],
  ].forEach((row, r) => {
    row.forEach((text, c) => {
      page.drawText(text, { x: 40 + c * 200, y: 700 - r * 25, size: 11 });
    });
  });
  const result = await convertPdfToMarkdown(await pdf.save());
  expect(result.markdown).toContain("| \\-\\-\\- | \\-\\-\\- |");
});

it.each(["| --- | --- |", "| A | B |", "---"])(
  "preserva linha literal %s sem interpretá-la como estrutura Markdown",
  async (text) => {
    const pdf = await PDFDocument.create();
    pdf.addPage().drawText(text, { x: 40, y: 700, size: 11 });
    const result = await convertPdfToMarkdown(await pdf.save(), {
      detectHeadings: false,
      detectTables: false,
    });
    expect(result.markdown).toBe(text === "---" ? "\\-\\-\\-" : text.replace(/\|/g, "\\|"));
  },
);
