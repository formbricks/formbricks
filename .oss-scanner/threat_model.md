# Threat model — Formbricks

## What the project is

Formbricks is an experience-management platform: a Next.js web app
(`apps/web`), a deployment-check app (`apps/deployment-check`), and shared
packages (`packages/*`). It is deployed self-hosted or as Formbricks Cloud.

One instance serves many **organizations**. Each organization contains one or
more **workspaces**; a workspace holds surveys, contacts, responses, segments,
actions, integrations, dashboards and stored files.

- A user's **organization role** is `owner`, `manager`, `member`, `billing` or
  `dashboard_viewer`. Owners and managers reach every workspace in the
  organization. `billing` (Formbricks Cloud only) sees the organization and
  manages its subscription, and never sees product data. `dashboard_viewer`
  reads a workspace's data only through dashboard-bound operations: the
  dashboards of workspaces its teams are assigned, a saved chart's data on
  them, and the filter value lists for keys some chart on the dashboard groups
  by. It never reaches the free-form chart query or field-value routes, and
  never reads surveys, responses, contacts or feedback records directly.
- `member` and `dashboard_viewer` reach a workspace only through a **team**. A
  team holds `read`, `readWrite` or `manage` on each workspace it is assigned,
  and a user's **team role** is `admin` or `contributor`.
- An **API key** holds `read`, `write` or `manage` on each workspace it
  lists, and optionally organization access-control `read` or `write`
  (organization members and their roles, teams and workspace-team
  assignments; API keys never reach invites).
- An **MCP OAuth client** acts for a user and never reaches more than that
  user can. Its grant further limits it to the organizations or workspaces it
  selects and to an access level per permission (an absent permission has no
  access), and the OAuth scopes the client was consented cap the grant.

The application is multi-tenant. **Both the organization and the workspace are
tenant boundaries**. A principal **reaches** an organization it belongs to
(for an API key, the organization that owns it) and, inside it, these
workspaces: an owner or manager, all of them; any other user except `billing`,
those one of their teams is assigned; an API key, those it lists; an MCP client, those its
user reaches. Reaching any other organization or workspace crosses a tenant
boundary. The
database, Redis, S3-compatible storage and SpiceDB (AuthZed) are shared by
every tenant. There is no in-app instance-admin role; whoever operates the
server is trusted.

## Where untrusted input enters

Treat all of the following as adversarial:

- **Public survey runtime** — link surveys (`/s/[surveyId]`, legacy `/p/[slug]`,
  contact links `/c/[jwt]`) and the JS SDK / client API (`/api/client/*`,
  `/api/v1/client/*`, `apps/web/public/js`). Anonymous visitors submit
  responses, hidden fields, file uploads and arbitrary values with no login.
- **Public REST APIs** — `/api/v1`, `/api/v2`, `/api/v3`, authenticated with
  workspace API keys. The key is a credential, but every request body, query
  parameter, header and path segment is still attacker-controlled.
- **App API** — `/api/internal/**` (what the web UI calls), the routes in
  the `apps/web/app/api/(internal)` group (survey exports, attachments,
  workspace integrations, organization usage) and the remaining server
  actions. Routes declare their auth in `withV3ApiWrapper`, except the
  gateway auth hooks (`envoy-auth`, `traefik-auth`) and the feedback CSV
  import, which check it in their own handlers. Most are
  `auth: "session"`: the caller can hold any organization role or team
  permission, and most role, team-permission and cross-workspace checks live
  here. The ones declared `auth: "none"` (sign-up, password reset,
  verification emails, link-survey PIN and email verification) are public
  endpoints and rated as such. Every body, query and path segment is
  attacker-controlled.
- **Auth and identity surfaces** — credentials and sessions (Better Auth),
  OAuth/OIDC callbacks, SAML assertions (EE), email verification, password
  reset, invite links, 2FA (EE), and the MCP OAuth endpoints
  (`/.well-known/oauth-*`, `/api/mcp`).
- **Stored tenant content** — survey definitions and logic, rich text and
  branding, response values, contact attributes, uploaded files and feedback
  records. A stored XSS that executes in another user's or another workspace's
  browser session is in scope.
- **Outbound requests and credentials** — webhook URLs, integration endpoints
  (Google Sheets, Slack, etc.), and any URL the server fetches on a user's
  behalf (SSRF). Storage and AI provider settings come from the operator's
  environment and are trusted.
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

Lower priority (still in scope, but rate findings accordingly):
`apps/deployment-check`, `docker/`, `charts/`, `docs/`, `scripts/`,
translations and test fixtures.

## How to exercise it

- Dependencies are installed and the library packages are built, including the Prisma
  client and the survey/JS bundles. The web app is audited from source: its production
  `next build` is not part of the image.
- Prove a finding with a focused unit test, for example
  `pnpm --filter @formbricks/web exec vitest run lib/membership/utils.test.ts`.
  Library suites run whole with `pnpm --filter <package> test`; the full
  `@formbricks/web` suite (about 1,700 files) is slow on a small machine.
- The stack cannot be started offline: Postgres, Redis, SpiceDB and an S3
  endpoint are not available inside the scanner. Do not report "cannot connect
  to <service>" as a vulnerability, and do not assume E2E/integration tests can
  run. Reason from source and prove findings with focused unit tests where
  possible.

## How we rate severity

Assume the default self-hosted or Cloud deployment, reachable from the
internet, with more than one tenant on the instance.

- **Critical** — unauthenticated RCE; taking over another user's account or
  session with no action from the victim; reading responses or PII of an
  organization the attacker chooses and does not belong to; SQL injection
  with data exfiltration; arbitrary file read/write outside the intended upload
  scope; a public survey endpoint that lets an anonymous attacker take over a
  workspace.
- **High** — IDOR or data leak into an organization or workspace the
  attacker does not reach (see "What the project is"); privilege escalation
  to organization owner/manager;
  authenticated RCE; SSRF reaching internal services or cloud metadata;
  stored XSS that runs in any other user's session;
  disclosure of API keys, secrets or session tokens; account takeover that
  needs an action from the victim (a click, opening a link); a request to a public endpoint (no account needed: link
  surveys, the client API, sign-in and other auth routes) that crashes the
  process, exhausts its memory or blocks it for other tenants.
- **Medium** — escalation between roles, team permissions, API-key
  permissions or MCP grant limits that stays within what the attacker
  reaches, short of owner/manager: for example a `read` team or key writing; `billing` reading
  product data of any workspace in its organization (Medium although billing
  reaches no workspace); `dashboard_viewer` reading raw responses in a
  workspace its team is assigned; an MCP client acting outside its grant's
  selection, access levels or consented scopes but within what its user
  reaches, including another organization its user belongs to. Stored XSS
  that only runs in the attacker's own session; CSRF on state-changing actions;
  open redirect; rate-limit bypass enabling response or invitation spam;
  authenticated DoS, including a crash or memory exhaustion that needs an
  account. Self-hosted sign-up is closed by default, and Formbricks Cloud
  blocks common free providers and known disposable domains at sign-up, so
  the attacker is a customer or a trial user.
- **Low** — information disclosure without sensitive data; self-XSS; missing
  security headers; an anonymous request that only slows its own response,
  with no crash, memory exhaustion or amplification;
  issues that only exist in dev-only packages or test fixtures.

Do not inflate severity based on a hypothetical misconfiguration. State the
attacker's starting position explicitly: anonymous, an organization role
(`owner`, `manager`, `member`, `billing`, `dashboard_viewer`), and for a
`member` or `dashboard_viewer` the team permission on the target workspace
(`read`, `readWrite`, `manage`); or an API key with its workspace and
organization permissions; or an MCP client with its grant (selection and
access levels) and consented scopes. A finding that requires the server
operator or database owner to be malicious is not a vulnerability.

## Out of scope

- Vulnerabilities that live only in third-party dependencies. Report them only
  when Formbricks's own code misuses the dependency in a way that creates the
  issue.
- This scanner setup itself (`.oss-scanner/`): its environment values are
  placeholders, not secrets.
- Generated code (`packages/database/generated`, build outputs) and
  vendored/third-party assets. The generated API v3 Zod schemas
  (`packages/api-v3-schemas`) stay in scope: they validate request input, so
  rate a gap in them by the route that uses them.
- Infrastructure or deployment misconfiguration of a specific installation
  (Helm values, cloud IAM, reverse-proxy or TLS settings) unless the repository
  enables it by default.
- Findings that require control of the server, database, Redis, SpiceDB or S3
  credentials, or that only reproduce with `NODE_ENV=development` and debug
  tooling enabled.
- Cosmetic issues, missing best-practice headers without a demonstrated impact,
  and dependency-version bumps with no reachable vulnerability.
