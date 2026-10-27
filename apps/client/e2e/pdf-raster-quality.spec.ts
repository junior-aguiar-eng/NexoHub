import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import {
  createEmbeddedRasterCorpus,
  createVectorRasterCorpus,
  rasterReference,
} from "../src/platform/__fixtures__/q-c0-raster/corpus";

const route = (path: string) => `${process.env.NEXOHUB_BASE_PATH ?? "/"}${path}`;
const jpeg = () =>
  readFile(new URL("../src/platform/fixtures/extraction-red-2x1.jpg", import.meta.url));

async function upload(page: Page, path: string, bytes: Uint8Array) {
  await page.goto(route(path));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "entrada.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });
}
async function run(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
}
async function download(page: Page, name = /Baixar arquivo gerado/i) {
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name }).click();
  const file = await pending;
  return {
    bytes: new Uint8Array(await readFile(await file.path())),
    name: file.suggestedFilename(),
  };
}
async function probe(page: Page, bytes: Uint8Array, points: number[][]) {
  return page.evaluate(
    async ({ data, points }) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas indisponível");
        context.drawImage(bitmap, 0, 0);
        return {
          width: bitmap.width,
          height: bitmap.height,
          pixels: points.map(([x, y]) => [
            ...context.getImageData(
              Math.floor(x * bitmap.width),
              Math.floor(y * bitmap.height),
              1,
              1,
            ).data,
          ]),
        };
      } finally {
        bitmap.close();
      }
    },
    { data: [...bytes], points },
  );
}
function colors(actual: number[][], expected: readonly (readonly number[])[], tolerance = 0) {
  expect(actual).toHaveLength(expected.length);
  expected.forEach((pixel, i) => {
    pixel.forEach((value, channel) => {
      // Canvas perde RGB oculto ao premultiplicar alpha zero; conferimos o alpha nesse caso.
      if (pixel[3] !== 0 || channel === 3)
        expect(Math.abs(actual[i][channel] - value)).toBeLessThanOrEqual(tolerance);
    });
  });
}
const bandPoints = [
  [1 / 6, 0.5],
  [0.5, 0.5],
  [5 / 6, 0.5],
];
const extractionPoints = Array.from({ length: 32 * 16 }, (_, i) => [
  ((i % 32) + 0.5) / 32,
  (Math.floor(i / 32) + 0.5) / 16,
]);
const extractionPixels = Array.from(
  { length: 32 * 16 },
  (_, i) => rasterReference.alphaProbes[i % 32 < 11 ? 0 : i % 32 < 22 ? 1 : 2],
);

test("Q-C0 extração sem imagem elegível não oferece download fictício", async ({ page }) => {
  const doc = await PDFDocument.create(),
    sheet = doc.addPage([144, 72]);
  sheet.drawImage(await doc.embedJpg(await jpeg()), { x: 0, y: 0, width: 144, height: 72 });
  await upload(page, "extrair-imagens", await doc.save());
  await run(page);
  await expect(page.getByRole("alert")).toContainText(
    "Nenhuma imagem incorporada foi encontrada neste PDF.",
  );
  await expect(page.getByRole("link", { name: /Baixar imagens selecionadas/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Selecionar imagem_p/ })).toHaveCount(0);
});

test("Q-C0 imagens→PDF: ordem, formatos, proporção e alpha sobre branco no download", async ({
  page,
}) => {
  await page.goto(route("imagem-para-pdf"));
  const images = await page.evaluate(async () => {
    const results: { mimeType: string; bytes: number[] }[] = [];
    for (const [mimeType, width, height] of [
      ["image/png", 120, 60],
      ["image/jpeg", 144, 72],
      ["image/webp", 96, 48],
    ] as const) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível");
      const palette =
        mimeType === "image/jpeg"
          ? ["red", "lime", "blue"]
          : ["rgba(255,0,0,0)", "rgba(0,255,0,0.5)", "blue"];
      palette.forEach((color, i) => {
        context.fillStyle = color;
        context.fillRect((i * width) / 3, 0, width / 3, height);
      });
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mimeType, 0.95),
      );
      if (!blob || blob.type !== mimeType) throw new Error("Formato indisponível");
      results.push({ mimeType, bytes: [...new Uint8Array(await blob.arrayBuffer())] });
    }
    return results;
  });
  await page.locator('input[type="file"]').setInputFiles(
    images.map((image, i) => ({
      name: `controle.${["png", "jpg", "webp"][i]}`,
      mimeType: image.mimeType,
      buffer: Buffer.from(image.bytes),
    })),
  );
  await page.getByTitle("Mover para esquerda").nth(1).click();
  await page.getByRole("button", { name: "Ajustar à imagem", exact: true }).click();
  await page.getByRole("button", { name: "Sem margem", exact: true }).click();
  await run(page);
  const pdfBytes = (await download(page)).bytes;
  const pdf = await PDFDocument.load(pdfBytes);
  expect(pdf.getPages().map((p) => p.getSize())).toEqual([
    { width: 144, height: 72 },
    { width: 120, height: 60 },
    { width: 96, height: 48 },
  ]);
  await upload(page, "pdf-para-jpg", pdfBytes);
  await run(page);
  const output = await download(page);
  expect(output.name).toMatch(/\.zip$/);
  const files = unzipSync(output.bytes);
  expect(Object.keys(files)).toEqual([
    "entrada_pagina_1.jpg",
    "entrada_pagina_2.jpg",
    "entrada_pagina_3.jpg",
  ]);
  const sizes = [
    [300, 150],
    [250, 125],
    [200, 100],
  ];
  for (const [i, bytes] of Object.values(files).entries()) {
    const image = await probe(page, bytes, bandPoints);
    expect([image.width, image.height]).toEqual(sizes[i]);
    colors(
      image.pixels,
      i === 0 ? rasterReference.opaqueProbes : rasterReference.whiteCompositeProbes,
      rasterReference.jpegTolerance,
    );
  }
});

test("Q-C0 PDF→JPG: CropBox, rotação, pixels e ordem no ZIP a 150 DPI", async ({ page }) => {
  await upload(page, "pdf-para-jpg", await createVectorRasterCorpus());
  await run(page);
  const files = unzipSync((await download(page)).bytes);
  expect(Object.keys(files)).toEqual([
    "entrada_pagina_1.jpg",
    "entrada_pagina_2.jpg",
    "entrada_pagina_3.jpg",
    "entrada_pagina_4.jpg",
  ]);
  const first = await probe(page, files["entrada_pagina_1.jpg"], [
    [0.25, 0.5],
    [0.75, 0.5],
  ]);
  expect([first.width, first.height]).toEqual([300, 150]);
  colors(
    first.pixels,
    [
      [255, 0, 0, 255],
      [0, 0, 255, 255],
    ],
    rasterReference.jpegTolerance,
  );
  const second = await probe(page, files["entrada_pagina_2.jpg"], [
    [0.5, 0.25],
    [0.5, 0.75],
  ]);
  expect([second.width, second.height]).toEqual([100, 200]);
  colors(
    second.pixels,
    [
      [255, 0, 0, 255],
      [0, 0, 255, 255],
    ],
    rasterReference.jpegTolerance,
  );
  expect(() =>
    colors(
      second.pixels,
      [
        [0, 0, 255, 255],
        [255, 0, 0, 255],
      ],
      rasterReference.jpegTolerance,
    ),
  ).toThrow();
  const third = await probe(page, files["entrada_pagina_3.jpg"], [
    [0.25, 0.5],
    [0.75, 0.5],
  ]);
  expect([third.width, third.height]).toEqual([200, 100]);
  colors(
    third.pixels,
    [
      [0, 0, 255, 255],
      [255, 0, 0, 255],
    ],
    rasterReference.jpegTolerance,
  );
  const fourth = await probe(page, files["entrada_pagina_4.jpg"], [
    [0.5, 0.25],
    [0.5, 0.75],
  ]);
  expect([fourth.width, fourth.height]).toEqual([100, 200]);
  colors(
    fourth.pixels,
    [
      [0, 0, 255, 255],
      [255, 0, 0, 255],
    ],
    rasterReference.jpegTolerance,
  );
});

for (const mode of ["all", "default", "page2"] as const) {
  test(`Q-C0 extração ${mode}: PNG com alpha, JPEG exato e seleção no download`, async ({
    page,
  }) => {
    const original = new Uint8Array(await jpeg());
    await upload(page, "extrair-imagens", await createEmbeddedRasterCorpus(original));
    if (mode !== "default") await page.getByRole("checkbox").uncheck();
    if (mode === "page2") {
      await page.getByRole("button", { name: "Páginas selecionadas", exact: true }).click();
      await page.getByPlaceholder("Ex.: 1, 3, 5-8").fill("2");
    }
    await run(page);
    await expect(page.getByRole("button", { name: /^Selecionar imagem_p/ })).toHaveCount(
      mode === "all" ? 3 : mode === "default" ? 2 : 1,
    );
    const output = await download(page, /Baixar imagens selecionadas/i);
    if (mode === "page2") {
      expect(output.name).toMatch(/imagem_p2_1\.jpg$/);
      expect(output.bytes).toEqual(original);
    } else {
      const files = unzipSync(output.bytes),
        names = Object.keys(files);
      expect(names).toEqual(
        mode === "all"
          ? ["entrada_imagem_p1_1.png", "entrada_imagem_p2_2.jpg", "entrada_imagem_p3_3.png"]
          : ["entrada_imagem_p1_1.png", "entrada_imagem_p3_2.png"],
      );
      for (const [name, bytes] of Object.entries(files)) {
        if (name.endsWith(".jpg")) expect(bytes).toEqual(original);
        else {
          const image = await probe(page, bytes, extractionPoints);
          expect([image.width, image.height]).toEqual([32, 16]);
          colors(image.pixels, extractionPixels);
          expect(() =>
            colors(
              image.pixels,
              extractionPixels.map((pixel) => [pixel[0], pixel[1], pixel[2], 255]),
            ),
          ).toThrow();
        }
      }
    }
  });
}
