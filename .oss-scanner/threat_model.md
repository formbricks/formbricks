# Threat model — Formbricks

## What the project is

Formbricks is an experience-management platform: a Next.js web app
(`apps/web`), a deployment-check app (`apps/deployment-check`), and shared
packages (`packages/*`). It is deployed self-hosted or as Formbricks Cloud. One
instance serves many organizations ("workspaces"): each organization has an
owner, managers, members and a billing role; each workspace holds surveys,
contacts, responses, segments, actions, integrations, API keys and members.

The application is multi-tenant. The **workspace/organization is the tenant
boundary**, and the database, Redis, S3-compatible storage and SpiceDB (AuthZed)
are shared by every tenant.

## Where untrusted input enters

Treat all of the following as adversarial:

- **Public survey runtime** — link surveys (`/s/[surveyId]`, legacy `/p/[slug]`,
  contact links `/c/[jwt]`) and the JS SDK / client API (`/api/client/*`,
  `/api/v1/client/*`, `apps/web/public/js`). Anonymous visitors submit
  responses, hidden fields, file uploads and arbitrary values with no login.
- **Public REST APIs** — `/api/v1`, `/api/v2`, `/api/v3`, authenticated with
  workspace API keys. The key is a credential, but every request body, query
  parameter, header and path segment is still attacker-controlled.
- **Auth and identity surfaces** — credentials and sessions (Better Auth),
  OAuth/OIDC callbacks, SAML assertions (EE), email verification, password
  reset, invite links, 2FA (EE), and the MCP OAuth endpoints
  (`/.well-known/oauth-*`, `/api/mcp`).
- **Stored tenant content** — survey definitions and logic, rich text and
  branding, response values, contact attributes, uploaded files and feedback
  records. A stored XSS that executes in another user's or another workspace's
  browser session is in scope.
- **Outbound requests and credentials** — webhook URLs, integration endpoints
  (Google Sheets, Slack, etc.), S3-compatible storage configuration, AI provider
  URLs, and any URL the server fetches on a user's behalf (SSRF).
- **Request metadata** — client IP, geo headers, `X-Forwarded-*`, `Host`;
  deployments sit behind arbitrary reverse proxies and TLS terminators.

## Components that matter most

- `apps/web/app/api/**` — v1/v2/v3, client and internal route handlers, auth
  checks, rate limiting, audit logging.
- `apps/web/app/(auth)/**` and `apps/web/modules/auth/**` — sign-in, sessions,
  OAuth.
- Public survey routes (`app/s`, `app/c`, `app/p`) and `packages/surveys`,
  `packages/survey-ui`, `packages/js-core` — rendering and response handling.
- `apps/web/lib/**` — workspace auth, API-key auth, membership and SpiceDB
  authorization, storage and env validation.
- `packages/database` — Prisma schema and queries; tenant scoping belongs in
  every query.
- `apps/web/modules/ee/**` — SSO/SAML, two-factor auth, role management,
  workflows, audit logs, licence checks.
- `packages/storage`, `packages/ai`, `packages/jobs`, `packages/workflows` —
  file handling, model calls, background jobs.

Lower priority (still in scope, but rate findings accordingly): `apps/storybook`,
`apps/deployment-check`, `docker/`, `charts/`, `docs/`, `scripts/`, generated
Prisma output, translations and test fixtures.

## How to exercise it

- Dependencies are installed and the library packages are built, including the Prisma
  client and the survey/JS bundles. The web app is audited from source: its production
  `next build` needs more than 8 GB and is deliberately not part of the image.
- Run unit tests with `pnpm --filter <package> test`, for example
  `pnpm --filter @formbricks/web test`.
- The stack cannot be started offline: Postgres, Redis, SpiceDB and an S3
  endpoint are not available inside the scanner. Do not report "cannot connect
  to <service>" as a vulnerability, and do not assume E2E/integration tests can
  run. Reason from source and prove findings with focused unit tests where
  possible.

## How we rate severity

Assume the default self-hosted or Cloud deployment, reachable from the
internet, with more than one tenant on the instance.

- **Critical** — unauthenticated RCE; authentication bypass that yields another
  user's session; cross-tenant access to responses/PII at scale; SQL injection
  with data exfiltration; arbitrary file read/write outside the intended upload
  scope; a public survey endpoint that lets an anonymous attacker take over a
  workspace.
- **High** — cross-workspace IDOR or data leak; privilege escalation to
  organization owner/manager; authenticated RCE; SSRF reaching internal
  services or cloud metadata; stored XSS in another user's admin session;
  disclosure of API keys, secrets or session tokens; account takeover through
  auth logic.
- **Medium** — same-tenant IDOR between roles; stored XSS whose impact stays
  inside the attacker's own session/workspace; CSRF on state-changing actions;
  open redirect; rate-limit bypass enabling response or invitation spam;
  authenticated DoS.
- **Low** — information disclosure without sensitive data; self-XSS; missing
  security headers; DoS from a single anonymous request with no amplification;
  issues that only exist in dev-only packages or test fixtures.

Do not inflate severity based on a hypothetical misconfiguration. State the
attacker's starting position explicitly (anonymous, workspace member, workspace
admin, instance admin). A finding that requires the instance admin or database
owner to be malicious is not a vulnerability.

## Out of scope

- Vulnerabilities that live only in third-party dependencies. Report them only
  when Formbricks's own code misuses the dependency in a way that creates the
  issue.
- Generated code (`packages/database/generated`, generated Zod schemas, build
  outputs) and vendored/third-party assets.
- Infrastructure or deployment misconfiguration of a specific installation
  (Helm values, cloud IAM, reverse-proxy or TLS settings) unless the repository
  enables it by default.
- Findings that require control of the server, database, Redis, SpiceDB or S3
  credentials, or that only reproduce with `NODE_ENV=development` and debug
  tooling enabled.
- Cosmetic issues, missing best-practice headers without a demonstrated impact,
  and dependency-version bumps with no reachable vulnerability.
