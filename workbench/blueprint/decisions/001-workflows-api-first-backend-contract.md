# Decision: Workflows API-first Backend Contract

| Field  | Value          |
| ------ | -------------- |
| Status | Accepted       |
| Date   | 2026-05-21     |
| Owner  | Javier Aguilar |

## Context

The Workflows epic is intended to move Formbricks toward a more API-first architecture. The Linear
project calls out natural-language workflow creation, direct API usage, and MCP/agent interaction as
success criteria. The user notes also state that the dashboard should no longer be the only true
product surface for this feature.

The existing product has many Next.js server-action-driven flows. For Workflows, this would recreate
the same dashboard-first coupling that the epic is trying to avoid.

## Decision

Workflows must be implemented as a v3 API-backed product surface.

- Do not use Next.js actions as the primary backend contract for workflow create/read/update/delete,
  activation, run inspection, dry runs, test runs, or execution controls.
- Every workflow operation available through the UI must also be available through the v3 API.
- The dashboard UI must be a client of the same API that external clients, LLMs, and MCPs can call.
- Before coding the dashboard UI, produce an endpoint inventory and plan missing v3 API endpoints.
- Keep OpenAPI documentation in sync with the implementation. The v3 OpenAPI spec lives under
  `docs/`, and API changes must include the generated spec updates.
- Use zod schemas and generated OpenAPI contracts so workflows can be created and updated from a
  validated JSON schema.
- Workflow definition and request schemas must live in a client-safe shared TypeScript module or
  package. The dashboard imports the same zod schemas as the v3 API and runs `safeParse` before save,
  activation, and dry-run requests so users get immediate inline validation feedback.
- Client-side schema validation is for UX only. The v3 API validates the same payload again and
  remains authoritative for all workflow writes, lifecycle transitions, dry runs, and execution
  controls.

PoC scope note: [Decision 003](./003-workflows-mvp-is-proof-of-concept.md) and
[Plan 001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md) keep the API-first
constraint for the PoC. The PoC uses minimal v3 route handlers and may defer OpenAPI generation and
full endpoint parity polish, but it must not use server actions or dashboard-only workflow behavior.

## Consequences

- UI implementation waits on the API requirements plan instead of inventing private dashboard-only
  mutations.
- API auth, workspace scoping, pagination, error models, and OpenAPI generation become full MVP/Beta
  acceptance criteria, not follow-up polish.
- LLMs, MCPs, and customer automation can create and manage workflows without scraping or imitating
  the dashboard.
- Implementation agents must treat API behavior as product behavior. Breaking API compatibility can
  break both the dashboard and external automation.
- Shared workflow schemas must avoid server-only dependencies such as Prisma clients, auth helpers,
  env access, or Node-only APIs so they can be imported by both browser code and API route handlers.
- Server-only validation still exists on top of shared schemas for auth, workspace scoping, referenced
  survey/contact existence, lifecycle transitions, entitlement checks, webhook URL safety, and
  side-effect/idempotency constraints.

## Alternatives Considered

- Use Next.js server actions first and add API coverage later. Rejected because it repeats the
  current dashboard-first coupling and makes MCP/LLM usage a second-class afterthought.
- Build only the dashboard MVP and postpone public API support. Rejected because it conflicts with
  the core reason for this project.
- Expose a partial API for only activation/run inspection. Rejected because the requirement is that
  everything doable through the UI must be doable through the v3 API.

## Follow-Ups

- Plan the endpoint inventory in [001-002 API requirements and OpenAPI contract](../../cowork/plans/001-002-api-requirements-and-openapi-contract.md).
- Decide the exact shared schema location during the API requirements plan, preferring a client-safe
  package/module that both `apps/web` client components and v3 route handlers can import without
  pulling server-only code into the browser bundle.
- Confirm the exact auth/permission checks for workspace-scoped workflows.
- Add API documentation and generated OpenAPI updates to the full MVP/Beta implementation definition
  of done.
- Do not add dashboard-only workflow behavior or Next.js server-action workflow workarounds.
