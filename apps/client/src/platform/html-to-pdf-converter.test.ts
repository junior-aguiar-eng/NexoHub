import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { convertHtmlToPdfDocument } from "./html-to-pdf-converter";

async function outputPages(html: string) {
  const result = await convertHtmlToPdfDocument(html);
  const task = getDocument({ data: result.bytes.slice(), useSystemFonts: true });
  try {
    const doc = await task.promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const text = await page.getTextContent();
      pages.push({
        text: text.items.map((item) => ("str" in item ? item.str : "")).join(" "),
        items: text.items.filter((item) => "str" in item),
        width: page.view[2] - page.view[0],
        height: page.view[3] - page.view[1],
      });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

describe("html-to-pdf-converter", () => {
  it("respeita quebras inline entre itens de lista e linhas do corpo da tabela", async () => {
    const list = await outputPages(
      '<ul><li>ANTES</li><li style="break-before:page">DEPOIS</li><li style="page-break-after:always">TERCEIRO</li><li>ULTIMO</li></ul>',
    );
    expect(list).toHaveLength(3);
    expect(list[0].text).toContain("ANTES");
    expect(list[1].text).toContain("DEPOIS");
    expect(list[2].text).toContain("ULTIMO");
  });
  it("respeita quebras entre linhas do corpo mantendo o cabeçalho", async () => {
    const table = await outputPages(
      '<table><thead><tr><th>Cabecalho</th></tr></thead><tbody><tr><td>ANTES</td></tr><tr style="page-break-before:always"><td>DEPOIS</td></tr><tr style="break-after:page"><td>TERCEIRO</td></tr><tr><td>ULTIMO</td></tr></tbody></table>',
    );
    expect(table).toHaveLength(3);
    for (const page of table) expect(page.text).toContain("Cabecalho");
    expect(table[0].text).toContain("ANTES");
    expect(table[1].text).toContain("DEPOIS");
    expect(table[2].text).toContain("ULTIMO");
  });
  it("repete o cabeçalho em cada página da tabela e preserva o último conteúdo", async () => {
    const rows = Array.from(
      { length: 110 },
      (_, i) => `<tr><td>Registro ${i}</td><td>Valor ${i}</td></tr>`,
    ).join("");
    const pages = await outputPages(
      `<table><thead><tr><th>Identificador</th><th>Descrição</th></tr></thead><tbody>${rows}<tr><td>ULTIMO-REGISTRO</td><td>FIM-TABELA</td></tr></tbody></table>`,
    );
    expect(pages.length).toBeGreaterThan(2);
    for (const page of pages) {
      expect(page.text).toContain("Identificador");
      expect(page.text).toContain("Descrição");
      for (const item of page.items) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(0);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(page.width + 0.5);
        expect(item.transform[5]).toBeGreaterThan(0);
        expect(item.transform[5] + item.height).toBeLessThanOrEqual(page.height);
      }
    }
    expect(pages.at(-1)?.text).toContain("FIM-TABELA");
    for (let i = 0; i < 110; i++)
      expect(pages.map((p) => p.text).join(" ")).toContain(`Registro ${i}`);
  });

  it("aplica quebras inline antes/depois sem criar páginas vazias nas extremidades", async () => {
    const pages = await outputPages(
      '<div style="break-before:page"><p>PRIMEIRO</p></div><p style="page-break-before:always">SEGUNDO</p><div style="break-after:page"><p>TERCEIRO</p></div><p>QUARTO</p><div style="page-break-after:always"></div>',
    );
    expect(pages).toHaveLength(3);
    expect(pages[0].text).toContain("PRIMEIRO");
    expect(pages[1].text).toContain("SEGUNDO TERCEIRO");
    expect(pages[2].text).toContain("QUARTO");
  });

  it("recusa cabeçalho maior que a página em vez de cortar ou repetir sem fim", async () => {
    await expect(
      convertHtmlToPdfDocument(
        `<table><thead><tr><th>${"CABECALHO ".repeat(2000)}</th></tr></thead><tbody><tr><td>FIM</td></tr></tbody></table>`,
      ),
    ).rejects.toThrow("HTML_TABLE_HEADER_TOO_TALL");
  });
  it("converte código HTML semântico com títulos, parágrafos, listas e tabelas", async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Mensal</title>
        </head>
        <body>
          <h1>Título Principal do Documento</h1>
          <p>Este é um parágrafo descritivo com formatação padrão.</p>
          <hr />
          <h2>Tópicos Importantes</h2>
          <ul>
            <li>Primeiro item da lista</li>
            <li>Segundo item importante</li>
            <li>Terceiro item da lista</li>
          </ul>
          <blockquote>
            "A simplicidade é o último grau de sofisticação."
          </blockquote>
          <h3>Dados Tabulares</h3>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qtd</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Serviço A</td>
                <td>2</td>
                <td>R$ 200,00</td>
              </tr>
              <tr>
                <td>Serviço B</td>
                <td>1</td>
                <td>R$ 150,00</td>
              </tr>
            </tbody>
          </table>
          <pre>console.log("NexoHub Local Engine");</pre>
        </body>
      </html>
    `;

    const result = await convertHtmlToPdfDocument(html, {
      pageSize: "A4",
      orientation: "portrait",
      margin: "normal",
      includePageNumbers: true,
    });

    expect(result.bytes.length).toBeGreaterThan(500);
    expect(result.title).toBe("Relatório Mensal");
    expect(result.pageCount).toBeGreaterThanOrEqual(1);

    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPageCount()).toBe(result.pageCount);
    expect(doc.getTitle()).toBe("Relatório Mensal");
  });

  it("suporta orientação landscape e tamanho de página alternativo", async () => {
    const html = `
      <h1>Planilha Paisagem</h1>
      <p>Documento largo para apresentação em modo horizontal.</p>
    `;

    const result = await convertHtmlToPdfDocument(html, {
      pageSize: "Letter",
      orientation: "landscape",
      margin: "small",
    });

    const doc = await PDFDocument.load(result.bytes);
    const page = doc.getPage(0);
    // Letter: 612 x 792. Em landscape: width = 792, height = 612
    expect(page.getWidth()).toBe(792);
    expect(page.getHeight()).toBe(612);
  });

  it("gera quebras de página automáticas para conteúdos extensos", async () => {
    const paragraphs = Array.from(
      { length: 45 },
      (_, i) =>
        `<p>Parágrafo ${i + 1}: texto suficientemente longo para preencher as páginas do documento de forma contínua e testar a paginação automática.</p>`,
    ).join("\n");

    const html = `
      <h1>Documento Extenso Multipágina</h1>
      ${paragraphs}
    `;

    const result = await convertHtmlToPdfDocument(html, {
      pageSize: "A4",
      margin: "normal",
    });

    expect(result.pageCount).toBeGreaterThan(1);
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPageCount()).toBe(result.pageCount);
  });

  it("rejeita conteúdo vazio ou somente com espaços", async () => {
    await expect(convertHtmlToPdfDocument("")).rejects.toThrow("HTML_CONTENT_EMPTY");
    await expect(convertHtmlToPdfDocument("   \n\t ")).rejects.toThrow("HTML_CONTENT_EMPTY");
  });
});
