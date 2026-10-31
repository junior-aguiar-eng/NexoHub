/** Identidade opcional: nunca é consultada pelo processamento local. */
export interface CloudIdentityPort {
  signIn(
    method: "google" | "emailLink",
    email?: string,
    binding?: import("./desktop-handoff").DesktopBinding,
  ): Promise<void>;
  completeEmailLink(email: string, url: string): Promise<void>;
  getIdToken(): Promise<string | null>;
  signOut(): Promise<void>;
  prepareDesktopHandoff?(
    binding: import("./desktop-handoff").DesktopBinding,
  ): Promise<import("./desktop-handoff").SessionEnvelope>;
}

export class CloudIdentityError extends Error {
  constructor(
    readonly code:
      | "CLOUD_DISABLED"
      | "AUTH_REQUIRED"
      | "AUTH_ACCOUNT_MISMATCH"
      | "AUTH_INVALID_CALLBACK"
      | "AUTH_INVALID_EMAIL"
      | "AUTH_UNAVAILABLE"
      | "EMAIL_UNVERIFIED"
      | "PARTICIPANT_NOT_ADMITTED",
  ) {
    super(code);
    this.name = "CloudIdentityError";
  }
}
