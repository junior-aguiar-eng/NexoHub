import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProcessingPreference,
  resetProcessingPreferenceMemory,
  setProcessingPreference,
  useProcessingPreference,
} from "./processing-preference";

describe("processing-preference", () => {
  beforeEach(() => {
    localStorage.clear();
    resetProcessingPreferenceMemory();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("retorna 'local-first' como valor padrão quando não há preferência gravada", () => {
    expect(getProcessingPreference()).toBe("local-first");
  });

  it("grava e recupera a preferência 'hybrid' no storage", () => {
    setProcessingPreference("hybrid");
    expect(getProcessingPreference()).toBe("hybrid");
    expect(localStorage.getItem("nexohub.cloud.processingPreference")).toBe("hybrid");
  });

  it("permite alternar de volta para 'local-first'", () => {
    setProcessingPreference("hybrid");
    expect(getProcessingPreference()).toBe("hybrid");
    setProcessingPreference("local-first");
    expect(getProcessingPreference()).toBe("local-first");
  });

  it("ignora valores corrompidos no storage e retorna 'local-first'", () => {
    localStorage.setItem("nexohub.cloud.processingPreference", "valor-invalido");
    expect(getProcessingPreference()).toBe("local-first");
  });

  it("é resiliente quando localStorage lança SecurityError (navegação anônima)", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Access denied", "SecurityError");
    });

    expect(getProcessingPreference()).toBe("local-first");
    setProcessingPreference("hybrid");
    expect(getProcessingPreference()).toBe("hybrid");
  });

  it("o hook useProcessingPreference sincroniza o estado e atualiza a preferência", () => {
    const { result } = renderHook(() => useProcessingPreference());
    expect(result.current[0]).toBe("local-first");

    act(() => {
      result.current[1]("hybrid");
    });

    expect(result.current[0]).toBe("hybrid");
    expect(getProcessingPreference()).toBe("hybrid");
  });
});
