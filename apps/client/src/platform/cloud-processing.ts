import type { CloudErrorCode, CloudJob, CloudQuote, CloudQuoteRequest } from "@nexohub/contracts";
import firebasePublic from "../../../../scripts/cloud/firebase-public.json";
import type { CloudIdentityPort } from "./cloud-identity";

export type CloudProcessingErrorCode =
  | CloudErrorCode
  | "AUTH_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "UPLOAD_FAILED"
  | "JOB_FAILED"
  | "NETWORK_ERROR";

export class CloudProcessingError extends Error {
  constructor(
    readonly code: CloudProcessingErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CloudProcessingError";
  }
}

export interface CloudProcessingPort {
  isEnabled(): Promise<boolean>;
  createQuote(request: CloudQuoteRequest): Promise<CloudQuote>;
  authorizeUpload(quoteId: string): Promise<boolean>;
  uploadInput(quoteId: string, data: Uint8Array): Promise<boolean>;
  createJob(quoteId: string): Promise<CloudJob>;
  getJobStatus(jobId: string): Promise<CloudJob>;
  cancelJob(jobId: string): Promise<CloudJob>;
  computeSha256(data: Uint8Array): Promise<string>;
}

export async function computeSha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as unknown as BufferSource);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createDisabledCloudProcessing(): CloudProcessingPort {
  const disabled = async (): Promise<never> => {
    throw new CloudProcessingError("CLOUD_DISABLED");
  };
  return {
    isEnabled: async () => false,
    createQuote: disabled,
    authorizeUpload: disabled,
    uploadInput: disabled,
    createJob: disabled,
    getJobStatus: disabled,
    cancelJob: disabled,
    computeSha256,
  };
}

async function extractErrorCode(response: Response): Promise<CloudProcessingErrorCode> {
  if (response.status === 503) return "CLOUD_DISABLED";
  if (response.status === 401) return "AUTH_REQUIRED";
  if (response.status === 403) {
    try {
      const body = (await response.json()) as { code?: string };
      if (
        body?.code === "PARTICIPANT_NOT_ADMITTED" ||
        body?.code === "EMAIL_UNVERIFIED" ||
        body?.code === "CLOUD_DISABLED"
      ) {
        return body.code;
      }
    } catch {
      // Fallback para AUTH_REQUIRED caso não haja JSON
    }
    return "AUTH_REQUIRED";
  }
  if (response.status === 429) {
    try {
      const body = (await response.json()) as { code?: string };
      if (body?.code === "QUOTA_EXCEEDED" || body?.code === "GLOBAL_BUDGET_EXCEEDED") {
        return body.code;
      }
    } catch {
      // ignore
    }
    return "QUOTA_EXCEEDED";
  }
  if (response.status === 410) return "QUOTE_EXPIRED";
  if (response.status === 409) return "INPUT_CHANGED";
  if (response.status === 400) return "INVALID_REQUEST";
  return "NETWORK_ERROR";
}

export function createCloudProcessing(
  identity: CloudIdentityPort,
  origin: string,
  fetcher: typeof fetch = fetch,
): CloudProcessingPort {
  const parsed = new URL(origin);
  if (
    ![firebasePublic.productionOrigin, firebasePublic.previewOrigin].includes(parsed.origin) ||
    parsed.pathname !== "/"
  ) {
    throw new CloudProcessingError("INVALID_REQUEST");
  }

  const authorizedRequest = async <T>(
    path: string,
    options: { method?: string; body?: unknown; isBinary?: boolean } = {},
  ): Promise<T> => {
    const token = await identity.getIdToken();
    if (!token) throw new CloudProcessingError("AUTH_REQUIRED");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };

    let requestBody: BodyInit | undefined;
    if (options.isBinary && options.body instanceof Uint8Array) {
      headers["Content-Type"] = "application/octet-stream";
      requestBody = options.body as unknown as BodyInit;
    } else if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetcher(`${parsed.origin}/hub/api/v1/cloud/${path}`, {
        method: options.method ?? (options.body === undefined ? "GET" : "POST"),
        headers,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: AbortSignal.timeout(30_000),
        ...(requestBody !== undefined ? { body: requestBody } : {}),
      });
    } catch {
      throw new CloudProcessingError("NETWORK_ERROR");
    }

    if (!response.ok) {
      throw new CloudProcessingError(await extractErrorCode(response));
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new CloudProcessingError("INVALID_REQUEST");
    }
  };

  return {
    async isEnabled(): Promise<boolean> {
      try {
        const response = await fetcher(`${parsed.origin}/hub/api/v1/cloud/status`, {
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(5_000),
        });
        if (!response.ok) return false;
        const data = (await response.json()) as { enabled?: boolean; identityAvailable?: boolean };
        return data.identityAvailable === true;
      } catch {
        return false;
      }
    },

    async createQuote(request: CloudQuoteRequest): Promise<CloudQuote> {
      return authorizedRequest<CloudQuote>("quotes", {
        method: "POST",
        body: request,
      });
    },

    async authorizeUpload(quoteId: string): Promise<boolean> {
      const res = await authorizedRequest<{ uploadAuthorized?: boolean }>(
        `quotes/${quoteId}/authorize-upload`,
        {
          method: "POST",
          body: { confirmed: true },
        },
      );
      return res.uploadAuthorized === true;
    },

    async uploadInput(quoteId: string, data: Uint8Array): Promise<boolean> {
      const res = await authorizedRequest<{ uploaded?: boolean }>(`quotes/${quoteId}/input`, {
        method: "PUT",
        body: data,
        isBinary: true,
      });
      return res.uploaded === true;
    },

    async createJob(quoteId: string): Promise<CloudJob> {
      return authorizedRequest<CloudJob>("jobs", {
        method: "POST",
        body: { quoteId },
      });
    },

    async getJobStatus(jobId: string): Promise<CloudJob> {
      return authorizedRequest<CloudJob>(`jobs/${jobId}`, {
        method: "GET",
      });
    },

    async cancelJob(jobId: string): Promise<CloudJob> {
      return authorizedRequest<CloudJob>(`jobs/${jobId}/cancel`, {
        method: "POST",
      });
    },

    computeSha256,
  };
}
