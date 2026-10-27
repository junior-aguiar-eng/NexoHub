import { PDFDocument } from "pdf-lib";
import { createPageSubsetCorpus } from "../doc-c4/corpus";

// Corpus autoral MPL-2.0. Credenciais fictícias de controle, sem dados de usuário.
export const accessReference = {
  userPassword: " acesso Q-C0 ç ",
  ownerPassword: " titular Q-C0 ",
  title: "Controle de acesso Q-C0 — ação",
  author: "NexoHub corpus autoral",
  attachmentName: "controle.txt",
  attachmentText: "Anexo autoral Q-C0: ação, 00123 e R$ 1.234,56.\n",
} as const;

export async function createAccessCorpus(): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await createPageSubsetCorpus());
  doc.setTitle(accessReference.title);
  doc.setAuthor(accessReference.author);
  doc.setCreationDate(new Date("2026-01-01T00:00:00Z"));
  doc.setModificationDate(new Date("2026-01-01T00:00:00Z"));
  await doc.attach(
    new TextEncoder().encode(accessReference.attachmentText),
    accessReference.attachmentName,
    {
      mimeType: "text/plain",
      description: "Controle sintético autoral",
      creationDate: new Date("2026-01-01T00:00:00Z"),
      modificationDate: new Date("2026-01-01T00:00:00Z"),
    },
  );
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
}
