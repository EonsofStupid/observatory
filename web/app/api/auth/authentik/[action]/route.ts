/**
 * Authentik OIDC route handlers — Auth-code + PKCE flow (ADR 0024 §7).
 *
 * STUB — each action returns 501 with a TODO pointer. Catch-all pattern so
 * Next.js routing doesn't 404 while implementation is in flight.
 *
 * Routes (all under /api/auth/authentik/):
 *
 *   /login    — GET. Generates code_verifier + state nonce, stores them in a
 *               short-lived signed cookie (5 min TTL), redirects to Authentik
 *               /application/o/authorize/ with code_challenge.
 *
 *   /callback — GET. Receives ?code=...&state=... from Authentik. Validates
 *               state cookie, exchanges code for access+refresh+id token at
 *               /application/o/token/, decodes id_token, provisions or looks
 *               up the user row in public.user (keyed by sub), syncs
 *               organization_member rows from groups claim, sets the encrypted
 *               session cookie, redirects to /.
 *
 *   /logout   — GET or POST. Clears the session cookie, redirects to Authentik
 *               /application/o/<client_id>/end-session/ for SLO.
 *
 *   /me       — GET. Returns the current session as JSON ({user, org, role}).
 *               Used by useAuthentikAuthClient on mount.
 *
 *   /refresh  — POST. Refreshes the access token via refresh_token grant.
 *
 *   /org/current — GET. Returns the current org (selected via currentOrgId cookie).
 *
 * Required env vars (read via process.env on server side):
 *   AUTHENTIK_ISSUER             https://auth.effing.ai/application/o/observatory-ui/
 *   AUTHENTIK_CLIENT_ID          observatory-ui
 *   AUTHENTIK_CLIENT_SECRET      (only for confidential clients; we are public)
 *   AUTHENTIK_REDIRECT_URI       https://observatory.effing.ai/api/auth/authentik/callback
 *   AUTHENTIK_JWKS_URI           https://auth.effing.ai/application/o/observatory-ui/jwks/
 *   AUTHENTIK_AUTHORIZE_URL      https://auth.effing.ai/application/o/authorize/
 *   AUTHENTIK_TOKEN_URL          https://auth.effing.ai/application/o/token/
 *   AUTHENTIK_END_SESSION_URL    https://auth.effing.ai/application/o/observatory-ui/end-session/
 *   AUTHENTIK_GROUP_CLAIM        groups
 *   AUTHENTIK_ADMIN_GROUP        observatory:admin
 *   SESSION_ENCRYPTION_KEY       32-byte hex (rotate daily via cron)
 *
 * Library choices (Phase B):
 *   openid-client@5      — PKCE + token exchange (handles all the RFC dance)
 *   jose                 — JWT verify (JWKS-cached)
 *   iron-session         — alternative for the session cookie; or use native
 *                          AES-256-GCM via crypto.subtle for parity with
 *                          IndexedDB DPoP keys
 *
 * Implementation order:
 *   1. /login + /callback (PKCE round-trip works, cookie set)
 *   2. /me (so React hook hydrates user state)
 *   3. /logout (SLO via Authentik end-session)
 *   4. /refresh (token rotation)
 *   5. /org/current (org selector)
 *
 * See PHASE-B-IMPLEMENTATION.md §3.4.
 */
import { NextRequest, NextResponse } from "next/server";

const NOT_IMPLEMENTED_BODY = JSON.stringify({
  error: "not_implemented",
  message: "Authentik OIDC route not yet implemented (ADR 0024 Phase B)",
  see: "https://github.com/EonsofStupid/observatory/blob/authentik-oidc/PHASE-B-IMPLEMENTATION.md",
});

function notImplemented(action: string): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: "not_implemented",
      action,
      message: "Authentik OIDC route not yet implemented (ADR 0024 Phase B)",
      see: "PHASE-B-IMPLEMENTATION.md",
    }),
    {
      status: 501,
      headers: { "content-type": "application/json" },
    },
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
): Promise<NextResponse> {
  const { action } = await params;
  void req;

  switch (action) {
    case "login":
      // TODO §3.4.1: generate code_verifier/code_challenge, set state cookie,
      // redirect to AUTHENTIK_AUTHORIZE_URL with PKCE params + scopes.
      return notImplemented("login");

    case "callback":
      // TODO §3.4.2: verify state cookie, exchange code → token,
      // verify id_token against JWKS, provision user, set session cookie,
      // redirect to /.
      return notImplemented("callback");

    case "logout":
      // TODO §3.4.3: clear session cookie, redirect to
      // AUTHENTIK_END_SESSION_URL (single-logout).
      return notImplemented("logout");

    case "me":
      // TODO §3.4.4: decode session cookie, return {user, org, role}.
      return notImplemented("me");

    default:
      return new NextResponse(
        JSON.stringify({ error: "unknown_action", action }),
        { status: 404, headers: { "content-type": "application/json" } },
      );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
): Promise<NextResponse> {
  const { action } = await params;
  void req;

  switch (action) {
    case "logout":
      // POST variant of logout (for forms / fetch).
      return notImplemented("logout");

    case "refresh":
      // TODO §3.4.5: read session cookie, exchange refresh_token for new
      // access_token, rotate cookie, return 204.
      return notImplemented("refresh");

    default:
      return new NextResponse(
        JSON.stringify({ error: "method_not_allowed_for_action", action }),
        { status: 405, headers: { "content-type": "application/json" } },
      );
  }
}
