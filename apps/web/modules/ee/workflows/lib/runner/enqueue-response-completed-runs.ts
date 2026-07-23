import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { type TWorkflowTriggerRunPayload, ZWorkflowTriggerRunPayload } from "@formbricks/workflows";
import { isDatabasePoolExhaustionError } from "@/lib/jobs/pool-exhaustion";
import { recordWorkflowRunCreatedMeterEvent } from "@/modules/ee/billing/lib/metering";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { type DispatchWorkflowRun } from "./dispatch";
import { markWorkflowRunDispatched } from "./mark-dispatched";
import {
  type WorkflowMatch,
  type WorkflowMatchCandidate,
  matchWorkflowsForResponse,
  readResponseCompletedTriggerConfig,
} from "./match-workflows";

/** The subset of a completed response the runner needs. Structurally satisfied by the response-pipeline payload. */
interface RunnerResponse {
  id: string;
  surveyId: string;
  finished: boolean;
  endingId?: string | null;
  updatedAt: Date;
  data: Record<string, unknown>;
}

interface EnqueueResponseCompletedWorkflowRunsInput {
  response: RunnerResponse;
  workspaceId: string;
  organizationId: string;
  // Passed through for workflow-run metering (ENG-1936). Null/absent off Formbricks Cloud or when the
  // org has no Stripe customer — the meter helper no-ops in those cases.
  stripeCustomerId?: string | null;
  dispatch: DispatchWorkflowRun;
  logContext?: Record<string, unknown>;
}

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === PrismaErrorType.UniqueConstraintViolation;

/**
 * Load the enabled workflows for a workspace as match candidates, each carrying its current published
 * version (highest `version`). Skips (and logs) two unrunnable cases so they never reach matching:
 * an enabled workflow with no published version (enable always publishes one — a data-integrity guard),
 * and a published version whose definition has no usable `response.completed` trigger (a malformed or
 * corrupt snapshot — the definition is unvalidated DB JSON).
 */
const loadEnabledWorkflowCandidates = async (
  workspaceId: string,
  logContext?: Record<string, unknown>
): Promise<WorkflowMatchCandidate[]> => {
  const workflows = await prisma.workflow.findMany({
    where: { workspaceId, status: "enabled" },
    select: {
      id: true,
      versions: { orderBy: { version: "desc" }, take: 1, select: { id: true, definition: true } },
    },
  });

  const candidates: WorkflowMatchCandidate[] = [];
  for (const workflow of workflows) {
    const publishedVersion = workflow.versions[0];
    if (!publishedVersion) {
      logger.warn(
        { ...logContext, workflowId: workflow.id, workspaceId },
        "Enabled workflow has no published version; skipping workflow run enqueue"
      );
      continue;
    }
    if (!readResponseCompletedTriggerConfig(publishedVersion.definition)) {
      logger.warn(
        { ...logContext, workflowId: workflow.id, workspaceId, workflowVersionId: publishedVersion.id },
        "Published workflow version has no usable response.completed trigger; skipping workflow run enqueue"
      );
      continue;
    }
    candidates.push({
      workflowId: workflow.id,
      publishedVersionId: publishedVersion.id,
      definition: publishedVersion.definition,
    });
  }

  return candidates;
};

/**
 * Persist one `queued` `WorkflowRun` for a matched workflow (bound to its published version) and return
 * its id. Idempotent: on the `@@unique([workflowId, idempotencyKey])` violation from a replayed pipeline
 * pass, returns the run already created on an earlier pass; a unique violation with no findable run is a
 * contradictory state and is surfaced. Transient DB pool exhaustion is rethrown so the pipeline retries
 * the whole (idempotent) enqueue; any other create failure is isolated per workflow (logged → null).
 */
const persistQueuedRun = async ({
  match,
  response,
  workspaceId,
  triggerPayload,
  logContext,
}: {
  match: WorkflowMatch;
  response: RunnerResponse;
  workspaceId: string;
  triggerPayload: TWorkflowTriggerRunPayload;
  logContext?: Record<string, unknown>;
}): Promise<{ id: string; createdAt: Date; isNew: boolean } | null> => {
  try {
    const run = await prisma.workflowRun.create({
      data: {
        workflowId: match.workflowId,
        workspaceId,
        workflowVersionId: match.publishedVersionId,
        status: "queued",
        triggerType: "response.completed",
        surveyId: response.surveyId,
        responseId: response.id,
        isDryRun: false,
        attempt: 0,
        idempotencyKey: response.id,
        triggerPayload,
      },
      select: { id: true, createdAt: true },
    });
    return { id: run.id, createdAt: run.createdAt, isNew: true };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.workflowRun.findUnique({
        where: { workflowId_idempotencyKey: { workflowId: match.workflowId, idempotencyKey: response.id } },
        select: { id: true, createdAt: true },
      });
      // isNew: false — a replayed enqueue re-found an already-persisted run. It must NOT be metered
      // again: Stripe only dedups a meter identifier for ~24h, so a retry beyond that window would
      // double-bill the same run (ENG-1936).
      if (existing) return { id: existing.id, createdAt: existing.createdAt, isNew: false };
      // The unique violation says a run exists, but we can't find it by its idempotency key — a
      // contradictory state with no run id to dispatch. Surface it rather than silently drop it.
      logger.error(
        { ...logContext, workflowId: match.workflowId, workspaceId, responseId: response.id },
        "Workflow run unique-constraint violation but no existing run found to re-dispatch"
      );
      return null;
    }
    if (isDatabasePoolExhaustionError(error)) {
      // Transient DB pool exhaustion: propagate so the pipeline retries the whole (idempotent) enqueue.
      throw error;
    }
    logger.error(
      { ...logContext, workflowId: match.workflowId, workspaceId, responseId: response.id, err: error },
      "Failed to persist workflow run"
    );
    return null;
  }
};

/**
 * Persist a `queued` `WorkflowRun` for a matched workflow and hand it to the dispatcher.
 *
 * If `dispatch` fails after the row is persisted, the run is left `queued` with no backing job — an
 * orphan. We log it distinctly (so it is alertable) and swallow rather than rethrow: rethrowing would
 * retry the whole response-pipeline job and re-run its other side-effects (webhooks, follow-ups,
 * notifications). The durable run row plus the `status` / `nextAttemptAt` indexes exist precisely so a
 * reconciler can re-dispatch orphaned runs; that reconciler is tracked separately (out of scope here).
 */
const createAndDispatchWorkflowRun = async ({
  match,
  response,
  workspaceId,
  stripeCustomerId,
  triggerPayload,
  dispatch,
  meterEvents,
  logContext,
}: {
  match: WorkflowMatch;
  response: RunnerResponse;
  workspaceId: string;
  stripeCustomerId?: string | null;
  triggerPayload: TWorkflowTriggerRunPayload;
  dispatch: DispatchWorkflowRun;
  meterEvents: Promise<void>[];
  logContext?: Record<string, unknown>;
}): Promise<void> => {
  const persisted = await persistQueuedRun({ match, response, workspaceId, triggerPayload, logContext });
  if (!persisted) {
    return;
  }
  const { id: workflowRunId, createdAt, isNew } = persisted;

  // Meter the run once, only when it is newly created (isNew) — a persisted run is billable
  // regardless of whether dispatch later succeeds, matching how responses meter at creation
  // (ENG-1936). A replayed enqueue that re-found an existing run is skipped so it can't double-bill
  // past Stripe's ~24h identifier-dedup window. These runs are always real (isDryRun: false); dry
  // runs are metered nowhere. Timestamped from the run's own createdAt so usage lands in the correct
  // billing period (response.updatedAt could be stale/older than Stripe's 35-day accept window).
  //
  // Cloud-only; the helper swallows its own errors, so metering never blocks or fails run creation.
  // The Stripe call starts here but is awaited by the caller only after the dispatch loop: it never
  // adds a round-trip to (or, on a Stripe hang, stalls) the serialized per-match dispatch below, yet
  // it is not dropped mid-flight if the worker exits right after the job completes — isNew is
  // consumed on creation, so a dropped event would leave the run permanently unbilled.
  if (isNew) {
    meterEvents.push(
      recordWorkflowRunCreatedMeterEvent({
        stripeCustomerId,
        workflowRunId,
        createdAt,
      })
    );
  }

  try {
    await dispatch({ workflowRunId, workflowId: match.workflowId, workspaceId });
  } catch (error) {
    logger.error(
      {
        ...logContext,
        workflowId: match.workflowId,
        workspaceId,
        responseId: response.id,
        workflowRunId,
        err: error,
      },
      "Workflow run persisted but dispatch failed; queued run is orphaned until the reconciler re-dispatches it"
    );
    return;
  }

  // Dispatch landed — record it as a durable DB fact (ENG-1658) so recovery can tell a genuine
  // never-dispatched orphan (dispatchedAt IS NULL) from a dispatched-but-lagging run. Best-effort:
  // a missed stamp self-heals on the next reconcile tick.
  await markWorkflowRunDispatched(workflowRunId, workspaceId, new Date(), {
    ...logContext,
    workflowId: match.workflowId,
    responseId: response.id,
  });
};

/**
 * Producer half of the workflow runner. On a completed response, find the enabled workflows whose
 * current published version targets this survey/ending, persist one `queued` `WorkflowRun` per match
 * (bound to that published version), and hand each to the injected dispatcher. Responses without an
 * ending card (surveys can have none) still count as completed: an "all endings" trigger fires for
 * them; only an explicit ending selection requires the response to have reached one of those cards.
 *
 * Idempotent: `idempotencyKey = responseId` + `@@unique([workflowId, idempotencyKey])` plus a
 * deterministic dispatch `jobId` mean a replayed `responseFinished` creates no duplicate runs or jobs.
 * Each match is isolated so one workflow's failure never blocks the others. The caller wraps the whole
 * call so a runner failure never affects the response pipeline.
 *
 * Entitlement gate: workflows is an EE feature (Cloud plan entitlement / self-hosted EE license).
 * The check runs only after a workflow actually matched — the common no-workflow response pays
 * nothing — and reads the Redis-cached entitlements context, so a non-entitled organization's
 * enabled workflows stop producing runs without an uncached per-response query.
 */
export const enqueueResponseCompletedWorkflowRuns = async ({
  response,
  workspaceId,
  organizationId,
  stripeCustomerId,
  dispatch,
  logContext,
}: EnqueueResponseCompletedWorkflowRunsInput): Promise<void> => {
  // Only completed responses enqueue runs; the ending card is optional (null on surveys without one).
  if (!response.finished) {
    return;
  }
  const endingId = response.endingId ?? null;

  const candidates = await loadEnabledWorkflowCandidates(workspaceId, logContext);
  const matches = matchWorkflowsForResponse(candidates, { surveyId: response.surveyId, endingId });
  if (matches.length === 0) {
    return;
  }

  const isWorkflowsEnabled = await getIsWorkflowsEnabled(organizationId);
  if (!isWorkflowsEnabled) {
    logger.info(
      {
        ...logContext,
        workspaceId,
        organizationId,
        responseId: response.id,
        matchedWorkflowIds: matches.map((match) => match.workflowId),
      },
      "Workflows entitlement missing for organization; skipping workflow run enqueue"
    );
    return;
  }

  // One trigger payload for every matched workflow. `triggeredAt` is derived from `response.updatedAt`
  // (not wall-clock) so a pipeline retry rebuilds a byte-identical payload.
  const triggerPayload = ZWorkflowTriggerRunPayload.parse({
    type: "response.completed",
    workspaceId,
    surveyId: response.surveyId,
    responseId: response.id,
    ...(endingId ? { endingCardId: endingId } : {}),
    data: response.data,
    triggeredAt: response.updatedAt.toISOString(),
  });

  const meterEvents: Promise<void>[] = [];
  for (const match of matches) {
    await createAndDispatchWorkflowRun({
      match,
      response,
      workspaceId,
      stripeCustomerId,
      triggerPayload,
      dispatch,
      meterEvents,
      logContext,
    });
  }

  // Meter events ran concurrently with the dispatch loop; settle them before returning so the job
  // holds the worker alive until every billed run is actually reported (parity with the awaited
  // response meter event). The helper owns its errors, so this only waits — it can never throw.
  await Promise.all(meterEvents);
};
