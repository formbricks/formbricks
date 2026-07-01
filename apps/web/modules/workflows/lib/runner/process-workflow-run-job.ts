import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@formbricks/database";
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

/**
 * Executes one `send_email` step and returns a per-step result + log row. Delegates the resolve/render/
 * send to `sendResolvedEmail`; the caller fails the whole run on a failed step so the error propagates
 * to the run lifecycle.
 */
const executeSendEmailStep = async ({
  step,
  sequence,
  emailContext,
  workflowRunId,
}: {
  step: TWorkflowExecutableStep;
  sequence: number;
  emailContext: RunEmailContext;
  workflowRunId: string;
}): Promise<ExecutedStep> => {
  const startedAt = new Date();
  const input = { to: step.node.config.to, subject: step.node.config.subject };

  const { status, error, output } = await sendResolvedEmail(
    step.node.config,
    emailContext,
    workflowRunId,
    step.stepId
  );

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

/** The subset of a persisted `succeeded` `WorkflowRunLog` needed to resume a step without re-sending. */
interface SucceededStepLog {
  stepId: string;
  stepType: string;
  input: unknown;
  output: unknown;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** Reconstructs a succeeded step result from a previously persisted succeeded log row, so a retry resumes. */
const resultFromSucceededLog = (log: SucceededStepLog): TWorkflowStepResult => ({
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
 * Runs the planned steps in order, resuming any that already have a `succeeded` log (no re-send, no
 * duplicate log row) and executing the rest. Returns the per-step results and the first failure
 * message, if any.
 */
const runSteps = async (
  steps: TWorkflowExecutableStep[],
  runId: string,
  emailContext: RunEmailContext
): Promise<{ stepResults: TWorkflowStepResult[]; failure: string | null }> => {
  const succeededLogs: SucceededStepLog[] = await prisma.workflowRunLog.findMany({
    where: { runId, status: "succeeded" },
    select: { stepId: true, stepType: true, input: true, output: true, startedAt: true, finishedAt: true },
  });
  const succeededByStepId = new Map(succeededLogs.map((log) => [log.stepId, log]));

  const stepResults: TWorkflowStepResult[] = [];

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
      emailContext,
      workflowRunId: runId,
    });

    await persistStepLog(runId, executed.log);
    stepResults.push(executed.result);

    if (executed.result.status === "failed") {
      return { stepResults, failure: executed.result.error ?? "Workflow step failed" };
    }
  }

  return { stepResults, failure: null };
};

/** Walks the claimed run to completion, throwing `WorkflowStepFailedError` (with the trace) on a failed step. */
const executeClaimedRun = async (
  run: { id: string; workflowVersion: { definition: unknown } | null; workflow: { definition: unknown } },
  workspaceId: string,
  triggerPayload: TWorkflowTriggerRunPayload
): Promise<void> => {
  const definition = resolveExecutableDefinition(run);
  const steps = planExecutableSteps(definition);

  const emailContext = await loadRunEmailContext(triggerPayload, workspaceId);
  const { stepResults, failure } = await runSteps(steps, run.id, emailContext);

  const runData: TWorkflowRunData = ZWorkflowRunData.parse({ trigger: triggerPayload, steps: stepResults });

  if (failure) {
    throw new WorkflowStepFailedError(failure, runData);
  }

  await prisma.workflowRun.updateMany({
    where: { id: run.id, workspaceId },
    data: { status: "completed", finishedAt: new Date(), data: runData },
  });
};

/**
 * Handles a run-execution error: transient DB pool exhaustion is rethrown untouched so BullMQ retries.
 * Otherwise the failure trace is recorded (terminal `failed` only on the final attempt, so earlier
 * attempts stay non-terminal and can retry) and rethrown before the final attempt.
 */
const handleRunError = async (
  error: unknown,
  runId: string,
  workspaceId: string,
  context: Parameters<JobHandler<TWorkflowRunJobData>>[1],
  logContext: ReturnType<typeof getWorkflowRunLogContext>
): Promise<void> => {
  if (isDatabasePoolExhaustionError(error)) {
    logger.warn({ ...logContext, err: error }, "Workflow run job hit database pool exhaustion; will retry");
    throw error;
  }

  const runData = error instanceof WorkflowStepFailedError ? error.runData : undefined;
  const isFinalAttempt = context.attempt >= context.maxAttempts;

  await recordRunFailure(runId, workspaceId, error, runData, isFinalAttempt, logContext);

  if (!isFinalAttempt) {
    throw toError(error, "Workflow run job failed");
  }

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

    const claimed = await claimRun(run, data.workspaceId, context.attempt, logContext);
    if (!claimed) {
      return;
    }

    await executeClaimedRun(run, data.workspaceId, triggerPayload);
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
    await prisma.workflowRun.updateMany({
      where: { id: runId, workspaceId },
      data: {
        error: toError(error, "Workflow run job failed").message,
        lastErrorAt: now,
        ...(isFinalAttempt ? { status: "failed", finishedAt: now } : {}),
        ...(runData ? { data: runData } : {}),
      },
    });
  } catch (persistError) {
    logger.error({ ...logContext, err: persistError }, "Failed to persist workflow run failure state");
  }
};
