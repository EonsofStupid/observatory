# Observatory — Phase B Implementation Plan

**Forked from:** Helicone/helicone @ v2025.08.21-1 (commit `f74f255fa`)
**Owner:** EonsofStupid/observatory
**Working branch:** `authentik-oidc`
**Companion ADR:** wardenclyffe `docs/decisions/0024-federated-identity-auth-architecture.md`
**License:** Apache 2.0 (preserved from upstream Helicone)

## Goal

Replace Helicone's better-auth (email/password) and Supabase auth paths with
**Authentik OIDC**, while keeping every other Helicone feature untouched:
- Trace explorer UI
- Cost dashboards
- Per-request prompt/response viewer
- `sk-helicone-*` API key minting (used by clyffy's Bifrost-PostHook plugin to
  ingest traces)
- ClickHouse trace store
- MinIO body storage
- RBAC tables (organization, organization_member, helicone_api_keys)

This document is the **work-spec for the implementation pass**. Stubs are in
place (see §3 below); each stub points back here with §-anchor references.

## 1. Status

| Component | State |
|---|---|
| Fork created | ✅ EonsofStupid/observatory, default branch `main`, tag `v2025.08.21-1` available |
| Working branch | ✅ `authentik-oidc` checked out at `f74f255fa` |
| Authentik Phase A scaffolding | ✅ realm + 8 scopes + 5 OIDC clients provisioned via wardenclyffe/scripts/foundation/15-authentik-realms-and-clients.sh (commit 99df215) |
| HeliconeAuthClient interface widening | ✅ `signInWithOAuth.provider` now `"google" \| "github" \| "authentik"` |
| Client AuthClientFactory | ✅ AUTH_PROVIDER=authentik branch added |
| SSR AuthClientFactory | ✅ AUTH_PROVIDER=authentik branch added |
| Jawn AuthClientFactory | ✅ AUTH_PROVIDER=authentik branch added |
| useAuthentikAuthClient (web) | 🟡 stub, type-correct, runtime TODO |
| authentikAuthClientFromSSRContext (web) | 🟡 stub |
| AuthentikAuthWrapper (jawn) | 🟡 stub — sk-helicone-* delegation works; JWT path TODO |
| /api/auth/authentik/[action] routes | 🟡 stub returning 501 |
| Operator passkey enrolment | ⏳ blocked on operator runbook 16 (~30 min) |
| Confidential client secrets in Infisical | ⏳ blocked on operator drop (2 secrets) |
| Conditional-UI flow imported into Authentik | ⏳ template authoring + import |
| signin/signup cloud-redirect removal | ⏳ §3.5 |
| docker-compose .env for LXC 113 | ⏳ §4 |
| Deploy on LXC 113 | ⏳ §5 |
| clyffy-go LLM driver retarget | ⏳ §6 |

## 2. Library choices

Use these (already in node_modules from upstream Helicone, or trivial to add):

| Purpose | Library | Notes |
|---|---|---|
| OIDC PKCE + token exchange | `openid-client@5` | handles RFC 7636 + 9068; `Issuer.discover()` for metadata |
| JWT verify + JWKS cache | `jose` | `createRemoteJWKSet(url, { cacheMaxAge: 3_600_000 })` |
| Session cookie encryption | `iron-session` OR native `crypto.subtle` AES-256-GCM | iron-session is simpler; native gives parity with browser DPoP key story |
| HTTP client | upstream Helicone's `fetch` | no new dep |

For the Jawn side (Express/TSOA):
| Purpose | Library |
|---|---|
| JWT verify | `jose` (same as web) |
| Postgres queries | upstream `pg` Pool (unchanged) |

## 3. Stub → implementation walkthrough

### 3.1 `web/packages/common/toImplement/client/useAuthentikAuthClient.ts`

Replace stub body with:
```ts
const { data, mutate } = useSWR<MeResponse | null>(
  "/api/auth/authentik/me",
  async (url) => {
    const r = await fetch(url, { credentials: "include" });
    if (r.status === 401) return null;
    if (!r.ok) throw new Error(`auth/me HTTP ${r.status}`);
    return (await r.json()) as MeResponse;
  },
);
const user = data?.user;
// ... wire signOut, signInWithOAuth, getOrg, getUser etc. against /api routes
```

`MeResponse` shape:
```ts
type MeResponse = {
  user: HeliconeUser;             // { id, email, user_metadata }
  org: HeliconeOrg;               // current org (selected via currentOrgId cookie)
  role: "admin" | "owner" | "member";
};
```

### 3.2 `web/packages/common/toImplement/server/authentikAuthClientFromSSRContext.ts`

The SSR counterpart needs to:
1. Parse `__Secure-clyffy-observatory-session` cookie from `ctx.req`.
2. Decrypt with `SESSION_ENCRYPTION_KEY` (AES-256-GCM).
3. The decrypted blob is `{ accessToken, refreshToken, expiresAt, sub, currentOrgId }`.
4. If `expiresAt` ≤ now, transparently call `/api/auth/authentik/refresh` server-side.
5. Validate `accessToken` against JWKS (one shared module-scope cache).
6. Look up user + org via Postgres (same SQL as BetterAuthWrapper / SupabaseAuthWrapper).
7. Return a HeliconeAuthClient bound to the validated session.

Implementation can largely mirror `useBetterAuthClient.ts` server-side variant.

### 3.3 `valhalla/jawn/src/packages/common/toImplement/server/AuthentikAuthWrapper.ts`

Two paths within `authenticate()`:

**Path A — `sk-helicone-*` bearer** (already correct in stub):
```ts
if (auth._type === "bearer" && auth.token.startsWith("sk-helicone")) {
  return authenticateBearer(auth);  // unchanged Helicone path
}
```

**Path B — OIDC JWT** (TODO):
```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const jwks = createRemoteJWKSet(new URL(env.AUTHENTIK_JWKS_URI), {
  cacheMaxAge: 60 * 60 * 1000,
});

const { payload } = await jwtVerify(token, jwks, {
  issuer: env.AUTHENTIK_ISSUER,
  audience: env.AUTHENTIK_CLIENT_ID,  // "observatory-ui"
});

// payload now has: sub, email, groups, realm, namespace_id, acr, amr, policy_version
const sub = payload.sub!;
const groups = (payload.groups as string[]) ?? [];

// Resolve user_id from public.user (provision row if absent — first login).
const user = await db.query(
  "SELECT id, email FROM public.user WHERE id = $1",
  [sub],
);
if (user.rows.length === 0) {
  await db.query(
    "INSERT INTO public.user (id, email) VALUES ($1, $2)",
    [sub, payload.email],
  );
}

// Resolve organizationId — prefer auth.orgId (if JwtAuth shape carries it),
// else first-listed org membership.
const orgId = (auth as JwtAuth).orgId ?? (await firstOrgFor(sub));

// Map groups → org_role.
const role: Role =
  groups.includes(env.AUTHENTIK_ADMIN_GROUP ?? "observatory:admin")
    ? "admin"
    : groups.includes("observatory:write")
    ? "owner"
    : "member";

return ok({ organizationId: orgId, userId: sub, role });
```

`getOrganization` / `getUserByEmail` / `getUserById`: copy verbatim from
BetterAuthWrapper — same Postgres queries.

`getUser(auth)`: validate JWT + return `{ email: payload.email, id: payload.sub }`.

`createUser(...)`: returns "not_supported" — Authentik IS the user store; users
created via the Authentik admin UI / SCIM provisioning. This method exists for
upstream-compat only.

### 3.4 `web/app/api/auth/authentik/[action]/route.ts`

Five concrete actions to implement:

#### 3.4.1 `GET /api/auth/authentik/login`

```ts
import { Issuer, generators } from "openid-client";

const issuer = await Issuer.discover(env.AUTHENTIK_ISSUER);
const client = new issuer.Client({
  client_id: env.AUTHENTIK_CLIENT_ID,
  redirect_uris: [env.AUTHENTIK_REDIRECT_URI],
  response_types: ["code"],
  token_endpoint_auth_method: "none", // public client
});

const code_verifier = generators.codeVerifier();
const state         = generators.state();
const code_challenge = generators.codeChallenge(code_verifier);

// Store verifier+state in a signed short-lived cookie.
const pkceCookie = encryptCookie({ code_verifier, state, returnTo: req.nextUrl.searchParams.get("return_to") ?? "/" });
const res = NextResponse.redirect(
  client.authorizationUrl({
    scope: "openid profile email groups clyffy:operate observatory:read observatory:write observatory:admin",
    code_challenge,
    code_challenge_method: "S256",
    state,
  }),
);
res.cookies.set("clyffy-pkce", pkceCookie, {
  httpOnly: true, secure: true, sameSite: "lax", maxAge: 300,
});
return res;
```

#### 3.4.2 `GET /api/auth/authentik/callback?code=...&state=...`

```ts
const pkce = decryptCookie(req.cookies.get("clyffy-pkce")?.value);
if (!pkce || pkce.state !== req.nextUrl.searchParams.get("state")) {
  return NextResponse.json({ error: "state_mismatch" }, { status: 400 });
}

const tokenSet = await client.callback(
  env.AUTHENTIK_REDIRECT_URI,
  { code: req.nextUrl.searchParams.get("code"), state: pkce.state },
  { code_verifier: pkce.code_verifier, state: pkce.state },
);

// tokenSet has: access_token, id_token, refresh_token, expires_at.
const claims = tokenSet.claims();  // verified id_token

// Provision/sync user row.
await provisionUser(claims.sub, claims.email);

// Sync organization_member from groups claim.
await syncMembership(claims.sub, claims.groups);

// Set encrypted session cookie.
const sessionBlob = await encryptSession({
  accessToken: tokenSet.access_token,
  refreshToken: tokenSet.refresh_token,
  expiresAt:   tokenSet.expires_at,
  sub:         claims.sub,
  currentOrgId: firstOrgFor(claims.sub),
});
const res = NextResponse.redirect(new URL(pkce.returnTo, req.url));
res.cookies.set("__Secure-clyffy-observatory-session", sessionBlob, {
  httpOnly: true, secure: true, sameSite: "strict",
  maxAge: 60 * 60 * 24 * 7,  // 7 days; refresh token rotates
});
res.cookies.delete("clyffy-pkce");
return res;
```

#### 3.4.3 `GET|POST /api/auth/authentik/logout`

```ts
const res = NextResponse.redirect(env.AUTHENTIK_END_SESSION_URL);
res.cookies.delete("__Secure-clyffy-observatory-session");
res.cookies.delete("currentOrgId");
return res;
```

#### 3.4.4 `GET /api/auth/authentik/me`

```ts
const session = await readSession(req);
if (!session) return new NextResponse(null, { status: 401 });

const userRow = await db.query(
  "SELECT id, email FROM public.user WHERE id = $1",
  [session.sub],
);
const orgRow = await db.query(
  `SELECT o.*, om.org_role as role
   FROM organization o
   LEFT JOIN organization_member om ON om.organization = o.id
   WHERE o.id = $1 AND om.member = $2`,
  [session.currentOrgId, session.sub],
);

return NextResponse.json({
  user: { id: userRow.rows[0].id, email: userRow.rows[0].email },
  org:  orgRow.rows[0],
  role: orgRow.rows[0].role,
});
```

#### 3.4.5 `POST /api/auth/authentik/refresh`

```ts
const session = await readSession(req);
if (!session) return new NextResponse(null, { status: 401 });

const newTokens = await client.refresh(session.refreshToken);
const res = new NextResponse(null, { status: 204 });
res.cookies.set(
  "__Secure-clyffy-observatory-session",
  await encryptSession({
    accessToken: newTokens.access_token,
    refreshToken: newTokens.refresh_token ?? session.refreshToken,
    expiresAt: newTokens.expires_at,
    sub: session.sub,
    currentOrgId: session.currentOrgId,
  }),
  { httpOnly: true, secure: true, sameSite: "strict", maxAge: 60 * 60 * 24 * 7 },
);
return res;
```

### 3.5 Kill cloud redirects at the source

In `web/pages/signin.tsx` and `web/pages/signup.tsx`, **delete the entire
`getServerSideProps` block**. The page will no longer redirect to
`us.helicone.ai/signin`. Replace with a redirect to `/api/auth/authentik/login`
when `AUTH_PROVIDER=authentik`:

```tsx
export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (process.env.AUTH_PROVIDER === "authentik") {
    return {
      redirect: { destination: "/api/auth/authentik/login", permanent: false },
    };
  }
  return { props: {} };
}
```

### 3.6 Helper modules to create

```
web/lib/authentik/
├── config.ts          — reads env vars, validates shape
├── jwks.ts            — module-scope JWKS cache
├── cookies.ts         — encryptSession / decryptSession (AES-256-GCM)
├── client.ts          — openid-client wrapper (Issuer.discover cached)
└── user-sync.ts       — provisionUser, syncMembership, firstOrgFor
```

These are pure modules; tests can mock the JWKS and assert behavior.

## 4. docker-compose env for LXC 113

Start from upstream `docker/.env.example`. Override:

```env
# ---- Auth provider (ADR 0024)
AUTH_PROVIDER=authentik
NEXT_PUBLIC_BETTER_AUTH=false   # explicitly disable upstream auth

# ---- Authentik OIDC (per Phase A provisioning)
AUTHENTIK_ISSUER=https://10.0.0.103:9443/application/o/observatory-ui/
AUTHENTIK_CLIENT_ID=observatory-ui
AUTHENTIK_REDIRECT_URI=http://10.0.0.113:3000/api/auth/authentik/callback
AUTHENTIK_JWKS_URI=https://10.0.0.103:9443/application/o/observatory-ui/jwks/
AUTHENTIK_AUTHORIZE_URL=https://10.0.0.103:9443/application/o/authorize/
AUTHENTIK_TOKEN_URL=https://10.0.0.103:9443/application/o/token/
AUTHENTIK_END_SESSION_URL=https://10.0.0.103:9443/application/o/observatory-ui/end-session/
AUTHENTIK_GROUP_CLAIM=groups
AUTHENTIK_ADMIN_GROUP=observatory:admin
AUTHENTIK_OWNER_GROUP=observatory:write

# ---- Session cookie encryption (rotate via cron, ADR 0024 §5)
SESSION_ENCRYPTION_KEY=<openssl rand -hex 32>

# ---- Backward compat (upstream Helicone still requires these)
NEXT_PUBLIC_APP_URL=http://10.0.0.113:3000
DATABASE_URL=postgres://helicone:<gen>@db:5432/helicone_test
SUPABASE_DATABASE_URL=${DATABASE_URL}   # legacy; reused by Jawn
```

For prod (when we have observatory.effing.ai):
```env
NEXT_PUBLIC_APP_URL=https://observatory.effing.ai
AUTHENTIK_REDIRECT_URI=https://observatory.effing.ai/api/auth/authentik/callback
```

## 5. Deploy on LXC 113 (`observatory`)

LXC 113 is provisioned with Docker + nesting=1. Deployment steps:

```bash
# On operator's workstation:
cd D:/localdev/observatory
git checkout authentik-oidc
docker build -t observatory-web:phaseb -f docker/dockerfiles/dockerfile_web .
docker build -t observatory-jawn:phaseb -f valhalla/dockerfile .

# Ship the docker-compose stack to LXC 113:
ssh server1 'pct exec 113 -- mkdir -p /opt/observatory'
scp docker/docker-compose.yml docker/.env server1:/tmp/
ssh server1 'pct push 113 /tmp/docker-compose.yml /opt/observatory/docker-compose.yml'
ssh server1 'pct push 113 /tmp/.env /opt/observatory/.env'
ssh server1 'pct exec 113 -- bash -c "cd /opt/observatory && docker compose --profile include-helicone up -d"'
```

Smoke test:
```bash
curl -sf http://10.0.0.113:3000/                            # 200 OK (signin page)
curl -sf http://10.0.0.113:3000/api/auth/authentik/me       # 401 (no session yet)
curl -sf http://10.0.0.113:3000/api/auth/authentik/login    # 302 to Authentik
# Browser flow: visit http://10.0.0.113:3000/signin → redirected to Authentik → passkey → back → see dashboard.
```

## 6. Wire clyffy-go to point at observatory

`orchestrator/internal/llm/helicone.go` already has the Helicone driver
(Apache 2.0 fork conceptually; our config points at our LXC 113). Update:

```go
// internal/config/config.go — already correct since 99df215.
//   CLYFFY_HELICONE_URL=http://10.0.0.113:8585      (Jawn API)
//   CLYFFY_HELICONE_API_KEY=sk-helicone-...         (minted via observatory UI)
```

Operator mints the `sk-helicone-*` ingest API key via observatory's UI → Settings
→ API Keys, drops to Infisical as `HELICONE_API_KEY_MASTER` (legacy env name
preserved — see `scripts/dev/load-env.sh §6b`). On next clyffy-master boot the
helicone-gateway capability comes online and traces flow.

(Rename to `OBSERVATORY_*` env vars is parking-lot — not blocking.)

## 7. Phase B test plan

- [ ] T1 `npx tsc --noEmit` in `web/` passes (stubs are type-correct).
- [ ] T2 `npx tsc --noEmit` in `valhalla/jawn/` passes.
- [ ] T3 `docker compose --profile include-helicone up -d` reaches healthy state on LXC 113.
- [ ] T4 `GET /api/auth/authentik/login` returns 302 to Authentik authorize URL with code_challenge present.
- [ ] T5 Browser passkey flow completes round-trip, session cookie set.
- [ ] T6 `GET /api/auth/authentik/me` returns `{user, org, role}` after sign-in.
- [ ] T7 Dashboard renders without "you must sign in" prompt.
- [ ] T8 Mint a `sk-helicone-*` API key via UI → key visible in Postgres `helicone_api_keys`.
- [ ] T9 Bifrost PostHook plugin (clyffy-go side) posts a trace to `http://10.0.0.113:8585/v1/chat/completions` carrying `Helicone-Auth: Bearer sk-helicone-...` → trace lands in ClickHouse, visible in observatory UI.
- [ ] T10 Property tag `namespace_id=clyffy.master` filters correctly in the trace explorer.

## 8. Out of scope (Phase B → Phase D)

- **DPoP enforcement** — ADR 0024 §3 specifies DPoP; Authentik 2025.10 doesn't ship native DPoP. We ship plain bearer + encrypted cookie now; add DPoP middleware in Phase D when Authentik 2025.12 lands or we implement client-side ourselves.
- **`pam_authentik_webauthn.so`** — Phase D.
- **Federation peer auth (RFC 9421)** — Phase C.
- **`clyffy-cli` device flow** — Phase C.

## 9. Reversibility

If something fails in Phase B and we need to roll back:

- Stay on `authentik-oidc` branch; don't merge to `main` until smoke tests pass.
- Upstream Helicone code paths are unchanged — flip `AUTH_PROVIDER` away from
  `authentik` and the legacy better-auth flow returns (with cloud redirect; not
  fit for prod but works for dev).
- The 7 better-auth files are NOT deleted in this branch (operator can still
  fall back). Cleanup to delete them lands in a focused follow-up commit once
  the Authentik path is validated end-to-end.

## 10. Sign-off checkpoint

When all of §7 passes, mark this doc as ✅ DONE, merge `authentik-oidc` → `main`,
tag `v0.1.0-authentik-1`, and update wardenclyffe `docs/foundation-status.md`
to flip Phase B from in-progress to ✅.
