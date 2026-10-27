// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { getDocument, PermissionFlag } from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, it } from "vitest";
import {
  createAccessCorpus,
  accessReference as reference,
} from "./__fixtures__/q-c0-access/corpus";
import { captureAccessSnapshot } from "./__fixtures__/q-c0-access/inspect";
import { protectPdfDocument } from "./pdf-engine";
import { checkPdfProtection, unlockPdfDocument } from "./pdf-unlock";

it.each(["AES-256", "RC4"] as const)(
  "%s preserva documento rico com senha de usuário e titular, sem modificar entradas",
  async (algorithm) => {
    const source = await createAccessCorpus(),
      snapshot = source.slice();
    const baseline = await captureAccessSnapshot(source);
    expect(baseline.title).toBe(reference.title);
    expect(baseline.author).toBe(reference.author);
    expect(baseline.pages.map((page) => page.rotation)).toEqual([0, 90, 180, 270]);
    expect(baseline.pages.map((page) => page.box)).toEqual([
      [10, 20, 370, 570],
      [10, 20, 390, 590],
      [10, 20, 410, 610],
      [10, 20, 430, 630],
    ]);
    expect(baseline.pages.map((page) => page.text.join(" "))).toEqual([
      "PAGINA-1",
      "PAGINA-2",
      "PAGINA-3",
      "PAGINA-4",
    ]);
    expect(baseline.fields.map((field) => field.name)).toEqual([
      "confirmado",
      "grupo",
      "grupo.descartado",
      "grupo.mantido",
      "opcao",
    ]);
    expect(baseline.attachments).toEqual([
      {
        name: reference.attachmentName,
        bytes: [...new TextEncoder().encode(reference.attachmentText)],
      },
    ]);
    const shared = baseline.fields.find((field) => field.name === "grupo.mantido");
    // PDF.js inclui o objeto lógico do campo junto aos widgets geométricos.
    const sharedWidgets = shared?.widgets.filter((widget) => Array.isArray(widget.rect));
    expect(sharedWidgets).toHaveLength(2);
    expect(sharedWidgets?.every((widget) => widget.value === "Valor preservado")).toBe(true);
    const encrypted = await protectPdfDocument(source, {
      algorithm,
      password: reference.userPassword,
      ownerPassword: reference.ownerPassword,
      allowPrinting: false,
      allowCopying: false,
      allowModifying: false,
    });
    const originalEncrypted = encrypted.slice();
    expect(await checkPdfProtection(encrypted)).toMatchObject({
      isProtected: true,
      needsPassword: true,
    });
    await expect(captureAccessSnapshot(encrypted)).rejects.toMatchObject({
      name: "PasswordException",
    });
    await expect(
      unlockPdfDocument(encrypted, { password: reference.userPassword.trim() }),
    ).rejects.toThrow("SENHA_INCORRETA");
    for (const password of [reference.userPassword, reference.ownerPassword]) {
      expect(await captureAccessSnapshot(encrypted, password)).toEqual(baseline);
      const unlocked = await unlockPdfDocument(encrypted, { password });
      expect(await captureAccessSnapshot(unlocked)).toEqual(baseline);
      const parsed = await PDFDocument.load(unlocked);
      expect(parsed.context.trailerInfo.Encrypt).toBeUndefined();
      const form = parsed.getForm();
      expect(form.getTextField("grupo.mantido").getText()).toBe("Valor preservado");
      expect(form.getTextField("grupo.mantido").acroField.getWidgets()).toHaveLength(2);
      expect(form.getRadioGroup("opcao").getSelected()).toBe("B");
      expect(form.getCheckBox("confirmado").isChecked()).toBe(true);
      form.getTextField("grupo.mantido").setText("Controle editado");
      expect(
        (await PDFDocument.load(await parsed.save()))
          .getForm()
          .getTextField("grupo.mantido")
          .getText(),
      ).toBe("Controle editado");
    }
    const task = getDocument({
      data: encrypted.slice(),
      password: reference.userPassword,
      useSystemFonts: true,
    });
    try {
      const permissions = await (await task.promise).getPermissions();
      for (const flag of [
        PermissionFlag.PRINT,
        PermissionFlag.PRINT_HIGH_QUALITY,
        PermissionFlag.COPY,
        PermissionFlag.MODIFY_CONTENTS,
        PermissionFlag.ASSEMBLE,
      ])
        expect(permissions).not.toContain(flag);
      expect(permissions).toContain(PermissionFlag.FILL_INTERACTIVE_FORMS);
    } finally {
      await task.destroy();
    }
    expect(source).toEqual(snapshot);
    expect(encrypted).toEqual(originalEncrypted);
  },
);

it.each([
  "RC4-40",
  "RC4-128",
  "AES-128",
  "AES-256-R5",
  "AES-256",
  "AES-256-object-streams",
  "AES-256-incremental",
  "AES-128-plain-metadata",
  "AES-256-pdf2",
])("desbloqueio %s conserva o snapshot independente do documento cifrado", async (name) => {
  const source = new Uint8Array(
      await readFile(new URL(`./__fixtures__/pdf-unlock/${name}.pdf`, import.meta.url)),
    ),
    snapshot = source.slice();
  const baseline = await captureAccessSnapshot(source, " senha com espacos ");
  expect(baseline.attachments.length).toBeGreaterThan(0);
  expect(baseline.fields.length).toBeGreaterThan(0);
  const unlocked = await unlockPdfDocument(source, { password: " senha com espacos " });
  expect(await captureAccessSnapshot(unlocked)).toEqual(baseline);
  expect(await checkPdfProtection(unlocked)).toEqual({
    isProtected: false,
    needsPassword: false,
    hasPermissionsRestriction: false,
  });
  expect(source).toEqual(snapshot);
});

it("o oráculo distingue anexo e campo alterados mesmo quando o texto das páginas permanece", async () => {
  const source = await createAccessCorpus(),
    baseline = await captureAccessSnapshot(source);
  const modified = await PDFDocument.load(source);
  modified.getForm().getTextField("grupo.mantido").setText("Divergente");
  await modified.attach(new TextEncoder().encode("Divergente"), reference.attachmentName);
  const changed = await captureAccessSnapshot(await modified.save());
  expect(changed.pages).toEqual(baseline.pages);
  expect(changed.fields).not.toEqual(baseline.fields);
  expect(changed.attachments).not.toEqual(baseline.attachments);
});
