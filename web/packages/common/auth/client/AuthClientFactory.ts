import { useAuthentikAuthClient } from "../../toImplement/client/useAuthentikAuthClient";
import { useBetterAuthClient } from "../../toImplement/client/useBetterAuthClient";
import { useSupabaseAuthClient } from "../../toImplement/client/useSupabaseAuthClient";
import { getEnv } from "../../toImplement/helpers/getEnv";

/**
 * Pick the auth client implementation at module load.
 *
 * Resolution order (first match wins):
 *   1. AUTH_PROVIDER === "authentik" → Authentik OIDC (per ADR 0024)
 *   2. NEXT_PUBLIC_BETTER_AUTH === "true" → upstream Helicone better-auth path
 *   3. otherwise → upstream Helicone Supabase path
 *
 * Note: we keep the legacy NEXT_PUBLIC_BETTER_AUTH branch so the upstream
 * docker-compose dev workflow still works without changing env vars. New
 * deployments set AUTH_PROVIDER=authentik and ignore the legacy flag.
 */
export const useHeliconeAuthClient =
  getEnv("AUTH_PROVIDER") === "authentik"
    ? useAuthentikAuthClient
    : getEnv("NEXT_PUBLIC_BETTER_AUTH") === "true"
    ? useBetterAuthClient
    : useSupabaseAuthClient;
