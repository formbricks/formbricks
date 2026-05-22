# Security

## Overview

Formbricks runs as a multi-tenant, self-hostable Experience Management platform that handles user PII (responses, contact attributes, emails) and integrates with third-party services (OAuth providers, payment processors, email senders, S3-compatible storage, AI providers). The security posture is **privacy-first, self-host-friendly, defense-in-depth**: every layer — runtime CSP, app authentication, database row scoping, secret handling, supply chain — has a deliberate policy.

This document is the workbench's durable security blueprint. The **canonical public security policy** is [`SECURITY.md`](../../SECURITY.md) at the repo root; vulnerability disclosure goes to `security@formbricks.com`. Operator-facing hardening is documented in [`docs/self-hosting/`](../../docs/self-hosting/).

## Goals

- **Protect respondent data above everything else.** Survey responses contain PII the respondent did not opt into sharing with Formbricks-the-company; treat them like medical records. Self-hosting must be a first-class deployment.
- **Keep secrets out of source control, logs, and error reports.** Every required secret has a generator (`openssl rand -hex 32`) and an env-var name. Real values never enter the repo.
- **Make privileged actions explicit and auditable.** Org admins can grant, revoke, and audit access. The Enterprise audit log captures privileged events.
- **Resist privilege escalation by construction.** Org roles and team roles are tiered; managers cannot promote to manager, only owners can.
- **Fail safely under partial outage.** Hub unreachable → empty state, not crash. Rate limit hit → 429, not data loss. Webhook delivery failure → retried via BullMQ, not silently dropped.
- **Stay current with CVEs.** The `pnpm.overrides` block in the root `package.json` pins CVE-patched transitives ahead of upstream fixes; every override carries a comment with the upstream chain it's waiting on.

## Non-Goals

- **Not a managed security service.** Formbricks does not classify or redact respondent PII automatically. Customers are responsible for what they ask.
- **Not GDPR/HIPAA-compliance-in-a-box.** Self-hosting plus appropriate organizational controls is what makes compliance possible; the software alone does not certify a deployment.
- **Not network-perimeter security.** Formbricks does not ship a WAF, an SSL terminator, or DDoS protection. Run it behind your own.

## Trust Boundaries

| Boundary                                    | Inputs we trust                                                                | Inputs we do **not** trust                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Embedded survey runtime** (`#fbjs`)       | Workspace styling tokens from the API; the survey config served by Formbricks. | Host-page CSS, host-page JS, host-page DOM. Survey runtime scopes every selector to `#fbjs` and never globalizes.   |
| **Respondent submissions**                  | The user filled in the form.                                                   | Question text and answers contain HTML — pass through `isomorphic-dompurify` before render, strip inline `style`.   |
| **Browser / dashboard client**              | Authenticated session cookie.                                                  | URL params (`workspaceId`, `surveyId`, `responseId`); attribute payloads; HTML question content; file uploads.      |
| **Server / Next.js runtime**                | Code we wrote + locked deps in `pnpm-lock.yaml`.                               | Anything from the browser. Every server action validates input with zod, then enforces auth via `getWorkspaceAuth`. |
| **Database (Postgres + pgvector)**          | Prisma client writes only. Migrations land via `db:migrate:deploy`.            | Raw SQL from user input. Use Prisma + parameterized queries. Soft-deletes use `isActive` / `deletedAt`.             |
| **Redis / Valkey**                          | Cache reads (best-effort) and BullMQ job state.                                | Cache writes from unauthenticated paths. Never store secrets in Redis.                                              |
| **Hub service**                             | Authenticated by `HUB_API_KEY` shared secret.                                  | A reachable Hub. Failure mode is empty state + warn log, not crash.                                                 |
| **Cube semantic layer**                     | JWT signed with `CUBEJS_API_SECRET`, scoped to the requesting workspace.       | Direct cross-tenant queries — Formbricks signs a tenant-scoped JWT per request.                                     |
| **Third-party integrations**                | OAuth tokens we issued + verified.                                             | Webhook payloads (must validate signing secret), inbound OAuth callbacks (CSRF state token).                        |
| **AI providers (Bedrock / Azure / Vertex)** | Provider-issued credentials.                                                   | LLM output — never execute, never trust as a security decision. Filter prompts to avoid leaking PII.                |
| **S3-compatible storage**                   | Pre-signed POST URLs issued server-side.                                       | Direct uploads bypassing signature; mime sniffing on the server side via `Sharp` / `heic-convert`.                  |
| **Outbound webhooks**                       | Workspace-configured URL + secret.                                             | Targeting internal IPs by default — set `DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS=1` only on self-host you control.  |

## Secrets

- **Storage.** Real secrets live outside git: in `.env` (gitignored), in `docker-compose` env files, in the deployment platform's secret manager, or in a Helm `values` override file. The repo's `.env.example` carries placeholders only.
- **Generators.** Four boot secrets must be 32-byte hex strings: `ENCRYPTION_KEY`, `NEXTAUTH_SECRET`, `CRON_SECRET`, `CUBEJS_API_SECRET`. Generate each with `openssl rand -hex 32`. `pnpm dev:setup` does this automatically for dev.
- **Rotation.**
  - `NEXTAUTH_SECRET` — rotation logs every active user out. Acceptable in an incident; communicate first if scheduled.
  - `ENCRYPTION_KEY` — never rotate without a re-encryption migration. Loss = unrecoverable encrypted columns.
  - `CRON_SECRET` — rotate freely. Update cron job configs at the same time.
  - `HUB_API_KEY`, `CUBEJS_API_SECRET` — rotate as a pair on the dependent service.
  - OAuth client secrets — rotate per provider; updates are picked up at the next env reload.
- **Logging.** Never log full env values. `@formbricks/logger` redacts known sensitive keys; new sensitive fields must be added to the redaction list.
- **Exposure rules.** Vars prefixed `NEXT_PUBLIC_` are embedded into the client bundle by Next.js — never use that prefix for anything sensitive.

## Authentication

- **Engine.** [`next-auth@4.24.13`](../../patches/next-auth@4.24.13.patch) (patched) with the Prisma adapter.
- **Methods shipped:** credentials (bcrypt-hashed password), Google OAuth, GitHub OAuth, Azure AD OAuth, generic OIDC (EE), SAML via `@boxyhq/saml-jackson` (EE).
- **Passwords.** Hashed with `bcryptjs` 3.0. Reset tokens via `jsonwebtoken` (TTL controlled by `PASSWORD_RESET_TOKEN_LIFETIME_MINUTES`).
- **2FA.** TOTP + backup codes via `otplib` 12. Available on all plans; mandatory enrollment is at the org admin's discretion.
- **Session.** Cookies signed with `NEXTAUTH_SECRET`. Lifetime controlled by `SESSION_MAX_AGE`. Deactivated accounts (`user.isActive === false`) trigger a `ClientLogout` at next request.
- **OAuth callback security.** Every OAuth provider mounts under `WEBAPP_URL/api/auth/callback/<provider>`. Misconfiguring `NEXTAUTH_URL` breaks OAuth — and is the most common production misconfig.
- **SSO knobs.** `AUTH_SKIP_INVITE_FOR_SSO`, `AUTH_SSO_DEFAULT_TEAM_ID`, `DISABLE_ACCOUNT_DELETION_SSO_CONFIRMATION` — all security-sensitive; document any non-default value.

## Authorization

A three-tier permission model. Implemented across [`apps/web/modules/workspaces/lib/utils.ts`](../../apps/web/modules/workspaces/lib/utils.ts) and [`apps/web/lib/membership/`](../../apps/web/lib/membership/); enforced on every server action and page boundary.

1. **Organization role** (`owner` / `manager` / `billing` / `member`). Covers org-wide capabilities: billing, member management, deletion. Owners can promote to owner; managers can only invite as member — codified anti-privilege-escalation.
2. **Team role** (EE: `Team Admin` / `Team Contributor`). Granular access within a team's workspaces.
3. **Workspace permission** (EE: `Read` / `Read & Write` / `Manage`). Per-team, per-workspace. `Manage` is the only level that touches workspace settings, integrations, and API keys.

**Community Edition collapses all of the above into "everyone is Owner"** — appropriate for solo / small-team self-hosters but incompatible with multi-team usage.

Every server action must:

- Call `getWorkspaceAuth(workspaceId)` (or its org equivalent) before doing work.
- Branch on `isOwner` / `isManager` / `hasReadAccess` / `hasReadWriteAccess` / `hasManageAccess` — not on raw role strings.
- Validate input with a zod schema, then pass typed values to the service.
- Return `{ data }` or `{ error }` consistently (`next-safe-action` enforces this shape).

## Multi-tenancy

- **Scoping.** Every record either belongs to an Organization or a Workspace. Queries that don't filter by the caller's scope are bugs.
- **API keys** (`ApiKey`) are org-scoped but each carries an `ApiKeyWorkspace[]` list declaring which workspaces it can hit. Cross-workspace key reuse is opt-in, not default.
- **Cube JWTs** are signed per request with the tenant ID embedded — the semantic layer's row-level security depends on it.
- **`DEFAULT_ORGANIZATION_ID`** locks a single-tenant deployment; do not set it on multi-tenant cloud-style hosts.

## Data Protection

- **At rest.** Postgres holds the canonical data; encryption at rest depends on the deployment (managed Postgres or LUKS). Audit log entries are hashed with `ENCRYPTION_KEY`.
- **In transit.** Always behind TLS in production. `docs/self-hosting/configuration/custom-ssl.mdx` documents the cert story.
- **Encrypted columns.** Selected sensitive fields are encrypted application-side using `ENCRYPTION_KEY`. Losing the key permanently corrupts these columns.
- **Soft deletion.** Many models carry `isActive` or `deletedAt`. Filter every read accordingly — `findMany` without the filter leaks tombstones.
- **PII boundaries.** Contact emails, response text, file uploads are PII. Exports must respect role gating (only `Read & Write+` can download CSVs).
- **HTML sanitization.** User-authored question text, descriptions, and end screens flow through `isomorphic-dompurify` + `sanitize-html`. Inline `style` is stripped to prevent CSP / XSS bypass.
- **File uploads.** S3 pre-signed POST URLs are scoped to extension, size, and workspace. The server re-processes images through `Sharp` / `heic-convert` before serving.
- **Backups & deletion.** Per the [public Security Policy](../../SECURITY.md), customers control their data lifecycle. Self-hosters own their backups.

## Network & Webhooks

- **Outbound webhooks.** Workspace-scoped destinations. By default Formbricks blocks webhook URLs targeting RFC1918 / loopback addresses; `DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS=1` lifts that on self-host only.
- **Inbound webhooks.** Stripe events verify the `STRIPE_WEBHOOK_SECRET` signature before any DB write. OAuth callbacks verify CSRF state.
- **Rate limiting.** Redis-backed; controlled by `RATE_LIMITING_DISABLED` (dev) and per-route ceilings. Documented in [`docs/self-hosting/advanced/rate-limiting.mdx`](../../docs/self-hosting/advanced/rate-limiting.mdx).
- **CSP & security headers.** Configured in `next.config.mjs` / middleware. The runtime sets a CSP nonce via `formbricksSurveys.setNonce()` for stylesheets it injects.
- **Survey runtime CSS scoping.** Every runtime utility is scoped to `#fbjs` via Tailwind's `important: "#fbjs"` — prevents host-page bleed-out and bleed-in.

## Survey Runtime Specifics

- **Sandboxed by scope, not by iframe.** The runtime ships into the host page directly, scoped to `#fbjs`. CSP nonces propagate.
- **No inline `style` on user content.** Question HTML is sanitized; `style=""` is stripped before render. CSP-safe by construction.
- **reCAPTCHA / Turnstile.** Available per workspace for spam protection on link surveys. Configured via `RECAPTCHA_*` or `TURNSTILE_*`.
- **PIN / single-use / email-verified link surveys.** Available link-survey gating modes; document any change to these in `business-rules/`.

## Supply Chain

- **Lockfile.** `pnpm-lock.yaml` is the source of truth. Never run `pnpm install --no-frozen-lockfile` in CI/production.
- **`pnpm.overrides`.** Root `package.json` pins CVE-patched transitive deps ahead of upstream chains landing fixes. Each entry carries a `comments.overrides` block documenting the upstream chain to watch.
- **`patchedDependencies`.** `next-auth@4.24.13` is patched via `patches/next-auth@4.24.13.patch`. The patch must be reviewed on every next-auth bump.
- **GitHub Actions.** Per [`AGENTS.md`](../../AGENTS.md): always set minimal `permissions` for `GITHUB_TOKEN`; on `ubuntu-latest` add `step-security/harden-runner` as the first step.
- **SonarQube.** Runs on PRs to flag code smells and security hotspots.
- **Vulnerability disclosure.** Per repo-root [`SECURITY.md`](../../SECURITY.md): report to `security@formbricks.com`. Annual third-party pentest.

## Verification

- **Automated checks** that touch security-relevant code paths are listed in [`./CHECKS.md`](./CHECKS.md). At minimum, server-action changes require `pnpm typecheck && pnpm test`; auth-changing PRs add `pnpm test:e2e` for the affected flow.
- **Manual flows with security implications** belong in [`./MANUAL_QA.md`](./MANUAL_QA.md) — sign-up + 2FA enrollment, OAuth flows, invite + role change, billing flow, survey publish + response capture, webhook delivery, file upload.
- **Migration safety.** Every schema change ships with a forward + (where reasonable) reverse migration. Destructive migrations against tables with PII require an explicit data-handling decision documented in a `decisions/` ADR.
- **Compliance audits.** Track open audit findings in the org's internal tracker — not in this repo.

## Accessibility (related)

Accessibility is documented separately in [`ACCESSIBILITY.md`](../../ACCESSIBILITY.md). The intersection with security is real: focus traps in dialogs, keyboard-only auth flows, and password-input visibility toggles all carry security implications. Changes to either must consider the other.
