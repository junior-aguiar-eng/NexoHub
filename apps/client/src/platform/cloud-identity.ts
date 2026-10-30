/** Identidade opcional: nunca é consultada pelo processamento local. */
export interface CloudIdentityPort {
  signIn(method: "google" | "emailLink", email?: string): Promise<void>;
  completeEmailLink(email: string, url: string): Promise<void>;
  getIdToken(): Promise<string | null>;
  signOut(): Promise<void>;
}

export class CloudIdentityError extends Error {
  constructor(
    readonly code:
      | "AUTH_INVALID_CALLBACK"
      | "AUTH_INVALID_EMAIL"
      | "AUTH_UNAVAILABLE"
      | "EMAIL_UNVERIFIED",
  ) {
    super(code);
    this.name = "CloudIdentityError";
  }
}
