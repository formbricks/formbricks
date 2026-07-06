import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { type JobHandler, type TWorkflowRunJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { type TUserLocale, ZUserLocale } from "@formbricks/types/user";
import {
  type TWorkflowExecutableStep,
  type TWorkflowRunData,
  type TWorkflowStepResult,
  type TWorkflowTriggerRunPayload,
  ZWorkflowExecutableDefinition,
  ZWorkflowRunData,
  ZWorkflowTriggerRunPayload,
  planExecutableSteps,
} from "@formbricks/workflows";
import { isDatabasePoolExhaustionError } from "@/lib/jobs/pool-exhaustion";
import { getOrganizationByWorkspaceId } from "@/lib/organization/service";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { sendEmail } from "@/modules/email";
import {
  buildSurveyResponseEmailHtml,
  resolveResponseRecipient,
} from "@/modules/email/lib/survey-response-email";

/** Strips CR/LF and other control chars from the subject — defense against SMTP header injection. */
// eslint-disable-next-line no-control-regex -- intentionally matching control chars to strip them
const CONTROL_CHARS_PATTERN = /[\x00-\x1f\x7f\u2028\u2029]/g;
const stripControlChars = (value: string): string => value.replace(CONTROL_CHARS_PATTERN, "");

/** Coerces a response's free-form `language` to a supported locale, falling back to undefined (→ default). */
const toResponseLocale = (language: string | null): TUserLocale | undefined => {
  const parsed = ZUserLocale.safeParse(language);
  if (!parsed.success) return undefined;
  return parsed.data;
};

/** Run states from which there is no further work — replays/redeliveries on these are no-ops. */
const TERMINAL_STATUS_LIST = ["completed", "failed", "canceled"] as const;
const TERMINAL_STATUSES = new Set<string>(TERMINAL_STATUS_LIST);

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

const MESSAGE_ID_FALLBACK_DOMAIN = "formbricks.com";

/** Extracts the domain from a validated email address, falling back to a stable default. */
const domainFromEmail = (from: string): string => from.split("@")[1]?.trim() || MESSAGE_ID_FALLBACK_DOMAIN;

/**
 * Builds the deterministic RFC 5322 Message-ID (`<hash@domain>`) stored on a step output and sent as
 * the `Message-ID` header. Stable across retries for the same run + step, so a replayed send carries
 * the same id — enabling protocol-level dedup and traceability to the same logical message.
 */
const buildMessageId = (workflowRunId: string, stepId: string, from: string): string => {
  const hash = createHash("sha256").update(`${workflowRunId}:${stepId}`).digest("hex");
  return `<${hash}@${domainFromEmail(from)}>`;
};

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

interface StepOutcome {
  status: TWorkflowStepResult["status"];
  error: string | null;
  output: Record<string, unknown>;
}

/** The survey/response/branding context, loaded once per run, that every step renders against. */
interface RunEmailContext {
  survey: TSurvey;
  response: TResponse;
  logoUrl: string;
}

/**
 * Resolves and sends one `send_email` step, Follow-Ups parity: resolves the recipient from the
 * response (literal email or question/hidden-field id), renders the branded HTML via
 * `buildSurveyResponseEmailHtml` (recall body + optional response-data blocks), and sends HTML-only.
 * The subject is sanitized (control chars stripped) and a stable RFC `Message-ID` is recorded on both
 * the sent header and the step output. Any resolution/send failure returns a failed outcome; the
 * caller fails the whole run so it propagates to the run lifecycle.
 */
const sendResolvedEmail = async (
  config: TWorkflowExecutableStep["node"]["config"],
  emailContext: RunEmailContext,
  workflowRunId: string,
  stepId: string
): Promise<StepOutcome> => {
  const recipient = resolveResponseRecipient(config.to, emailContext.response);
  if (!recipient.ok) {
    return { status: "failed", error: recipient.error, output: {} };
  }

  const messageId = buildMessageId(workflowRunId, stepId, config.from);
  const subject = stripControlChars(config.subject);

  try {
    const html = await buildSurveyResponseEmailHtml({
      body: config.body,
      survey: emailContext.survey,
      response: emailContext.response,
      attachResponseData: config.attachResponseData,
      includeVariables: config.includeVariables,
      includeHiddenFields: config.includeHiddenFields,
      logoUrl: emailContext.logoUrl,
      locale: toResponseLocale(emailContext.response.language),
    });

    // No `from` — the deployment MAIL_FROM default applies, exactly like survey Follow-Ups. `config.from`
    // is only used to derive the stable Message-ID domain, never as the actual sender.
    const sent = await sendEmail({
      to: recipient.email,
      replyTo: config.replyTo.length > 0 ? config.replyTo.join(", ") : undefined,
      subject,
      html,
      messageId,
    });

    if (sent) {
      return { status: "succeeded", error: null, output: { messageId, provider: EMAIL_PROVIDER } };
    }
    return { status: "failed", error: "SMTP is not configured; workflow email was not sent", output: {} };
  } catch (sendError) {
    return {
      status: "failed",
      error: toError(sendError, "Failed to send workflow email").message,
      output: {},
    };
  }
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

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === PrismaErrorType.UniqueConstraintViolation;

/**
 * Sends an owned step (we hold its `running` log row) and records the terminal outcome onto that same
 * row via `update` (never a second `create` — the `(runId, stepId)` unique constraint forbids it).
 *
 * At-most-once tradeoff: we claim (`running`) BEFORE calling `sendEmail`, so if the process crashes
 * between a successful SMTP handoff and the `succeeded` update, the retry sees `running` and will NOT
 * re-send — that email is potentially lost rather than duplicated. This is the accepted policy: never
 * send the same step twice.
 */
const sendOwnedStep = async (
  step: TWorkflowExecutableStep,
  runId: string,
  emailContext: RunEmailContext
): Promise<TWorkflowStepResult> => {
  const input = { to: step.node.config.to, subject: step.node.config.subject };
  const { status, error, output } = await sendResolvedEmail(
    step.node.config,
    emailContext,
    runId,
    step.stepId
  );
  const finishedAt = new Date();

  await prisma.workflowRunLog.update({
    where: { runId_stepId: { runId, stepId: step.stepId } },
    data: { status, output, error, finishedAt },
  });

  return {
    stepId: step.stepId,
    stepType: step.stepType,
    status,
    input,
    output,
    ...(error ? { error } : {}),
    startedAt: finishedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
};

/**
 * Claims a not-yet-succeeded step and sends it. Two claim paths:
 *  - no row: `create` a `running` row. A P2002 means a concurrent worker created it first — re-read and
 *    defer to the resume/skip logic in `runStep`.
 *  - existing `failed`/`pending` row: flip it to `running` via a conditional `updateMany`; `count===0`
 *    means another worker already claimed it, so skip (at-most-once).
 * Returns `null` when the claim was lost (caller re-reads / skips).
 */
const claimAndSendStep = async (
  step: TWorkflowExecutableStep,
  sequence: number,
  runId: string,
  existing: StepLogRow | null,
  emailContext: RunEmailContext
): Promise<TWorkflowStepResult | null> => {
  const startedAt = new Date();

  if (!existing) {
    try {
      await prisma.workflowRunLog.create({
        data: {
          runId,
          sequence,
          stepId: step.stepId,
          stepType: step.stepType,
          status: "running",
          input: { to: step.node.config.to, subject: step.node.config.subject },
          startedAt,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        return null; // Concurrent create won; caller re-reads and resumes/skips.
      }
      throw error;
    }
    return sendOwnedStep(step, runId, emailContext);
  }

  // A prior attempt left a `failed`/`pending` row — take it over only if it is still in that state.
  const claim = await prisma.workflowRunLog.updateMany({
    where: { runId, stepId: step.stepId, status: { in: ["failed", "pending"] } },
    data: { status: "running", startedAt, output: {}, error: null, finishedAt: null },
  });
  if (claim.count === 0) {
    return null; // Another worker claimed it first; skip per at-most-once.
  }
  return sendOwnedStep(step, runId, emailContext);
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
 * Runs one planned step with a per-step claim guard:
 *  - `succeeded` row → resume (no send).
 *  - `running` row → owned by a concurrent delivery / stalled attempt → BAIL (no send, don't finalize).
 *  - no row / `failed` / `pending` → claim, then send (a `failed` send never went out, so re-sending is safe).
 *    A lost claim (concurrent `create`/`updateMany` won) also BAILs.
 */
const runStep = async (
  step: TWorkflowExecutableStep,
  sequence: number,
  runId: string,
  emailContext: RunEmailContext,
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<TWorkflowStepResult | typeof STEP_BAIL> => {
  const existing: StepLogRow | null = await prisma.workflowRunLog.findFirst({
    where: { runId, stepId: step.stepId },
    select: stepLogSelect,
  });

  if (existing?.status === "succeeded") {
    return resultFromLogRow(existing, "succeeded");
  }

  if (existing?.status === "running") {
    // A `running` row we did NOT just create means another live delivery (or a stalled prior attempt)
    // owns this run. At-most-once: never re-send; and don't finalize the run — bail and let the owner.
    logger.warn(
      { ...logContext, stepId: step.stepId },
      "Workflow step already in-flight (running); another delivery owns this run — bailing"
    );
    return STEP_BAIL;
  }

  const result = await claimAndSendStep(step, sequence, runId, existing, emailContext);
  if (result) {
    return result;
  }

  // Claim lost to a concurrent delivery after we read the row — bail rather than risk a double-send or
  // prematurely finalizing a run the winner still owns.
  logger.warn(
    { ...logContext, stepId: step.stepId },
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

/**
 * Loads the survey/response/branding context a run's emails render against. Uses the same loaders the
 * response-pipeline job uses (worker-safe, no request scope). Missing survey or response is
 * unrecoverable for this run and fails it.
 */
const loadRunEmailContext = async (
  triggerPayload: TWorkflowTriggerRunPayload,
  workspaceId: string
): Promise<RunEmailContext> => {
  const [response, survey] = await Promise.all([
    getResponse(triggerPayload.responseId),
    getSurvey(triggerPayload.surveyId),
  ]);

  if (!response) {
    throw new WorkflowRunNotExecutableError(`Response ${triggerPayload.responseId} not found`);
  }
  if (!survey) {
    throw new WorkflowRunNotExecutableError(`Survey ${triggerPayload.surveyId} not found`);
  }

  // Tenant-integrity guard: the survey/response ids come from the (untrusted) stored trigger payload,
  // so confirm they belong to this run's workspace/survey before rendering an email from their data.
  if (survey.workspaceId !== workspaceId) {
    throw new WorkflowRunNotExecutableError(
      `Survey ${triggerPayload.surveyId} does not belong to workspace ${workspaceId}`
    );
  }
  if (response.surveyId !== triggerPayload.surveyId) {
    throw new WorkflowRunNotExecutableError(
      `Response ${triggerPayload.responseId} does not belong to survey ${triggerPayload.surveyId}`
    );
  }

  const organization = await getOrganizationByWorkspaceId(workspaceId);
  const logoUrl = organization?.whitelabel?.logoUrl ?? "";

  return { survey, response, logoUrl };
};

/**
 * Runs the planned steps in order under the per-step claim guard (`runStep`). Three outcomes:
 *  - `bail`: a step is owned by a concurrent delivery / stalled attempt → stop, do NOT finalize the run
 *    (the owner does). The per-step `WorkflowRunLog` rows remain the source of truth for the run's state.
 *  - `failure`: a step's send definitively failed this attempt → fail the whole run (row stays `failed`,
 *    which is retryable).
 *  - success: all steps resolved.
 */
const runSteps = async (
  steps: TWorkflowExecutableStep[],
  runId: string,
  emailContext: RunEmailContext,
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<{ bail: true } | { bail: false; stepResults: TWorkflowStepResult[]; failure: string | null }> => {
  const stepResults: TWorkflowStepResult[] = [];

  for (const [index, step] of steps.entries()) {
    const result = await runStep(step, index + 1, runId, emailContext, logContext);
    if (result === STEP_BAIL) {
      return { bail: true };
    }
    stepResults.push(result);

    if (result.status === "failed") {
      return { bail: false, stepResults, failure: result.error ?? "Workflow step failed" };
    }
  }

  return { bail: false, stepResults, failure: null };
};

/** Walks the claimed run to completion, throwing `WorkflowStepFailedError` (with the trace) on a failed step. */
const executeClaimedRun = async (
  run: { id: string; workflowVersion: { definition: unknown } | null; workflow: { definition: unknown } },
  workspaceId: string,
  triggerPayload: TWorkflowTriggerRunPayload,
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<void> => {
  const definition = resolveExecutableDefinition(run);
  const steps = planExecutableSteps(definition);

  const emailContext = await loadRunEmailContext(triggerPayload, workspaceId);
  const outcome = await runSteps(steps, run.id, emailContext, logContext);

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
    where: { id: run.id, workspaceId, status: "running" },
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
  runId: string,
  workspaceId: string,
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
    await recordRunFailure(runId, workspaceId, error, runData, false, logContext);
    throw toError(error, "Workflow run job failed");
  }

  // Final attempt: commit a terminal `failed` and swallow. Pool exhaustion on the last attempt must be
  // recorded here rather than rethrown into the void, or the run would stay stuck `running` forever.
  await recordRunFailure(runId, workspaceId, error, runData, true, logContext);
  logger.error({ ...logContext, err: error }, "Workflow run job failed after final attempt");
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

    const claimed = await claimRun(run, data.workspaceId, context.attempt, logContext);
    if (!claimed) {
      return;
    }

    await executeClaimedRun(run, data.workspaceId, triggerPayload, logContext);
  } catch (error) {
    await handleRunError(error, run.id, data.workspaceId, context, logContext);
  }
};

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
): Promise<void> => {
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
  } catch (persistError) {
    logger.error({ ...logContext, err: persistError }, "Failed to persist workflow run failure state");
  }
};
