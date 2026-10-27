import { expect, it } from "vitest";
import { createRepairCorpus } from "./__fixtures__/r-c1/corpus";
import { repairPdfDocument } from "./pdf-repair-engine";
import { verifyRepairedPdf } from "./pdf-repair-verify";

it("leitor independente reabre conteúdo, campos e anexos da saída", async () => {
  const source = (await createRepairCorpus())[0];
  const result = await repairPdfDocument(source.bytes);
  await expect(verifyRepairedPdf(result.pdfBytes, 2)).resolves.toBeUndefined();
});
it("não libera contagem divergente nem bytes inválidos", async () => {
  const source = (await createRepairCorpus())[0];
  await expect(verifyRepairedPdf(source.bytes, 3)).rejects.toThrow("PDF_REPAIR_VERIFICATION");
  await expect(verifyRepairedPdf(new Uint8Array([1, 2, 3]), 1)).rejects.toThrow(
    "PDF_REPAIR_VERIFICATION",
  );
});
