import { expect, it } from "vitest";
import { isPreservedChunk, segmentTextForTranslation } from "./translation-segmentation";

it("prefere a última sentença completa ao cortar um parágrafo longo", () => {
  const first = "Maria Silva não autorizou o pagamento.";
  const second = "O prazo de 30 dias não foi alterado e deve ser conferido.";
  const text = `${first} ${second}`;
  const chunks = segmentTextForTranslation(text, 65);
  expect(chunks.filter((chunk) => !isPreservedChunk(chunk))[0]).toBe(first);
  expect(chunks.join("")).toBe(text);
});

it.each(["pt", "en", "es"])(
  "não perde Unicode, números, nomes ou quebras na segmentação %s",
  () => {
    const text = `Maria Silva não autorizou 125 euros. João Costa confirmou 12 documentos. 😀\r\n\t{{nome}} https://example.com pessoa@example.com`;
    const chunks = segmentTextForTranslation(text, 45);
    expect(chunks.join("")).toBe(text);
    expect(chunks.every((chunk) => chunk.length <= 45 || isPreservedChunk(chunk))).toBe(true);
  },
);
