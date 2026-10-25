// @vitest-environment node
import { computeHash2B, encodePasswordAES256 } from "@pdfsmaller/pdf-encrypt";
import { degrees, PDFDict, PDFDocument, PDFHexString, PDFName, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it, vi } from "vitest";
import { protectPdfDocument, redactPdfDocument } from "./pdf-engine";

async function sourcePdf(rotation = 0) {
  const doc = await PDFDocument.create();
  doc.setTitle("SEGREDO METADADO");
  const page = doc.addPage([300, 200]);
  page.setCropBox(50, 40, 200, 120);
  page.setRotation(degrees(rotation));
  page.drawRectangle({ x: 50, y: 40, width: 200, height: 120, color: rgb(1, 0, 0) });
  page.drawText("SEGREDO RECUPERAVEL", { x: 60, y: 100, size: 10 });
  return doc.save();
}
async function open(bytes: Uint8Array, password?: string) {
  const task = pdfjs.getDocument({ data: bytes.slice(), password, useSystemFonts: true });
  try {
    return await task.promise;
  } catch (error) {
    await task.destroy();
    throw error;
  }
}

describe("segurança real de proteção e ocultação", () => {
  it.each(["AES-256", "RC4"] as const)(
    "preserva espaços na senha %s e bloqueia senha incorreta",
    async (algorithm) => {
      const source = await sourcePdf();
      const original = source.slice();
      const bytes = await protectPdfDocument(source, {
        password: " senha exata ",
        ownerPassword: " titular exato ",
        algorithm,
      });
      expect(source).toEqual(original);
      await expect(open(bytes)).rejects.toMatchObject({ name: "PasswordException" });
      await expect(open(bytes, "senha exata")).rejects.toMatchObject({ name: "PasswordException" });
      for (const password of [" senha exata ", " titular exato "]) {
        const doc = await open(bytes, password);
        try {
          const text = await (await doc.getPage(1)).getTextContent();
          expect(text.items.some((item) => "str" in item && item.str.includes("SEGREDO"))).toBe(
            true,
          );
        } finally {
          await doc.loadingTask.destroy();
        }
      }
    },
  );
  it("grava permissões consistentes, inclusive impressão de alta qualidade e montagem", async () => {
    const bytes = await protectPdfDocument(await sourcePdf(), {
      password: "senha",
      allowPrinting: false,
      allowModifying: false,
      allowCopying: false,
    });
    const doc = await open(bytes, "senha");
    try {
      const permissions = await doc.getPermissions();
      for (const denied of [
        pdfjs.PermissionFlag.PRINT,
        pdfjs.PermissionFlag.PRINT_HIGH_QUALITY,
        pdfjs.PermissionFlag.COPY,
        pdfjs.PermissionFlag.MODIFY_CONTENTS,
        pdfjs.PermissionFlag.ASSEMBLE,
      ])
        expect(permissions).not.toContain(denied);
    } finally {
      await doc.loadingTask.destroy();
    }
  });
  it("não usa a senha de abertura como credencial implícita do titular", async () => {
    const bytes = await protectPdfDocument(await sourcePdf(), { password: "senha" });
    const parsed = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const encryption = parsed.context.lookup(parsed.context.trailerInfo.Encrypt, PDFDict);
    const user = encryption.lookup(PDFName.of("U"), PDFHexString).asBytes();
    const owner = encryption.lookup(PDFName.of("O"), PDFHexString).asBytes();
    const password = encodePasswordAES256("senha");
    expect(await computeHash2B(password, user.slice(32, 40), new Uint8Array())).toEqual(
      user.slice(0, 32),
    );
    expect(await computeHash2B(password, owner.slice(32, 40), user)).not.toEqual(
      owner.slice(0, 32),
    );
  });
  it("permite restrições com somente senha do titular", async () => {
    const bytes = await protectPdfDocument(await sourcePdf(), { ownerPassword: " titular " });
    for (const password of [undefined, " titular "]) {
      const doc = await open(bytes, password);
      expect(doc.numPages).toBe(1);
      await doc.loadingTask.destroy();
    }
  });
  it.each(["ação漢字", "senha🔐"])(
    "recusa RC4 Unicode com erro estruturado sem expor caracteres: %s",
    async (password) => {
      await expect(
        protectPdfDocument(await sourcePdf(), { algorithm: "RC4", password }),
      ).rejects.toThrow("SENHA_RC4_NAO_SUPORTADA");
      await expect(
        protectPdfDocument(await sourcePdf(), {
          algorithm: "RC4",
          password: "abertura",
          ownerPassword: password,
        }),
      ).rejects.toThrow("SENHA_RC4_NAO_SUPORTADA");
    },
  );
  it("abre RC4 com senha acentuada exata", async () => {
    const bytes = await protectPdfDocument(await sourcePdf(), {
      algorithm: "RC4",
      password: " ação-é-çã ",
    });
    const doc = await open(bytes, " ação-é-çã ");
    try {
      expect(
        (await (await doc.getPage(1)).getTextContent()).items.some(
          (item) => "str" in item && item.str.includes("SEGREDO"),
        ),
      ).toBe(true);
    } finally {
      await doc.loadingTask.destroy();
    }
  });
  it("aplica o limite AES-256 de 127 bytes conforme o padrão PDF", async () => {
    const prefix = `${"a".repeat(125)}ç`;
    const password = `${prefix}🔐sufixo`;
    expect(encodePasswordAES256(password)).toEqual(new TextEncoder().encode(prefix));
    expect(encodePasswordAES256(password)).toHaveLength(127);
    const bytes = await protectPdfDocument(await sourcePdf(), { password });
    for (const candidate of [password, prefix]) {
      const doc = await open(bytes, candidate);
      expect(doc.numPages).toBe(1);
      await doc.loadingTask.destroy();
    }
  });
  it("aceita senha Unicode AES-256", async () => {
    const bytes = await protectPdfDocument(await sourcePdf(), { password: "ação漢字🔐" });
    const doc = await open(bytes, "ação漢字🔐");
    expect(doc.numPages).toBe(1);
    await doc.loadingTask.destroy();
  });
  it("recusa ocultação sem áreas e documento que ultrapassa o limite de memória", async () => {
    await expect(redactPdfDocument(await sourcePdf(), { redactions: [] })).rejects.toThrow(
      "AREA_OCULTACAO_OBRIGATORIA",
    );
    const huge = await PDFDocument.create();
    for (let i = 0; i < 5; i++) huge.addPage([2000, 2000]);
    await expect(
      redactPdfDocument(await huge.save(), {
        redactions: [
          { id: "r", pageIndex: 0, xPercent: 0, yPercent: 0, widthPercent: 10, heightPercent: 10 },
        ],
      }),
    ).rejects.toThrow("PDF_OCULTACAO_LIMITE_EXCEDIDO");
  });
  it("recusa o orçamento total antes de alocar qualquer canvas", async () => {
    const probe = await open(await sourcePdf());
    const factory = Object.getPrototypeOf(probe.canvasFactory) as {
      create(width: number, height: number): unknown;
    };
    const create = vi.spyOn(factory, "create").mockImplementation(() => {
      throw new Error("CANVAS_ANTES_DO_PREFLIGHT");
    });
    try {
      const huge = await PDFDocument.create();
      for (let i = 0; i < 5; i++) huge.addPage([2000, 2000]);
      const options = {
        redactions: [
          { id: "r", pageIndex: 0, xPercent: 0, yPercent: 0, widthPercent: 10, heightPercent: 10 },
        ],
      };
      await expect(redactPdfDocument(await huge.save(), options)).rejects.toThrow(
        "PDF_OCULTACAO_LIMITE_EXCEDIDO",
      );
      expect(create).not.toHaveBeenCalled();
      const allowed = await PDFDocument.create();
      allowed.addPage([2000, 2000]);
      await expect(redactPdfDocument(await allowed.save(), options)).rejects.toThrow(
        "CANVAS_ANTES_DO_PREFLIGHT",
      );
      expect(create).toHaveBeenCalledOnce();
    } finally {
      create.mockRestore();
      await probe.loadingTask.destroy();
    }
  });
  it.each([0, 90, 180, 270])(
    "remove conteúdo recuperável e aplica tarja no espaço visual com rotação %s",
    async (rotation) => {
      const source = await sourcePdf(rotation);
      const original = source.slice();
      const bytes = await redactPdfDocument(source, {
        redactions: [
          { id: "r", pageIndex: 0, xPercent: 0, yPercent: 0, widthPercent: 50, heightPercent: 25 },
        ],
      });
      expect(source).toEqual(original);
      const parsed = await PDFDocument.load(bytes);
      expect(parsed.getTitle()).toBeUndefined();
      const doc = await open(bytes);
      try {
        const page = await doc.getPage(1);
        expect((await page.getTextContent()).items).toHaveLength(0);
        const viewport = page.getViewport({ scale: 1 });
        expect(viewport.width).toBe(rotation % 180 ? 120 : 200);
        expect(viewport.height).toBe(rotation % 180 ? 200 : 120);
        const factory = doc.canvasFactory as {
          create(
            w: number,
            h: number,
          ): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D };
          destroy(pair: unknown): void;
        };
        const pair = factory.create(viewport.width, viewport.height);
        try {
          await page.render({ canvas: pair.canvas, canvasContext: pair.context, viewport }).promise;
          expect([...pair.context.getImageData(5, 5, 1, 1).data]).toEqual([0, 0, 0, 255]);
          expect([...pair.context.getImageData(viewport.width - 5, 5, 1, 1).data]).toEqual([
            255, 0, 0, 255,
          ]);
        } finally {
          factory.destroy(pair);
        }
      } finally {
        await doc.loadingTask.destroy();
      }
    },
  );
  it.each([
    { pageIndex: 9 },
    { pageIndex: 0.5 },
    { xPercent: NaN },
    { xPercent: -1 },
    { widthPercent: 0 },
    { xPercent: 80, widthPercent: 30 },
  ])("recusa áreas inválidas sem gerar saída parcial: %j", async (override) => {
    await expect(
      redactPdfDocument(await sourcePdf(), {
        redactions: [
          {
            id: "r",
            pageIndex: 0,
            xPercent: 0,
            yPercent: 0,
            widthPercent: 10,
            heightPercent: 10,
            ...override,
          },
        ],
      }),
    ).rejects.toThrow("AREA_OCULTACAO_INVALIDA");
  });
});
