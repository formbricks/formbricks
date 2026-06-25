import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { ZWorkflowTriggerRunPayload } from "@formbricks/workflows";
import { type DispatchWorkflowRun } from "./dispatch";
import { type WorkflowMatchCandidate, matchWorkflowsForResponse } from "./match-workflows";

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
      // Enable always publishes a version, so this is a data-integrity guard: never enqueue an
      // unrunnable run for an enabled workflow that somehow has no published version.
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
        // The run already exists from an earlier pipeline pass. Re-dispatch (idempotent via jobId) in
        // case that pass created the run but failed to enqueue — no duplicate run, no duplicate job.
        const existing = await prisma.workflowRun.findUnique({
          where: { workflowId_idempotencyKey: { workflowId: match.workflowId, idempotencyKey: response.id } },
          select: { id: true },
        });
        if (existing) {
          await dispatch({ workflowRunId: existing.id, workflowId: match.workflowId, workspaceId });
        }
        continue;
      }
      logger.error(
        { ...logContext, workflowId: match.workflowId, workspaceId, responseId: response.id, err: error },
        "Failed to create or dispatch workflow run"
      );
    }
  }
};
