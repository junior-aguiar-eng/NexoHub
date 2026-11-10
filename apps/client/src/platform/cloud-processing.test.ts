import { describe, expect, it, vi } from "vitest";
import firebasePublic from "../../../../scripts/cloud/firebase-public.json";
import type { CloudIdentityPort } from "./cloud-identity";
import {
  computeSha256,
  createCloudProcessing,
  createDisabledCloudProcessing,
} from "./cloud-processing";

describe("cloud-processing", () => {
  it("computeSha256 gera hash hex SHA-256 correto de 64 caracteres", async () => {
    const encoder = new TextEncoder();
    const data = encoder.encode("teste-nexohub");
    const hash = await computeSha256(data);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // SHA-256 conhecido de 'teste-nexohub'
    // echo -n 'teste-nexohub' | sha256sum: e3814b7e80f9...
    expect(hash.length).toBe(64);
  });

  it("createDisabledCloudProcessing retorna isEnabled falso e rejeita chamadas", async () => {
    const port = createDisabledCloudProcessing();
    expect(await port.isEnabled()).toBe(false);
    await expect(
      port.createQuote({
        tool: "ocr",
        inputSha256: "0".repeat(64),
        inputBytes: 100,
        estimatedUnits: { pages: 1, characters: 0, files: 1 },
      }),
    ).rejects.toThrow("CLOUD_DISABLED");
  });

  it("rejeita origem não autorizada com INVALID_REQUEST", () => {
    const mockIdentity: CloudIdentityPort = {
      signIn: vi.fn(),
      completeEmailLink: vi.fn(),
      getIdToken: vi.fn().mockResolvedValue("token-123"),
      signOut: vi.fn(),
    };

    expect(() => createCloudProcessing(mockIdentity, "https://malicious.example.com/")).toThrow(
      "INVALID_REQUEST",
    );
  });

  it("executa fluxo completo de cotação, upload e criação de job com sucesso", async () => {
    const mockIdentity: CloudIdentityPort = {
      signIn: vi.fn(),
      completeEmailLink: vi.fn(),
      getIdToken: vi.fn().mockResolvedValue("valid-bearer-token"),
      signOut: vi.fn(),
    };

    const mockQuote = {
      quoteId: "quote-123",
      tool: "ocr" as const,
      expiresAt: "2026-11-10T22:00:00Z",
      units: { pages: 2, characters: 0, files: 1 },
      maximumUsdMicros: 0,
      policyVersion: "1.0",
      priceVersion: "1.0",
      processingLocation: "southamerica-east1",
      requiresUpload: true,
      requiresConfirmation: true,
    };

    const mockJob = {
      jobId: "job-abc",
      state: "running" as const,
    };

    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(url);
      expect(init?.headers).toMatchObject({ Authorization: "Bearer valid-bearer-token" });

      if (u.pathname.endsWith("/quotes") && init?.method === "POST") {
        return new Response(JSON.stringify(mockQuote), { status: 200 });
      }
      if (u.pathname.endsWith("/quotes/quote-123/authorize-upload") && init?.method === "POST") {
        return new Response(JSON.stringify({ uploadAuthorized: true }), { status: 200 });
      }
      if (u.pathname.endsWith("/quotes/quote-123/input") && init?.method === "PUT") {
        expect(init?.headers).toMatchObject({ "Content-Type": "application/octet-stream" });
        return new Response(JSON.stringify({ uploaded: true }), { status: 200 });
      }
      if (u.pathname.endsWith("/jobs") && init?.method === "POST") {
        return new Response(JSON.stringify(mockJob), { status: 200 });
      }
      if (u.pathname.endsWith("/jobs/job-abc") && init?.method === "GET") {
        return new Response(JSON.stringify({ jobId: "job-abc", state: "succeeded" }), {
          status: 200,
        });
      }
      if (u.pathname.endsWith("/jobs/job-abc/cancel") && init?.method === "POST") {
        return new Response(JSON.stringify({ jobId: "job-abc", state: "cancel_requested" }), {
          status: 200,
        });
      }
      return new Response("Not found", { status: 404 });
    });

    const port = createCloudProcessing(
      mockIdentity,
      `${firebasePublic.productionOrigin}/`,
      fetcher as unknown as typeof fetch,
    );

    // 1. Cotação
    const quote = await port.createQuote({
      tool: "ocr",
      inputSha256: "a".repeat(64),
      inputBytes: 5000,
      estimatedUnits: { pages: 2, characters: 0, files: 1 },
    });
    expect(quote.quoteId).toBe("quote-123");

    // 2. Autorização de upload
    const authorized = await port.authorizeUpload("quote-123");
    expect(authorized).toBe(true);

    // 3. Upload binário
    const uploaded = await port.uploadInput("quote-123", new Uint8Array([1, 2, 3]));
    expect(uploaded).toBe(true);

    // 4. Criação do Job
    const job = await port.createJob("quote-123");
    expect(job.jobId).toBe("job-abc");
    expect(job.state).toBe("running");

    // 5. Status do Job
    const status = await port.getJobStatus("job-abc");
    expect(status.state).toBe("succeeded");

    // 6. Cancelamento
    const cancelled = await port.cancelJob("job-abc");
    expect(cancelled.state).toBe("cancel_requested");
  });

  it("mapeia erro de cota excedida (429) para QUOTA_EXCEEDED", async () => {
    const mockIdentity: CloudIdentityPort = {
      signIn: vi.fn(),
      completeEmailLink: vi.fn(),
      getIdToken: vi.fn().mockResolvedValue("valid-token"),
      signOut: vi.fn(),
    };

    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({ code: "QUOTA_EXCEEDED" }), { status: 429 });
    });

    const port = createCloudProcessing(
      mockIdentity,
      `${firebasePublic.productionOrigin}/`,
      fetcher as unknown as typeof fetch,
    );

    await expect(
      port.createQuote({
        tool: "ocr",
        inputSha256: "b".repeat(64),
        inputBytes: 1000,
        estimatedUnits: { pages: 10, characters: 0, files: 1 },
      }),
    ).rejects.toThrow(expect.objectContaining({ code: "QUOTA_EXCEEDED" }));
  });
});
