# Product

## Summary

Formbricks is an **open-source, privacy-first Experience Management (XM) platform**: a complete toolchain for asking the right person the right question at the right moment, capturing the answer wherever it makes sense, and turning many answers into something a team can act on. It is positioned in the market as the open alternative to Qualtrics, with Typeform-and-Google-Forms-style link surveys, SurveyMonkey-style targeted website / in-app surveys, plus a unified feedback layer that brings third-party feedback sources (CSV uploads, NPS tools, ticket exports) into the same analysis surface.

The product ships in two flavors from the same codebase:

- **Formbricks Community Edition (AGPLv3)** — the free, self-hostable core. Covers the survey builder, link surveys, website & app surveys via the JS SDK, single-tenant workspace model, the response/contact layer, integrations, and the public REST API.
- **Formbricks Enterprise Edition** — additional modules under [`apps/web/modules/ee/`](../../apps/web/modules/ee/) (separate license). Adds multi-tenant teams + role-based access, the Unify Feedback / Feedback Directory pipeline, advanced targeting / quotas / multi-language / email follow-ups, SSO, audit logs, AI translation, and white-label.
- **Formbricks Cloud** — the hosted offering at [app.formbricks.com](https://app.formbricks.com). Same codebase, with billing, trial banners, and entitlement checks toggled by the `IS_FORMBRICKS_CLOUD` flag.

Everything in this document describes capabilities the codebase actually has today — based on the [docs/](../../docs/) sitemap, the Prisma schema at [`packages/database/schema.prisma`](../../packages/database/schema.prisma), and the route map under [`apps/web/app/(app)/workspaces/[workspaceId]/`](<../../apps/web/app/(app)/workspaces/[workspaceId]/>).

## Users

The product serves a layered audience. A typical Formbricks deployment touches all of them.

- **Survey creators** — Product Managers, UX researchers, Customer Success, People Ops, Marketing. They build surveys in the no-code editor, target them at users or distribute them as links, and read responses. They live in the dashboard daily.
- **Response analysts** — researchers and data folks who tag responses, slice by segment, build dashboards from charts, and export to CSV / xlsx / data warehouse.
- **Developers** — embed the JS SDK ([`@formbricks/js-core`](../../packages/js-core/)) into a web or React Native app, hand-fire actions, set user attributes, and (occasionally) call the REST API directly. They are the ones who unblock identified-user targeting.
- **Workspace and organization admins** — IT, security, and engineering leads who manage members, roles, teams, billing, SSO, API keys, integrations, and (for self-hosters) the infrastructure.
- **End-respondents** — the people who actually answer surveys. They never see the dashboard; they see the runtime card (modal, inline, or full-page link survey). The runtime design language lives in its own guide: [`./guidelines/design-guidelines-survey-runtime.md`](./guidelines/design-guidelines-survey-runtime.md).

## Problems

The problems Formbricks is built to solve, in roughly the order users encounter them:

1. **Generic surveys don't convert.** Email-and-link surveys get 2–3% response rates; in-context surveys triggered on the right user action get 6–10x more. Most tools force a choice between the two — Formbricks offers both from one product.
2. **Targeting is brittle.** Filtering "users who upgraded in the last 30 days, on iOS, in EMEA" usually means writing custom code or duct-taping a CRM. Formbricks moves targeting into a no-code segment editor that consumes user attributes the SDK sets at runtime.
3. **Survey fatigue silently kills response quality.** Showing the same user three surveys a week destroys data quality. Formbricks ships a per-workspace recontact cooldown, per-survey display caps, and segment-based exclusion as first-class behavior.
4. **Feedback is fragmented across tools.** A team reads NPS in one place, support tickets in another, sales feedback in a third. The Unify Feedback module (Enterprise) ingests external sources (CSV, third-party connectors) into one Feedback Directory so analysis happens on the merged data.
5. **Privacy and compliance are non-negotiable.** Surveys touch PII. Formbricks is self-hostable under AGPLv3, supports SSO and 2FA, and ships an audit log — so customers in regulated industries can deploy without sending response data to a third party.
6. **Closed survey tools cost too much for what they do.** Qualtrics-class pricing is unjustifiable for many teams. The free / open-source tier covers the use cases most teams actually need.

## Goals

- **Be the open alternative to Qualtrics / Typeform.** Cover everything from a single link form to a multi-language, segmented, in-app survey program — without an upgrade prompt blocking the basic flow.
- **Be SDK-first for in-product surveys.** The JS SDK is the moat. App/website surveys should be one-line-to-install and not require a backend.
- **Be a privacy-first XM platform.** Self-hostable, EU-friendly, no required vendor lock-in for response data.
- **Be developer-friendly enough to extend.** REST API + webhooks + integrations + an open codebase mean teams can build on top.
- **Make the runtime invisible.** End-users should never feel they are answering "a survey." The Quiet Stage runtime is engineered to look at home on any host page (see runtime design guide).

## Non-Goals

These are out of scope on purpose — recording them prevents drift.

- **Not a CRM.** Contacts exist to enable targeting and identification — not to replace HubSpot/Salesforce. The HubSpot integration is one-way (push response → CRM).
- **Not a marketing automation tool.** Email follow-ups exist for transactional response acknowledgement, not for nurture sequences.
- **Not a BI tool.** Dashboards and charts are analysis-on-feedback, not general-purpose data viz over arbitrary data sources.
- **Not a panel provider.** Formbricks supports running a panel (see "Research Panel" best practice doc) but does not own a respondent panel.
- **Not white-label by default.** White-labeling is an Enterprise-only capability; the open-source distribution always carries Formbricks branding on the runtime (controllable per-workspace within license terms).
- **Mobile-first dashboard UI.** The dashboard is desktop-only by design — the runtime (what respondents see) is mobile-friendly, but the editor and analysis surfaces block on small screens via [`NoMobileOverlay`](../../apps/web/modules/ui/components/no-mobile-overlay/index.tsx).

---

## Domain Model

The product's core entities, from the Prisma schema. Knowing this small graph is the fastest way to read any feature.

```
Organization (multi-tenant root, billing lives here)
 └── Workspace (the "project" — surveys + branding + recontact policy)
      ├── Survey ──→ Response (with Tags) + Display
      ├── Contact ──→ ContactAttribute, ContactAttributeKey
      ├── Segment (reusable targeting rule)
      ├── ActionClass (no-code or code action used as a Survey Trigger)
      ├── ApiKey (via ApiKeyWorkspace) + Integration + Webhook
      ├── Connector ──→ ConnectorFormbricksMapping / ConnectorFieldMapping (Unify, EE)
      ├── Chart + Dashboard + DashboardWidget (Analysis, EE)
      └── FeedbackDirectoryWorkspace (Unify membership, EE)

Organization
 ├── Team ──→ TeamUser (EE-gated role granularity)
 │    └── WorkspaceTeam (which teams can access which workspaces, EE)
 ├── Membership (user ↔ org with role: owner | manager | billing | member)
 ├── FeedbackDirectory (Unify destination, EE)
 │    ├── Connector (formbricks_survey | csv) → external feedback source
 │    └── Chart (cross-workspace analysis on directory data)
 └── ApiKey (org-scoped, but each key declares which Workspaces it can hit)
```

Two terms worth flagging up front because they cause confusion:

- **"Workspace"** in Formbricks is what most tools call a "project" — a survey-collection container with its own branding, recontact policy, and contacts. Multiple workspaces live inside one Organization. (The older docs and the public API still use "Project" / "Environment" in some places; the dashboard URL today is `/workspaces/[workspaceId]/...`.)
- **"Contact"** is the identified end-user the SDK has called `setUserId(...)` on. Unidentified users can still see surveys (page-view trigger, recontact rules) but cannot be targeted by attribute segments and don't count toward MTU.

---

## Core Workflows

Each subsection describes one of the product's pillars: what it is, the routes/modules that own it, and the most important user-facing concepts.

### 1. Surveys (the heart of the product)

Surveys live under [`apps/web/app/(app)/workspaces/[workspaceId]/surveys/`](<../../apps/web/app/(app)/workspaces/[workspaceId]/surveys/>) with the editor module at [`apps/web/modules/survey/editor/`](../../apps/web/modules/survey/editor/). Three survey **types**, all using the same builder:

- **Link Surveys** — invitation-based. Distributed via email, SMS, push, or webview. No SDK required. URL features include hidden fields, data prefilling, personal links, single-use links, source tracking, start-at-block, email verification, market-research panel, PIN protection, custom head scripts, and offline support. See [`docs/xm-and-surveys/surveys/link-surveys/`](../../docs/xm-and-surveys/surveys/link-surveys/).
- **Website Surveys** — triggered by behavior on a public website (no login required). The JS SDK detects unidentified visitors.
- **App Surveys** — triggered for identified users inside a logged-in product. The SDK sets the user ID and attributes; segments target them. Both website and app surveys share the docs at [`docs/xm-and-surveys/surveys/website-app-surveys/`](../../docs/xm-and-surveys/surveys/website-app-surveys/).

**Question types** (the renderers live in [`packages/survey-ui/src/components/elements/`](../../packages/survey-ui/src/components/elements/)):

- Open text, single-select, multi-select, picture-select, ranking, matrix
- Rating (number / star / smiley scales, ranges 3/4/5/6/7/10), NPS (0–10 with detractor/passive/promoter coloring)
- Date, file upload, address, contact info, consent, statement / CTA
- Schedule a meeting (embeds Cal.com)

**General features that apply across types:**

- Conditional logic (skip / show / set variable / fail), variables, recall (interpolate prior answers into question text), hidden fields, metadata, multi-language with optional AI translation (EE), validation rules, partial submissions, email follow-ups (paid), quota management (EE), spam protection (reCAPTCHA), per-survey tags, image/video media on questions.

**Editor surface** is a left rail of blocks + the active block's form + a right-side `PreviewSurvey` running the actual `@formbricks/surveys` runtime against the draft. Auto-save indicator runs continuously; drag-reorder via `@formkit/auto-animate`. See the dashboard components guide for the surface inventory.

### 2. Distribution & Triggering

Once a survey exists, how does the right person see it?

- **Link distribution.** Copy a URL, optionally hidden-field encode user metadata or pretty-URL it. Personal Links generate one URL per contact. Single-Use Links self-destruct after one response.
- **Actions** — predefined events that trigger website/app surveys. Two flavors:
  - **No-code actions** — set up in the dashboard, fired automatically by the SDK on URL change, click selectors, or page view.
  - **Code actions** — fired programmatically by `formbricks.track("event-name", { ... })`.
    Configured surveys subscribe to one or more `ActionClass` records via the `SurveyTrigger` join.
- **Targeting** — who is allowed to see it. For identified users (EE), a `Segment` matches against `ContactAttribute`s the SDK has set, plus device type and behavior. For anonymous traffic, a percentage cap (`Show survey to X% of users`) prevents over-display.
- **Recontact rules** — per-workspace cooldown (default 7 days) + per-survey "show once / always / on response" knobs. Recontact is the _last_ gate before display, sitting after targeting and trigger. See [`docs/xm-and-surveys/surveys/website-app-surveys/recontact.mdx`](../../docs/xm-and-surveys/surveys/website-app-surveys/recontact.mdx).
- **Survey cooldown** — a workspace-wide debounce so two surveys can't fire at the user within the cooldown window.

### 3. Contacts & Segments (Enterprise)

Lives at [`apps/web/modules/ee/contacts/`](../../apps/web/modules/ee/contacts/). The dashboard route is [`workspaces/[workspaceId]/(contacts)/contacts`](<../../apps/web/app/(app)/workspaces/[workspaceId]/(contacts)/contacts/>).

- **Contacts** — identified users created the first time `setUserId` is called (or via CSV bulk upload via the `UploadContactsCSVButton`). Each contact owns a set of typed attributes (`ContactAttribute`) keyed by reusable `ContactAttributeKey` records — `email`, `plan`, `signupDate`, anything custom.
- **Segments** — saved rules over contact attributes / behavior / device. Reused across multiple surveys and across the Quota engine. Built with the same recursive `ConditionsEditor` that powers survey logic.
- **Attributes vs. user ID.** The user ID is the stable identifier; attributes are everything else. Attributes drive segmentation; the user ID drives identification and de-duplication.
- **MTU (Monthly Tracked Users)** — a Cloud-side billing dimension; identified users count toward the cap. Unidentified visitors do not.

### 4. Responses, Tags & Analysis

Responses live under each survey at [`workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/`](<../../apps/web/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/>) and include:

- **Summary view** — auto-aggregated per-question (averages for NPS, distribution charts for choice, word clouds for text).
- **Responses table** — every submission, filterable, with the `DataTable*` exports from [`apps/web/modules/ui/components/data-table/`](../../apps/web/modules/ui/components/data-table/) on TanStack Table v8.
- **Per-response detail** — each answer, the contact who submitted it, TTC, the device, the source.
- **Tags** — workspace-scoped labels applied to responses to slice analysis. `Tag` is its own model; `TagsOnResponses` is the join.
- **Export** — CSV / xlsx, plus the REST API for piping into a data warehouse.

### 5. Dashboards & Charts (Enterprise Analysis)

A higher-level analysis layer that crosses surveys. Lives in [`apps/web/modules/ee/analysis/`](../../apps/web/modules/ee/analysis/), routes under [`workspaces/[workspaceId]/(analysis)/`](<../../apps/web/app/(app)/workspaces/[workspaceId]/(analysis)/>).

- **Chart** — a single visualization (area / bar / line / pie / big number). Holds a Cube.js-style query (`ChartQuery`) + display config (`ChartConfig`). Lives at the workspace or directory level.
- **Dashboard** — a named collection of `DashboardWidget` entries laying out multiple charts on a grid. Workspace-scoped, unique by name. Powered by Recharts.
- **Use case:** "NPS trend over the last 6 months across all our website surveys" or "Detractor count by region" — answerable without exporting to a separate BI tool.

### 6. Unify Feedback & Feedback Directories (Enterprise)

The most ambitious surface. Solves the "feedback in five different tools" problem. Routes at [`workspaces/[workspaceId]/unify/`](<../../apps/web/app/(app)/workspaces/[workspaceId]/unify/>), backed by [`apps/web/modules/ee/unify-feedback/`](../../apps/web/modules/ee/unify-feedback/) and [`apps/web/modules/ee/feedback-directory/`](../../apps/web/modules/ee/feedback-directory/).

The data model is layered:

- **FeedbackDirectory** — an organization-level pool of normalized feedback records. Multiple workspaces can subscribe via `FeedbackDirectoryWorkspace`. Charts can be built directly against the directory.
- **Connector** — a typed pipe pulling records into the directory. Two types today: `formbricks_survey` (live survey responses) and `csv` (uploaded files). Connector mappings (`ConnectorFormbricksMapping`, `ConnectorFieldMapping`) declare how source fields land in the directory schema.
- **FeedbackRecord** — the normalized atom. Lives in a separate service called **Formbricks Hub** (the SDK is `@formbricks/hub`, declared in [`apps/web/package.json`](../../apps/web/package.json); the integration is at [`apps/web/modules/hub/`](../../apps/web/modules/hub/)). Each record has a typed value (`text`, `categorical`, `nps`, `csat`, `ces`, `rating`, `number`, `boolean`, `date`) plus source metadata, language, timestamp, and the contact who produced it.
- **Topics & Subtopics** — AI-driven thematic clustering over directory records (early-stage / EE).
- **Semantic search** — natural-language search across feedback records, served by the Hub.

The two pages worth knowing:

- [`workspaces/[workspaceId]/unify/feedback-records`](<../../apps/web/app/(app)/workspaces/[workspaceId]/unify/feedback-records/>) — the merged stream of records across all connected directories.
- [`workspaces/[workspaceId]/unify/sources`](<../../apps/web/app/(app)/workspaces/[workspaceId]/unify/sources/>) — the connector configuration surface.

If you're touching this area: **the Hub is a separate service** (called via `HUB_API_KEY`, with the client dependency declared in [`apps/web/package.json`](../../apps/web/package.json)). If the env var is missing, the dashboard falls back to an empty state instead of crashing. Read [`apps/web/modules/hub/service.ts`](../../apps/web/modules/hub/service.ts) for the error model.

### 7. Workspaces, Organizations & Permissions

The multi-tenancy model. Implemented in [`apps/web/modules/workspaces/`](../../apps/web/modules/workspaces/) and [`apps/web/modules/organization/`](../../apps/web/modules/organization/); EE additions in [`apps/web/modules/ee/teams/`](../../apps/web/modules/ee/teams/) and [`apps/web/modules/ee/role-management/`](../../apps/web/modules/ee/role-management/).

- **Organization** — top of the tree. Owns billing, member invitations, license state, and (in EE) Teams and Feedback Directories.
- **Workspace** — the survey container. Has its own branding, recontact policy, default language, action classes, contacts, surveys, charts, dashboards, integrations, and API key access. Multiple workspaces per org are common (e.g., one per product line).
- **Permission layers** (most → least powerful):
  1. **Organization roles** — `Owner`, `Manager`, `Billing`, `Member` (see [`docs/.../organizations-and-roles.mdx`](../../docs/xm-and-surveys/core-features/user-management/organizations-and-roles.mdx)). Org-level roles can override team restrictions.
  2. **Team roles** (EE) — `Team Admin` (can manage team membership + workspaces) and `Team Contributor` (acts within workspaces assigned to the team).
  3. **Workspace permissions** (EE) — per-team, per-workspace: `Read`, `Read & Write`, `Manage`. `Manage` includes settings + API keys + integrations.
- **Community Edition** collapses all of the above into "everyone is an Owner" — fine for solo / small-team self-hosters.
- **Privilege escalation prevention** — managers cannot promote to manager; only owners can. Codified in invite/role-update flows.
- **Authentication** — Auth.js with credentials, OAuth (Google, GitHub, Azure AD), and SSO (EE). Two-factor auth (TOTP + backup codes) is available on all plans.

### 8. Integrations, Webhooks & API

Integration surface at [`apps/web/modules/integrations/`](../../apps/web/modules/integrations/) plus settings under [`workspaces/[workspaceId]/settings/workspace/integrations/`](<../../apps/web/app/(app)/workspaces/[workspaceId]/settings/workspace/integrations/>).

- **First-party integrations:** Slack, Notion, Airtable, Google Sheets, HubSpot, n8n, Make, Zapier, ActivePieces, WordPress.
- **Webhooks** — per-survey or per-workspace HTTP delivery on response events. The `Webhook` model carries URL + event types + (optional) survey filter.
- **Public REST APIs** (see [`docs/api-reference/`](../../docs/api-reference/) and [`docs/api-v3-reference/`](../../docs/api-v3-reference/)):
  - **Public Client API** — used by the SDK; unauthenticated; covers displays + responses.
  - **Management API** — authenticated with personal API key (workspace-scoped via `ApiKeyWorkspace`); full CRUD over surveys, contacts, responses, segments, etc. v2 and v3 are both shipped.
- **JS SDK ([`@formbricks/js-core`](../../packages/js-core/))** — the embedded library. Provides `setUserId`, `setAttribute`, `track`, `logout`, plus the runtime mount. Also supports React Native.

### 9. Styling & Theming

Survey appearance is controlled at three levels, in increasing precedence:

1. **Organization white-label** (EE) — corporate-wide brand defaults.
2. **Workspace styling** — default brand color, card border, highlight, logo, default language, branding-on/off toggle, placement (`bottomRight` / `topRight` / `bottomLeft` / `topLeft` / `center`), overlay (`none` / `light` / `dark`).
3. **Per-survey overrides** — only when the workspace allows style overwrite (`allowStyleOverwrite` in `Workspace.styling`).

Every visual property on the runtime card is a CSS custom property (`--fb-*`) so the embedder's brand replaces it without recompiling. See the runtime design guide for the full token list.

### 10. Self-hosting & Operations

Self-host story at [`docs/self-hosting/`](../../docs/self-hosting/), Docker compose + Helm chart shipped. Pieces:

- **Single Postgres + Next.js + worker** is the baseline. Docker images ship with both Community and Enterprise code; the Enterprise license key activates EE features.
- **Storage** — local filesystem or S3-compatible (configurable via env). Survey responses are _not_ offloaded; only uploads.
- **Auth** — credentials by default; SSO (SAML / OIDC) is EE.
- **Monitoring** — Sentry hooks built-in; Prometheus endpoint via the worker.
- **Audit logs** (EE) — module at [`apps/web/modules/ee/audit-logs/`](../../apps/web/modules/ee/audit-logs/).
- **Rate limiting & CDN** — configurable per docs.

---

## What "Done" looks like for the product

A useful one-line shape, for orienting future work:

> A Formbricks customer can install the SDK in their app, target a logged-in user with a multi-question NPS survey in their language, have the user answer it inline without leaving the page, see the response tagged and segmented in their dashboard within a minute, pipe it into a Slack channel and a Feedback Directory chart, and never have a respondent realize they were "answering a survey."

Every feature in this document either supports a step of that flow, or it's a related path (link surveys, anonymous web surveys, panel research, etc.) that reuses the same primitives.

## Constraints

- **Languages & runtimes** — TypeScript 6+, Node.js, React 19, Preact (runtime host), Next.js 16 (App Router, RSC).
- **Tooling** — pnpm workspaces + Turborepo, Prisma over PostgreSQL, Vitest (unit) + Playwright (e2e), oxfmt.
- **Licensing** — AGPLv3 for the core; EE code under [`apps/web/modules/ee/`](../../apps/web/modules/ee/) is separately licensed. The runtime preview and the survey itself are AGPLv3 to keep the embedded JS distributable.
- **Privacy posture** — self-hosting is a first-class deployment, not an afterthought. PII handling, response export, and audit logs must keep that posture intact.
- **Embedded runtime contract** — the JS bundle scopes everything under `#fbjs` and never paints the host page. See the runtime design guide.
- **Desktop-first dashboard** — small viewports get [`NoMobileOverlay`](../../apps/web/modules/ui/components/no-mobile-overlay/index.tsx). The respondent runtime is mobile-friendly; the editor is not.

## Open Questions

Worth revisiting deliberately, not silently:

- **Workspace vs. Project / Environment terminology.** The Prisma schema and current routes use `Workspace`; some older docs still reference "Project" + "Environment." Pick one canonical term and back-fill the rest.
- **Unify Feedback Hub readiness.** The Hub service has a documented degraded mode (no `HUB_API_KEY` → empty state). What is the SLA story for Unify in production?
- **Dark mode.** The CSS variable layer carries dark values in the dashboard but the shell does not toggle `.dark`. Decision: ship it, drop the dead code, or wait?
- **Mobile dashboard.** Permanent desktop-only, or future scoped responsive subset?
- **AI features** (translation, topic clustering, semantic search). What is GA vs. preview? Which are gated by Cloud vs. self-host?
