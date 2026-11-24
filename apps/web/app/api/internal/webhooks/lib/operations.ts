import "server-only";
import { ResourceNotFoundError, UnknownError } from "@formbricks/types/errors";
import { refusalResponse } from "@/app/api/internal/lib/refusal";
import type { TRequestContext } from "@/app/api/internal/lib/types";
import { requireWorkspaceActionAccess } from "@/app/api/internal/lib/workspace-access";
import { applyRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import {
  noContentResponse,
  problemForbidden,
  problemInternalError,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import { generateWebhookSecret } from "@/lib/crypto";
import { capturePostHogEvent } from "@/lib/posthog";
import { assertNewlyAttachedSurveysWorkspaceVisible } from "@/lib/survey/visibility/outbound";
import {
  getOrganizationIdFromWebhookId,
  getOrganizationIdFromWorkspaceId,
  getWorkspaceIdFromWebhookId,
} from "@/lib/utils/helper";
import {
  getWebhook,
  getWebhookWithSecret,
} from "@/modules/api/v2/management/webhooks/[webhookId]/lib/webhook";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { isDiscordWebhook } from "@/modules/integrations/webhooks/lib/utils";
import {
  createWebhook,
  deleteWebhook,
  testEndpoint,
  updateWebhook,
} from "@/modules/integrations/webhooks/lib/webhook";
import type { TWebhookCreateBody, TWebhookTestDeliveryBody, TWebhookUpdateBody } from "../schemas";
import { type TWebhookTestDeliveryResource, serializeCreatedWebhook } from "../serializers";

/**
 * Webhooks, for the workspace's Webhooks integration page. Deprecated in favour of Workflows but still
 * shipped: these routes carry the server actions' checks over unchanged — `workspace.write` on the webhook's
 * workspace, the per-workspace state-mutation budget, the attach-time survey visibility guard and the
 * webhook URL's SSRF validation inside the write.
 */

/** What a delivery the endpoint didn't answer reports: its transport error stays in the logs. */
export const WEBHOOK_ENDPOINT_UNREACHABLE = "The webhook endpoint could not be reached.";

/** The service refuses Discord webhook URLs: their own message, as a 422 naming the URL. */
const refuseDiscordUrl = (url: string, { requestId, instance }: TRequestContext): Response | null => {
  if (!isDiscordWebhook(url)) return null;
  const reason = "Discord webhooks are currently not supported.";
  return problemUnprocessableContent(requestId, reason, {
    instance,
    invalid_params: [{ name: "url", reason }],
  });
};

/**
 * Run a step whose refusals the forms show (an SSRF-rejected URL, a restricted survey); other errors
 * propagate. The webhook service reports an endpoint that didn't answer (a timeout, a refused connection) as
 * `UnknownError`. That is about the caller's URL, so it answers 422, not 500, with a fixed message: the
 * transport error's own text (addresses, socket codes) is not the caller's to see, as with the action.
 */
async function runRefusable<T>(
  { requestId, instance }: TRequestContext,
  step: () => Promise<T>
): Promise<T | Response> {
  try {
    return await step();
  } catch (error) {
    const refused = refusalResponse(error, requestId, instance);
    if (refused) return refused;
    if (error instanceof UnknownError) {
      return problemUnprocessableContent(requestId, WEBHOOK_ENDPOINT_UNREACHABLE, { instance });
    }
    throw error;
  }
}

/** The webhook's workspace and organization, or `null` for a webhook that isn't there. */
async function resolveWebhook(
  webhookId: string
): Promise<{ organizationId: string; workspaceId: string } | null> {
  try {
    const [organizationId, workspaceId] = await Promise.all([
      getOrganizationIdFromWebhookId(webhookId),
      getWorkspaceIdFromWebhookId(webhookId),
    ]);
    return { organizationId, workspaceId };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return null;
    throw error;
  }
}

/** `workspace.write` on the workspace, then its state-mutation budget: the action's two checks, in order. */
async function requireWorkspaceWrite(
  context: TRequestContext,
  workspaceId: string
): Promise<Response | { userId: string }> {
  const access = await requireWorkspaceActionAccess({ ...context, workspaceId, action: "workspace.write" });
  if (access instanceof Response) return access;

  const limited = await applyRateLimitOrRespond(rateLimitConfigs.actions.stateMutation, workspaceId, context);
  if (limited) return limited;
  return access;
}

/**
 * Authorize a write to an existing webhook: the organization and workspace are read off the webhook, never
 * taken from the caller, and named in the audit entry before any check can refuse. A missing webhook gets
 * the same 403 as one in a workspace the caller can't write to.
 */
async function requireWebhookWrite(
  context: TRequestContext,
  webhookId: string
): Promise<Response | { userId: string; organizationId: string }> {
  const { requestId, instance, auditLog } = context;
  if (auditLog) auditLog.targetId = webhookId;

  const webhook = await resolveWebhook(webhookId);
  if (!webhook) return problemForbidden(requestId, undefined, instance);
  if (auditLog) auditLog.organizationId = webhook.organizationId;

  const access = await requireWorkspaceWrite(context, webhook.workspaceId);
  if (access instanceof Response) return access;
  return { userId: access.userId, organizationId: webhook.organizationId };
}

/**
 * `POST /api/internal/webhooks?workspaceId=`: create a webhook in the workspace. Answers 201 with the
 * webhook and its signing secret, shown once. No `Location`: the webhook's own path takes PUT and DELETE only.
 */
export async function createWebhookOperation({
  workspaceId,
  body,
  ...context
}: TRequestContext & { workspaceId: string; body: TWebhookCreateBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;

  let organizationId: string;
  try {
    organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
    throw error;
  }
  if (auditLog) auditLog.organizationId = organizationId;

  const access = await requireWorkspaceWrite(context, workspaceId);
  if (access instanceof Response) return access;

  const discord = refuseDiscordUrl(body.url, context);
  if (discord) return discord;

  const { secret, ...webhookInput } = body;
  const webhook = await runRefusable(context, async () => {
    await assertNewlyAttachedSurveysWorkspaceVisible(webhookInput.surveyIds ?? []);
    return createWebhook(workspaceId, webhookInput, secret);
  });
  if (webhook instanceof Response) return webhook;

  if (auditLog) {
    auditLog.targetId = webhook.id;
    auditLog.newObject = webhookInput;
  }

  capturePostHogEvent(
    access.userId,
    "integration_connected",
    { integration_type: "webhook", organization_id: organizationId, workspace_id: workspaceId },
    { organizationId, workspaceId }
  );

  return successResponse(serializeCreatedWebhook(webhook), { requestId, status: 201 });
}

/**
 * `PUT /api/internal/webhooks/{webhookId}`: replace the webhook's settings. Only surveys newly attached by
 * this save have to be workspace-visible; one restricted after it was attached may stay.
 */
export async function updateWebhookOperation({
  webhookId,
  body,
  ...context
}: TRequestContext & { webhookId: string; body: TWebhookUpdateBody }): Promise<Response> {
  const { requestId, auditLog } = context;
  const access = await requireWebhookWrite(context, webhookId);
  if (access instanceof Response) return access;

  const existing = await getWebhook(webhookId);
  if (auditLog) auditLog.oldObject = existing;

  const updated = await runRefusable(context, async () => {
    await assertNewlyAttachedSurveysWorkspaceVisible(
      body.surveyIds ?? [],
      existing.ok ? existing.data.surveyIds : []
    );
    return updateWebhook(webhookId, body);
  });
  if (updated instanceof Response) return updated;

  if (auditLog) auditLog.newObject = await getWebhook(webhookId);
  return noContentResponse({ requestId });
}

/** `DELETE /api/internal/webhooks/{webhookId}`: delete the webhook. */
export async function deleteWebhookOperation({
  webhookId,
  ...context
}: TRequestContext & { webhookId: string }): Promise<Response> {
  const { requestId, auditLog } = context;
  const access = await requireWebhookWrite(context, webhookId);
  if (access instanceof Response) return access;

  if (auditLog) auditLog.oldObject = { ...(await getWebhook(webhookId)) };

  const deleted = await runRefusable(context, () => deleteWebhook(webhookId));
  if (deleted instanceof Response) return deleted;
  return noContentResponse({ requestId });
}

/**
 * `GET /api/internal/webhooks/{webhookId}/secret`: the signing secret, for a writer who asks to reveal or
 * copy it. The route carries the per-user reveal budget. A missing webhook or secret gets the same 403 as a
 * webhook in a workspace the caller can't write to.
 */
export async function getWebhookSecretOperation({
  webhookId,
  ...context
}: TRequestContext & { webhookId: string }): Promise<Response> {
  const { requestId, instance } = context;
  const webhook = await resolveWebhook(webhookId);
  if (!webhook) return problemForbidden(requestId, undefined, instance);

  const access = await requireWorkspaceActionAccess({
    ...context,
    workspaceId: webhook.workspaceId,
    action: "workspace.write",
  });
  if (access instanceof Response) return access;

  const secret = await getWebhookWithSecret(webhookId);
  if (!secret.ok) {
    // A database fault is ours, not an authorization refusal; report it as such so it reaches the
    // infrastructure-error path. A missing webhook (or a key without a secret) stays the uniform 403.
    if (secret.error.type === "internal_server_error") {
      return problemInternalError(requestId, "The webhook secret could not be read.", instance);
    }
    return problemForbidden(requestId, undefined, instance);
  }
  if (secret.data.secret === null) return problemForbidden(requestId, undefined, instance);

  return successResponse({ secret: secret.data.secret }, { requestId });
}

/**
 * Who may test `body.url`, and which secret signs it. With `webhookId` the caller must write to that
 * webhook's workspace, and the stored secret signs the payload whatever the URL: the endpoint verifies the
 * secret real deliveries will carry, and a writer can reveal that secret anyway. Without one, the caller
 * must write to the workspace the webhook is about to be created in, and the payload is signed with
 * `secret` or a new one.
 */
async function resolveTestDeliverySecret(
  context: TRequestContext,
  body: TWebhookTestDeliveryBody,
  workspaceId: string
): Promise<Response | { userId: string; secret: string | undefined }> {
  const { requestId, instance } = context;

  if (body.webhookId) {
    let webhookWorkspaceId: string;
    try {
      webhookWorkspaceId = await getWorkspaceIdFromWebhookId(body.webhookId);
    } catch (error) {
      if (error instanceof ResourceNotFoundError) return problemForbidden(requestId, undefined, instance);
      throw error;
    }
    const access = await requireWorkspaceActionAccess({
      ...context,
      workspaceId: webhookWorkspaceId,
      action: "workspace.write",
    });
    if (access instanceof Response) return access;

    const webhook = await getWebhookWithSecret(body.webhookId);
    if (!webhook.ok) return problemForbidden(requestId, undefined, instance);
    // A changed URL used to get a throwaway secret, so an endpoint that verifies the stored one rejected
    // its own test and the form refused to save. Sign with the stored secret, as deliveries do.
    return { userId: access.userId, secret: webhook.data.secret ?? undefined };
  }

  const access = await requireWorkspaceActionAccess({ ...context, workspaceId, action: "workspace.write" });
  if (access instanceof Response) return access;
  return { userId: access.userId, secret: body.secret ?? generateWebhookSecret() };
}

/**
 * `POST /api/internal/webhooks/test-deliveries?workspaceId=`: POST a signed test payload to `url` and
 * report whether the endpoint accepted it. The server makes an outbound request to a URL the caller names,
 * so it goes through `testEndpoint`, the transport real deliveries use: SSRF validation of the URL and of
 * every address it resolves to, the connection pinned to the validated address, no redirects followed and
 * the delivery timeout. An endpoint that refuses, redirects or answers an error status is a 422 with the
 * reason the form shows. Not audited, as the action it replaces was not: nothing is stored.
 */
export async function testWebhookDeliveryOperation({
  workspaceId,
  body,
  ...context
}: TRequestContext & { workspaceId: string; body: TWebhookTestDeliveryBody }): Promise<Response> {
  const { requestId } = context;
  const resolved = await resolveTestDeliverySecret(context, body, workspaceId);
  if (resolved instanceof Response) return resolved;

  // Per user, not per workspace: each call makes the server send a signed request to an external URL.
  const limited = await applyRateLimitOrRespond(
    rateLimitConfigs.actions.webhookTest,
    resolved.userId,
    context
  );
  if (limited) return limited;

  const discord = refuseDiscordUrl(body.url, context);
  if (discord) return discord;

  const tested = await runRefusable(context, () => testEndpoint(body.url, resolved.secret));
  if (tested instanceof Response) return tested;

  return successResponse<TWebhookTestDeliveryResource>({ secret: resolved.secret ?? null }, { requestId });
}
