# Decision: Workflows Builder State Management

| Field  | Value          |
| ------ | -------------- |
| Status | Accepted       |
| Date   | 2026-05-22     |
| Owner  | Javier Aguilar |

## Context

[Decision 002](./002-workflows-tech.md) establishes React Flow, shared browser-safe zod schemas,
workflow JSON as the source of truth, and a dashboard client backed by the v3 API. The PoC builder
needs enough local state to support canvas selection, node dragging, a collapsible config drawer,
unsaved edits, and local validation without turning React Flow state into a competing workflow
definition.

`apps/web` does not currently have a single app-wide global state library. It uses local React state,
React Context, React Hook Form in form-heavy surfaces, and TanStack Query in scoped server-state
surfaces. The workflow prototype research also used Jotai and Immer for editor-local state.

## Decision

The Workflows PoC builder uses a scoped Jotai store plus Immer producers for editor-local state.

- Scope the Jotai `Provider` to the workflow builder subtree. This is not a new dashboard-wide state
  management convention.
- Use Jotai for UI and draft-editor state such as the loaded workflow snapshot, editable workflow
  name, workflow definition draft, derived React Flow nodes, selected node, and drawer collapse
  state.
- Use Immer to keep nested draft updates explicit and immutable, especially for workflow definition
  and React Flow node changes.
- Keep the persisted workflow JSON document as the source of truth. React Flow nodes and edges are a
  derived/editor view, and drag positions are committed back into workflow JSON instead of becoming a
  second persisted graph model.
- Keep server/API state authoritative in the v3 API. The dashboard still loads, saves, enables,
  disables, deletes, and inspects workflows through the v3 route handlers.
- Do not introduce React Hook Form or TanStack Query into the PoC just to satisfy a pattern. They are
  eligible for Beta/MVP hardening only when they reduce real complexity:
  - React Hook Form can own complex node/workflow configuration forms, validation display, dirty
    fields, and submission ergonomics. It must not own the graph document or replace shared workflow
    schema validation.
  - TanStack Query can own server-state concerns such as workflow list/detail caching, run polling,
    pagination, invalidation after mutations, and retry/refetch policy. It must not own unsaved
    builder drafts.

## Consequences

- `apps/web` declares direct `jotai` and `immer` dependencies for the Workflows builder.
- Builder state remains inspectable and testable as non-TSX editor state if it grows beyond the PoC.
- The dashboard can avoid prop-drilling selected node, drawer, and draft graph state through the
  builder surface while still preserving the API-first architecture.
- Beta work should revisit React Hook Form and TanStack Query deliberately, with explicit benefits,
  instead of treating them as mandatory framework choices.
- Future agents must not generalize this into an app-wide Jotai mandate without a separate decision.

## Alternatives Considered

- Keep only component-local `useState`. Rejected for the builder because selection, draft
  definition, canvas state, drawer state, and future validation state already cross component
  boundaries.
- Let React Flow state become the source of truth. Rejected because the accepted architecture requires
  workflow JSON to remain the canonical definition.
- Use React Hook Form as the builder state model. Rejected for graph/document state; it may be useful
  later inside node config forms.
- Use TanStack Query for unsaved editor drafts. Rejected because it is a server-state tool, while the
  builder draft is local user input until saved through the v3 API.
- Introduce app-wide Jotai state for the dashboard. Rejected because this decision only covers the
  workflow builder subtree.

## Follow-Ups

- Keep the PoC builder on scoped Jotai + Immer and verify React Flow drag state does not flash or
  fight workflow JSON updates.
- In Beta, evaluate React Hook Form for complex node config drawers once the node/action catalog is
  larger than the PoC.
- In Beta, evaluate TanStack Query for workflow lists, run polling, pagination, and mutation
  invalidation if those flows become difficult to maintain with the minimal API client.
