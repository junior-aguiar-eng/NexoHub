import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { getDocument, PermissionFlag } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  createAccessCorpus,
  accessReference as reference,
} from "../src/platform/__fixtures__/q-c0-access/corpus";
import { captureAccessSnapshot } from "../src/platform/__fixtures__/q-c0-access/inspect";

const route = (path: string) => `${process.env.NEXOHUB_BASE_PATH ?? "/"}${path}`;
async function upload(page: Page, path: string, bytes: Uint8Array) {
  await page.goto(route(path));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "controle.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });
}
async function run(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
}
async function download(page: Page) {
  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  return new Uint8Array(await readFile(await file.path()));
}

for (const algorithm of ["AES-256", "RC4"]) {
  test(`Q-C0 ${algorithm}: proteger e desbloquear preserva campos, anexo e documento baixado`, async ({
    page,
  }) => {
    const source = await createAccessCorpus(),
      baseline = await captureAccessSnapshot(source);
    await upload(page, "proteger-pdf", source);
    await page
      .getByLabel("Senha de abertura do documento", { exact: true })
      .fill(reference.userPassword);
    await page.getByLabel("Confirmar senha", { exact: true }).fill(reference.userPassword);
    await page.locator(`input[name="algorithm"][value="${algorithm}"]`).check();
    await page.getByRole("checkbox", { name: "Permitir impressão do documento" }).uncheck();
    await page.getByRole("checkbox", { name: "Permitir cópia e extração de texto" }).uncheck();
    await page.getByRole("checkbox", { name: "Permitir alterações no conteúdo" }).uncheck();
    await run(page);
    const encrypted = await download(page);
    await expect(
      captureAccessSnapshot(encrypted, reference.userPassword.trim()),
    ).rejects.toMatchObject({ name: "PasswordException" });
    expect(await captureAccessSnapshot(encrypted, reference.userPassword)).toEqual(baseline);
    const task = getDocument({
      data: encrypted.slice(),
      password: reference.userPassword,
      useSystemFonts: true,
    });
    try {
      const permissions = await (await task.promise).getPermissions();
      for (const denied of [
        PermissionFlag.PRINT,
        PermissionFlag.PRINT_HIGH_QUALITY,
        PermissionFlag.COPY,
        PermissionFlag.MODIFY_CONTENTS,
        PermissionFlag.ASSEMBLE,
      ])
        expect(permissions).not.toContain(denied);
    } finally {
      await task.destroy();
    }

    await upload(page, "desbloquear-pdf", encrypted);
    await page.getByPlaceholder("Digite a senha do PDF...").fill(reference.userPassword.trim());
    await run(page);
    await expect(page.getByRole("alert")).toContainText("A senha informada não abre");
    await expect(page.getByRole("link", { name: /Baixar arquivo gerado/i })).toHaveCount(0);
    await page.getByPlaceholder("Digite a senha do PDF...").fill(reference.userPassword);
    await run(page);
    const unlocked = await download(page);
    expect(await captureAccessSnapshot(unlocked)).toEqual(baseline);
    const doc = await PDFDocument.load(unlocked);
    expect(doc.context.trailerInfo.Encrypt).toBeUndefined();
    expect(doc.getForm().getCheckBox("confirmado").isChecked()).toBe(true);
    expect(doc.getForm().getRadioGroup("opcao").getSelected()).toBe("B");
    doc.getForm().getTextField("grupo.mantido").setText("Controle editável");
    expect(
      (await PDFDocument.load(await doc.save())).getForm().getTextField("grupo.mantido").getText(),
    ).toBe("Controle editável");
  });
}

test("Q-C0 restrições sem senha de abertura são removidas mantendo conteúdo/anexo", async ({
  page,
}) => {
  const source = new Uint8Array(
    await readFile(
      new URL("../src/platform/__fixtures__/pdf-unlock/permissions-only.pdf", import.meta.url),
    ),
  );
  const baseline = await captureAccessSnapshot(source);
  await upload(page, "desbloquear-pdf", source);
  await run(page);
  const output = await download(page);
  expect(await captureAccessSnapshot(output)).toEqual(baseline);
  expect((await PDFDocument.load(output)).context.trailerInfo.Encrypt).toBeUndefined();
});

test("Q-C0 recusa regravar ByteRange sem oferecer download", async ({ page }) => {
  const source = new Uint8Array(
    await readFile(
      new URL("../src/platform/__fixtures__/pdf-unlock/signed-placeholder.pdf", import.meta.url),
    ),
  );
  await upload(page, "desbloquear-pdf", source);
  await page.getByPlaceholder("Digite a senha do PDF...").fill(" senha com espacos ");
  await run(page);
  await expect(page.getByRole("alert")).toContainText(/assinatura|assinado/i);
  await expect(page.getByRole("link", { name: /Baixar arquivo gerado/i })).toHaveCount(0);
});
