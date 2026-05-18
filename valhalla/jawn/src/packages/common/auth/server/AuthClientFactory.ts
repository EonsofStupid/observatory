import { getEnv } from "../../toImplement/helpers/getEnv";
import { AuthentikAuthWrapper } from "../../toImplement/server/AuthentikAuthWrapper";
import { BetterAuthWrapper } from "../../toImplement/server/BetterAuthWrapper";
import { SupabaseAuthWrapper } from "../../toImplement/server/SupabaseAuthWrapper";
import { HeliconeAuthClient } from "./HeliconeAuthClient";

/**
 * Pick the server-side auth wrapper.
 *
 * Resolution order (per ADR 0024 §7.1):
 *   1. AUTH_PROVIDER === "authentik" → AuthentikAuthWrapper (OIDC JWT bearer,
 *      JWKS-validated; delegates sk-helicone-* bearer to common.authenticateBearer)
 *   2. NEXT_PUBLIC_BETTER_AUTH === "true" → BetterAuthWrapper (upstream Helicone)
 *   3. otherwise → SupabaseAuthWrapper (legacy fallback)
 */
export function getHeliconeAuthClient(): HeliconeAuthClient {
  if (getEnv("AUTH_PROVIDER") === "authentik") {
    return new AuthentikAuthWrapper();
  }
  if (getEnv("NEXT_PUBLIC_BETTER_AUTH") === "true") {
    return new BetterAuthWrapper();
  }
  return new SupabaseAuthWrapper();
}
