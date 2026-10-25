import type { EditorReplacement, EditorTextObject } from "./pdf-editor-types";

export const editorLatinText = (text: string) =>
  /^[\x20-\x7e\xa0-\xff\u20ac\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\n]*$/.test(text);

// Ligaduras e códigos privados exigem um mapeamento que este perfil não homologa.
export const editorUnsafeMapping = (text: string) =>
  /[\p{Cc}\p{Co}\ufb00-\ufb06\ufffd]/u.test(text);

/** Pré-verificação conservadora; geometria e serialização continuam validadas pelo motor. */
export function editorReplacementIssue(
  object: EditorTextObject,
  replacement: EditorReplacement,
): "unsafeObject" | "unsafeStyle" | "unprovenCharacters" | "fitError" | undefined {
  if (!object.editable) return "unsafeObject";
  if (!replacement.text) return;
  if (replacement.text.includes("\n")) return "fitError";
  if (editorUnsafeMapping(replacement.text)) return "unprovenCharacters";
  if (
    object.canChangeStyle === false &&
    (replacement.fallbackFont ||
      (replacement.fontSize !== undefined && replacement.fontSize !== object.fontSize))
  )
    return "unsafeStyle";
  if (replacement.fallbackFont || object.fontPolicy === "latin") {
    if (!editorLatinText(replacement.text)) return "unprovenCharacters";
  } else if (object.fontPolicy === "observed") {
    const coverage = new Set(object.supportedCharacters);
    if (Array.from(replacement.text).some((ch) => ch !== " " && !coverage.has(ch)))
      return "unprovenCharacters";
  }
}
