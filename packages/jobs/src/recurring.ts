import { JOB_NAMES } from "@/src/constants";
import { type AnyBackgroundJobDefinition, toAnyBackgroundJobDefinition } from "@/src/contracts";
import { createMissingOverrideHandler } from "@/src/processors/missing-override";
import { type TGlobalScopeJobData, ZGlobalScopeJobData } from "@/src/types";

/**
 * The scope every recurring job runs under. It is both the scheduler-identity segment and the job
 * payload, which is why the two cannot drift.
 */
const GLOBAL_SCOPE = "global";

interface RecurringJobInput {
  /** Human-readable name used in log lines and error messages, e.g. "survey scheduling". */
  label: string;
  name: string;
  /** Stable identity of the schedule in Redis. Changing it orphans the existing production schedule. */
  scheduleId: string;
}

export interface RecurringJobDescriptor {
  data: TGlobalScopeJobData;
  definition: AnyBackgroundJobDefinition;
  label: string;
  name: string;
  scheduleId: string;
  scope: string;
}

/**
 * Declares a recurring background job once, for both sides of the system: the worker registry (via
 * `definition`) and the producer that registers the schedule (via `name`/`scheduleId`/`scope`).
 *
 * What stays in `apps/web` is deliberate: the *timing* (cron pattern, interval, time zone — all
 * env-derived) and the real handler, which needs Prisma and app modules this package cannot import.
 * See `apps/web/lib/jobs/recurring-registrations.ts`.
 *
 * Handlers must be **idempotent and safe to overlap**: `BULLMQ_WORKER_CONCURRENCY` and
 * `BULLMQ_WORKER_COUNT` are operator-configurable and there may be several app replicas, so two ticks
 * of the same job can run at once. They must also stay I/O-bound — BullMQ renews the job lock on a
 * timer, so CPU-bound work that blocks the event loop is what makes a job stall, not a long runtime.
 */
export const defineRecurringJob = ({
  label,
  name,
  scheduleId,
}: RecurringJobInput): RecurringJobDescriptor => ({
  data: { scope: GLOBAL_SCOPE },
  definition: toAnyBackgroundJobDefinition({
    handle: createMissingOverrideHandler<TGlobalScopeJobData>(label, (data) => ({ scope: data.scope })),
    name,
    schema: ZGlobalScopeJobData,
  }),
  label,
  name,
  scheduleId,
  scope: GLOBAL_SCOPE,
});

/** Every recurring job in the system. Adding one here wires the registry, the producer and the exports. */
export const recurringJobDescriptors = {
  authzedProjectionDelivery: defineRecurringJob({
    label: "AuthZed projection delivery",
    name: JOB_NAMES.authzedProjectionDelivery,
    scheduleId: "authzed-projection-delivery",
  }),
  authzedReconciliationAudit: defineRecurringJob({
    label: "AuthZed reconciliation audit",
    name: JOB_NAMES.authzedReconciliationAudit,
    scheduleId: "authzed-reconciliation-audit",
  }),
  surveyArchivePurge: defineRecurringJob({
    label: "survey archive purge",
    name: JOB_NAMES.surveyArchivePurge,
    scheduleId: "daily-survey-archive-purge",
  }),
  surveyScheduling: defineRecurringJob({
    label: "survey scheduling",
    name: JOB_NAMES.surveyScheduling,
    scheduleId: "daily-survey-scheduling",
  }),
  usageTelemetry: defineRecurringJob({
    label: "usage telemetry",
    name: JOB_NAMES.usageTelemetry,
    scheduleId: "daily-usage-telemetry",
  }),
  workflowRunReconcile: defineRecurringJob({
    label: "workflow run reconcile",
    name: JOB_NAMES.workflowRunReconcile,
    scheduleId: "workflow-run-reconcile",
  }),
  workflowsUsageSnapshot: defineRecurringJob({
    label: "workflows usage snapshot",
    name: JOB_NAMES.workflowsUsageSnapshot,
    scheduleId: "daily-workflows-usage-snapshot",
  }),
} as const satisfies Record<string, RecurringJobDescriptor>;

export type TRecurringJobKey = keyof typeof recurringJobDescriptors;

/** The recurring jobs' worker-side definitions, keyed by job name for `backgroundJobDefinitions`. */
export const recurringJobDefinitions: Record<string, AnyBackgroundJobDefinition> = Object.fromEntries(
  Object.values(recurringJobDescriptors).map((descriptor) => [descriptor.name, descriptor.definition])
);
