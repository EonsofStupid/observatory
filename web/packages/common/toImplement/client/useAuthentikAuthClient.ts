/**
 * useAuthentikAuthClient — React hook that returns a HeliconeAuthClient backed
 * by Authentik OIDC (ADR 0024 Phase B).
 *
 * STUB IMPLEMENTATION — methods throw at runtime until implemented. Build
 * passes because all type signatures are correct against HeliconeAuthClient.
 *
 * Implementation plan (see PHASE-B-IMPLEMENTATION.md §3.1):
 *
 * 1. Read session from /api/auth/authentik/me on mount (SWR pattern).
 *    Cookie-based; no token in JS visibility.
 * 2. signOut → POST /api/auth/authentik/logout, clears cookie, redirects to
 *    Authentik /application/o/observatory-ui/end-session/.
 * 3. signInWithOAuth({ provider: "authentik" }) → window.location =
 *    /api/auth/authentik/login (PKCE init server-side; redirects to Authentik
 *    /application/o/authorize/).
 * 4. signInWithPassword / signUp / resetPassword / changePassword / updateUser
 *    → all return Err("password auth disabled; use OIDC passkey via Authentik").
 *    These exist in the interface for upstream-compat but are not used.
 * 5. getUser → SWR cached /api/auth/authentik/me response.
 * 6. getOrg → SWR cached /api/auth/authentik/org/current; respects
 *    `currentOrgId` cookie selector across user's groups.
 * 7. refreshSession → POST /api/auth/authentik/refresh; rotates the cookie's
 *    encrypted access+refresh tokens.
 *
 * DPoP: client generates a non-extractable Ed25519 keypair in IndexedDB on
 * first sign-in; every fetch wraps in a DPoP proof JWT. Deferred to ADR 0024
 * Phase D (DPoP enforcement); for now we ship plain bearer + cookie.
 */
import { useMemo, useState, useEffect } from "react";
import { HeliconeAuthClient } from "../../auth/client/HeliconeAuthClient";
import { Result, err, ok } from "../../result";
import { HeliconeOrg, HeliconeUser } from "../../auth/types";

const NOT_IMPLEMENTED = "Authentik OIDC client not yet implemented (ADR 0024 Phase B)";
const PASSWORD_DISABLED = "Password auth disabled — use Authentik passkey sign-in";

export function useAuthentikAuthClient(): HeliconeAuthClient {
  // Stub state: real impl fetches /api/auth/authentik/me on mount.
  const [user] = useState<HeliconeUser | undefined>(undefined);

  return useMemo<HeliconeAuthClient>(
    () => ({
      user,

      signOut: async () => {
        // TODO: POST /api/auth/authentik/logout → clear cookie → redirect to
        //       Authentik end-session endpoint.
        if (typeof window !== "undefined") {
          window.location.href = "/api/auth/authentik/logout";
        }
      },

      refreshSession: async () => {
        // TODO: POST /api/auth/authentik/refresh — rotates encrypted cookie.
        throw new Error(NOT_IMPLEMENTED);
      },

      signUp: async () => err<HeliconeUser, string>(PASSWORD_DISABLED),

      getOrg: async () =>
        err<{ org: HeliconeOrg; role: string }, string>(NOT_IMPLEMENTED),

      resetPassword: async () => err<void, string>(PASSWORD_DISABLED),

      changePassword: async () => err<void, string>(PASSWORD_DISABLED),

      signInWithPassword: async () =>
        err<HeliconeUser, string>(PASSWORD_DISABLED),

      signInWithOAuth: async ({ provider }) => {
        if (provider !== "authentik") {
          return err<void, string>(
            `provider "${provider}" not supported in Authentik mode — only "authentik" accepted`,
          );
        }
        // Server-side PKCE init lives at /api/auth/authentik/login.
        if (typeof window !== "undefined") {
          window.location.href = "/api/auth/authentik/login";
        }
        return ok<void, string>(undefined);
      },

      updateUser: async () => err<void, string>(PASSWORD_DISABLED),

      getUser: async () => {
        if (user) return ok<HeliconeUser, string>(user);
        return err<HeliconeUser, string>(NOT_IMPLEMENTED);
      },
    }),
    [user],
  );
}
