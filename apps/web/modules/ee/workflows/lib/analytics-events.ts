import type { WorkflowAnalyticsOperation } from "@formbricks/workflows/server";

/**
 * PostHog event names for the Workflows feature (ENG-2851). One module, imported by the server
 * adapter and the client tracker alike, so a name can never drift between the two. Deliberately
 * free of runtime imports: the client bundle must not pull `posthog-node`, and the server must not
 * pull `posthog-js`.
 *
 * Naming follows the 36 existing server events: `snake_case`, `workflow_` prefix. PostHog's own
 * Workflows product emits `$workflows_email_*` (dollar-prefixed), so there is no collision.
 */

/** Lifecycle events, keyed by the package's operation so a new operation is a compile error here. */
export const WORKFLOW_LIFECYCLE_EVENTS: Record<WorkflowAnalyticsOperation, string> = {
  created: "workflow_created",
  duplicated: "workflow_duplicated",
  enabled: "workflow_enabled",
  disabled: "workflow_disabled",
  archived: "workflow_archived",
  unarchived: "workflow_unarchived",
  deleted: "workflow_deleted",
  tested: "workflow_tested",
};

/** Emitted by the runner once per run that ends `failed`, never per attempt. */
export const WORKFLOW_RUN_FAILED_EVENT = "workflow_run_failed";

/** Which surface issued the mutation; the same handler serves all three. */
export type TWorkflowAnalyticsVia = "ui" | "api" | "mcp";
