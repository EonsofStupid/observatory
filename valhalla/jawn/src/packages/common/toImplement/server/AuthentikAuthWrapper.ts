/**
 * AuthentikAuthWrapper — Jawn-side server impl of HeliconeAuthClient (ADR 0024 §7).
 *
 * STUB IMPLEMENTATION — every path errors at runtime, but type signatures
 * are complete so the build passes. Replace each method body in Phase B.
 *
 * Critical design (per ADR 0024 §7.4):
 *   - JWT path (Authorization: Bearer eyJ...) → validate against Authentik
 *     JWKS, extract sub/groups/orgId claims, map to public.user.id +
 *     organization_member rows.
 *   - sk-helicone-* path (Authorization: Bearer sk-helicone-...) → DELEGATE
 *     to common.authenticateBearer() unchanged. This is THE WIN — API key
 *     minting + Bifrost-PostHook ingestion stay identical to upstream.
 *
 * Implementation plan (see PHASE-B-IMPLEMENTATION.md §3.3):
 *
 * 1. JWKS fetch + cache:
 *      env: AUTHENTIK_JWKS_URI
 *      lib: jose (already in node_modules from supabase path) — use
 *           `createRemoteJWKSet(new URL(env.AUTHENTIK_JWKS_URI), { cacheMaxAge: 60*60*1000 })`.
 * 2. authenticate():
 *      if auth._type === "bearer" && auth.token.startsWith("sk-helicone")
 *        → return authenticateBearer(auth);  (unchanged)
 *      if auth._type === "jwt" OR (bearer && JWT-shaped):
 *        → jose.jwtVerify(token, jwks, { issuer: env.AUTHENTIK_ISSUER, audience: ["observatory-ui"] });
 *        → look up public.user by `id = payload.sub` (provision row if absent);
 *        → resolve current org via payload.groups + currentOrgId cookie/orgId field;
 *        → map group → org_role (admin if in AUTHENTIK_ADMIN_GROUP, owner if observatory:admin scope, else member);
 *        → return ok({ organizationId, userId, role, tier: org.tier }).
 *      else → err("unsupported auth").
 * 3. getOrganization(): same SQL as BetterAuthWrapper.getOrganization —
 *    JOIN organization × organization_member × authParams.organizationId
 *    × authParams.userId. No change.
 * 4. getUser(): JWKS-validate, return { email, id, user_metadata }.
 * 5. createUser(): provision row in public.user keyed by Authentik sub.
 *    Called on first OIDC callback. Idempotent.
 * 6. getUserByEmail / getUserById: existing Postgres lookups, no auth.
 *
 * RBAC mapping:
 *   AUTHENTIK_ADMIN_GROUP env (default "observatory:admin") → org_role "admin"
 *   AUTHENTIK_OWNER_GROUP env (default "observatory:write")  → "owner"
 *   else → "member"
 *
 * Group claim source: payload.groups (array<string>).
 */
import { ok, err } from "../../result";
import {
  AuthParams,
  AuthResult,
  GenericHeaders,
  HeliconeAuth,
  HeliconeUserResult,
  JwtAuth,
  OrgResult,
} from "../../auth/types";
import { HeliconeAuthClient } from "../../auth/server/HeliconeAuthClient";
import { authenticateBearer } from "./common";

const NOT_IMPLEMENTED = "AuthentikAuthWrapper not yet implemented (ADR 0024 Phase B)";

export class AuthentikAuthWrapper implements HeliconeAuthClient {
  async authenticate(
    auth: HeliconeAuth,
    headers?: GenericHeaders,
  ): AuthResult {
    void headers;

    // sk-helicone-* path stays on the unchanged Helicone bearer flow.
    if (auth._type === "bearer" && auth.token.startsWith("sk-helicone")) {
      return authenticateBearer(auth);
    }
    if (auth._type === "bearerProxy" && auth.token.startsWith("sk-helicone")) {
      return authenticateBearer({ _type: "bearer", token: auth.token });
    }

    // JWT (Authentik OIDC) path — TODO Phase B §3.3.
    if (auth._type === "jwt" || auth._type === "bearer") {
      return err(NOT_IMPLEMENTED);
    }
    return err("unsupported auth type for Authentik wrapper");
  }

  async getOrganization(authParams: AuthParams): OrgResult {
    void authParams;
    return err(NOT_IMPLEMENTED);
  }

  async getUser(auth: JwtAuth, headers?: GenericHeaders): HeliconeUserResult {
    void auth;
    void headers;
    return err(NOT_IMPLEMENTED);
  }

  async createUser({
    email,
    password,
    otp,
  }: {
    email: string;
    password?: string;
    otp?: boolean;
  }): HeliconeUserResult {
    void email;
    void password;
    void otp;
    // Provisioned automatically on first OIDC callback; manual create is a no-op in Authentik mode.
    return err(NOT_IMPLEMENTED);
  }

  async getUserByEmail(email: string): HeliconeUserResult {
    void email;
    return err(NOT_IMPLEMENTED);
  }

  async getUserById(userId: string): HeliconeUserResult {
    void userId;
    return err(NOT_IMPLEMENTED);
  }
}
