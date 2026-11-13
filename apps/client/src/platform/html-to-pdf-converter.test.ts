import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { convertHtmlToPdfDocument, sanitizeHtmlForPdf } from "./html-to-pdf-converter";

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

  describe("sanitização, renderização fiel CSS/imagem e camada de texto pesquisável", () => {
    const MINIMAL_PNG_BYTES = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const MINIMAL_PNG_DATA_URL = `data:image/png;base64,${Buffer.from(MINIMAL_PNG_BYTES).toString("base64")}`;

    const originalGetClientRects = Object.getOwnPropertyDescriptor(
      Range.prototype,
      "getClientRects",
    );

    function mockRangeGetClientRects(fn: () => DOMRectList) {
      Object.defineProperty(Range.prototype, "getClientRects", {
        configurable: true,
        writable: true,
        value: fn,
      });
    }

    afterEach(() => {
      if (originalGetClientRects) {
        Object.defineProperty(Range.prototype, "getClientRects", originalGetClientRects);
      } else {
        Reflect.deleteProperty(Range.prototype, "getClientRects");
      }
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    it("remove tags perigosas, handlers inline, javascript: e URLs externas mantendo CSS e data:image/*", () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Relatório Seguro</title>
            <link rel="stylesheet" href="https://evil.invalid/style.css" />
            <style>
              @import "https://evil.invalid/imported.css";
              .card {
                display: flex;
                background-color: #f8fafc;
                border: 2px solid #0284c7;
                background-image: url("https://evil.invalid/bg.png");
              }
            </style>
          </head>
          <body>
            <script>window.__hacked = true;</script>
            <noscript>Sem script</noscript>
            <iframe src="https://evil.invalid/frame"></iframe>
            <object data="https://evil.invalid/obj"></object>
            <embed src="https://evil.invalid/emb" />
            <div class="card" onclick="alert(1)" style="color:#0f172a">
              <a href="javascript:alert(2)">Link malicioso</a>
              <img id="ext" src="https://evil.invalid/tracker.png" alt="Externo" />
              <img id="local" src="${MINIMAL_PNG_DATA_URL}" alt="Local" />
              <svg width="24" height="24" onload="alert(3)">
                <rect width="24" height="24" fill="#0284c7" />
              </svg>
            </div>
          </body>
        </html>
      `;

      const sanitized = sanitizeHtmlForPdf(html);
      expect(sanitized.title).toBe("Relatório Seguro");
      expect(sanitized.styleCss).toContain("display: flex");
      expect(sanitized.styleCss).toContain("background-color: #f8fafc");
      expect(sanitized.styleCss).toContain("border: 2px solid #0284c7");
      expect(sanitized.styleCss).not.toContain("evil.invalid");
      expect(sanitized.styleCss).not.toContain("@import");

      expect(sanitized.bodyHtml).not.toContain("<script");
      expect(sanitized.bodyHtml).not.toContain("<noscript");
      expect(sanitized.bodyHtml).not.toContain("<iframe");
      expect(sanitized.bodyHtml).not.toContain("<object");
      expect(sanitized.bodyHtml).not.toContain("<embed");
      expect(sanitized.bodyHtml).not.toContain("onclick");
      expect(sanitized.bodyHtml).not.toContain("onload");
      expect(sanitized.bodyHtml).not.toContain("javascript:");
      expect(sanitized.bodyHtml).not.toContain("https://evil.invalid");
      expect(sanitized.bodyHtml).toContain(MINIMAL_PNG_DATA_URL);
      expect(sanitized.bodyHtml).toContain("<svg");
      expect(sanitized.bodyHtml).toContain("<rect");
    });

    it("rasteriza página com CSS e imagem embutida (XObject /Image) e preserva camada de texto pesquisável", async () => {
      const capturedSvgSources: string[] = [];
      const drawImage = vi.fn();
      const fillRect = vi.fn();
      const mockCtx = {
        fillStyle: "#ffffff",
        fillRect,
        drawImage,
      } as unknown as CanvasRenderingContext2D;

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => mockCtx);
      vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(MINIMAL_PNG_DATA_URL);

      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        complete = true;
        private _src = "";
        get src() {
          return this._src;
        }
        set src(value: string) {
          this._src = value;
          capturedSvgSources.push(value);
          queueMicrotask(() => {
            this.onload?.();
          });
        }
        decode() {
          return Promise.resolve();
        }
      }
      vi.stubGlobal("Image", MockImage);

      let lineOffset = 0;
      mockRangeGetClientRects(() => {
        const top = 20 + lineOffset * 28;
        lineOffset += 1;
        return [
          {
            left: 16,
            top,
            right: 320,
            bottom: top + 18,
            width: 304,
            height: 18,
            x: 16,
            y: top,
            toJSON: () => ({}),
          } as DOMRect,
        ] as unknown as DOMRectList;
      });

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Cartão Fiel</title>
            <style>
              .box {
                display: flex;
                background-color: #e0f2fe;
                border: 1px solid #0284c7;
                font-family: Georgia, serif;
              }
            </style>
          </head>
          <body>
            <script>evil()</script>
            <div class="box">
              <h1>Relatório Visual Fiel</h1>
              <p>Texto pesquisável com CSS Flexbox e imagem local.</p>
              <img src="${MINIMAL_PNG_DATA_URL}" alt="Logo" />
              <img src="https://evil.invalid/leak.png" alt="Bloqueado" />
            </div>
          </body>
        </html>
      `;

      const result = await convertHtmlToPdfDocument(html, {
        pageSize: "A4",
        orientation: "portrait",
        margin: "normal",
      });

      expect(drawImage).toHaveBeenCalled();
      expect(capturedSvgSources.length).toBeGreaterThanOrEqual(1);
      const decodedSvg = decodeURIComponent(capturedSvgSources[0]);
      expect(decodedSvg).toContain("<foreignObject");
      expect(decodedSvg).toContain("background-color: #e0f2fe");
      expect(decodedSvg).toContain("display: flex");
      expect(decodedSvg).toContain(MINIMAL_PNG_DATA_URL);
      expect(decodedSvg).not.toContain("evil.invalid");
      expect(decodedSvg).not.toContain("<script");

      // Verifica que o PDF possui objeto de imagem (/Subtype /Image)
      const pdfDoc = await PDFDocument.load(result.bytes);
      const page = pdfDoc.getPage(0);
      const xObjects = page.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
      expect(xObjects).toBeDefined();
      const hasImageXObject = xObjects?.keys().some((key) => {
        const obj = pdfDoc.context.lookup(xObjects.get(key));
        return (
          obj instanceof PDFRawStream &&
          obj.dict.get(PDFName.of("Subtype"))?.toString() === "/Image"
        );
      });
      expect(hasImageXObject).toBe(true);

      // Verifica camada de texto pesquisável extraída pelo pdfjs-dist
      const task = getDocument({ data: result.bytes.slice(), useSystemFonts: true });
      try {
        const parsed = await task.promise;
        const firstPage = await parsed.getPage(1);
        const content = await firstPage.getTextContent();
        const extracted = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
        expect(extracted).toContain("Relatório Visual Fiel");
        expect(extracted).toContain("Texto pesquisável com CSS Flexbox e imagem local.");
      } finally {
        await task.destroy();
      }
    });

    it("lida graciosamente quando getClientRects retorna vazio no jsdom mantendo imagem e texto", async () => {
      const mockCtx = {
        fillStyle: "#ffffff",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => mockCtx);
      vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(MINIMAL_PNG_DATA_URL);

      class MockImage {
        onload: (() => void) | null = null;
        complete = true;
        set src(_value: string) {
          queueMicrotask(() => {
            this.onload?.();
          });
        }
      }
      vi.stubGlobal("Image", MockImage);
      mockRangeGetClientRects(() => [] as unknown as DOMRectList);

      const result = await convertHtmlToPdfDocument(
        `<p>Texto preservado sem retângulos de layout</p><img src="${MINIMAL_PNG_DATA_URL}" />`,
      );
      expect(result.pageCount).toBe(1);

      const pdfDoc = await PDFDocument.load(result.bytes);
      const xObjects = pdfDoc.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
      const hasImageXObject = xObjects?.keys().some((key) => {
        const obj = pdfDoc.context.lookup(xObjects.get(key));
        return (
          obj instanceof PDFRawStream &&
          obj.dict.get(PDFName.of("Subtype"))?.toString() === "/Image"
        );
      });
      expect(hasImageXObject).toBe(true);

      const task = getDocument({ data: result.bytes.slice(), useSystemFonts: true });
      try {
        const parsed = await task.promise;
        const firstPage = await parsed.getPage(1);
        const content = await firstPage.getTextContent();
        const extracted = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
        expect(extracted).toContain("Texto preservado sem retângulos de layout");
      } finally {
        await task.destroy();
      }
    });

    it("pagina conteúdo longo e quebras CSS no modo navegador preservando texto em cada página", async () => {
      const mockCtx = {
        fillStyle: "#ffffff",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D;

      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => mockCtx);
      vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(MINIMAL_PNG_DATA_URL);

      class MockImage {
        onload: (() => void) | null = null;
        complete = true;
        set src(_value: string) {
          queueMicrotask(() => {
            this.onload?.();
          });
        }
      }
      vi.stubGlobal("Image", MockImage);

      let index = 0;
      mockRangeGetClientRects(() => {
        // Página A4 normal tem ~994px de altura útil; colocamos uma linha em y=40 e outra em y=1200
        const top = index === 0 ? 40 : 1200;
        index += 1;
        return [
          {
            left: 10,
            top,
            right: 260,
            bottom: top + 18,
            width: 250,
            height: 18,
            x: 10,
            y: top,
            toJSON: () => ({}),
          } as DOMRect,
        ] as unknown as DOMRectList;
      });

      const result = await convertHtmlToPdfDocument(
        "<p>Linha Página Um</p><p>Linha Página Dois</p>",
        { pageSize: "A4", margin: "normal" },
      );
      expect(result.pageCount).toBe(2);

      const task = getDocument({ data: result.bytes.slice(), useSystemFonts: true });
      try {
        const parsed = await task.promise;
        const p1 = (await (await parsed.getPage(1)).getTextContent()).items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        const p2 = (await (await parsed.getPage(2)).getTextContent()).items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        expect(p1).toContain("Linha Página Um");
        expect(p2).toContain("Linha Página Dois");
      } finally {
        await task.destroy();
      }
    });

    it("incorpora camada Unicode via addOcrTextLayer quando a fonte padrão está acessível", async () => {
      const fontPath = [
        path.resolve(process.cwd(), "public/standard_fonts/LiberationSans-Regular.ttf"),
        path.resolve(process.cwd(), "apps/client/public/standard_fonts/LiberationSans-Regular.ttf"),
      ].find((candidate) => existsSync(candidate));
      if (!fontPath) throw new Error("LiberationSans-Regular.ttf não encontrado");
      const fontBytes = readFileSync(fontPath);

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(fontBytes, { status: 200 })),
      );
      const mockCtx = {
        fillStyle: "#ffffff",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => mockCtx);
      vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(MINIMAL_PNG_DATA_URL);

      class MockImage {
        onload: (() => void) | null = null;
        complete = true;
        set src(_value: string) {
          queueMicrotask(() => {
            this.onload?.();
          });
        }
      }
      vi.stubGlobal("Image", MockImage);
      mockRangeGetClientRects(() => {
        return [
          {
            left: 12,
            top: 24,
            right: 240,
            bottom: 42,
            width: 228,
            height: 18,
            x: 12,
            y: 24,
            toJSON: () => ({}),
          } as DOMRect,
        ] as unknown as DOMRectList;
      });

      const result = await convertHtmlToPdfDocument("<p>Camada Unicode NexoHub №1</p>");
      const task = getDocument({ data: result.bytes.slice(), disableFontFace: true });
      try {
        const parsed = await task.promise;
        const firstPage = await parsed.getPage(1);
        const content = await firstPage.getTextContent({ disableNormalization: true });
        const extracted = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ");
        expect(extracted).toContain("Camada Unicode NexoHub №1");
      } finally {
        await task.destroy();
      }
    });

    it("executa fallback estrutural multipágina quando document não está disponível (Node puro)", async () => {
      vi.stubGlobal("document", undefined);
      vi.stubGlobal("DOMParser", undefined);

      const paragraphs = Array.from(
        { length: 45 },
        (_, i) =>
          `<p>Parágrafo fallback ${i + 1}: conteúdo textual extenso sem DOM para testar paginação determinística.</p>`,
      ).join("\n");
      const result = await convertHtmlToPdfDocument(
        `<script>alert(1)</script><h1>Título Fallback</h1>${paragraphs}`,
      );

      expect(result.pageCount).toBeGreaterThan(1);
      const task = getDocument({ data: result.bytes.slice(), useSystemFonts: true });
      try {
        const parsed = await task.promise;
        const page1Text = (await (await parsed.getPage(1)).getTextContent()).items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        expect(page1Text).toContain("Título Fallback");
        expect(page1Text).toContain("Parágrafo fallback 1");
        expect(page1Text).not.toContain("alert(1)");
      } finally {
        await task.destroy();
      }
    });
  });
});
