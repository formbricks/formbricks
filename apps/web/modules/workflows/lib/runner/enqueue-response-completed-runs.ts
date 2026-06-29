import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { type TWorkflowTriggerRunPayload, ZWorkflowTriggerRunPayload } from "@formbricks/workflows";
import { isDatabasePoolExhaustionError } from "@/lib/jobs/pool-exhaustion";
import { type DispatchWorkflowRun } from "./dispatch";
import {
  type WorkflowMatch,
  type WorkflowMatchCandidate,
  matchWorkflowsForResponse,
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
  dispatch: DispatchWorkflowRun;
  logContext?: Record<string, unknown>;
}

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === PrismaErrorType.UniqueConstraintViolation;

/**
 * Load the enabled workflows for a workspace as match candidates, each carrying its current published
 * version (highest `version`). Enabled workflows with no published version are logged and skipped —
 * a data-integrity guard, since enable always publishes a version — so we never build an unrunnable run.
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
    candidates.push({
      workflowId: workflow.id,
      publishedVersionId: publishedVersion.id,
      definition: publishedVersion.definition,
    });
  }

  return candidates;
};

/**
 * Persist one `queued` `WorkflowRun` for a matched workflow (bound to its published version) and hand it
 * to the dispatcher. Idempotent: on the `@@unique([workflowId, idempotencyKey])` violation from a
 * replayed pipeline pass, re-dispatch the existing run (covers "created but not enqueued"); a unique
 * violation with no findable run is surfaced as a contradictory state. Transient DB pool exhaustion is
 * rethrown so the pipeline retries the whole (idempotent) enqueue; any other failure is isolated per
 * workflow (logged, so one bad workflow never blocks the rest).
 */
const createAndDispatchWorkflowRun = async ({
  match,
  response,
  workspaceId,
  triggerPayload,
  dispatch,
  logContext,
}: {
  match: WorkflowMatch;
  response: RunnerResponse;
  workspaceId: string;
  triggerPayload: TWorkflowTriggerRunPayload;
  dispatch: DispatchWorkflowRun;
  logContext?: Record<string, unknown>;
}): Promise<void> => {
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
      select: { id: true },
    });
    await dispatch({ workflowRunId: run.id, workflowId: match.workflowId, workspaceId });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.workflowRun.findUnique({
        where: { workflowId_idempotencyKey: { workflowId: match.workflowId, idempotencyKey: response.id } },
        select: { id: true },
      });
      if (existing) {
        await dispatch({ workflowRunId: existing.id, workflowId: match.workflowId, workspaceId });
      } else {
        // The unique violation says a run exists, but we can't find it by its idempotency key — a
        // contradictory state with no run id to dispatch. Surface it rather than silently drop it.
        logger.error(
          { ...logContext, workflowId: match.workflowId, workspaceId, responseId: response.id },
          "Workflow run unique-constraint violation but no existing run found to re-dispatch"
        );
      }
      return;
    }
    if (isDatabasePoolExhaustionError(error)) {
      // Transient DB pool exhaustion: propagate so the pipeline retries the whole (idempotent)
      // enqueue rather than swallow it and silently drop this workflow's run.
      throw error;
    }
    logger.error(
      { ...logContext, workflowId: match.workflowId, workspaceId, responseId: response.id, err: error },
      "Failed to create or dispatch workflow run"
    );
  }
};

/**
 * Producer half of the workflow runner. On a completed response that reached an ending card, find the
 * enabled workflows whose current published version targets this survey/ending, persist one `queued`
 * `WorkflowRun` per match (bound to that published version), and hand each to the injected dispatcher.
 *
 * Idempotent: `idempotencyKey = responseId` + `@@unique([workflowId, idempotencyKey])` plus a
 * deterministic dispatch `jobId` mean a replayed `responseFinished` creates no duplicate runs or jobs.
 * Each match is isolated so one workflow's failure never blocks the others. The caller wraps the whole
 * call so a runner failure never affects the response pipeline.
 */
export const enqueueResponseCompletedWorkflowRuns = async ({
  response,
  workspaceId,
  dispatch,
  logContext,
}: EnqueueResponseCompletedWorkflowRunsInput): Promise<void> => {
  // Only completed responses that reached an ending card enqueue runs.
  if (!response.finished || !response.endingId) {
    return;
  }
  const endingId = response.endingId;

  const candidates = await loadEnabledWorkflowCandidates(workspaceId, logContext);
  const matches = matchWorkflowsForResponse(candidates, { surveyId: response.surveyId, endingId });
  if (matches.length === 0) {
    return;
  }

  // One trigger payload for every matched workflow. `triggeredAt` is derived from `response.updatedAt`
  // (not wall-clock) so a pipeline retry rebuilds a byte-identical payload.
  const triggerPayload = ZWorkflowTriggerRunPayload.parse({
    type: "response.completed",
    workspaceId,
    surveyId: response.surveyId,
    responseId: response.id,
    endingCardId: endingId,
    data: response.data,
    triggeredAt: response.updatedAt.toISOString(),
  });

  for (const match of matches) {
    await createAndDispatchWorkflowRun({
      match,
      response,
      workspaceId,
      triggerPayload,
      dispatch,
      logContext,
    });
  }
};
