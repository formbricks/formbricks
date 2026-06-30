import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import { type JobHandler, type TWorkflowRunJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import {
  type TResolvedWorkflowEmail,
  type TWorkflowExecutableStep,
  type TWorkflowRunData,
  type TWorkflowStepResult,
  type TWorkflowTriggerRunPayload,
  ZWorkflowExecutableDefinition,
  ZWorkflowRunData,
  ZWorkflowTriggerRunPayload,
  planExecutableSteps,
  resolveWorkflowEmail,
} from "@formbricks/workflows";
import { isDatabasePoolExhaustionError } from "@/lib/jobs/pool-exhaustion";
import { sendEmail } from "@/modules/email";

/** Run states from which there is no further work — replays/redeliveries on these are no-ops. */
const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled"]);

/** Run states a delivery may claim by transitioning to `running`. */
const CLAIMABLE_STATUSES = ["queued"] as const;

const EMAIL_PROVIDER = "smtp";

const workflowRunSelect = {
  id: true,
  status: true,
  attempt: true,
  triggerPayload: true,
  workflowVersion: { select: { definition: true } },
  workflow: { select: { definition: true } },
} as const;

/** Thrown when the run cannot be executed at all (definition missing/invalid). Marks the run failed. */
class WorkflowRunNotExecutableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowRunNotExecutableError";
  }
}

/**
 * Thrown when a step fails after some steps may have run. Carries the partial `data.steps` so the
 * single failure-persistence path records the executed trace alongside the failed status.
 */
class WorkflowStepFailedError extends Error {
  readonly runData: TWorkflowRunData;
  constructor(message: string, runData: TWorkflowRunData) {
    super(message);
    this.name = "WorkflowStepFailedError";
    this.runData = runData;
  }
}

const toError = (error: unknown, fallbackMessage: string): Error =>
  error instanceof Error ? error : new Error(fallbackMessage);

const getWorkflowRunLogContext = (
  data: TWorkflowRunJobData,
  context: Parameters<JobHandler<TWorkflowRunJobData>>[1]
) => ({
  attempt: context.attempt,
  jobId: context.jobId,
  jobName: context.jobName,
  maxAttempts: context.maxAttempts,
  queueName: context.queueName,
  workflowId: data.workflowId,
  workflowRunId: data.workflowRunId,
  workspaceId: data.workspaceId,
});

/**
 * Builds the deterministic message id stored on a step output. Stable across retries for the same
 * run + step, so a replayed send is traceable to the same logical message.
 */
const buildMessageId = (workflowRunId: string, stepId: string): string =>
  createHash("sha256").update(`${workflowRunId}:${stepId}`).digest("hex");

/**
 * Resolve the run's executable definition: prefer the immutable `workflowVersion.definition`
 * snapshot, fall back to the workflow's live `definition`. The persisted JSON is untrusted, so it is
 * parsed through `ZWorkflowExecutableDefinition`; a non-executable definition fails the run.
 */
const resolveExecutableDefinition = (run: {
  workflowVersion: { definition: unknown } | null;
  workflow: { definition: unknown };
}): ReturnType<typeof ZWorkflowExecutableDefinition.parse> => {
  const rawDefinition = run.workflowVersion?.definition ?? run.workflow.definition;
  const parsed = ZWorkflowExecutableDefinition.safeParse(rawDefinition);
  if (!parsed.success) {
    throw new WorkflowRunNotExecutableError("Workflow run definition is not executable");
  }
  return parsed.data;
};

interface ExecutedStep {
  result: TWorkflowStepResult;
  log: {
    sequence: number;
    stepId: string;
    stepType: string;
    status: TWorkflowStepResult["status"];
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    error: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
  };
}

/**
 * Executes one `send_email` step: resolves placeholders against the trigger payload, validates the
 * resolved recipient, and performs the send. Returns a per-step result + log row. An invalid resolved
 * recipient, a `false` return from `sendEmail` (SMTP unconfigured), and a thrown send failure all
 * produce a `failed` step; the caller fails the whole run on a failed step so the error propagates to
 * the run lifecycle.
 */
const executeSendEmailStep = async ({
  step,
  sequence,
  triggerPayload,
  workflowRunId,
}: {
  step: TWorkflowExecutableStep;
  sequence: number;
  triggerPayload: TWorkflowTriggerRunPayload;
  workflowRunId: string;
}): Promise<ExecutedStep> => {
  const startedAt = new Date();
  const email: TResolvedWorkflowEmail = resolveWorkflowEmail(step.node.config, triggerPayload);
  const input = { to: email.to, subject: email.subject };

  let status: TWorkflowStepResult["status"] = "succeeded";
  let error: string | null = null;
  let output: Record<string, unknown> = {};

  if (!email.recipientValid) {
    // The recipient is templated from respondent-controlled data; never hand an invalid address to SMTP.
    status = "failed";
    error = "Resolved email recipient is not a valid address";
  } else {
    try {
      const sent = await sendEmail({
        to: email.to,
        from: email.from,
        replyTo: email.replyTo.length > 0 ? email.replyTo.join(", ") : undefined,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });

      if (!sent) {
        status = "failed";
        error = "SMTP is not configured; workflow email was not sent";
      } else {
        output = { messageId: buildMessageId(workflowRunId, step.stepId), provider: EMAIL_PROVIDER };
      }
    } catch (sendError) {
      status = "failed";
      error = toError(sendError, "Failed to send workflow email").message;
    }
  }

  const finishedAt = new Date();

  const result: TWorkflowStepResult = {
    stepId: step.stepId,
    stepType: step.stepType,
    status,
    input,
    output,
    ...(error ? { error } : {}),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };

  return {
    result,
    log: {
      sequence,
      stepId: step.stepId,
      stepType: step.stepType,
      status,
      input,
      output,
      error,
      startedAt,
      finishedAt,
    },
  };
};

/** Reconstructs a succeeded step result from a previously persisted succeeded log row, so a retry resumes. */
const resultFromSucceededLog = (log: {
  stepId: string;
  stepType: string;
  input: unknown;
  output: unknown;
  startedAt: Date | null;
  finishedAt: Date | null;
}): TWorkflowStepResult => ({
  stepId: log.stepId,
  stepType: log.stepType,
  status: "succeeded",
  input: (log.input as Record<string, unknown>) ?? {},
  output: (log.output as Record<string, unknown>) ?? {},
  startedAt: log.startedAt?.toISOString() ?? new Date().toISOString(),
  finishedAt: log.finishedAt?.toISOString() ?? new Date().toISOString(),
});

/**
 * Persists a step's log row. The caller skips already-`succeeded` steps before reaching here, so a
 * retry never accumulates duplicate rows for an already-completed step. The run is already proven to
 * belong to the workspace, so `runId` is the tenant-scoped key here.
 */
const persistStepLog = async (runId: string, log: ExecutedStep["log"]): Promise<void> => {
  await prisma.workflowRunLog.create({
    data: {
      runId,
      sequence: log.sequence,
      stepId: log.stepId,
      stepType: log.stepType,
      status: log.status,
      input: log.input,
      output: log.output,
      error: log.error,
      startedAt: log.startedAt,
      finishedAt: log.finishedAt,
    },
  });
};

/**
 * Apps/web handler for the `workflow-run.process` BullMQ job. Loads the run (tenant-scoped by
 * `workspaceId`), walks its executable trigger → `send_email` graph, sends each email, persists
 * per-step `WorkflowRunLog` rows plus the mirrored `data.steps`, and transitions the run
 * `queued → running → completed|failed`.
 *
 * Tenant-scoped: every read and write is constrained by `data.workspaceId`; a run that does not match
 * the job's workspace is treated as not found and the job is dropped (no retry).
 *
 * Replay/retry-safe: a run already terminal is a no-op; the `queued → running` claim is a conditional
 * `updateMany` so concurrent deliveries cannot both process it; and a step that already has a
 * `succeeded` log is skipped (resumed) rather than re-sent, so a retry after a partial run does not
 * double-send. On transient DB pool exhaustion the error is rethrown so BullMQ retries; a definitive
 * execution failure is recorded on the run and only rethrown before the final attempt.
 */
export const processWorkflowRunJob: JobHandler<TWorkflowRunJobData> = async (data, context) => {
  const logContext = getWorkflowRunLogContext(data, context);

  const run = await prisma.workflowRun.findFirst({
    where: { id: data.workflowRunId, workspaceId: data.workspaceId },
    select: workflowRunSelect,
  });

  if (!run) {
    // Missing OR cross-workspace: the row is the durable source of truth and a tenant mismatch must
    // never be retried into a foreign workspace. Drop the job either way.
    logger.error(logContext, "Workflow run not found for workspace; dropping job");
    return;
  }

  if (TERMINAL_STATUSES.has(run.status)) {
    logger.info({ ...logContext, status: run.status }, "Workflow run already terminal; skipping");
    return;
  }

  try {
    const triggerPayload = ZWorkflowTriggerRunPayload.parse(run.triggerPayload);
    const definition = resolveExecutableDefinition(run);
    const steps = planExecutableSteps(definition);

    // Claim the run with a conditional, tenant-scoped transition so two concurrent deliveries cannot
    // both flip queued -> running and double-process. 0 rows means another delivery already claimed it.
    const claim = await prisma.workflowRun.updateMany({
      where: { id: run.id, workspaceId: data.workspaceId, status: { in: [...CLAIMABLE_STATUSES] } },
      data: { status: "running", startedAt: new Date(), attempt: context.attempt },
    });

    if (claim.count === 0 && run.status === "queued") {
      logger.info(logContext, "Workflow run already claimed by another delivery; skipping");
      return;
    }

    // Steps that already have a succeeded log (from a prior attempt) are resumed, not re-sent.
    const succeededLogs = await prisma.workflowRunLog.findMany({
      where: { runId: run.id, status: "succeeded" },
      select: { stepId: true, stepType: true, input: true, output: true, startedAt: true, finishedAt: true },
    });
    const succeededByStepId = new Map(succeededLogs.map((log) => [log.stepId, log]));

    const stepResults: TWorkflowStepResult[] = [];
    let failure: string | null = null;

    for (const [index, step] of steps.entries()) {
      const alreadySucceeded = succeededByStepId.get(step.stepId);
      if (alreadySucceeded) {
        // Resume: do not re-send and do not write a duplicate log row; just advance the plan.
        stepResults.push(resultFromSucceededLog(alreadySucceeded));
        continue;
      }

      const executed = await executeSendEmailStep({
        step,
        sequence: index + 1,
        triggerPayload,
        workflowRunId: run.id,
      });

      await persistStepLog(run.id, executed.log);
      stepResults.push(executed.result);

      if (executed.result.status === "failed") {
        failure = executed.result.error ?? "Workflow step failed";
        break;
      }
    }

    const runData: TWorkflowRunData = ZWorkflowRunData.parse({
      trigger: triggerPayload,
      steps: stepResults,
    });

    if (failure) {
      throw new WorkflowStepFailedError(failure, runData);
    }

    await prisma.workflowRun.updateMany({
      where: { id: run.id, workspaceId: data.workspaceId },
      data: { status: "completed", finishedAt: new Date(), data: runData },
    });
  } catch (error) {
    // Transient DB pool exhaustion is always retryable: rethrow so BullMQ retries the whole job.
    if (isDatabasePoolExhaustionError(error)) {
      logger.warn({ ...logContext, err: error }, "Workflow run job hit database pool exhaustion; will retry");
      throw error;
    }

    const runData = error instanceof WorkflowStepFailedError ? error.runData : undefined;
    await markRunFailed(run.id, data.workspaceId, error, runData, logContext);

    // Before the final attempt, rethrow so BullMQ retries. On the last attempt, swallow — the failure
    // is durably recorded on the run, and rethrowing would only re-log without changing the outcome.
    if (context.attempt < context.maxAttempts) {
      throw toError(error, "Workflow run job failed");
    }

    logger.error({ ...logContext, err: error }, "Workflow run job failed after final attempt");
  }
};

/**
 * Records a failed terminal state on the run, tenant-scoped by `workspaceId`. Best-effort: a
 * persistence failure here is logged but never masks the original execution error the caller is about
 * to rethrow/swallow.
 */
const markRunFailed = async (
  runId: string,
  workspaceId: string,
  error: unknown,
  runData: TWorkflowRunData | undefined,
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<void> => {
  const finishedAt = new Date();
  try {
    await prisma.workflowRun.updateMany({
      where: { id: runId, workspaceId },
      data: {
        status: "failed",
        error: toError(error, "Workflow run job failed").message,
        lastErrorAt: finishedAt,
        finishedAt,
        ...(runData ? { data: runData } : {}),
      },
    });
  } catch (persistError) {
    logger.error({ ...logContext, err: persistError }, "Failed to persist workflow run failure state");
  }
};
