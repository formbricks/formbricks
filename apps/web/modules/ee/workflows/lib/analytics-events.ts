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

/**
 * Daily state snapshots (one per organization with a live workflow, and one per organization and
 * node type), emitted by the `workflows-usage.snapshot` job. Dashboards deduplicate them per
 * organization and day (max, or unique organizations) before summing: the job may legitimately run
 * twice in a day.
 */
export const WORKFLOW_USAGE_SNAPSHOT_EVENT = "workflow_usage_snapshot";
export const WORKFLOW_NODE_TYPE_SNAPSHOT_EVENT = "workflow_node_type_snapshot";

/** Which surface issued the mutation; the same handler serves all three. */
export type TWorkflowAnalyticsVia = "ui" | "api" | "mcp";

/** Client-side events, fired from the Workflows UI through `trackWorkflowEvent`. */
export const WORKFLOW_CLIENT_EVENTS = {
  surfaceViewed: "workflow_surface_viewed",
  triggerAdded: "workflow_trigger_added",
  actionAdded: "workflow_action_added",
  nodeDeleted: "workflow_node_deleted",
  inspectorOpened: "workflow_inspector_opened",
  canvasAction: "workflow_canvas_action",
  validationProblemsViewed: "workflow_validation_problems_viewed",
  validationProblemFixClicked: "workflow_validation_problem_fix_clicked",
  enableBlocked: "workflow_enable_blocked",
  autosaveFailed: "workflow_autosave_failed",
  listFiltered: "workflow_list_filtered",
  runDetailOpened: "workflow_run_detail_opened",
} as const;
export type TWorkflowClientEvent = (typeof WORKFLOW_CLIENT_EVENTS)[keyof typeof WORKFLOW_CLIENT_EVENTS];

/**
 * The distinct screens of the feature, reported as `surface` on `workflow_surface_viewed`. A value
 * that never shows up in PostHog is a screen nobody reaches. Not listed on purpose: the paywall,
 * which is the shared `upgrade_prompt_viewed{feature:"workflows"}`, and the inspector and run
 * drawer, which have richer events of their own.
 */
export const WORKFLOW_SURFACES = [
  "list",
  "list_empty",
  "list_empty_filtered",
  "workspace_runs",
  "builder",
  "workflow_runs",
] as const;
export type TWorkflowSurface = (typeof WORKFLOW_SURFACES)[number];
