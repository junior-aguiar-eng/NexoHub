import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { readDocumentText } from "./document-reader";

const namespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const wrap = (body: string) =>
  `<w:document xmlns:w="${namespace}"><w:body>${body}</w:body></w:document>`;
function docx(xml: string, name = "minuta.docx", type = "") {
  const bytes = zipSync({ "word/document.xml": strToU8(xml) });
  return new File([bytes as unknown as BlobPart], name, { type });
}

describe("Leitura local de documentos", () => {
  it.each([
    ["minuta.docx", ""],
    ["MINUTA.DOCX", "application/octet-stream"],
    ["minuta", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ])("extrai texto de DOCX preservando parágrafos, runs e acentos: %s", async (name, type) => {
    const file = docx(
      wrap(
        "<w:p><w:r><w:t>Olá, </w:t></w:r><w:r><w:t>mundo &amp; você.</w:t></w:r></w:p>" +
          "<w:p><w:r><w:t>Outro</w:t><w:tab/><w:t>item</w:t><w:br/><w:t>Nova linha</w:t></w:r></w:p>",
      ),
      name,
      type,
    );
    await expect(readDocumentText(file)).resolves.toBe(
      "Olá, mundo & você.\nOutro\titem\nNova linha",
    );
  });

  it("preserva linhas e células de tabelas", async () => {
    const file = docx(
      wrap(
        "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Nome</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Valor</w:t></w:r></w:p></w:tc></w:tr></w:tbl>",
      ),
    );
    await expect(readDocumentText(file)).resolves.toBe("Nome\tValor");
  });

  it.each(["<invalido>", '<!DOCTYPE document [<!ENTITY segredo "conteúdo">]><document/>'])(
    "recusa XML inválido ou com entidades declaradas",
    async (xml) => {
      await expect(readDocumentText(docx(xml))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    },
  );

  it("recusa ZIP que não contém o documento principal", async () => {
    const bytes = zipSync({ "outro.xml": strToU8("texto") });
    await expect(
      readDocumentText(new File([bytes as unknown as BlobPart], "invalido.docx")),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("limita a saída descompactada mesmo com tamanho declarado incorreto", async () => {
    const bytes = zipSync({ "word/document.xml": strToU8(wrap(" ".repeat(16 * 1024 * 1024))) });
    new DataView(bytes.buffer).setUint32(22, 1, true);
    await expect(
      readDocumentText(new File([bytes as unknown as BlobPart], "grande.docx")),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("continua lendo TXT e Markdown como texto", async () => {
    await expect(readDocumentText(new File(["# Título\nTexto normal."], "nota.md"))).resolves.toBe(
      "# Título\nTexto normal.",
    );
  });
});
