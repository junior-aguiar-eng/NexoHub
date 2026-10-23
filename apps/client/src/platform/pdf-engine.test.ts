import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  compressPdfDocument,
  extractPdfSelectedPages,
  mergePdfDocuments,
  splitPdfByInterval,
} from "./pdf-engine";

async function makePdf(pages = 2): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pages; i++) pdf.addPage([200, 200]);
  return pdf.save();
}

describe("operações PDF no navegador", () => {
  it("relata a variação real de tamanho na compressão", async () => {
    const source = await makePdf();
    const result = await compressPdfDocument(source);
    expect(result.savedBytes).toBe(source.length - result.bytes.length);
    expect(result.savedPercent).toBe(Math.round((result.savedBytes / source.length) * 100));
  });

  it("recusa regravar PDF com ByteRange de assinatura", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    const signature = pdf.context.obj({ Type: "Sig", ByteRange: [0, 1, 2, 3] });
    pdf.context.register(signature);
    await expect(compressPdfDocument(await pdf.save())).rejects.toThrow(
      "PDF_ASSINADO_NAO_SUPORTADO",
    );
  });

  it("interrompe a junção quando um dos arquivos é inválido", async () => {
    await expect(mergePdfDocuments([await makePdf(), new Uint8Array([1, 2, 3])])).rejects.toThrow();
  });

  it("não devolve o original quando a seleção de páginas é inválida", async () => {
    const source = await makePdf();
    await expect(extractPdfSelectedPages(source, [])).rejects.toThrow();
    await expect(extractPdfSelectedPages(source, [3])).rejects.toThrow();
    await expect(splitPdfByInterval(source, 3, 4)).rejects.toThrow();
  });

  it("descarta metadados redundantes e miniaturas na compressão", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([200, 200]);
    const { PDFName } = await import("pdf-lib");
    page.node.set(PDFName.of("Thumb"), pdf.context.obj({ Type: "XObject" }));
    page.node.set(PDFName.of("PieceInfo"), pdf.context.obj({}));
    pdf.catalog.set(PDFName.of("PieceInfo"), pdf.context.obj({}));
    const compressed = await compressPdfDocument(await pdf.save());
    const reloaded = await PDFDocument.load(compressed.bytes);
    const reloadedPage = reloaded.getPage(0);
    expect(reloadedPage.node.has(PDFName.of("Thumb"))).toBe(false);
    expect(reloadedPage.node.has(PDFName.of("PieceInfo"))).toBe(false);
    expect(reloaded.catalog.has(PDFName.of("PieceInfo"))).toBe(false);
  });

  it("converte imagens PNG e JPG em documento PDF multipágina", async () => {
    const { convertImagesToPdfDocument } = await import("./pdf-engine");
    const minimalPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const minimalJpg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00,
      0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
      0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b,
      0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31,
      0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff,
      0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00,
      0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
      0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf, 0x00, 0xff, 0xd9,
    ]);

    const pdfBytes = await convertImagesToPdfDocument([
      { bytes: minimalPng, mimeType: "image/png" },
      { bytes: minimalJpg, mimeType: "image/jpeg" },
    ]);

    const doc = await PDFDocument.load(pdfBytes);
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(595.28, 1);
    expect(doc.getPage(0).getHeight()).toBeCloseTo(841.89, 1);
  });

  it("converte páginas de um PDF em imagens JPG válidas", async () => {
    const { convertPdfPagesToJpgImages } = await import("./pdf-engine");
    const source = await makePdf(2);
    const images = await convertPdfPagesToJpgImages(source);
    expect(images).toHaveLength(2);
    expect(images[0].name).toBe("pagina_1.jpg");
    expect(images[1].name).toBe("pagina_2.jpg");
    expect(images[0].data[0]).toBe(0xff);
    expect(images[0].data[1]).toBe(0xd8);
  });

  it("aplica estampa de marca d'água de texto no PDF preservando páginas", async () => {
    const { addWatermarkToPdfDocument } = await import("./pdf-engine");
    const source = await makePdf(2);
    const watermarkedBytes = await addWatermarkToPdfDocument(source, {
      text: "CONFIDENCIAL TESTE",
      angle: 45,
      opacity: 0.4,
      color: "red",
    });

    const doc = await PDFDocument.load(watermarkedBytes);
    expect(doc.getPageCount()).toBe(2);
    expect(watermarkedBytes.length).toBeGreaterThan(source.length);
  });

  it("insere numeração de páginas alinhada respeitando página inicial", async () => {
    const { addPageNumbersToPdfDocument } = await import("./pdf-engine");
    const source = await makePdf(3);
    const numberedBytes = await addPageNumbersToPdfDocument(source, {
      position: "bottom-right",
      format: "pageXofY",
      startPage: 2,
    });

    const doc = await PDFDocument.load(numberedBytes);
    expect(doc.getPageCount()).toBe(3);
    expect(numberedBytes.length).toBeGreaterThan(source.length);
  });

  it("gera PDF pesquisável injetando camada de texto sobre o documento original", async () => {
    const { generateSearchablePdf } = await import("./pdf-engine");
    const source = await makePdf(1);
    const searchablePdf = await generateSearchablePdf(source, [
      {
        pageNumber: 1,
        text: "CONTRATO SOCIAL CLAUSULA PRIMEIRA",
        width: 200,
        height: 200,
        lines: [
          {
            text: "CONTRATO SOCIAL",
            bbox: { x0: 20, y0: 30, x1: 180, y1: 50 },
          },
          {
            text: "CLAUSULA PRIMEIRA",
            bbox: { x0: 20, y0: 60, x1: 180, y1: 80 },
          },
        ],
      },
    ]);

    const doc = await PDFDocument.load(searchablePdf);
    expect(doc.getPageCount()).toBe(1);
    expect(searchablePdf.length).toBeGreaterThan(source.length);
  });

  it("recorta as margens de todas as páginas ajustando CropBox e MediaBox", async () => {
    const { cropPdfDocument } = await import("./pdf-engine");
    const source = await makePdf(2);
    const croppedBytes = await cropPdfDocument(source, {
      margins: { top: 10, bottom: 10, left: 10, right: 10 },
      scope: "all",
    });

    const doc = await PDFDocument.load(croppedBytes);
    expect(doc.getPageCount()).toBe(2);
    const page1 = doc.getPage(0);
    const mediaBox = page1.getMediaBox();
    expect(mediaBox.width).toBeCloseTo(160, 1);
    expect(mediaBox.height).toBeCloseTo(160, 1);
    expect(mediaBox.x).toBeCloseTo(20, 1);
    expect(mediaBox.y).toBeCloseTo(20, 1);
  });

  it("recorta apenas as páginas selecionadas no escopo selected", async () => {
    const { cropPdfDocument } = await import("./pdf-engine");
    const source = await makePdf(2);
    const croppedBytes = await cropPdfDocument(source, {
      margins: { top: 10, bottom: 0, left: 0, right: 0 },
      scope: "selected",
      selectedPages: [1],
    });

    const doc = await PDFDocument.load(croppedBytes);
    const page1 = doc.getPage(0);
    const page2 = doc.getPage(1);
    expect(page1.getMediaBox().height).toBeCloseTo(180, 1);
    expect(page2.getMediaBox().height).toBeCloseTo(200, 1);
  });

  it("rejeita margens negativas ou excessivas", async () => {
    const { cropPdfDocument } = await import("./pdf-engine");
    const source = await makePdf(1);
    await expect(
      cropPdfDocument(source, {
        margins: { top: 96, bottom: 0, left: 0, right: 0 },
      }),
    ).rejects.toThrow("RECORTE_MUITO_GRANDE");

    await expect(
      cropPdfDocument(source, {
        margins: { top: -5, bottom: 0, left: 0, right: 0 },
      }),
    ).rejects.toThrow("MARGEM_INVALIDA");
  });

  it("assina PDF inserindo imagem e metadados de signatário e data", async () => {
    const { signPdfDocument } = await import("./pdf-engine");
    const source = await makePdf(2);
    const minimalPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const signedBytes = await signPdfDocument(source, {
      signatureImageBytes: minimalPng,
      signerName: "Dr. Roberto Silva",
      includeDate: true,
      placement: {
        page: "last",
        xPercent: 60,
        yPercent: 10,
        widthPercent: 30,
        heightPercent: 15,
      },
    });

    const doc = await PDFDocument.load(signedBytes);
    expect(doc.getPageCount()).toBe(2);
    expect(signedBytes.length).toBeGreaterThan(source.length);
  });

  it("assina PDF em todas as páginas e valida erro com entrada vazia", async () => {
    const { signPdfDocument } = await import("./pdf-engine");
    const source = await makePdf(2);
    const minimalPng = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f,
      0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00,
      0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);

    const signedAll = await signPdfDocument(source, {
      signatureImageBytes: minimalPng,
      signerName: "Dra. Maria Clara",
      includeDate: false,
      placement: {
        page: "all",
        xPercent: 50,
        yPercent: 5,
        widthPercent: 25,
        heightPercent: 10,
      },
    });

    const doc = await PDFDocument.load(signedAll);
    expect(doc.getPageCount()).toBe(2);

    await expect(
      signPdfDocument(new Uint8Array(0), {
        signatureImageBytes: minimalPng,
        placement: { xPercent: 0, yPercent: 0, widthPercent: 20, heightPercent: 10 },
      }),
    ).rejects.toThrow("DOCUMENTO_VAZIO");

    await expect(
      signPdfDocument(source, {
        placement: { xPercent: 0, yPercent: 0, widthPercent: 20, heightPercent: 10 },
      }),
    ).rejects.toThrow("ASSINATURA_VAZIA");
  });

  it("extrai imagens embutidas em documento PDF descartando miniaturas decorativas", async () => {
    const { extractImagesFromPdf } = await import("./pdf-engine");
    const source = await makePdf(2);
    const images = await extractImagesFromPdf(source, {
      minWidth: 16,
      minHeight: 16,
    });

    expect(images.length).toBeGreaterThan(0);
    const firstImg = images[0];
    expect(firstImg).toBeDefined();
    expect(firstImg?.width).toBeGreaterThanOrEqual(16);
    expect(firstImg?.height).toBeGreaterThanOrEqual(16);
    expect(["jpeg", "png"]).toContain(firstImg?.format);

    await expect(extractImagesFromPdf(new Uint8Array(0))).rejects.toThrow("DOCUMENTO_VAZIO");
  });

  it("inspeciona campos de formulário PDF interativo (AcroForms)", async () => {
    const { inspectPdfFormFields } = await import("./pdf-engine");

    // Teste com documento vazio ou sem campos
    expect(await inspectPdfFormFields(new Uint8Array(0))).toEqual([]);
    const blankPdf = await makePdf(1);
    expect(await inspectPdfFormFields(blankPdf)).toEqual([]);

    // Cria documento com campos de formulário reais
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 400]);
    const form = pdf.getForm();

    const tf = form.createTextField("nomeCliente");
    tf.setText("Ana Souza");
    tf.addToPage(page, { x: 50, y: 300, width: 200, height: 30 });

    const cb = form.createCheckBox("concordo");
    cb.check();
    cb.addToPage(page, { x: 50, y: 250, width: 20, height: 20 });

    const dd = form.createDropdown("cidade");
    dd.addOptions(["São Paulo", "Rio de Janeiro", "Curitiba"]);
    dd.select("Curitiba");
    dd.addToPage(page, { x: 50, y: 200, width: 150, height: 25 });

    const rg = form.createRadioGroup("tipoConta");
    rg.addOptionToPage("PF", page, { x: 50, y: 150, width: 20, height: 20 });
    rg.addOptionToPage("PJ", page, { x: 100, y: 150, width: 20, height: 20 });
    rg.select("PJ");

    const formPdf = await pdf.save();
    const fields = await inspectPdfFormFields(formPdf);

    expect(fields.length).toBe(4);
    const textField = fields.find((f) => f.name === "nomeCliente");
    expect(textField).toBeDefined();
    expect(textField?.type).toBe("text");
    expect(textField?.currentValue).toBe("Ana Souza");

    const checkField = fields.find((f) => f.name === "concordo");
    expect(checkField).toBeDefined();
    expect(checkField?.type).toBe("checkbox");
    expect(checkField?.currentValue).toBe(true);

    const dropField = fields.find((f) => f.name === "cidade");
    expect(dropField).toBeDefined();
    expect(dropField?.type).toBe("dropdown");
    expect(dropField?.currentValue).toBe("Curitiba");
    expect(dropField?.options).toContain("São Paulo");

    const radioField = fields.find((f) => f.name === "tipoConta");
    expect(radioField).toBeDefined();
    expect(radioField?.type).toBe("radio");
    expect(radioField?.currentValue).toBe("PJ");
  });

  it("preenche campos de formulário e aplica achatamento (flatten)", async () => {
    const { fillPdfForm, inspectPdfFormFields } = await import("./pdf-engine");

    const pdf = await PDFDocument.create();
    const page = pdf.addPage([400, 400]);
    const form = pdf.getForm();

    const tf = form.createTextField("campoTexto");
    tf.setText("Original");
    tf.addToPage(page, { x: 50, y: 300, width: 200, height: 30 });

    const cb = form.createCheckBox("campoCheck");
    cb.check();
    cb.addToPage(page, { x: 50, y: 250, width: 20, height: 20 });

    const dd = form.createDropdown("campoDrop");
    dd.addOptions(["Opcao 1", "Opcao 2"]);
    dd.select("Opcao 1");
    dd.addToPage(page, { x: 50, y: 200, width: 150, height: 25 });

    const initialPdf = await pdf.save();

    // 1. Preenchimento mantendo o formulário editável
    const filledBytes = await fillPdfForm(initialPdf, {
      values: {
        campoTexto: "Novo Valor Atualizado",
        campoCheck: false,
        campoDrop: "Opcao 2",
      },
      flatten: false,
    });

    const inspectedAfterFill = await inspectPdfFormFields(filledBytes);
    expect(inspectedAfterFill.length).toBe(3);
    expect(inspectedAfterFill.find((f) => f.name === "campoTexto")?.currentValue).toBe(
      "Novo Valor Atualizado",
    );
    expect(inspectedAfterFill.find((f) => f.name === "campoCheck")?.currentValue).toBe(false);
    expect(inspectedAfterFill.find((f) => f.name === "campoDrop")?.currentValue).toBe("Opcao 2");

    // 2. Preenchimento com achatamento (flatten)
    const flattenedBytes = await fillPdfForm(initialPdf, {
      values: {
        campoTexto: "Texto Permanente",
      },
      flatten: true,
    });

    const inspectedAfterFlatten = await inspectPdfFormFields(flattenedBytes);
    expect(inspectedAfterFlatten.length).toBe(0);

    // Erro ao enviar documento vazio
    await expect(
      fillPdfForm(new Uint8Array(0), {
        values: {},
      }),
    ).rejects.toThrow("EMPTY_DOCUMENT");
  });

  it("verifica proteções e desbloqueia PDF removendo restrições criptográficas", async () => {
    const { checkPdfProtection, unlockPdfDocument } = await import("./pdf-engine");

    // 1. Documento vazio ou sem proteções
    expect(await checkPdfProtection(new Uint8Array(0))).toEqual({
      isProtected: false,
      needsPassword: false,
      hasPermissionsRestriction: false,
    });
    const blank = await makePdf(1);
    expect(await checkPdfProtection(blank)).toEqual({
      isProtected: false,
      needsPassword: false,
      hasPermissionsRestriction: false,
    });
    const identical = await unlockPdfDocument(blank);
    expect(identical).toEqual(blank);

    // 2. Documento com restrições /Encrypt (permissões com senha de proprietário)
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 300]);
    const enc = pdf.context.obj({ Filter: "Standard", V: 2, R: 3, P: -4 });
    pdf.context.trailerInfo.Encrypt = enc;
    const protectedBytes = await pdf.save();

    const status = await checkPdfProtection(protectedBytes);
    expect(status.isProtected).toBe(true);
    expect(status.hasPermissionsRestriction).toBe(true);

    // Desbloqueia o PDF
    const unlockedBytes = await unlockPdfDocument(protectedBytes);
    expect(unlockedBytes.byteLength).toBeGreaterThan(0);

    // O arquivo resultante não deve ter mais nenhuma proteção
    const unlockedStatus = await checkPdfProtection(unlockedBytes);
    expect(unlockedStatus.isProtected).toBe(false);
    expect(unlockedStatus.hasPermissionsRestriction).toBe(false);

    // Teste de rejeição com documento vazio
    await expect(unlockPdfDocument(new Uint8Array(0))).rejects.toThrow("EMPTY_DOCUMENT");
  });
});
