/**
 * authentikAuthClientFromSSRContext — SSR counterpart to useAuthentikAuthClient.
 *
 * STUB IMPLEMENTATION — returns a HeliconeAuthClient that errors on most calls.
 * Build passes (correct type signatures); runtime guards against accidental
 * use before implementation.
 *
 * Implementation plan (see PHASE-B-IMPLEMENTATION.md §3.2):
 *
 * 1. Decrypt the __Secure-clyffy-observatory-session cookie from ctx.req.
 * 2. Validate the embedded OIDC access token against the JWKS cache (1h TTL).
 * 3. If token expired but refresh_token valid, transparently refresh.
 * 4. Map sub claim → public.user.id (look up or create); groups claim →
 *    organization_member rows; orgId from currentOrgId cookie.
 * 5. Return a HeliconeAuthClient bound to the validated session.
 *
 * Cookie crypto: AES-256-GCM with key from SESSION_ENCRYPTION_KEY env var,
 * rotated daily. Implementation TODO; use Node `crypto.subtle` for parity
 * with browser-side IndexedDB DPoP keys (ADR 0024 §5).
 *
 * JWKS: fetched from AUTHENTIK_JWKS_URI on first request, cached in module
 * scope with 1h TTL. Re-fetch on jwt.verify() throwing on unknown kid.
 */
import { HeliconeAuthClient } from "../../auth/client/HeliconeAuthClient";
import { SSRContext } from "../../auth/client/getSSRHeliconeAuthClient";
import { Result, err, ok } from "../../result";
import { HeliconeOrg, HeliconeUser } from "../../auth/types";

const NOT_IMPLEMENTED = "Authentik SSR auth not yet implemented (ADR 0024 Phase B)";
const PASSWORD_DISABLED = "Password auth disabled — use Authentik passkey sign-in";

export async function authentikAuthClientFromSSRContext(
  ctx: SSRContext<any, any, any>,
): Promise<HeliconeAuthClient> {
  // TODO: parse cookie, validate JWT against JWKS, hydrate user.
  void ctx;
  const user: HeliconeUser | undefined = undefined;

  return {
    user,

    signOut: async () => {
      // No-op on server side; client redirects to /api/auth/authentik/logout.
    },

    refreshSession: async () => {
      throw new Error(NOT_IMPLEMENTED);
    },

    signUp: async () => err<HeliconeUser, string>(PASSWORD_DISABLED),

    getOrg: async () =>
      err<{ org: HeliconeOrg; role: string }, string>(NOT_IMPLEMENTED),

    resetPassword: async () => err<void, string>(PASSWORD_DISABLED),

    changePassword: async () => err<void, string>(PASSWORD_DISABLED),

    signInWithPassword: async () =>
      err<HeliconeUser, string>(PASSWORD_DISABLED),

    signInWithOAuth: async () =>
      err<void, string>(
        "Use server-side /api/auth/authentik/login route, not SSR client.",
      ),

    updateUser: async () => err<void, string>(PASSWORD_DISABLED),

    getUser: async () => {
      if (user) return ok<HeliconeUser, string>(user);
      return err<HeliconeUser, string>(NOT_IMPLEMENTED);
    },
  };
}
