import { initializeApp } from "firebase/app";
import {
  type Auth,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  initializeAuth,
  inMemoryPersistence,
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { CloudIdentityError, type CloudIdentityPort } from "./cloud-identity";
import { sealDesktopSession } from "./desktop-handoff";

export interface BrowserCloudIdentityConfig {
  readonly apiKey: string;
  readonly projectId: string;
  readonly authDomain: string;
  readonly redirectUrl: string;
}

/** Uma instância por bootstrap da plataforma. Não conectada à UI até o gate de ativação. */
export function createBrowserCloudIdentity(config: BrowserCloudIdentityConfig): CloudIdentityPort {
  const redirect = new URL(config.redirectUrl);
  if (
    redirect.protocol !== "https:" ||
    redirect.username ||
    redirect.password ||
    redirect.hash ||
    !config.apiKey ||
    !config.projectId ||
    !config.authDomain
  ) {
    throw new CloudIdentityError("AUTH_INVALID_CALLBACK");
  }
  let auth: Auth | null = null;
  const ready = () => {
    if (!auth) {
      const app = initializeApp(
        { apiKey: config.apiKey, projectId: config.projectId, authDomain: config.authDomain },
        { name: "nexohub-cloud", automaticDataCollectionEnabled: false },
      );
      auth = initializeAuth(app, {
        persistence: inMemoryPersistence,
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    }
    return auth;
  };
  const checkedEmail = (email?: string) => {
    const value = email?.trim();
    if (!value || value.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(value))
      throw new CloudIdentityError("AUTH_INVALID_EMAIL");
    return value;
  };
  const confirmed = async (current: Auth) => {
    if (!current.currentUser?.emailVerified) {
      await signOut(current);
      throw new CloudIdentityError("EMAIL_UNVERIFIED");
    }
  };
  const sanitized = (error: unknown): never => {
    if (error instanceof CloudIdentityError) throw error;
    throw new CloudIdentityError("AUTH_UNAVAILABLE");
  };
  return {
    async signIn(method, email, binding) {
      try {
        if (method === "emailLink") {
          const value = checkedEmail(email);
          const target = new URL(config.redirectUrl);
          if (binding) {
            for (const [key, entry] of Object.entries(binding))
              target.searchParams.set(key, String(entry));
          }
          await sendSignInLinkToEmail(ready(), value, {
            url: target.href,
            handleCodeInApp: true,
          });
        } else {
          const current = ready();
          await signInWithPopup(current, new GoogleAuthProvider());
          await confirmed(current);
        }
      } catch (error) {
        sanitized(error);
      }
    },
    async completeEmailLink(email, url) {
      try {
        const callback = new URL(url);
        if (
          callback.origin !== redirect.origin ||
          callback.pathname !== redirect.pathname ||
          callback.username ||
          callback.password
        )
          throw new CloudIdentityError("AUTH_INVALID_CALLBACK");
        const value = checkedEmail(email);
        const current = ready();
        if (!isSignInWithEmailLink(current, url))
          throw new CloudIdentityError("AUTH_INVALID_CALLBACK");
        await signInWithEmailLink(current, value, url);
        await confirmed(current);
      } catch (error) {
        sanitized(error);
      }
    },
    async getIdToken() {
      try {
        return auth?.currentUser?.emailVerified ? await auth.currentUser.getIdToken() : null;
      } catch (error) {
        return sanitized(error);
      }
    },
    async prepareDesktopHandoff(binding) {
      try {
        const current = ready();
        await confirmed(current);
        const user = current.currentUser;
        if (!user?.refreshToken) throw new CloudIdentityError("AUTH_REQUIRED");
        return await sealDesktopSession(binding, {
          idToken: await user.getIdToken(),
          refreshToken: user.refreshToken,
        });
      } catch (error) {
        return sanitized(error);
      }
    },
    async signOut() {
      try {
        if (auth) await signOut(auth);
      } catch (error) {
        sanitized(error);
      }
    },
  };
}
