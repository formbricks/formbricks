---
status: proposed
---

# Agent-first: the only human UI is the account shell

Everything on the platform, from authoring surveys to reading responses, is done by an agent through MCP and `/api/v3`. People keep only the account shell: sign-up and login, organization management, connecting an agent, creating agent connections, and OAuth consent. The editors, builders, response tables and result views are retired, because an agent writes the same documents faster than a form does and a second human path would drift from the agent one (this is an experiment on a branch that is never merged, to see where the journey goes).

## Considered Options

- **Keep a read-only results view** so people can watch what agents did: rejected. Observation goes through the audit log and the agent itself, and a view is a UI to keep.
- **No UI at all, org and keys through the agent too**: rejected. OAuth consent and key creation need a person at a browser, and an agent cannot safely mint its own credentials.

## Consequences

- Every capability that was UI-only needs an MCP tool or is deleted. The 14 session-only v3 routes move to API key and OAuth auth.
- The respondent runtime (SDK, survey renderer, client API, hosted survey pages) is unchanged.
- The shell is rebuilt, responsive, on the Formbricks design system and a small fresh component set; the rest of `modules/ui` is deleted. "Connect your agent" is the home page, and OAuth grants and API keys merge into one Agent connections screen.
- v1 and v2 management APIs and their docs are deleted along with the UI.

## State of the experiment branch

Built: the account shell (`apps/web/app/(shell)`, `apps/web/modules/shell`) with Connect your agent, Agent connections (API keys and OAuth grants in one table), OAuth consent with per-permission selection, organization members, teams, workspaces, security (audit log, delete organization) and billing, and the account page. The auth and setup screens were restyled onto the same components. About 2,000 files of the old UI, the v1/v2 management APIs, the integrations, the dashboards and charts (tables dropped by migration, SpiceDB definition removed) and the editor-only modules are gone, with their routes, docs, Playwright specs and env vars.

Capabilities that lost their only surface and have no MCP tool yet, so they are currently unavailable: creating Feedback Datasets, creating action classes, personal and single-use link generation, PIN, email verification and pretty URL on a survey, Qualtrics (.qsf) import, data-retention policy and exemption management, third-party integrations (Slack, Notion, Google Sheets, Airtable: the response pipeline no longer calls them and the `Integration` rows are untouched), per-user response notification emails, and the AI smart-tools organization switch. API keys have one permission per workspace, no expiry and no stored key fragment, so the per-resource grid and "expires in" from the mock are not built.

Needs a person: `pnpm i18n` (about 325 new en-US strings have no translations and no `i18n.lock` entry), a deploy of the SpiceDB schema change with the reviewed digest, a run of the Playwright suite (none of the rewritten specs has been run), and a decision on the `dashboards` licence wire value that is now only named `feedbackAnalytics` in code.
