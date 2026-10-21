import { beforeEach, describe, expect, it } from "vitest";
import {
  addCustomWord,
  clearSessionIgnored,
  getCustomVocabulary,
  ignoreWordInSession,
  isWordIgnoredOrCustom,
  removeCustomWord,
} from "./user-vocabulary";

describe("UserVocabularyStore", () => {
  beforeEach(() => {
    localStorage.clear();
    clearSessionIgnored();
    for (const word of Array.from(getCustomVocabulary())) {
      removeCustomWord(word);
    }
  });

  it("permite adicionar e persistir palavras customizadas", () => {
    expect(isWordIgnoredOrCustom("jurisprudencial")).toBe(false);

    addCustomWord("Jurisprudencial");
    expect(isWordIgnoredOrCustom("jurisprudencial")).toBe(true);
    expect(isWordIgnoredOrCustom("JURISPRUDENCIAL")).toBe(true);
    expect(Array.from(getCustomVocabulary())).toContain("jurisprudencial");
  });

  it("permite remover palavras customizadas", () => {
    addCustomWord("customtermo");
    expect(isWordIgnoredOrCustom("customtermo")).toBe(true);

    removeCustomWord("customtermo");
    expect(isWordIgnoredOrCustom("customtermo")).toBe(false);
  });

  it("permite ignorar palavras na sessão atual sem persistir", () => {
    ignoreWordInSession("temporario");
    expect(isWordIgnoredOrCustom("temporario")).toBe(true);
    expect(Array.from(getCustomVocabulary())).not.toContain("temporario");

    clearSessionIgnored();
    expect(isWordIgnoredOrCustom("temporario")).toBe(false);
  });
});
