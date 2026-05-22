# Architecture Diagrams

Mermaid diagrams that describe how the Workflows feature wires the dashboard, the v3 API, the job
system, and the database together. The diagrams capture the **target architecture** decided in
[`decisions/001-workflows-api-first-backend-contract.md`](../../blueprint/decisions/001-workflows-api-first-backend-contract.md)
and [`decisions/002-workflows-tech.md`](../../blueprint/decisions/002-workflows-tech.md); they are not a snapshot of
what's already built.

PoC scope note: [Decision 003](../../blueprint/decisions/003-workflows-mvp-is-proof-of-concept.md) and
[Plan 001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md) use these diagrams as the
target architecture, but the first PoC intentionally stops before real email/webhook side effects,
audit-event persistence, idempotency/retries, dry runs, OpenAPI generation, and migration of existing
Follow-ups/Webhooks.

All shapes follow the same conventions:

- Solid arrows = synchronous in-process or HTTP calls.
- Dashed arrows = asynchronous, planned, or post-MVP relationships.
- `(…)` cylinders = persistent stores. `[[ … ]]` = queues.
- Boxes inside the **Formbricks runtime** band run inside our deployment; anything in the **External**
  band lives outside our control.

---

## 1. System Component Map

The dashboard, the v3 API, and the job system are co-deployed inside `apps/web` and `packages/jobs`.
The dashboard is a **client of the v3 API**, not a special-cased peer of the backend, so an LLM, MCP,
or external customer can call the same endpoints.

```mermaid
flowchart LR
  subgraph Clients
    UI["Browser<br/>apps/web dashboard"]
    LLM["LLM / MCP /<br/>external API clients"]
  end

  subgraph FB["Formbricks runtime"]
    direction TB
    subgraph Web["apps/web (Next.js)"]
      RSC["Dashboard pages<br/>RSC + Client Components"]
      API["v3 API route handlers<br/>(REST, OpenAPI-described)"]
    end

    subgraph Jobs["packages/jobs"]
      WORKER["Workflow worker<br/>(BullMQ consumer)"]
      WEBHOOKDEL["Existing webhook<br/>delivery job"]
    end

    DB[("PostgreSQL<br/>workflow definitions<br/>workflow runs<br/>audit events")]
    REDIS[["Redis<br/>BullMQ queues"]]
  end

  subgraph Ext["External"]
    SMTP["SMTP / Email provider"]
    CUSTOMER["Customer webhook URLs"]
    AI["AI providers<br/>(post-MVP)"]
    INTEG["Existing REST integrations<br/>Slack / Notion / HubSpot /<br/>Airtable / Sheets"]
  end

  UI -- "HTTPS / fetch" --> API
  RSC -- "server-side fetch" --> API
  LLM -- "HTTPS" --> API
  API -- "read / write" --> DB
  API -- "enqueue jobs" --> REDIS
  WORKER -- "dequeue" --> REDIS
  WORKER -- "load config<br/>persist run state" --> DB
  WORKER -- "send" --> SMTP
  WORKER -- "POST" --> CUSTOMER
  WORKER -. "inference call<br/>(post-MVP)" .-> AI
  WORKER -- "reuse" --> WEBHOOKDEL
  WORKER -. "wrap as actions<br/>(post-MVP)" .-> INTEG
```

**Reading the diagram:**

- The dashboard's React Server Components fetch from the same v3 API surface that external clients
  use. There are no Next.js server actions in the path for any user-facing workflow operation.
- Workflow execution is always async: the API enqueues a job; the worker drains it. The customer-
  facing request path never blocks on email, webhooks, or AI calls.
- The worker reuses `packages/jobs`' existing webhook-delivery code instead of building a new HTTP
  client.
- `INTEG` is shown dashed because no existing third-party connector is exposed as a workflow action
  in the MVP. The connection is forward-compatibility only.

---

## 2. Create / Edit Workflow Request Flow

The dashboard never writes to the database directly; it builds a workflow JSON document from the
canvas and drawer state and sends it through the v3 API.

```mermaid
sequenceDiagram
  actor U as User
  participant UI as Dashboard UI<br/>(apps/web client)
  participant API as v3 API<br/>(route handler)
  participant Z as zod schema
  participant DB as PostgreSQL

  U->>UI: edit canvas / drawer
  UI->>UI: derive workflow JSON<br/>from React Flow + form state
  UI->>API: PUT /api/v3/workflows/:id
  API->>Z: parse(workflowJson)
  alt invalid
    Z-->>API: ZodError
    API-->>UI: 400 + field errors
    UI->>U: render inline errors
  else valid
    Z-->>API: typed definition
    API->>DB: UPDATE workflow_definitions<br/>SET definition, updated_at
    DB-->>API: row
    API-->>UI: 200 + canonical JSON
    UI->>UI: reconcile React Flow state<br/>from server response
  end
```

**Reading the diagram:**

- The JSON document is the source of truth. The canvas is a view; on save, the UI reconciles its
  state from the server's canonical response rather than trusting its local copy.
- Validation lives in zod and runs on every write. The same schema feeds OpenAPI generation, so the
  v3 API contract and the workflow JSON definition can't drift.
- Lifecycle transitions (enable / disable / return-to-draft) are **separate** endpoints, not
  implicit consequences of `PUT`. See state machine in §3.

---

## 3. Workflow Lifecycle State Machine

Per the milestone and business rules, every workflow exists in exactly one of three states. Only
`enabled` workflows respond to trigger events. Transitions are enforced both in the data model and on
the v3 API.

```mermaid
stateDiagram-v2
  [*] --> draft: createWorkflow
  draft --> enabled: enable
  enabled --> disabled: disable
  disabled --> enabled: enable
  enabled --> draft: returnToDraft
  disabled --> draft: returnToDraft
  draft --> [*]: deleteWorkflow
  enabled --> [*]: deleteWorkflow
  disabled --> [*]: deleteWorkflow

  note right of enabled
    Only `enabled` workflows produce runs.
    Drafts and disabled workflows are
    saved but never trigger side effects.
  end note
```

**Reading the diagram:**

- `draft -> draft` self-edits don't appear because they aren't state transitions; they're regular
  `PUT` updates.
- `returnToDraft` is a single semantic transition exposed twice on the diagram because both `enabled`
  and `disabled` workflows can be re-opened for breaking edits.
- Delete is a terminal transition from any state. The API plan decides whether deletion is hard or
  soft.

---

## 4. Run Execution Flow

A trigger event (initially a survey response) becomes a queued job, then a worker drains it and walks
the workflow graph. Every step's input/output and status is persisted into the run record so the run
detail UI can replay execution.

```mermaid
sequenceDiagram
  participant Src as Survey runtime / public API
  participant API as v3 API
  participant DB as PostgreSQL
  participant Q as BullMQ queue (Redis)
  participant W as Workflow worker
  participant Ext as External<br/>(email / webhook / AI)

  Src->>API: POST /api/v3/responses (response completed)
  API->>DB: INSERT response
  API->>DB: SELECT enabled workflows<br/>WHERE trigger matches
  loop For each matching workflow
    API->>DB: INSERT workflow_runs<br/>(status=queued, idempotency_key)
    API->>Q: enqueue WorkflowRunJob<br/>(workflowId, version, trigger payload)
  end
  API-->>Src: 200

  W->>Q: dequeue WorkflowRunJob
  W->>DB: UPDATE workflow_runs<br/>SET status=running, started_at
  loop For each step in graph order
    W->>DB: load step config + prior outputs
    alt Condition / Compute / If-Else
      W->>W: evaluate in-process<br/>(no external call)
    else Send Email
      W->>Ext: SMTP send
    else Send Webhook / API Call
      W->>Ext: HTTP POST<br/>{ response: previous-output }
    else AI Agent (post-MVP)
      W->>Ext: inference call
    end
    W->>DB: persist step input / output /<br/>status / timing
  end
  W->>DB: UPDATE workflow_runs<br/>SET status=completed|failed|canceled<br/>ended_at, elapsed_ms
  W->>DB: INSERT workflow_audit<br/>(run completed)
```

**Reading the diagram:**

- The customer-facing response path is short and always returns before any side effect runs.
- One trigger event can fan out to many workflow runs — one per matching enabled workflow — each with
  its own idempotency key.
- The Send Webhook payload in MVP is a fixed envelope whose `response` field carries the previous
  action's output (or the trigger payload at the first step). Templating `{{response.x}}` into a
  user-authored body is post-MVP — see the milestone.
- The audit insert at the bottom is intentionally one row per terminal transition, not per step. Step
  detail lives inside `workflow_runs`, not in the audit log.

---

## 5. Run Status State Machine

The run status vocabulary from [`decisions/002-workflows-tech.md`](../../blueprint/decisions/002-workflows-tech.md):

```mermaid
stateDiagram-v2
  [*] --> queued: enqueue
  queued --> running: worker pickup
  running --> queued: retry / backoff
  queued --> canceled: cancel
  running --> canceled: cancel
  running --> completed: all steps ok
  running --> failed: step failed beyond retry
  completed --> [*]
  failed --> [*]
  canceled --> [*]
```

**Reading the diagram:**

- Retries are represented as `running -> queued` rather than a new `retrying` status. Retry count is
  metadata on the run, not a separate phase.
- Timeouts terminate as `failed`, not as a distinct status.
- Cancellation is allowed from both `queued` and `running`. Cancelling a step does not auto-fail
  prior completed steps — their outputs remain in the run record.

---

## 6. Indicative Data Model

The exact column shape is decided in
[`plans/001-003-workflow-schema-data-model-and-permissions.md`](../../cowork/plans/001-003-workflow-schema-data-model-and-permissions.md);
the diagram below names the entities and the load-bearing relationships only.

```mermaid
erDiagram
  WORKSPACE ||--o{ WORKFLOW_DEFINITION : "owns"
  WORKFLOW_DEFINITION ||--o{ WORKFLOW_RUN : "produces"
  WORKFLOW_DEFINITION ||--o{ WORKFLOW_AUDIT : "audited by"
  SURVEY }o--o{ WORKFLOW_DEFINITION : "referenced by trigger config"
  RESPONSE ||--o{ WORKFLOW_RUN : "originates"
  USER ||--o{ WORKFLOW_AUDIT : "actor"

  WORKFLOW_DEFINITION {
    uuid id PK
    uuid workspace_id FK
    string name
    enum status "draft | enabled | disabled"
    jsonb definition "nodes, edges, configs, variables"
    integer current_version
    timestamp created_at
    timestamp updated_at
  }

  WORKFLOW_RUN {
    uuid id PK
    uuid workflow_id FK
    integer workflow_version
    enum status "queued | running | completed | failed | canceled"
    jsonb trigger_payload
    jsonb step_outputs "per-step input, output, status, timing"
    string idempotency_key
    timestamp started_at
    timestamp ended_at
    integer elapsed_ms
  }

  WORKFLOW_AUDIT {
    uuid id PK
    uuid workflow_id FK
    uuid actor_user_id FK
    string action "created | updated | enabled | disabled |
                   returned_to_draft | deleted |
                   run_started | run_completed | run_failed"
    jsonb metadata
    timestamp at
  }
```

**Reading the diagram:**

- Two tables for the two lifecycles: `WORKFLOW_DEFINITION` (mutable config) and `WORKFLOW_RUN`
  (append-heavy, per-execution). They're split to keep pagination and retention policies independent.
- `workflow_version` on the run record is what makes "enabled runs execute against the version that
  was live when triggered" possible even when no version UI ships in MVP.
- `idempotency_key` is the dedupe handle the worker uses to avoid duplicate side effects on retry.
- Names are indicative — the data-model plan owns the final column and table names.

---

## 7. Existing Asset Reuse (MVP + Post-MVP)

The MVP intentionally limits itself to two existing primitives: the webhook delivery code in
`packages/jobs` and the Follow-ups email path. Other connectors stay in place and are post-MVP
candidates for being wrapped as workflow actions later.

```mermaid
flowchart TD
  subgraph WF["Workflow worker"]
    W["WorkflowRunJob"]
    SE["Send Email action"]
    SW["Send Webhook / API Call action"]
    SAI["AI Agent action<br/>(post-MVP stretch)"]
  end

  subgraph EX["Existing Formbricks assets"]
    FU["Follow-ups email path<br/>apps/web/modules/follow-ups (existing)"]
    WD["Webhook delivery job<br/>packages/jobs (existing)"]
    INT["Integration clients<br/>apps/web/modules/integrations/<br/>Slack, Notion, HubSpot, Airtable, Sheets"]
  end

  subgraph FUTURE["Post-MVP candidates"]
    LA["Slack action"]
    NA["Notion action"]
    HA["HubSpot action"]
    AA["Airtable action"]
    GA["Google Sheets action"]
  end

  W --> SE
  W --> SW
  W --> SAI
  SE -- "reuse" --> FU
  SW -- "reuse" --> WD
  LA -. "wraps" .-> INT
  NA -. "wraps" .-> INT
  HA -. "wraps" .-> INT
  AA -. "wraps" .-> INT
  GA -. "wraps" .-> INT
```

**Reading the diagram:**

- The two solid reuse arrows (`SE -> FU`, `SW -> WD`) are the only MVP integrations. Existing
  Follow-ups behavior must not regress; existing webhook delivery semantics must be preserved.
- The five dashed arrows describe shape, not commitments. They are the reason the workflow action
  interface in [decision 002](../../blueprint/decisions/002-workflows-tech.md) is required to absorb new connectors
  without redesign.

---

## Cross-references

- [E001 Workflows epic](../../blueprint/epics/E001-workflows.md)
- [001 Workflows MVP milestone](../../blueprint/milestones/001-workflows-mvp.md)
- [Decision 001 — API-first backend contract](../../blueprint/decisions/001-workflows-api-first-backend-contract.md)
- [Decision 002 — Technical architecture](../../blueprint/decisions/002-workflows-tech.md)
- [Business rules — glossary and scope](../../blueprint/business-rules/001-workflows-glossary-and-scope.md)
- [Plan 001-002 — API requirements and OpenAPI contract](../../cowork/plans/001-002-api-requirements-and-openapi-contract.md)
- [Plan 001-003 — Workflow schema, data model, and permissions](../../cowork/plans/001-003-workflow-schema-data-model-and-permissions.md)
- [Plan 001-004 — Execution engine and jobs](../../cowork/plans/001-004-execution-engine-and-jobs.md)
- [Plan 001-006 — Dashboard workflow builder UI](../../cowork/plans/001-006-dashboard-workflow-builder-ui.md)
- [Design guidelines — Workflows builder](../../blueprint/guidelines/design-guidelines-workflows.md)
