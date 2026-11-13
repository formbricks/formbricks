import "server-only";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import {
  type TWorkflowTriggerRunPayload,
  type TWorkflowWebhookPayload,
  WEBHOOK_IDEMPOTENCY_KEY_MAX_LENGTH,
  WEBHOOK_PAYLOAD_MAX_BYTES,
  WEBHOOK_PAYLOAD_MAX_DEPTH,
  WORKFLOW_SAMPLE_TRIGGER_SOURCE,
  WORKFLOW_TRIGGERS,
  parseWebhookPayload,
} from "@formbricks/workflows";
import {
  problemBadRequest,
  problemForbidden,
  problemInternalError,
  problemNotFound,
  problemPayloadTooLarge,
  problemTooManyRequests,
  problemUnsupportedMediaType,
} from "@/app/api/v3/lib/response";
import { RequestBodyTooLargeError, readRequestBodyWithLimit } from "@/app/lib/api/request-body";
import { ALLOW_WORKFLOW_PLAIN_HTTP } from "@/lib/constants";
import { UNTRUSTED_CLIENT_IP, getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { loggableError } from "@/lib/utils/loggable-error";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { TRateLimitConfig } from "@/modules/core/rate-limit/types/rate-limit";
import { recordWorkflowRunCreatedMeterEvent } from "@/modules/ee/billing/lib/metering";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import { dispatchWorkflowRunViaJobs } from "@/modules/ee/workflows/lib/runner/dispatch";
import { markWorkflowRunDispatched } from "@/modules/ee/workflows/lib/runner/mark-dispatched";
import { workflowWebhookDailyRunLimit, workflowWebhookOrgRateLimit } from "./limits";
import { isWebhookTokenMatch } from "./token";

/**
 * A call to a Webhook Secret URL (ENG-7166 / ED2, ENG-7167 / ED3). The checks run in the order spec §3
 * fixes, so each answer reveals no more than the checks before it allow:
 *
 * per-workflow rate limit by id (no database read) → token hash, constant time → HTTPS → plan →
 * organization calls and daily runs → content type, size and shape → idempotency → sample and run
 * written together.
 *
 * Unknown workflow, archived workflow, a wrong or regenerated token, and a workflow whose trigger is not
 * a Webhook trigger all answer the same 404. No answer and no log line carries the token or the payload.
 */

interface WebhookCallInput {
  req: Request;
  workflowId: string;
  token: string;
  requestId: string;
  /** The request path with the token already redacted. */
  instance: string;
}

type TWebhookLog = ReturnType<typeof logger.withContext>;

const ZWorkflowId = z.cuid2();

/** A hash no token can match, so a call with no stored hash still pays for one comparison. */
const NO_TOKEN_HASH = "0".repeat(64);

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

const RUN_SELECT = { id: true, createdAt: true } as const;

/**
 * HTTPS is required (ADR 0041). Behind a proxy the scheme comes from `X-Forwarded-Proto` (its first hop
 * when several proxies appended), otherwise from the request itself. Plain HTTP is accepted for localhost,
 * and on a self-hosted instance whose admin set `DANGEROUSLY_ALLOW_WORKFLOW_PLAIN_HTTP=1` (never on Cloud).
 */
export const isSecureWebhookCall = (req: Request, allowPlainHttp: boolean): boolean => {
  const url = new URL(req.url);
  if (allowPlainHttp || LOCAL_HOSTNAMES.has(url.hostname)) return true;

  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const scheme = forwarded || url.protocol.replace(/:$/, "");
  return scheme === "https";
};

const mediaTypeOf = (contentType: string | null): string =>
  (contentType ?? "").split(";")[0].trim().toLowerCase();

const callResult = (runId: string | null, status: 200 | 202): Response =>
  Response.json({ runId }, { status, headers: { "Cache-Control": "private, no-store" } });

/** `applyRateLimit`, with a refusal as a 429 response instead of a throw. */
const refuseOverLimit = async (
  config: TRateLimitConfig,
  identifier: string,
  ctx: WebhookCallInput
): Promise<Response | null> => {
  try {
    await applyRateLimit(config, identifier);
    return null;
  } catch (error) {
    if (!(error instanceof TooManyRequestsError)) throw error;
    return problemTooManyRequests(
      ctx.requestId,
      "Too many calls to this Webhook Secret URL. Please try again later.",
      error.retryAfter,
      ctx.instance
    );
  }
};

const loadWorkflow = (workflowId: string) =>
  prisma.workflow.findUnique({
    where: { id: workflowId },
    select: {
      id: true,
      status: true,
      workspaceId: true,
      webhookTokenHash: true,
      definition: true,
      versions: { orderBy: { version: "desc" }, take: 1, select: { id: true } },
      workspace: {
        select: {
          organizationId: true,
          organization: { select: { billing: { select: { stripeCustomerId: true } } } },
        },
      },
    },
  });

type TLoadedWorkflow = NonNullable<Awaited<ReturnType<typeof loadWorkflow>>>;

/** A workflow this token may call: it exists, is not archived, has a Webhook trigger, and the hash matches. */
const isCallable = (workflow: TLoadedWorkflow | null, token: string): workflow is TLoadedWorkflow => {
  // Compare first, whatever the row looks like, so a missing workflow costs the same hash and compare.
  const matches = isWebhookTokenMatch(token, workflow?.webhookTokenHash ?? NO_TOKEN_HASH);
  return (
    matches &&
    workflow !== null &&
    workflow.status !== "archived" &&
    workflow.definition?.trigger?.triggerType === WORKFLOW_TRIGGERS.WEBHOOK
  );
};

type TPayloadRead = { ok: true; payload: TWorkflowWebhookPayload } | { ok: false; response: Response };

/** Content type (415), size while reading (413), then JSON object and depth (400). Never echoes the body. */
const readPayload = async (ctx: WebhookCallInput): Promise<TPayloadRead> => {
  if (mediaTypeOf(ctx.req.headers.get("content-type")) !== "application/json") {
    return {
      ok: false,
      response: problemUnsupportedMediaType(ctx.requestId, "Send the payload as application/json.", {
        instance: ctx.instance,
      }),
    };
  }

  let text: string;
  try {
    text = await readRequestBodyWithLimit(ctx.req, WEBHOOK_PAYLOAD_MAX_BYTES);
  } catch (error) {
    if (!(error instanceof RequestBodyTooLargeError)) throw error;
    return {
      ok: false,
      response: problemPayloadTooLarge(
        ctx.requestId,
        `The payload is over the ${WEBHOOK_PAYLOAD_MAX_BYTES / 1024} KB limit.`,
        ctx.instance
      ),
    };
  }

  const parsed = parseWebhookPayload(text);
  if (!parsed.ok) {
    return {
      ok: false,
      response: problemBadRequest(
        ctx.requestId,
        `The payload must be a JSON object nested at most ${WEBHOOK_PAYLOAD_MAX_DEPTH} levels.`,
        { instance: ctx.instance }
      ),
    };
  }
  return parsed;
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";

const findRunByIdempotencyKey = async (workflowId: string, idempotencyKey: string) =>
  prisma.workflowRun.findUnique({
    where: { workflowId_idempotencyKey: { workflowId, idempotencyKey } },
    select: { id: true },
  });

/**
 * Saves the payload as the Sample and, for an enabled workflow, creates the queued run, in one
 * transaction. Returns the new run, null when no run starts, or the run an earlier call with the same
 * idempotency key started (a race lost on the unique key).
 */
const saveCall = async (
  workflow: TLoadedWorkflow,
  payload: TWorkflowWebhookPayload,
  { idempotencyKey, callerIp }: { idempotencyKey: string | null; callerIp: string | null }
): Promise<
  | { kind: "created"; run: { id: string; createdAt: Date } }
  | { kind: "none" }
  | { kind: "existing"; runId: string }
> => {
  const now = new Date();
  const triggerPayload: TWorkflowTriggerRunPayload = {
    type: WORKFLOW_TRIGGERS.WEBHOOK,
    workspaceId: workflow.workspaceId,
    payload,
    triggeredAt: now.toISOString(),
  };

  try {
    const run = await prisma.$transaction(async (tx) => {
      const callData = { sample: payload, lastCalledAt: now, lastCallerIp: callerIp };
      await tx.workflowSample.upsert({
        where: { workflowId_source: { workflowId: workflow.id, source: WORKFLOW_SAMPLE_TRIGGER_SOURCE } },
        create: {
          workflowId: workflow.id,
          workspaceId: workflow.workspaceId,
          source: WORKFLOW_SAMPLE_TRIGGER_SOURCE,
          ...callData,
        },
        update: callData,
      });

      if (workflow.status !== "enabled") return null;

      return tx.workflowRun.create({
        data: {
          workflowId: workflow.id,
          workspaceId: workflow.workspaceId,
          workflowVersionId: workflow.versions[0]?.id ?? null,
          status: "queued",
          triggerType: WORKFLOW_TRIGGERS.WEBHOOK,
          isDryRun: false,
          attempt: 0,
          idempotencyKey,
          callerIp,
          triggerPayload,
        },
        select: RUN_SELECT,
      });
    });
    return run ? { kind: "created", run } : { kind: "none" };
  } catch (error) {
    if (!idempotencyKey || !isUniqueViolation(error)) throw error;
    const existing = await findRunByIdempotencyKey(workflow.id, idempotencyKey);
    if (!existing) throw error;
    return { kind: "existing", runId: existing.id };
  }
};

/** Bill and queue a new run. Neither may fail the call: the run row is the durable record. */
const startRun = async (
  workflow: TLoadedWorkflow,
  run: { id: string; createdAt: Date },
  log: TWebhookLog
) => {
  await recordWorkflowRunCreatedMeterEvent({
    stripeCustomerId: workflow.workspace.organization.billing?.stripeCustomerId,
    workflowRunId: run.id,
    createdAt: run.createdAt,
  });

  try {
    await dispatchWorkflowRunViaJobs({
      workflowRunId: run.id,
      workflowId: workflow.id,
      workspaceId: workflow.workspaceId,
    });
  } catch (error) {
    log.error(
      { workflowRunId: run.id, ...loggableError(error) },
      "Webhook workflow run persisted but dispatch failed; queued run is orphaned until the reconciler re-dispatches it"
    );
    return;
  }

  await markWorkflowRunDispatched(run.id, workflow.workspaceId, new Date(), { workflowId: workflow.id });
};

/** Steps 1–5: who may call, and whether a limit refuses the call. The workflow, or the refusal. */
const admitCall = async (ctx: WebhookCallInput): Promise<TLoadedWorkflow | Response> => {
  const notFound = () => problemNotFound(ctx.requestId, "Webhook", null, ctx.instance);

  // 1. Per-workflow limit, keyed by the id from the path, before anything touches the database.
  if (!ZWorkflowId.safeParse(ctx.workflowId).success) return notFound();
  const perWorkflow = await refuseOverLimit(rateLimitConfigs.api.v3WorkflowWebhook, ctx.workflowId, ctx);
  if (perWorkflow) return perWorkflow;

  // 2. Token: constant-time hash compare; every way of not matching is the same 404.
  const workflow = await loadWorkflow(ctx.workflowId);
  if (!isCallable(workflow, ctx.token)) return notFound();

  // 3. HTTPS.
  if (!isSecureWebhookCall(ctx.req, ALLOW_WORKFLOW_PLAIN_HTTP)) {
    return problemForbidden(ctx.requestId, "Webhook Secret URLs must be called over HTTPS.", ctx.instance);
  }

  // 4. Plan, checked on every call through the cached entitlement lookup.
  const { organizationId } = workflow.workspace;
  if (!(await getIsWorkflowsEnabled(organizationId))) {
    return problemForbidden(ctx.requestId, "Workflows are not enabled for this organization", ctx.instance);
  }

  // 5. Organization calls per minute, then (only when a run would start) the workflow's runs per day.
  const perOrganization = await refuseOverLimit(workflowWebhookOrgRateLimit, organizationId, ctx);
  if (perOrganization) return perOrganization;
  if (workflow.status === "enabled") {
    const daily = await refuseOverLimit(workflowWebhookDailyRunLimit, workflow.id, ctx);
    if (daily) return daily;
  }

  return workflow;
};

/** Steps 7: the run an earlier call with the same Idempotency-Key started, or the key to store. */
const resolveIdempotency = async (
  ctx: WebhookCallInput,
  workflow: TLoadedWorkflow
): Promise<{ response: Response } | { idempotencyKey: string | null }> => {
  // Prefixed so a caller's key can never collide with the response ids Response completed runs keep
  // in the same column.
  const rawKey = ctx.req.headers.get("idempotency-key");
  if (rawKey === null) return { idempotencyKey: null };
  if (rawKey.length === 0 || rawKey.length > WEBHOOK_IDEMPOTENCY_KEY_MAX_LENGTH) {
    return {
      response: problemBadRequest(
        ctx.requestId,
        `Idempotency-Key must be 1 to ${WEBHOOK_IDEMPOTENCY_KEY_MAX_LENGTH} characters.`,
        { instance: ctx.instance }
      ),
    };
  }

  const idempotencyKey = `webhook:${rawKey}`;
  if (workflow.status === "enabled") {
    const existing = await findRunByIdempotencyKey(workflow.id, idempotencyKey);
    if (existing) return { response: callResult(existing.id, 200) };
  }
  return { idempotencyKey };
};

const handleCall = async (ctx: WebhookCallInput, log: TWebhookLog): Promise<Response> => {
  const workflow = await admitCall(ctx);
  if (workflow instanceof Response) return workflow;

  // 6. Content type, size, shape.
  const read = await readPayload(ctx);
  if (!read.ok) return read.response;

  // 7. Idempotency: a key this workflow has seen returns the run it started.
  const idempotency = await resolveIdempotency(ctx, workflow);
  if ("response" in idempotency) return idempotency.response;
  const { idempotencyKey } = idempotency;

  // 8. Sample and run together.
  const clientIp = await getClientIpFromHeaders(ctx.req.headers);
  const saved = await saveCall(workflow, read.payload, {
    idempotencyKey,
    callerIp: clientIp === UNTRUSTED_CLIENT_IP ? null : clientIp,
  });
  if (saved.kind === "none") return callResult(null, 202);
  if (saved.kind === "existing") return callResult(saved.runId, 200);

  await startRun(workflow, saved.run, log);
  log.info({ workflowId: workflow.id, workflowRunId: saved.run.id }, "Webhook call queued a workflow run");
  return callResult(saved.run.id, 202);
};

/**
 * Entry point for `POST /api/v3/workflows/{workflowId}/webhook/{token}`. An unexpected error is logged
 * by name and frames only (its message could quote the request) and answered with a plain 500, which
 * the v3 wrapper reports to Sentry under the redacted path.
 */
export const receiveWorkflowWebhookCall = async (ctx: WebhookCallInput): Promise<Response> => {
  const log = logger.withContext({
    requestId: ctx.requestId,
    path: ctx.instance,
    workflowId: ctx.workflowId,
  });
  try {
    return await handleCall(ctx, log);
  } catch (error) {
    log.error({ ...loggableError(error), statusCode: 500 }, "Webhook call failed");
    return problemInternalError(ctx.requestId, undefined, ctx.instance);
  }
};
