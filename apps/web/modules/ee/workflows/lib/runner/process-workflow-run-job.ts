import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { type JobHandler, type TWorkflowRunJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import {
  type TWorkflowExecutableDefinition,
  type TWorkflowRunContext,
  type TWorkflowRunData,
  type TWorkflowStepNode,
  type TWorkflowStepResult,
  type TWorkflowStepType,
  type TWorkflowTriggerRunPayload,
  WorkflowWalkError,
  ZWorkflowExecutableDefinition,
  ZWorkflowRunData,
  ZWorkflowTriggerRunPayload,
  getWorkflowStepType,
  walkWorkflowSteps,
} from "@formbricks/workflows";
import { isDatabasePoolExhaustionError } from "@/lib/jobs/pool-exhaustion";
import { captureWorkflowRunFailed } from "@/modules/ee/workflows/lib/analytics/run-failure";
import { type WorkflowRunEffects, liveWorkflowRunEffects } from "./effects";
import {
  type WorkflowRunEnvironment,
  WorkflowRunNotExecutableError,
  createInitialRunContext,
  loadWorkflowRunEnvironment,
} from "./run-environment";
import { getWorkflowStepExecutor } from "./steps";
import type { WorkflowStepExecutor } from "./steps/types";

/** Run states from which there is no further work — replays/redeliveries on these are no-ops. */
const TERMINAL_STATUS_LIST = ["completed", "failed", "canceled"] as const;
const TERMINAL_STATUSES = new Set<string>(TERMINAL_STATUS_LIST);

/** Run states a delivery may claim by transitioning to `running`. */
const CLAIMABLE_STATUSES = ["queued"] as const;

const workflowRunSelect = {
  id: true,
  status: true,
  attempt: true,
  triggerType: true,
  triggerPayload: true,
  workflowVersion: { select: { definition: true } },
  // `createdBy` carries the per-user email limit: the respondent who triggers a run is anonymous.
  workflow: { select: { definition: true, createdBy: true } },
} as const;

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

const toError = (error: unknown, fallbackMessage: string): Error => {
  if (error instanceof Error) return error;
  return new Error(fallbackMessage);
};

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

/** A persisted `WorkflowRunLog` row, as much of it as the claim/resume logic needs. */
interface StepLogRow {
  stepId: string;
  stepType: string;
  status: TWorkflowStepResult["status"];
  input: unknown;
  output: unknown;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

const stepLogSelect = {
  stepId: true,
  stepType: true,
  status: true,
  input: true,
  output: true,
  error: true,
  startedAt: true,
  finishedAt: true,
} as const;

/** Reconstructs a step result from its persisted log row (used to resume a `succeeded` step, or record a `skipped` one). */
const resultFromLogRow = (log: StepLogRow, status: TWorkflowStepResult["status"]): TWorkflowStepResult => ({
  stepId: log.stepId,
  stepType: log.stepType,
  status,
  input: (log.input as Record<string, unknown>) ?? {},
  output: (log.output as Record<string, unknown>) ?? {},
  ...(log.error ? { error: log.error } : {}),
  startedAt: log.startedAt?.toISOString() ?? new Date().toISOString(),
  finishedAt: log.finishedAt?.toISOString() ?? new Date().toISOString(),
});

/**
 * A step result plus what later steps read under its id, when that differs from the stored output
 * (an HTTP response kept whole in memory, ENG-7179). `ZWorkflowRunData` drops `variables` when the
 * run's `data.steps` is written, so it never reaches the database.
 */
type ExecutedStep = TWorkflowStepResult & { variables?: Record<string, unknown> };

const toRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** A step taken from its log row: its Variables rebuilt from the stored output (≤64 KB of a response). */
const resumedStep = (
  executor: WorkflowStepExecutor<TWorkflowStepType>,
  result: TWorkflowStepResult
): ExecutedStep =>
  executor.variablesFromOutput
    ? { ...result, variables: executor.variablesFromOutput(result.output ?? {}) }
    : result;

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === PrismaErrorType.UniqueConstraintViolation;

/** Everything one step needs from the run it belongs to. */
interface StepRunInput {
  node: TWorkflowStepNode;
  stepType: TWorkflowStepType;
  executor: WorkflowStepExecutor<TWorkflowStepType>;
  sequence: number;
  runId: string;
  context: TWorkflowRunContext;
  environment: WorkflowRunEnvironment;
  effects: WorkflowRunEffects;
}

/**
 * Runs an owned step (we hold its `running` log row) and records the terminal outcome onto that same
 * row via `update` (never a second `create` — the `(runId, stepId)` unique constraint forbids it).
 *
 * At-most-once tradeoff for steps with effects: we claim (`running`) BEFORE the effect, so if the
 * process crashes between a successful SMTP handoff and the `succeeded` update, the retry sees
 * `running` and will NOT re-send — that email is potentially lost rather than duplicated. This is the
 * accepted policy: never send the same step twice.
 */
const executeOwnedStep = async (step: StepRunInput): Promise<ExecutedStep> => {
  const { status, error, output, variables } = await step.executor.execute({
    node: step.node,
    context: step.context,
    environment: step.environment,
    effects: step.effects,
  });
  const finishedAt = new Date();

  await prisma.workflowRunLog.update({
    where: { runId_stepId: { runId: step.runId, stepId: step.node.id } },
    data: { status, output, error, finishedAt },
  });

  return {
    stepId: step.node.id,
    stepType: step.stepType,
    status,
    input: step.executor.describeInput(step.node),
    output,
    ...(error ? { error } : {}),
    startedAt: finishedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    ...(variables ? { variables } : {}),
  };
};

/**
 * Claims a not-yet-succeeded step and runs it. Two claim paths:
 *  - no row: `create` a `running` row. A P2002 means a concurrent worker created it first — the
 *    caller bails.
 *  - existing row in a re-runnable state: flip it to `running` via a conditional `updateMany`;
 *    `count===0` means another worker already claimed it, so the caller bails (at-most-once).
 *    `failed`/`pending`/`skipped` never had their effect; a `running` step without effects (If/else)
 *    is safe to evaluate again.
 * Returns `null` when the claim was lost.
 */
const claimAndRunStep = async (
  step: StepRunInput,
  existing: StepLogRow | null
): Promise<ExecutedStep | null> => {
  const startedAt = new Date();

  if (!existing) {
    try {
      await prisma.workflowRunLog.create({
        data: {
          runId: step.runId,
          sequence: step.sequence,
          stepId: step.node.id,
          stepType: step.stepType,
          status: "running",
          input: step.executor.describeInput(step.node),
          startedAt,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return null; // Concurrent create won; the caller bails.
      }
      throw error;
    }
    return executeOwnedStep(step);
  }

  const reclaimable: TWorkflowStepResult["status"][] = ["failed", "pending", "skipped"];
  if (!step.executor.hasEffects) reclaimable.push("running");

  const claim = await prisma.workflowRunLog.updateMany({
    where: { runId: step.runId, stepId: step.node.id, status: { in: reclaimable } },
    data: { status: "running", startedAt, output: {}, error: null, finishedAt: null },
  });
  if (claim.count === 0) {
    return null; // Another worker claimed it first; skip per at-most-once.
  }
  return executeOwnedStep(step);
};

/**
 * Sentinel: another live delivery (or a stalled prior attempt) owns this run. The current execution
 * must stop and leave the run `running` rather than finalize it — otherwise a second worker could
 * `complete` the run while the owner's in-flight send is still resolving (possibly to `failed`),
 * masking the failure. The owner finishes the run; a truly stuck one is recovered by the
 * execution-side reconciler (`reconcile-stuck-running-runs.ts`), which fails the run and skips its
 * orphaned steps.
 */
const STEP_BAIL = Symbol("workflow-step-bail");

/**
 * Runs one step with a per-step claim guard:
 *  - `succeeded` row → resume (not run again; its output, an If/else's branch included, is reused).
 *  - `running` row of a step with effects → owned by a concurrent delivery / stalled attempt → BAIL.
 *  - otherwise → claim, then run. A lost claim also BAILs.
 */
const runStep = async (
  step: StepRunInput,
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<ExecutedStep | typeof STEP_BAIL> => {
  const existing: StepLogRow | null = await prisma.workflowRunLog.findFirst({
    where: { runId: step.runId, stepId: step.node.id },
    select: stepLogSelect,
  });

  if (existing?.status === "succeeded") {
    return resumedStep(step.executor, resultFromLogRow(existing, "succeeded"));
  }

  // A "Don't wait" call handed to its own job (ENG-7179): that job owns the row now. Never run it again,
  // whatever state the job left it in; the walk just goes on.
  if (existing && step.executor.handedOff?.(toRecord(existing.output))) {
    return resumedStep(step.executor, resultFromLogRow(existing, existing.status));
  }

  if (existing?.status === "running" && step.executor.hasEffects) {
    // A `running` row we did NOT just create means another live delivery (or a stalled prior attempt)
    // owns this run. At-most-once: never re-send; and don't finalize the run — bail and let the owner.
    logger.warn(
      { ...logContext, stepId: step.node.id },
      "Workflow step already in-flight (running); another delivery owns this run — bailing"
    );
    return STEP_BAIL;
  }

  const result = await claimAndRunStep(step, existing);
  if (result) {
    return result;
  }

  // Claim lost to a concurrent delivery after we read the row — bail rather than risk a double-send or
  // prematurely finalizing a run the winner still owns.
  logger.warn(
    { ...logContext, stepId: step.node.id },
    "Workflow step claim lost to a concurrent delivery — bailing"
  );
  return STEP_BAIL;
};

/**
 * Claims the run with a conditional, tenant-scoped `queued → running` transition so two concurrent
 * deliveries cannot both process it. Returns `false` when the claim loses the race (0 rows updated
 * while the loaded status was still `queued`); a loaded `running` status is a legitimate retry and
 * still claims (so the resume path runs).
 */
const claimRun = async (
  run: { id: string; status: string },
  workspaceId: string,
  attempt: number,
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<boolean> => {
  const claim = await prisma.workflowRun.updateMany({
    where: { id: run.id, workspaceId, status: { in: [...CLAIMABLE_STATUSES] } },
    data: { status: "running", startedAt: new Date(), attempt },
  });

  if (claim.count === 0 && run.status === "queued") {
    logger.info(logContext, "Workflow run already claimed by another delivery; skipping");
    return false;
  }
  return true;
};

type WalkOutcome =
  | { bail: true }
  | { bail: false; stepResults: TWorkflowStepResult[]; failure: string | null };

/**
 * Walks the run's graph from the trigger (ADR 0047) under the per-step claim guard (`runStep`):
 * each step's output joins the run context under its id, and an If/else's output picks the branch.
 * Three outcomes:
 *  - `bail`: a step is owned by a concurrent delivery / stalled attempt → stop, do NOT finalize the run
 *    (the owner does). The per-step `WorkflowRunLog` rows remain the source of truth for the run's state.
 *  - `failure`: a step definitively failed this attempt → fail the whole run (row stays `failed`,
 *    which is retryable).
 *  - success: the walk reached the end of its branch.
 */
const walkRun = async (
  definition: TWorkflowExecutableDefinition,
  runId: string,
  environment: WorkflowRunEnvironment,
  effects: WorkflowRunEffects,
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<WalkOutcome> => {
  const context = createInitialRunContext(environment);
  const stepResults: TWorkflowStepResult[] = [];
  let failure: string | null = null;
  let bailed = false;

  await walkWorkflowSteps(definition, async (node, sequence) => {
    const executor = getWorkflowStepExecutor(node);
    const result = await runStep(
      { node, stepType: getWorkflowStepType(node), executor, sequence, runId, context, environment, effects },
      logContext
    );
    if (result === STEP_BAIL) {
      bailed = true;
      return { next: "stop" };
    }

    stepResults.push(result);
    const output = result.output ?? {};
    // A handed-off step's final outcome belongs to its job and never fails the run.
    if (result.status === "failed" && !executor.handedOff?.(output)) {
      failure = result.error ?? "Workflow step failed";
      return { next: "stop" };
    }

    context.steps[node.id] = result.variables ?? output;
    // A rate-limited (skipped) step has no result to branch on; only a succeeded one decides.
    return result.status === "succeeded" && executor.decide ? executor.decide(output) : { next: "continue" };
  });

  return bailed ? { bail: true } : { bail: false, stepResults, failure };
};

/** Walks the claimed run to completion, throwing `WorkflowStepFailedError` (with the trace) on a failed step. */
const executeClaimedRun = async (
  run: {
    id: string;
    workflowVersion: { definition: unknown } | null;
    workflow: { definition: unknown; createdBy: string | null };
  },
  data: TWorkflowRunJobData,
  triggerPayload: TWorkflowTriggerRunPayload,
  effects: WorkflowRunEffects,
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<void> => {
  const definition = resolveExecutableDefinition(run);
  const environment = await loadWorkflowRunEnvironment({
    runId: run.id,
    workflowId: data.workflowId,
    workspaceId: data.workspaceId,
    trigger: triggerPayload,
    definition,
    actorUserId: run.workflow.createdBy ?? null,
  });

  const outcome = await walkRun(definition, run.id, environment, effects, logContext);

  if (outcome.bail) {
    // Another live delivery / stalled attempt owns this run; leave it `running` for the owner to finish.
    logger.info(logContext, "Workflow run owned by another delivery; leaving it running without finalizing");
    return;
  }

  const runData: TWorkflowRunData = ZWorkflowRunData.parse({
    trigger: triggerPayload,
    steps: outcome.stepResults,
  });

  if (outcome.failure) {
    throw new WorkflowStepFailedError(outcome.failure, runData);
  }

  // Status-guarded terminal write: only finalize a run that is still `running`. A 0-row result means
  // another delivery already finalized it — don't clobber its verdict.
  const completed = await prisma.workflowRun.updateMany({
    where: { id: run.id, workspaceId: data.workspaceId, status: "running" },
    data: { status: "completed", finishedAt: new Date(), data: runData },
  });
  if (completed.count === 0) {
    logger.info(logContext, "Workflow run already finalized by another delivery; skipping completion write");
  }
};

/**
 * Handles a run-execution error. On a non-final attempt the run stays non-terminal (only the error
 * trace is recorded) and the error is rethrown so BullMQ retries — this holds for both transient DB
 * pool exhaustion and definitive execution failures. On the FINAL attempt (including the prod
 * `maxAttempts:1` config, where the first attempt IS the final one) a terminal `failed` is recorded
 * and the error is swallowed, so a pool-exhaustion or any other failure never strands the run in
 * `running` with no retry left.
 */
const handleRunError = async (
  error: unknown,
  run: { id: string; triggerType: string },
  data: TWorkflowRunJobData,
  context: Parameters<JobHandler<TWorkflowRunJobData>>[1],
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<void> => {
  const runData = error instanceof WorkflowStepFailedError ? error.runData : undefined;
  const isFinalAttempt = context.attempt >= context.maxAttempts;

  if (!isFinalAttempt) {
    // Retryable: don't write a terminal status (would defeat the retry via the terminal-skip guard).
    // Record the error trace for observability, then rethrow so BullMQ retries the whole job.
    if (isDatabasePoolExhaustionError(error)) {
      logger.warn({ ...logContext, err: error }, "Workflow run job hit database pool exhaustion; will retry");
    }
    await recordRunFailure(run.id, data.workspaceId, error, runData, false, logContext);
    throw toError(error, "Workflow run job failed");
  }

  // Final attempt: commit a terminal `failed` and swallow. Pool exhaustion on the last attempt must be
  // recorded here rather than rethrown into the void, or the run would stay stuck `running` forever.
  const recorded = await recordRunFailure(run.id, data.workspaceId, error, runData, true, logContext);
  logger.error({ ...logContext, err: error }, "Workflow run job failed after final attempt");
  // Only the delivery whose terminal write landed reports the failure. A losing concurrent delivery
  // (0 rows, or a persistence error) must neither duplicate the event nor report a failure over a run
  // another delivery has already completed.
  if (recorded) {
    await captureWorkflowRunFailed({
      runId: run.id,
      workflowId: data.workflowId,
      workspaceId: data.workspaceId,
      triggerType: run.triggerType,
      failedStepType: runData?.steps.findLast((step) => step.status === "failed")?.stepType ?? null,
      errorKind: classifyRunError(error),
      attempt: context.attempt,
    });
  }
};

/** Coarse, PII-free failure class for analytics; the message itself can name a recipient. */
const classifyRunError = (error: unknown): string => {
  if (error instanceof WorkflowRunNotExecutableError || error instanceof WorkflowWalkError) {
    return "not_executable";
  }
  if (error instanceof WorkflowStepFailedError) return "step_failed";
  if (isDatabasePoolExhaustionError(error)) return "database_pool_exhausted";
  return "unknown";
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
 * Replay/retry-safe (at-most-once email delivery): a run already terminal is a no-op; the
 * `queued → running` claim is a conditional `updateMany` so concurrent deliveries can't both process
 * it; and beneath that, each step is claimed BEFORE its send via a `(runId, stepId)`-unique
 * `WorkflowRunLog` row — a `succeeded` step resumes, a `running` (already-attempted) step is skipped
 * (never re-sent), and only a definitively `failed` step is re-sent (it never went out). On a non-final
 * attempt any failure (incl. DB pool exhaustion) is rethrown so BullMQ retries; on the final attempt a
 * terminal `failed` is recorded and swallowed so the run never stays stuck `running`.
 */
export const createWorkflowRunJobHandler =
  (effects: WorkflowRunEffects): JobHandler<TWorkflowRunJobData> =>
  async (data, context) => {
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

      const claimed = await claimRun(run, data.workspaceId, context.attempt, logContext);
      if (!claimed) {
        return;
      }

      await executeClaimedRun(run, data, triggerPayload, effects, logContext);
    } catch (error) {
      await handleRunError(error, run, data, context, logContext);
    }
  };

/** The `workflow-run.process` job handler with the live effects (real email). */
export const processWorkflowRunJob: JobHandler<TWorkflowRunJobData> =
  createWorkflowRunJobHandler(liveWorkflowRunEffects);

/**
 * Persists the failure trace on the run, tenant-scoped by `workspaceId`. On the final attempt this
 * commits the terminal `failed` status + `finishedAt`; on earlier attempts it records only
 * `error`/`lastErrorAt`/`attempt` and KEEPS the run non-terminal (`running`) so BullMQ retries are not
 * defeated by the terminal-skip guard. Best-effort: a persistence failure here is logged but never
 * masks the original execution error the caller is about to rethrow/swallow.
 */
const recordRunFailure = async (
  runId: string,
  workspaceId: string,
  error: unknown,
  runData: TWorkflowRunData | undefined,
  isFinalAttempt: boolean,
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<boolean> => {
  const now = new Date();
  try {
    // Status-guarded: only touch a run that is still non-terminal. A 0-row result means another delivery
    // already finalized it (completed/failed) — don't clobber that verdict with a stale failure.
    const updated = await prisma.workflowRun.updateMany({
      where: { id: runId, workspaceId, status: { notIn: [...TERMINAL_STATUS_LIST] } },
      data: {
        error: toError(error, "Workflow run job failed").message,
        lastErrorAt: now,
        ...(isFinalAttempt ? { status: "failed", finishedAt: now } : {}),
        ...(runData ? { data: runData } : {}),
      },
    });
    if (updated.count === 0) {
      logger.info(
        { ...logContext },
        "Workflow run already finalized by another delivery; skipping failure write"
      );
    }
    // Whether this delivery's write landed: the caller reports the failure only when it did.
    return updated.count > 0;
  } catch (persistError) {
    logger.error({ ...logContext, err: persistError }, "Failed to persist workflow run failure state");
    return false;
  }
};
