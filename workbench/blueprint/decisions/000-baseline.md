# Decision: Technology Baseline

| Field  | Value      |
| ------ | ---------- |
| Status | Accepted   |
| Date   | 2026-05-21 |
| Owner  | Platform   |

## Context

This decision records the technology picks Formbricks ships with today — engines, frameworks, libraries, services, and tooling. It is not an aspirational document. Every entry below is actually wired into the codebase as of this date (see references in `package.json` files and `docker/docker-compose.yml`).

The purpose is twofold:

1. Give new contributors and AI agents a one-shot map of "what runs Formbricks" without grepping a hundred `package.json` files.
2. Establish a baseline against which future change-of-stack decisions can be diffed. When a future ADR proposes "replace X with Y," it should reference an entry here.

Each item answers two questions: **what it is** and **what it does for Formbricks**. Versions are noted where they meaningfully constrain other choices (e.g., Tailwind v3 vs v4 picks split the dashboard and the runtime).

## Decision

### 1. Languages & Core Toolchain

| Pick                        | Version    | Purpose in Formbricks                                                                                                                                                |
| --------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TypeScript**              | 6+         | The only application language. Every package and app is TS-first. Strict mode across the workspace.                                                                  |
| **Node.js**                 | ≥18.x      | Runtime for the Next.js app, the worker, Vitest, build tooling. Production Docker image pins a single Node version.                                                  |
| **pnpm**                    | 10.32.1    | Package manager + workspace runner. Lockfile in `pnpm-lock.yaml`. `pnpm.overrides` block in root `package.json` pins CVE-patched transitive deps.                    |
| **Turborepo**               | 2.x        | Monorepo task orchestrator. `turbo.json` declares per-package build/test/lint/typecheck pipelines with cache. Used by every `pnpm <task>` at the root.               |
| **Vite**                    | 7.3.3      | Library build tool for everything that isn't a Next.js app — `@formbricks/surveys` (UMD + ESM), `@formbricks/js-core`, `@formbricks/storage`, `@formbricks/cache`, … |
| **Prettier**                | (lockfile) | The actual formatter run by `lint-staged` and `pnpm format`. (`oxfmt` is referenced in CHECKS.md as a future target but Prettier is the current source of truth.)    |
| **ESLint** + custom presets | —          | Static analysis. Shared config in [`packages/config-eslint/`](../../../packages/config-eslint/) applied to every package.                                            |
| **Husky** + **lint-staged** | 9 / 16     | Git hooks for pre-commit format/lint. `prepare` script installs Husky.                                                                                               |
| **tsx** / **jiti**          | —          | TS runners for scripts and config loading.                                                                                                                           |
| **cross-env** / **dotenv**  | —          | Cross-platform env handling for build/test scripts.                                                                                                                  |
| **SonarQube** (external)    | —          | Code-smell and security-hotspot analysis in CI. Referenced in [`AGENTS.md`](../../../AGENTS.md) and [`sonar-project.properties`](../../../sonar-project.properties). |

### 2. Web App Framework

| Pick                   | Version | Purpose                                                                                                                                                        |
| ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| **Next.js**            | 16.2.6  | The dashboard application at [`apps/web`](../../../apps/web/). App Router + React Server Components. Turbopack in dev (`next dev --turbopack`).                |
| **React**              | 19.2.6  | The UI runtime for the dashboard and the `@formbricks/survey-ui` library. RSC + Server Actions baked in.                                                       |
| **next-auth**          | 4.24.13 | Authentication: credentials, OAuth (Google/GitHub/Azure AD). Patched via `patches/next-auth@4.24.13.patch`. Uses Prisma adapter (`@next-auth/prisma-adapter`). |
| **next-safe-action**   | 8.1.10  | Type-safe Server Action wrapper. Every server action returns a `{ data }                                                                                       | { error }` shape, validated by zod schemas. |
| **@t3-oss/env-nextjs** | 0.13.11 | Schema-validated environment variables. Surfaces failures at boot rather than at first use.                                                                    |

### 3. Data Layer

| Pick                                      | Version           | Purpose                                                                                                                                                                          |
| ----------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL** (`pgvector/pgvector:pg18`) | 18                | Primary OLTP database. Uses the `pgvector` distribution to support embeddings for AI features. One DB serves both Formbricks and (optionally) the Hub service.                   |
| **Prisma**                                | 6.19.3            | ORM + migration tool. Schema-first at [`packages/database/schema.prisma`](../../../packages/database/schema.prisma). `prisma-json-types-generator` types JSON columns.           |
| **@prisma/instrumentation**               | 6.19.3            | OpenTelemetry instrumentation for Prisma queries.                                                                                                                                |
| **Redis / Valkey**                        | Valkey 7+ (image) | Cache, rate limiting, and audit-log buffer. Docker compose ships Valkey; the codebase talks to it via the `redis` 5.x client in [`@formbricks/cache`](../../../packages/cache/). |
| **BullMQ** + **ioredis**                  | 5.61 / 5.8        | Background job queue for [`@formbricks/jobs`](../../../packages/jobs/) — response delivery, follow-ups, integrations, scheduled tasks.                                           |
| **Cube.js**                               | v1.6.6            | Semantic layer for the analytics surface. Queried by the dashboard via `@cubejs-client/core` 1.6.6; deployed as a separate `cube` service in compose.                            |
| **@formbricks/hub**                       | 0.5.0 (SDK)       | Client for the external Hub service that owns Unify feedback records. Image `ghcr.io/formbricks/hub`; talks to its own Postgres (or shares the main one).                        |
| **@paralleldrive/cuid2**                  | 2.3.1             | Collision-resistant string IDs for new records (where Prisma `@default(cuid())` is the standard).                                                                                |

### 4. Validation & API Contracts

| Pick                              | Version | Purpose                                                                                                               |
| --------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| **Zod**                           | 4.3.6   | Runtime validation for every server action input, env var, API request, and (most) DB write path.                     |
| **@hookform/resolvers**           | 5.2.2   | Bridges zod schemas into `react-hook-form`. The standard form validation pattern in the dashboard.                    |
| **zod-openapi**                   | 5.4.6   | Generates OpenAPI specs from the same zod schemas the server actions validate against. Specs end up in `openapi.yml`. |
| **@formbricks/types** (workspace) | —       | Shared zod schemas + TS types across packages. The runtime, the SDK, and the API agree because they import from here. |

### 5. Dashboard UI

UI primitives live in [`apps/web/modules/ui/components/`](../../../apps/web/modules/ui/components/). Design rules in [`workbench/blueprint/guidelines/design-guidelines-dashboard.md`](../guidelines/design-guidelines-dashboard.md).

| Pick                                | Version   | Purpose                                                                                                                                                |
| ----------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tailwind CSS**                    | 3.4.19    | Utility styling for the dashboard. JS config in [`apps/web/tailwind.config.js`](../../../apps/web/tailwind.config.js). _Not v4 — the runtime uses v4._ |
| **shadcn/ui** (new-york)            | —         | Component generator on top of Radix. `apps/web/components.json` configures the codemod. Components are owned in-repo, not imported.                    |
| **Radix UI**                        | 1.x–2.x   | Headless primitives: dialog, popover, dropdown, tabs, tooltip, slider, switch, select, radio-group, checkbox, label, separator, slot, collapsible.     |
| **@tailwindcss/forms / typography** | 0.5       | Tailwind plugins for form-control reset and rich text styling.                                                                                         |
| **tailwindcss-animate**             | 1.0.7     | Animation utility classes for Radix/shadcn state transitions.                                                                                          |
| **Lucide React**                    | 0.577.0   | The icon set. Outlined, 1.5px stroke. Used everywhere except a small bespoke icon set in the runtime.                                                  |
| **class-variance-authority**        | 0.7.1     | Variant-driven className generation. Backs `Button`, `Alert`, `Sidebar`, etc.                                                                          |
| **clsx** / **tailwind-merge**       | 2.1 / 3.5 | Standard class-name composer (`cn`). Used everywhere.                                                                                                  |

### 6. Dashboard Data & Interaction Libraries

| Pick                                              | Version           | Purpose                                                                                                                                   |
| ------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **TanStack Query**                                | 5.99.2            | Client-side data fetching + caching for any non-RSC data. Used sparingly — RSC is the default.                                            |
| **TanStack Table**                                | 8.21.3            | Headless table primitive behind the dashboard's response, survey, and contact tables. Toolbar/header/selection wrappers in `data-table/`. |
| **React Hook Form**                               | 7.71.2            | Form state engine. Always paired with zod via the `Form` bridge.                                                                          |
| **Lexical** + plugins                             | 0.41.0            | Rich-text editor for headlines, descriptions, end screens, and email follow-ups. (Migrated from / on top of `cal.com`'s editor.)          |
| **Recharts**                                      | 2.15.3            | Chart rendering. Backs the `Chart` wrapper and the Dashboards surface.                                                                    |
| **react-grid-layout**                             | 2.2.2             | Draggable / resizable widget grid for `Dashboard` layouts.                                                                                |
| **@dnd-kit/\***                                   | 6 / 9 / 10        | Drag-and-drop for the survey block editor (`BlocksDroppable`) and ranking question authoring.                                             |
| **@formkit/auto-animate**                         | 0.9.0             | One-liner reorder animations for lists (editor blocks, conditions editor, ranking).                                                       |
| **framer-motion**                                 | 12.35.2           | Used only in survey preview surfaces (`PreviewSurvey`, `ThemeStylingPreviewSurvey`) for card-stack animation.                             |
| **cmdk**                                          | 1.1.1             | Command-palette primitive. Powers the search / quick-action UI.                                                                           |
| **react-hot-toast**                               | 2.6.0             | Toast notifications. The only toast library — do not introduce `sonner`.                                                                  |
| **react-day-picker** + **react-calendar**         | 9.14 / 6.0        | Date picker primitive and calendar surface.                                                                                               |
| **date-fns**                                      | 4.1.0             | Date math and locale-aware formatting. Default across the codebase.                                                                       |
| **react-colorful**                                | 5.6.2             | Hex / HSL color picker — used in the survey styling settings.                                                                             |
| **boring-avatars**                                | 2.0.4             | Generated avatars for users (`bauhaus` variant) and contacts (`beam` variant).                                                            |
| **isomorphic-dompurify** + **sanitize-html**      | 3.9 / 2.17        | HTML sanitization for user-authored question text, descriptions, and embedded content.                                                    |
| **markdown-it** + **prismjs**                     | 14.1 / 1.30       | Markdown rendering and code highlighting in the docs/code-block surfaces.                                                                 |
| **react-confetti**                                | 6.4.0             | The celebratory confetti burst on onboarding / first-response moments.                                                                    |
| **qr-code-styling** + **qrcode**                  | 1.9 / 1.5         | QR-code generation for link survey distribution.                                                                                          |
| **react-i18next** + **i18next** + **i18next-icu** | 16.5 / 25.8 / 2.4 | Translation runtime. Locale files under `apps/web/locales/`.                                                                              |
| **lingo.dev**                                     | (CLI)             | Translation tooling — `pnpm i18n:web:generate` and `pnpm i18n:surveys:generate` call its CLI.                                             |

### 7. Survey Runtime (`@formbricks/surveys` + `@formbricks/survey-ui`)

The embedded surveys end-users actually answer. Two packages, two React flavors. Design rules in [`workbench/blueprint/guidelines/design-guidelines-survey-runtime.md`](../guidelines/design-guidelines-survey-runtime.md).

| Pick                                        | Version     | Purpose                                                                                                                                                           |
| ------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preact**                                  | 10.29.1     | The host runtime in [`@formbricks/surveys`](../../../packages/surveys/). Small bundle, fast paint, scoped to `#fbjs` to avoid host-page CSS bleed.                |
| **React 19**                                | 19.2.6      | The component library in [`@formbricks/survey-ui`](../../../packages/survey-ui/). Same React as the dashboard so previews are real.                               |
| **Tailwind CSS v4**                         | 4.2.4       | _Survey-side only._ CSS-based config (`@theme` / `@config`) in [`packages/survey-ui/src/styles/globals.css`](../../../packages/survey-ui/src/styles/globals.css). |
| **Radix UI** (same primitives as dashboard) | 1.x         | Themed via `--fb-*` CSS variables so every embedder's brand color drives the visible surface.                                                                     |
| **Lucide React**                            | 0.577.0     | Icon set inside `@formbricks/survey-ui`. (`@formbricks/surveys` ships a small bespoke SVG set for chrome icons that need to inherit brand color.)                 |
| **react-day-picker** + **date-fns**         | 9.14 / 4.1  | Date question type renderer.                                                                                                                                      |
| **react-i18next** + **i18next**             | 16.5 / 25.8 | Runtime translation. Locales in [`packages/surveys/locales/`](../../../packages/surveys/locales/).                                                                |
| **isomorphic-dompurify**                    | 3.9.0       | Sanitizes HTML in question headlines/descriptions. Strips inline `style` for CSP safety.                                                                          |
| **@formkit/auto-animate**                   | 0.9.0       | Ranking reorder animations.                                                                                                                                       |

### 8. Embeddable SDK (`@formbricks/js-core`)

| Pick                                    | Version   | Purpose                                                                                                                                                                |
| --------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **@formbricks/js-core**                 | workspace | The single JS SDK customers install on their site or app. Bundles to UMD + ESM via Vite. Output copied to `apps/web/public/js/` and served from the Formbricks domain. |
| **React Native** (peer)                 | —         | The SDK exposes a React Native binding for the in-app survey flow on mobile.                                                                                           |
| **`formbricksSurveys`** (window global) | —         | The bridge between `js-core` and `@formbricks/surveys` — the runtime publishes `renderSurvey` / `renderSurveyInline` / `renderSurveyModal` on `window`.                |

### 9. Storage, Files & Media

| Pick                                                                                                 | Version   | Purpose                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **AWS S3 SDK** (`@aws-sdk/client-s3`, `@aws-sdk/s3-presigned-post`, `@aws-sdk/s3-request-presigner`) | 3.1007    | Object storage for survey uploads, custom theme assets, organization logos. S3-compatible (works with Cloud + RustFS for self-host). |
| **RustFS**                                                                                           | (Docker)  | Default self-hosted S3-compatible store shipped with the docker-compose stack.                                                       |
| **Sharp**                                                                                            | 0.34.5    | Image resizing and format conversion server-side.                                                                                    |
| **heic-convert**                                                                                     | 2.1.0     | iPhone HEIC → JPEG conversion for file uploads.                                                                                      |
| **xlsx** (vendored)                                                                                  | 0.20.3    | Excel export — vendored as a tarball under [`apps/web/vendor/`](../../../apps/web/vendor/) to pin a known-good build.                |
| **papaparse** + **csv-parse**                                                                        | 5.5 / 6.1 | CSV parsing (responses, contact uploads, Unify CSV connectors).                                                                      |
| **@json2csv/node**                                                                                   | 7.0.6     | CSV writing for response exports.                                                                                                    |

### 10. Email

| Pick                                          | Version   | Purpose                                                                                                                          |
| --------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **nodemailer**                                | 8.0.7     | The actual SMTP / SES sender used by [`@formbricks/email`](../../../packages/email/) and the email-followups feature.            |
| **react-email** + **@react-email/components** | 5.2 / 1.0 | Email template authoring (React components → MJML-style HTML) and the email preview server (`pnpm dev` inside `packages/email`). |

### 11. Authentication & Security

| Pick                                         | Version    | Purpose                                                                                                           |
| -------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| **next-auth**                                | 4.24.13    | Session + OAuth + credentials. Patched (`patches/next-auth@4.24.13.patch`) for behavior fixes.                    |
| **@boxyhq/saml-jackson**                     | 26.2.0     | SAML / OIDC SSO (Enterprise). Self-hosted SSO surface.                                                            |
| **bcryptjs**                                 | 3.0.3      | Password hashing.                                                                                                 |
| **otplib**                                   | 12.0.1     | TOTP-based two-factor authentication.                                                                             |
| **jsonwebtoken**                             | 9.0.3      | Signed tokens for password reset, email verification, single-use links, Cube.js JWTs.                             |
| **react-turnstile**                          | 1.1.5      | Cloudflare Turnstile widget for spam protection on link surveys.                                                  |
| **isomorphic-dompurify** / **sanitize-html** | 3.9 / 2.17 | XSS defense across user-authored HTML and rich-text content.                                                      |
| **undici**                                   | 7.24.8     | Server-side HTTP client (preferred over `fetch` polyfills where we need explicit pooling / certificate handling). |

### 12. AI

| Pick                              | Version  | Purpose                                                                                                                                  |
| --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Vercel AI SDK**                 | (latest) | Provider-agnostic LLM calls in [`@formbricks/ai`](../../../packages/ai/). Used by AI translation, topic clustering, and semantic search. |
| **@ai-sdk/amazon-bedrock**        | 4.0.104  | Bedrock provider.                                                                                                                        |
| **@ai-sdk/azure**                 | 3.0.64   | Azure OpenAI provider.                                                                                                                   |
| **@ai-sdk/google-vertex**         | 4.0.126  | Google Vertex AI provider.                                                                                                               |
| **@aws-sdk/credential-providers** | 3.1017   | AWS credential resolution for Bedrock + S3.                                                                                              |

### 13. Payments (Cloud Only)

| Pick       | Version | Purpose                                                                                                  |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------- |
| **Stripe** | 20.4.1  | Subscription billing for Formbricks Cloud. Gated behind `IS_FORMBRICKS_CLOUD`. Webhooks land in the app. |

### 14. External APIs & Integrations

| Pick                                | Version  | Purpose                                                                                                                                          |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **googleapis**                      | 171.4.0  | Google Sheets integration. Also covers Google OAuth refresh for Sheets-mode integrations.                                                        |
| Slack / Notion / HubSpot / Airtable | (REST)   | Each integration is a direct REST client; configuration lives under [`apps/web/modules/integrations/`](../../../apps/web/modules/integrations/). |
| **Webhooks**                        | (native) | Workspace-/survey-scoped HTTP delivery on response events. Implemented in [`@formbricks/jobs`](../../../packages/jobs/).                         |

### 15. Observability

| Pick                                        | Version      | Purpose                                                                                                  |
| ------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------- |
| **Sentry** (`@sentry/nextjs`)               | 10.43.0      | Error tracking, performance traces, release tagging. Server + edge + client configs ship out-of-the-box. |
| **OpenTelemetry** (full SDK)                | 0.217 / 2.7  | Instrumentation for traces and metrics. Includes OTLP exporters (HTTP) and a Prometheus exporter.        |
| **`@formbricks/logger`**                    | workspace    | Structured JSON logger used by every package (replaces ad-hoc `console.log`).                            |
| **PostHog** (`posthog-js` + `posthog-node`) | 1.369 / 5.28 | Product analytics + feature flags. Drives the trial-banner A/B test, "upgrade_cta_clicked" events, etc.  |
| **Chatwoot**                                | (widget)     | Customer-support chat widget on Cloud, mounted via [`ChatwootWidget`](../../../apps/web/app/chatwoot/).  |

### 16. Testing & Quality

| Pick                                         | Version    | Purpose                                                                                                                               |
| -------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Vitest**                                   | 4.1.6      | Unit + integration tests across every package. Coverage via `@vitest/coverage-v8`.                                                    |
| **@testing-library/react** + **jest-dom**    | 16 / 6.9   | DOM testing helpers for React component tests.                                                                                        |
| **vitest-mock-extended**                     | 3.1.1      | Type-safe deep mocks for Prisma client and other deps.                                                                                |
| **Playwright**                               | (lockfile) | End-to-end browser regression in [`apps/web/playwright/`](../../../apps/web/playwright/). Azure-hosted runner for parallel runs.      |
| **Storybook 10** (+ `@storybook/react-vite`) | 10.3.6     | Component review surface in [`apps/storybook/`](../../../apps/storybook/) and inline `.stories.tsx` files in `@formbricks/survey-ui`. |
| **Chromatic**                                | (CI)       | Visual regression and review for Storybook stories.                                                                                   |
| **resize-observer-polyfill**                 | 1.5.1      | Test-only polyfill for jsdom.                                                                                                         |

### 17. Deployment & Self-Hosting

| Pick                                      | Purpose                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Docker** + **docker-compose**           | The canonical self-host story. Compose file in [`docker/docker-compose.yml`](../../../docker/docker-compose.yml).       |
| **Helm chart** (`helm-chart/`)            | Kubernetes deployment manifest for production self-hosts.                                                               |
| **ghcr.io/formbricks/formbricks** (image) | Single Docker image carrying both Community and Enterprise code. EE features activate behind an Enterprise license key. |
| **ghcr.io/formbricks/hub** (image)        | The separate Hub service for Unify feedback records.                                                                    |
| **`cubejs/cube:v1.6.6`** (image)          | Cube semantic-layer service. Required for the analytics surface.                                                        |
| **Gitpod**                                | Cloud development environments. One-click setup from the GitHub README.                                                 |
| **Sentry releases / OpenTelemetry**       | Operational observability in production.                                                                                |

### 18. Documentation

| Pick         | Purpose                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Mintlify** | Docs site engine for [`docs/`](../../../docs/). Schema in `docs.json`. Served at [formbricks.com/docs](https://formbricks.com/docs). |
| **Postman**  | Public API reference is published as Postman collections + linked from the Mintlify docs.                                            |

## Consequences

- **Stack is mostly mainstream TS + React.** Onboarding a new contributor who knows Next.js, Prisma, and Tailwind is fast. The unusual picks — Preact in the runtime, Cube.js for analytics, the Hub service — are documented above so they don't surprise anyone.
- **Two Tailwind versions live in the repo** (v3 in the dashboard, v4 in the survey runtime). Every CSS rule change has to know which side it's on; mixing tokens between packages breaks. See the two design guides for the surface boundary.
- **Two React flavors live in the repo** (Preact for the survey host, React 19 for the dashboard + component library). Import paths must match the package (`preact/hooks` vs `react`). The component library is designed to be Preact-compatible at the prop surface (no Suspense, no RSC).
- **Vite for libraries, Next.js for the app.** Anything shipped to customers as a JS bundle goes through Vite (UMD + ESM). The app uses Next.js + Turbopack only.
- **Multiple services in production.** A real Formbricks deployment is at minimum: Postgres + Valkey + the Formbricks web container + a worker + Cube + Hub. The compose file is the source of truth.
- **`pnpm.overrides` is load-bearing.** A long list of CVE-patched transitive deps is pinned in root `package.json`. The block has comments explaining each one and the upstream chain it's waiting on; remove an override only when its referenced upstream is fixed.
- **AI is provider-agnostic by construction.** `@formbricks/ai` wraps the Vercel AI SDK; Bedrock / Azure / Vertex are interchangeable per deployment. No hard-coded OpenAI path.
- **Self-hosters can swap pieces.** S3 can be RustFS or any S3-compatible store, Redis can be external, SSO is pluggable via SAML/OIDC. The compose file is a default, not a contract.

## Alternatives Considered

This document records the current baseline rather than re-litigating each pick. A short note on the ones where the alternative is non-trivial:

- **Preact vs React for the survey runtime.** Preact won because the bundle ships to third-party host pages and the size delta matters (10s of KB on every page view). React on the component library wins because it's consumed by both the runtime and the dashboard preview.
- **Tailwind v3 vs v4.** The dashboard predates v4 and has too much config-driven content to migrate cheaply; the runtime was greenfield enough to start on v4. A future ADR may unify on v4 across the repo.
- **`oxfmt` vs Prettier.** The CHECKS.md file lists `oxfmt --write .` as the canonical formatter, but the active git hook still runs Prettier. Treat that as a deliberate, in-flight migration rather than a contradiction.
- **Cube.js vs hand-rolled aggregation.** Cube was picked so analysts can write semantic queries instead of building a per-metric API endpoint. It is now a load-bearing service.
- **`@formbricks/hub` as a separate service.** The Hub could have lived in the same Next.js app. It was extracted because it owns feedback-record normalization across multiple workspaces and customers (Unify) and benefits from its own deployment cadence + scaling story.
- **Sonner vs react-hot-toast.** Stayed on `react-hot-toast` for now to avoid churn — the dashboard already wires it everywhere.

## Follow-Ups

- Decide the `oxfmt` vs Prettier story explicitly (one ADR, kill the ambiguity).
- Decide the Tailwind v3 → v4 migration plan for the dashboard (or accept the split permanently).
- Ship a "self-host minimum stack" ADR that picks which optional services are removable (e.g., Cube for instances that don't use the analytics surface).
- Decide on dark-mode wiring for the dashboard (CSS variables exist; no `.dark` toggle is connected today).
- Audit the `pnpm.overrides` block on every dependabot bump; remove patches whose upstream chain has landed a fix.
