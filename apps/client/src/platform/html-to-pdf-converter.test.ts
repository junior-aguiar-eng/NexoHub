import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { convertHtmlToPdfDocument } from "./html-to-pdf-converter";

describe("html-to-pdf-converter", () => {
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
