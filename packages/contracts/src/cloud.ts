/** Contratos da nuvem opcional; não ativam motores nem exigem login no modo local. */
export type CloudTool = "ocr" | "translate-text" | "office-to-pdf";
export type ProcessingMode = "local" | "cloud";
/** Inteiro não negativo, US$ 1 = 1.000.000 micros; validado no servidor. */
export type UsdMicros = number;

export interface CloudBalance {
  readonly used: number;
  readonly reserved: number;
  readonly remaining: number;
}

export interface CloudUsage {
  readonly ocrPages: CloudBalance;
  readonly translationCharacters: CloudBalance;
  readonly officeFiles: CloudBalance;
  readonly budgetUsdMicros: CloudBalance;
  readonly resetAt: string;
}

export interface CloudUnits {
  readonly pages: number;
  readonly characters: number;
  readonly files: number;
}

export interface CloudQuote {
  readonly quoteId: string;
  readonly tool: CloudTool;
  readonly expiresAt: string;
  readonly units: CloudUnits;
  readonly maximumUsdMicros: UsdMicros;
  readonly policyVersion: string;
  readonly priceVersion: string;
  readonly processingLocation: string;
  readonly requiresUpload: boolean;
  readonly requiresConfirmation: boolean;
}

export type CloudJobState =
  | "quoted"
  | "awaiting_upload"
  | "awaiting_confirmation"
  | "reserved"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancel_requested"
  | "needs_reconciliation"
  | "settled"
  | "expired";

export interface CloudJob {
  readonly jobId: string;
  readonly state: CloudJobState;
  readonly usage: CloudUsage;
  readonly expiresAt: string;
}

export interface CloudParticipant {
  readonly participantId: string;
  readonly email?: string;
  readonly admitted: boolean;
  readonly emailVerified: boolean;
}

export interface CloudQuoteRequest {
  readonly tool: CloudTool;
  readonly inputSha256: string;
  readonly inputBytes: number;
  readonly estimatedUnits: CloudUnits;
  readonly targetLanguage?: string;
}

export interface CloudSubmitRequest {
  readonly quoteId: string;
  readonly idempotencyKey: string;
}

export type CloudErrorCode =
  | "CLOUD_DISABLED"
  | "AUTH_REQUIRED"
  | "EMAIL_UNVERIFIED"
  | "PARTICIPANT_NOT_ADMITTED"
  | "QUOTA_EXCEEDED"
  | "GLOBAL_BUDGET_EXCEEDED"
  | "PRICE_UNAVAILABLE"
  | "QUOTE_EXPIRED"
  | "INPUT_CHANGED"
  | "JOB_BUSY"
  | "RECONCILIATION_REQUIRED";

export interface CloudError {
  readonly code: CloudErrorCode;
  readonly message: string;
}
