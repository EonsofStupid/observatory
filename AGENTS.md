---
# CLYFFY TOUCHPOINT v1 — intelligence-layer routing (ADR 0026)
clyffy_touchpoint:
  version: 1
  namespace_id: clyffy.master
  project_key: observatory-fork
  persona: clyffy-operator

  surreal:
    plane_a:
      url: http://10.0.0.104:8000
      ns: clyffy
      db: ai_memory

  audit:
    event_prefix: observatory
    enabled: true

  scopes:
    - clyffy:operate
    - observatory:read
    - observatory:write
    - observatory:admin

  capabilities:
    mcp_servers:
      - http://10.0.0.103:9090   # Auth-K (for OIDC client provisioning when wiring AUTH_PROVIDER=authentik)
    federation_peers:
      - clyffy.master
      - wardenclyffe.infra

  intel_hook:
    capture_chats: true
---

# Observatory — Agent Context (canonical)

This repository is the operator's **fork** of Helicone v2025.08.21-1
(commit `f74f255fa`, Apache 2.0). Living on `authentik-oidc` branch with
the Authentik OIDC swap in flight per ADR 0024 §7 + Sprint 2 of
`wardenclyffe/docs/poam.md`.

**Original Helicone CLAUDE.md is at `CLAUDE.md` in the repo root — that
file describes upstream Helicone's structure (web/jawn/worker/etc.).
This AGENTS.md is the OPERATOR FORK context — read this first.**

## Why this fork exists

Per `wardenclyffe/docs/decisions/0023-...` (when authored): Helicone
went into maintenance mode under Mintlify in March 2026. The all-in-one
Docker image redirects sign-in to `us.helicone.ai`. The operator forked
at `v2025.08.21-1` before the cloud-coupling tightened further.

What we kept verbatim:
- ClickHouse trace ingestion
- Postgres metadata
- `sk-helicone-*` API key minting (`valhalla/jawn/src/managers/apiKeys/`)
- RBAC (organization, organization_member tables)
- Trace explorer UI, cost dashboards

What we swap:
- better-auth → Authentik OIDC (see PHASE-B-IMPLEMENTATION.md)
- Cloud-redirect `getServerSideProps` in signin/signup pages → delete
- Stripe / Pylon / Segment cloud-only branches → strip

## Sprint 2 path (Phase B per ADR 0024 §7)

Status: **stubs in place** (commit `09d4afd0c`), full impl pending operator passkey enrolment.

Read `PHASE-B-IMPLEMENTATION.md` in this repo for the §-anchored work spec.

## Where intelligence lands

Every action by agents working in this repo audits to clyffy.ai_memory
.audit_log with event_type prefix `observatory.<action>` and
project_key=`observatory-fork`. The Master Clyffy UI's Observatory page
queries those rows.

## Deployment target

LXC 113 on server1 (renamed from clyffy-langfuse → observatory in foundation
work 2026-05-17). Awaiting Phase B impl complete + operator passkey ✅
before deploy.

## Reading order

1. `wardenclyffe/AGENTS.md` — estate-wide rules
2. `PHASE-B-IMPLEMENTATION.md` (this repo) — concrete work spec
3. `wardenclyffe/docs/decisions/0024-federated-identity-auth-architecture.md` §7 — auth swap details
4. `wardenclyffe/docs/specs/master-clyffy-architecture.md` — where observatory fits in the mesh
5. `CLAUDE.md` (this repo) — upstream Helicone structure reference (read for context, not for current architecture)
