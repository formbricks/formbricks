# Research: Workflows Trigger Hook and IA

| Field      | Value                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| Status     | Done                                                                       |
| Date       | 2026-05-22                                                                 |
| Source     | [001-000](../../cowork/plans/001-000-prototype-readiness-and-contracts.md) |
| Next input | [001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md)      |

## Response Completed Hook

Existing response completion maps to the response pipeline event `responseFinished`.

Observed enqueue points:

- `apps/web/app/api/v1/management/responses/route.ts`
- `apps/web/app/api/v1/management/responses/[responseId]/route.ts`
- `apps/web/app/api/v1/client/[workspaceId]/responses/route.ts`
- `apps/web/app/api/v1/client/[workspaceId]/responses/[responseId]/lib/put-response-handler.ts`
- `apps/web/app/api/v2/client/[workspaceId]/responses/route.ts`
- `apps/web/modules/api/v2/management/responses/route.ts`
- `apps/web/modules/api/v2/management/responses/[responseId]/route.ts`

These routes call `sendToPipeline`, which enqueues `response-pipeline.process` through `@formbricks/jobs`.

The app-specific processor is `apps/web/modules/response-pipeline/lib/process-response-pipeline-job.ts`.
It already loads and validates:

- `workspaceId`
- `surveyId`
- `response`
- organization for the workspace
- survey for the event
- webhooks for the event

Recommended insertion point:

```ts
if (data.event === "responseFinished") {
  await enqueueResponseCompletedWorkflowRunsSafely({ data, logContext, survey, workspaceId: data.workspaceId });
  await runResponseFinishedSideEffects({ ... });
}
```

Place the workflow enqueue step inside the `responseFinished` branch after the pipeline has confirmed the survey
exists, the organization exists, and `survey.workspaceId === data.workspaceId`. Run it before or alongside legacy
side effects, but keep it safe:

- It must not block legacy webhooks, follow-ups, integrations, notifications, connector handling, or survey
  auto-complete if workflow enqueue fails.
- It should log with the existing pipeline context.
- It should create workflow runs and enqueue workflow jobs only for `enabled` workflows.
- It should not execute workflow actions synchronously in the response pipeline job.
- It should call a server-only workflow enqueue service, not an externally reachable trigger HTTP route.

## Trigger Payload

The workflow trigger payload should be the existing response pipeline payload plus stable metadata:

```ts
{
  event: "response.completed",
  workspaceId,
  surveyId,
  response,
}
```

Use the existing response payload shape from `TResponsePipelineJobData`. It already includes response fields,
tags, dates coerced by the job schema, and Formbricks response data/variables/meta.

## Dashboard IA Decision

PoC placement: add Workflows as its own main sidebar section.

Rationale:

- Workflows has at least two first-class surfaces: configured workflows and runs.
- It is not only analysis, so placing it under Dashboards would blur the product model.
- It is not only Unify Feedback, because the first trigger is survey response completion and future actions span
  survey automation, email, webhook/API, and integrations.
- The existing main nav already groups "Ask" and "Unify Feedback". A new "Workflows" group follows the same
  pattern and keeps future workflow runs visible.

Suggested routes:

- `/workspaces/[workspaceId]/workflows`
- `/workspaces/[workspaceId]/workflows/[workflowId]`
- `/workspaces/[workspaceId]/workflows/[workflowId]/runs`
- `/workspaces/[workspaceId]/workflows/[workflowId]/runs/[runId]`

Suggested main nav section:

```ts
{
  id: "workflows",
  name: t("common.workflows"),
  items: [
    {
      name: t("common.workflows"),
      href: `/workspaces/${workspace.id}/workflows`,
      icon: WorkflowIcon,
      isActive: pathname?.includes("/workflows"),
      disabled: isMembershipPending || isBilling,
    },
  ],
}
```

The PoC can keep run list/detail nested under a workflow instead of adding a second main-nav item. If run
inspection becomes a top-level daily surface after demo feedback, add a secondary navigation or second item.

## UI Component Reuse

Relevant existing components and patterns:

- Main nav: `MainNavigation`, `NavigationLink`, `WorkspaceLayout`.
- Secondary nav: `SecondaryNavigation`, with examples in analysis, contacts, and Unify.
- Page shell: `PageContentWrapper`, `PageHeader`, `Button`, `Badge`, `Skeleton`.
- Tables: `DataTableHeader`, `DataTableToolbar`, `DataTableSettingsModal`, `getSelectionColumn`.
- Forms: `FormProvider`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormError`, `Input`, `Select`,
  `Checkbox`, `Switch`, `Tabs`, `Sheet`, `Dialog`.
- Branch/condition UI reference: `ConditionsEditor`.
- Email action reference: `FollowUpModal`, `FollowUpActionMultiEmailInput`, and follow-up email helpers.
- Webhook config reference: `modules/integrations/webhooks/components/*`.
- Builder/editor state reference: survey editor patterns plus the imported prototype Jotai editor state.

## Builder Notes

- Use React Flow for the visual canvas.
- Keep a fixed or absolute drawer over the canvas, collapsible, for selected node configuration.
- Use shared zod validation for local draft feedback.
- Keep selected node, open drawer, dirty flag, and validation issue display in client/editor state.
- Keep persisted workflow JSON and server state in the v3 API/query layer.
- Do not add TSX/component unit tests for the builder; full UI automation is deferred from the PoC.
