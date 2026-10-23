import { ToolRunError } from "@nexohub/tool-sdk";
import { Unzip, UnzipInflate } from "fflate";
import { translate } from "@/i18n";

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const MAX_XML_BYTES = 16 * 1024 * 1024;

function invalidDocx(): ToolRunError {
  return new ToolRunError("INVALID_INPUT", translate("document.errorInvalidDocx"));
}

function sizeLimit(): ToolRunError {
  return new ToolRunError("INVALID_INPUT", translate("document.errorDocxLimit"));
}

function extractDocumentXml(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let size = 0;
  let found = false;
  let complete = false;
  let entries = 0;
  const archive = new Unzip((file) => {
    if (++entries > 10000) throw sizeLimit();
    if (file.name !== "word/document.xml") return;
    if (found) throw invalidDocx();
    found = true;
    if ((file.originalSize ?? 0) > MAX_XML_BYTES) throw sizeLimit();
    file.ondata = (error, chunk, final) => {
      if (error) throw invalidDocx();
      size += chunk.length;
      if (size > MAX_XML_BYTES) {
        file.terminate();
        throw sizeLimit();
      }
      chunks.push(chunk);
      complete = final;
    };
    file.start();
  });
  archive.register(UnzipInflate);
  // Limita também a expansão por chamada; o tamanho declarado no ZIP não é confiável.
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    archive.push(bytes.subarray(offset, offset + 8192), offset + 8192 >= bytes.length);
  }
  if (!complete) throw invalidDocx();
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function extractXmlText(bytes: Uint8Array): string {
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  const xml = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw invalidDocx();
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const root = document.documentElement;
  const ns = root.namespaceURI;
  if (
    document.getElementsByTagName("parsererror").length > 0 ||
    root.localName !== "document" ||
    (ns !== "http://schemas.openxmlformats.org/wordprocessingml/2006/main" &&
      ns !== "http://purl.oclc.org/ooxml/wordprocessingml/main")
  )
    throw invalidDocx();
  const body = document.getElementsByTagNameNS(ns, "body")[0];
  if (!body) throw invalidDocx();
  function text(element: Element): string {
    if (element.namespaceURI === ns) {
      if (element.localName === "t") return element.textContent ?? "";
      if (element.localName === "tab") return "\t";
      if (element.localName === "br" || element.localName === "cr") return "\n";
      if (element.localName === "tr") {
        const cells = Array.from(element.children)
          .filter((cell) => cell.namespaceURI === ns && cell.localName === "tc")
          .map((cell) => text(cell).replace(/\n$/, ""))
          .join("\t");
        return `${cells}\n`;
      }
    }
    const content = Array.from(element.children).map(text).join("");
    return element.namespaceURI === ns && element.localName === "p" ? `${content}\n` : content;
  }
  return text(body).replace(/\n$/, "");
}

export async function readBrowserDocxText(file: File): Promise<string> {
  if (file.size > MAX_INPUT_BYTES) throw sizeLimit();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return extractXmlText(extractDocumentXml(bytes));
  } catch (error) {
    if (error instanceof ToolRunError) throw error;
    throw invalidDocx();
  }
}
