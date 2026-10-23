// @vitest-environment node
import { readFile } from "node:fs/promises";
import { degrees, PDFDocument, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { comparePdfDocuments, PDF_COMPARISON_LIMITS } from "./pdf-comparison";

async function pdf(pages: readonly (string | number)[], rotation = 0, crop = false, fontSize = 14) {
  const document = await PDFDocument.create();
  for (const value of pages) {
    const page = document.addPage([300, 200]);
    if (crop) page.setCropBox(25, 20, 250, 160);
    page.setRotation(degrees(rotation));
    if (typeof value === "string") page.drawText(value, { x: 40, y: 100, size: fontSize });
    else
      page.drawRectangle({
        x: 40 + value * 20,
        y: 50,
        width: 40,
        height: 60,
        color: rgb(value / 5, 0.2, 0.6),
      });
  }
  return document.save();
}

describe("comparação real de PDFs locais", () => {
  it("identifica PDFs iguais, preserva os bytes e informa progresso", async () => {
    const left = await pdf(["Contrato original"]);
    const original = left.slice();
    const phases: string[] = [];
    const result = await comparePdfDocuments(left, left, {
      onProgress: (value) => phases.push(value.phase),
    });
    expect(result.pairs[0]).toMatchObject({
      status: "unchanged",
      textChanged: false,
      visualChanged: false,
      visualDifferenceRatio: 0,
      regions: [],
    });
    expect(result.pairs[0]?.leftImage).toMatch(/^data:image\/png;base64,/);
    expect(result.pairs[0]?.diffImage).toMatch(/^data:image\/png;base64,/);
    expect(result.leftHasText).toBe(true);
    expect(left).toEqual(original);
    expect(phases).toEqual(expect.arrayContaining(["reading", "aligning", "comparing", "done"]));
  });
  it("separa alterações textuais de alterações visuais e aponta regiões normalizadas", async () => {
    const result = await comparePdfDocuments(
      await pdf(["valor antigo"]),
      await pdf(["valor novo"]),
    );
    const pair = result.pairs[0];
    expect(pair).toMatchObject({ status: "modified", textChanged: true, visualChanged: true });
    expect(pair?.textDiff.stats.wordsAdded).toBe(1);
    expect(pair?.textDiff.stats.wordsDeleted).toBe(1);
    expect(pair?.regions.length).toBeGreaterThan(0);
    for (const region of pair?.regions ?? []) {
      expect(region.x).toBeGreaterThanOrEqual(0);
      expect(region.y).toBeGreaterThanOrEqual(0);
      expect(region.x + region.width).toBeLessThanOrEqual(1);
      expect(region.y + region.height).toBeLessThanOrEqual(1);
    }
  });
  it.each([false, true])(
    "alinha inserção/remoção intermediária sem cascata: remoção=%s",
    async (remove) => {
      const a = await pdf(["Pagina alfa", "Pagina beta", "Pagina gama"]);
      const b = await pdf(["Pagina alfa", "Pagina inserida", "Pagina beta", "Pagina gama"]);
      const result = await comparePdfDocuments(remove ? b : a, remove ? a : b);
      expect(result.pairs.map((pair) => pair.status)).toEqual([
        "unchanged",
        remove ? "removed" : "added",
        "unchanged",
        "unchanged",
      ]);
      expect(result.pairs[2]).toMatchObject({
        leftPage: remove ? 3 : 2,
        rightPage: remove ? 2 : 3,
      });
    },
  );
  it("alinha páginas sem texto pela assinatura visual e sinaliza texto ausente", async () => {
    const result = await comparePdfDocuments(await pdf([0, 1, 2]), await pdf([0, 4, 1, 2]));
    expect(result.leftHasText).toBe(false);
    expect(result.rightHasText).toBe(false);
    expect(result.pairs.map((pair) => pair.status)).toEqual([
      "unchanged",
      "added",
      "unchanged",
      "unchanged",
    ]);
  });
  it("detecta mudanças de imagem sem inventar diferença textual", async () => {
    const result = await comparePdfDocuments(await pdf([0]), await pdf([2]));
    expect(result.pairs[0]).toMatchObject({
      status: "modified",
      textChanged: false,
      visualChanged: true,
    });
  });
  it.each([0, 90, 180, 270])("respeita CropBox e rotação %s", async (rotation) => {
    const source = await pdf(["Texto visivel"], rotation, true);
    const result = await comparePdfDocuments(source, source);
    const pair = result.pairs[0];
    expect(pair?.status).toBe("unchanged");
    expect((pair?.width ?? 0) / (pair?.height ?? 1)).toBeCloseTo(
      rotation % 180 ? 160 / 250 : 250 / 160,
      2,
    );
  });
  it("usa a mesma escala física em páginas com dimensões diferentes", async () => {
    const a = await pdf([0]);
    const b = await PDFDocument.load(a);
    b.getPage(0).setSize(400, 200);
    const result = await comparePdfDocuments(a, await b.save());
    // A única mudança está no papel em branco: o conteúdo não deve ser redimensionado.
    expect(result.pairs[0]).toMatchObject({
      textChanged: false,
      visualChanged: true,
      geometryChanged: true,
      visualDifferenceRatio: 0,
    });
    expect(result.pairs[0]?.width).toBeGreaterThan(result.pairs[0]?.height ?? 0);
  });
  it.each([false, true])(
    "sinaliza inserção/remoção de página em branco: remoção=%s",
    async (remove) => {
      const a = await pdf(["Pagina alfa", "Pagina beta"]);
      const b = await pdf(["Pagina alfa", "", "Pagina beta"]);
      const result = await comparePdfDocuments(remove ? b : a, remove ? a : b);
      expect(result.pairs.map((pair) => pair.status)).toEqual([
        "unchanged",
        remove ? "removed" : "added",
        "unchanged",
      ]);
      expect(result.pairs[1]).toMatchObject({
        textChanged: false,
        visualChanged: true,
        visualDifferenceRatio: 0,
        regions: [{ x: 0, y: 0, width: 1, height: 1 }],
      });
    },
  );
  it("sinaliza orientação de página em branco sem inventar pixels diferentes", async () => {
    const result = await comparePdfDocuments(await pdf([""]), await pdf([""], 90));
    expect(result.pairs[0]).toMatchObject({
      status: "modified",
      geometryChanged: true,
      visualChanged: true,
      visualDifferenceRatio: 0,
      regions: [{ x: 0, y: 0, width: 1, height: 1 }],
    });
  });
  it("normaliza espaços extraídos para comparação textual", async () => {
    const result = await comparePdfDocuments(
      await pdf(["Texto com espacos"]),
      await pdf(["Texto  com   espacos"]),
    );
    expect(result.pairs[0]?.textChanged).toBe(false);
    expect(result.pairs[0]?.visualChanged).toBe(true);
  });
  it("recusa limites de páginas e bytes com código estável", async () => {
    const source = await pdf(["Pagina"]);
    await expect(
      comparePdfDocuments(new Uint8Array(PDF_COMPARISON_LIMITS.maxFileBytes + 1), source),
    ).rejects.toThrow("PDF_COMPARACAO_LIMITE_EXCEDIDO");
    await expect(
      comparePdfDocuments(
        await pdf(Array.from({ length: PDF_COMPARISON_LIMITS.maxPages + 1 }, () => "Pagina")),
        source,
      ),
    ).rejects.toThrow("PDF_COMPARACAO_LIMITE_EXCEDIDO");
  });
  it("recusa senha sem pedir credenciais nem expor conteúdo", async () => {
    const encrypted = new Uint8Array(
      await readFile(new URL("./__fixtures__/pdf-unlock/AES-256.pdf", import.meta.url)),
    );
    await expect(comparePdfDocuments(encrypted, await pdf(["Pagina"]))).rejects.toThrow(
      "PDF_COMPARACAO_SENHA_NECESSARIA",
    );
  });
  it.each(["x".repeat(20_001), "x ".repeat(2_001)])(
    "recusa texto fora do orçamento sem truncar (caso %#)",
    async (text) => {
      await expect(
        comparePdfDocuments(await pdf([text], 0, false, 0.001), await pdf(["Pagina"])),
      ).rejects.toThrow("PDF_COMPARACAO_TEXTO_LIMITE_EXCEDIDO");
    },
  );
  it("compara imagens rasterizadas sem texto selecionável", async () => {
    const document = await PDFDocument.create();
    const image = await document.embedPng(
      "iVBORw0KGgoAAAANSUhEUgAAACgAAAAKCAIAAABJ+IsHAAAAGklEQVR4nGP4z8AwIGhgbB21eNTiUYuHhcUAaRuOgDO6NfgAAAAASUVORK5CYII=",
    );
    document.addPage([300, 200]).drawImage(image, { x: 30, y: 40, width: 240, height: 100 });
    const source = await document.save();
    const result = await comparePdfDocuments(source, source);
    expect(result.leftHasText).toBe(false);
    expect(result.rightHasText).toBe(false);
    expect(result.pairs[0]?.status).toBe("unchanged");
    const changed = await comparePdfDocuments(source, await pdf([""]));
    expect(changed.pairs[0]).toMatchObject({
      status: "modified",
      textChanged: false,
      visualChanged: true,
    });
  });
  it("recusa entrada inválida e cancelamento prévio", async () => {
    const source = await pdf(["Pagina"]);
    await expect(comparePdfDocuments(new Uint8Array([1, 2, 3]), source)).rejects.toThrow(
      "PDF_COMPARACAO_PDF_INVALIDO",
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      comparePdfDocuments(source, source, { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("cancela durante o progresso e não emite conclusão", async () => {
    const controller = new AbortController();
    const phases: string[] = [];
    const source = await pdf(["Pagina alfa", "Pagina beta"]);
    await expect(
      comparePdfDocuments(source, source, {
        signal: controller.signal,
        onProgress: (info) => {
          phases.push(info.phase);
          if (info.phase === "comparing") controller.abort();
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(phases).not.toContain("done");
  });
});
