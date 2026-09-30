import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useRecentOperations } from "./useRecentOperations";

afterEach(() => localStorage.clear());

describe("histórico local", () => {
  it("preserva uma operação real com contrato no nome após recarga", () => {
    localStorage.setItem(
      "nexohub:recent-operations:v2",
      JSON.stringify([
        {
          id: "op-real",
          documentName: "contrato.pdf",
          toolId: "pdf-compress",
          toolName: "Comprimir PDF",
          timestamp: 1,
          categoryKey: "recent.type.pdf",
        },
      ]),
    );
    const { result } = renderHook(() => useRecentOperations());
    expect(result.current.operations.map((op) => op.documentName)).toEqual(["contrato.pdf"]);
  });
});
