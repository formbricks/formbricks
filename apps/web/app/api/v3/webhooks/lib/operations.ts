import "server-only";
import { v7 as uuidv7 } from "uuid";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { type TV3WorkspaceListParams, listV3WorkspaceResource } from "@/app/api/v3/lib/list-resource";
import {
  createdResponse,
  problemBadRequest,
  problemForbidden,
  problemUnprocessableContent,
  successResponse,
} from "@/app/api/v3/lib/response";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { WEBHOOK_DELIVERY_TIMEOUT_MS } from "@/lib/constants";
import { findNewlyAttachedNotWorkspaceVisibleSurveyIds } from "@/lib/survey/visibility/outbound";
import { validateWebhookUrl } from "@/lib/utils/validate-webhook-url";
import {
  WebhookDeliveryTimeoutError,
  sendSignedWebhookRequest,
} from "@/modules/integrations/webhooks/lib/send-signed-webhook";
import { isDiscordWebhook } from "@/modules/integrations/webhooks/lib/utils";
import { type TWebhookWithoutSecret, serializeV3Webhook } from "../serializers";
import type { TV3CreateWebhookBody, TV3UpdateWebhookBody, TV3WebhookTestResult } from "./schemas";
import {
  createWorkspaceWebhook,
  deleteWorkspaceWebhook,
  findWebhookById,
  findWorkspaceSurveyIds,
  getWebhookDeliveryTarget,
  listWorkspaceWebhooks,
  updateWorkspaceWebhook,
} from "./service";

type TBaseParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
};

/** How many offending survey ids a 422 names, so the problem document stays small. */
const MAX_REPORTED_SURVEY_IDS = 20;

/** The body of the test delivery, identical to the one the app's "test endpoint" button always sent. */
const TEST_DELIVERY_BODY = JSON.stringify({ event: "testEndpoint" });

const operationLog = (params: TBaseParams, operation: string) =>
  logger.withContext({ requestId: params.requestId, operation });

/**
 * Every operation but create and list resolves the workspace from the webhook itself, never from the
 * request, so a caller cannot pair someone else's webhook id with a workspace they can reach. An unknown
 * webhook answers 403, not 404, so ids cannot be probed for existence.
 */
async function authorizeWebhook(
  webhookId: string,
  minPermission: "read" | "readWrite",
  { authentication, requestId, instance }: TBaseParams
): Promise<Response | { webhook: TWebhookWithoutSecret; organizationId: string }> {
  const webhook = await findWebhookById(webhookId);
  if (!webhook) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  const access = await requireV3WorkspaceAccess(
    authentication,
    webhook.workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  return { webhook, organizationId: access.organizationId };
}

/**
 * Why a URL cannot be a webhook target, or null when it can. The SSRF policy is the one deliveries use
 * (`validateWebhookUrl`: http(s) only, no private, loopback, link-local or metadata addresses, DNS checked),
 * so a URL accepted here is one the delivery worker will also send to.
 */
async function getUrlProblem(url: string): Promise<InvalidParam | null> {
  if (isDiscordWebhook(url)) {
    return { name: "url", reason: "Discord webhooks are currently not supported." };
  }

  try {
    await validateWebhookUrl(url);
    return null;
  } catch (error) {
    if (error instanceof InvalidInputError) return { name: "url", reason: error.message };
    throw error;
  }
}

/**
 * The 422 for surveys a webhook may not name, or null when all are fine. A survey of another workspace and
 * one that does not exist are the same answer. Visibility is only checked for surveys being newly attached:
 * a survey restricted after it was attached stays on the webhook (delivery skips it), so an unrelated edit
 * must not fail.
 */
async function getSurveyProblem(
  workspaceId: string,
  surveyIds: ReadonlyArray<string>,
  previousSurveyIds: ReadonlyArray<string>,
  { requestId, instance }: TBaseParams
): Promise<Response | null> {
  const unique = [...new Set(surveyIds)];
  const known = await findWorkspaceSurveyIds(workspaceId, unique);
  const unknown = unique.filter((surveyId) => !known.has(surveyId));
  if (unknown.length > 0) {
    return problemUnprocessableContent(requestId, "Some surveys do not exist in this workspace", {
      instance,
      invalid_params: unknown.slice(0, MAX_REPORTED_SURVEY_IDS).map((missingId) => ({
        name: "surveyIds",
        reason: "Survey not found in this workspace",
        code: "dangling_reference",
        missingId,
      })),
    });
  }

  const blocked = await findNewlyAttachedNotWorkspaceVisibleSurveyIds(unique, previousSurveyIds);
  if (blocked.length > 0) {
    return problemUnprocessableContent(
      requestId,
      "Outbound connections can only use surveys that are visible to the whole workspace",
      {
        instance,
        code: "survey_not_workspace_visible",
        invalid_params: blocked.slice(0, MAX_REPORTED_SURVEY_IDS).map((id) => ({
          name: "surveyIds",
          reason: `Survey ${id} is not visible to the whole workspace`,
        })),
      }
    );
  }

  return null;
}

const urlProblemResponse = (problem: InvalidParam, { requestId, instance }: TBaseParams): Response =>
  problemUnprocessableContent(requestId, "The webhook URL cannot be used", {
    instance,
    invalid_params: [problem],
  });

export function listV3Webhooks(params: TV3WorkspaceListParams): Promise<Response> {
  return listV3WorkspaceResource({
    ...params,
    resourceName: "webhooks",
    fetchAll: listWorkspaceWebhooks,
    serialize: serializeV3Webhook,
  });
}

export async function getV3Webhook(params: TBaseParams & { webhookId: string }): Promise<Response> {
  const { requestId } = params;

  try {
    const authorized = await authorizeWebhook(params.webhookId, "read", params);
    if (authorized instanceof Response) return authorized;

    return successResponse(serializeV3Webhook(authorized.webhook), { requestId });
  } catch (error) {
    return mapV3ThrownError(error, {
      log: operationLog(params, "webhooks.get"),
      requestId,
      instance: params.instance ?? "",
      operation: "webhooks.get",
    });
  }
}

export async function createV3Webhook(
  params: TBaseParams & { body: TV3CreateWebhookBody; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { body, auditLog, authentication, requestId, instance } = params;

  try {
    const access = await requireV3WorkspaceAccess(
      authentication,
      body.workspaceId,
      "readWrite",
      requestId,
      instance
    );
    if (access instanceof Response) return access;

    if (auditLog) auditLog.organizationId = access.organizationId;

    const surveyProblem = await getSurveyProblem(access.workspaceId, body.surveyIds, [], params);
    if (surveyProblem) return surveyProblem;

    const urlProblem = await getUrlProblem(body.url);
    if (urlProblem) return urlProblemResponse(urlProblem, params);

    const { secret, ...webhook } = await createWorkspaceWebhook(access.workspaceId, body);
    const resource = serializeV3Webhook(webhook);

    if (auditLog) {
      auditLog.targetId = webhook.id;
      // The audited object never carries the secret.
      auditLog.newObject = resource;
    }

    return createdResponse(
      { ...resource, secret },
      { requestId, location: `/api/v3/webhooks/${webhook.id}` }
    );
  } catch (error) {
    return mapV3ThrownError(error, {
      log: operationLog(params, "webhooks.create"),
      requestId,
      instance: instance ?? "",
      operation: "webhooks.create",
    });
  }
}

export async function updateV3Webhook(
  params: TBaseParams & { webhookId: string; body: TV3UpdateWebhookBody; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { webhookId, body, auditLog, requestId, instance } = params;

  try {
    const authorized = await authorizeWebhook(webhookId, "readWrite", params);
    if (authorized instanceof Response) return authorized;
    const { webhook, organizationId } = authorized;

    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = webhookId;
      auditLog.oldObject = serializeV3Webhook(webhook);
    }

    if (Object.values(body).every((value) => value === undefined)) {
      return problemBadRequest(requestId, "Send at least one field to change", {
        instance,
        invalid_params: [{ name: "body", reason: "Send at least one of name, url, triggers or surveyIds" }],
      });
    }

    if (body.surveyIds) {
      const surveyProblem = await getSurveyProblem(
        webhook.workspaceId,
        body.surveyIds,
        webhook.surveyIds,
        params
      );
      if (surveyProblem) return surveyProblem;
    }

    if (body.url) {
      const urlProblem = await getUrlProblem(body.url);
      if (urlProblem) return urlProblemResponse(urlProblem, params);
    }

    const updated = serializeV3Webhook(await updateWorkspaceWebhook(webhook.workspaceId, webhookId, body));
    if (auditLog) auditLog.newObject = updated;

    return successResponse(updated, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, {
      log: operationLog(params, "webhooks.update"),
      requestId,
      instance: instance ?? "",
      operation: "webhooks.update",
    });
  }
}

export async function deleteV3Webhook(
  params: TBaseParams & { webhookId: string; auditLog?: TV3AuditLog }
): Promise<Response> {
  const { webhookId, auditLog, requestId, instance } = params;

  try {
    const authorized = await authorizeWebhook(webhookId, "readWrite", params);
    if (authorized instanceof Response) return authorized;

    if (auditLog) {
      auditLog.organizationId = authorized.organizationId;
      auditLog.targetId = webhookId;
    }

    const deleted = await deleteWorkspaceWebhook(authorized.webhook.workspaceId, webhookId);
    if (auditLog) auditLog.oldObject = serializeV3Webhook(deleted);

    return successResponse({ id: webhookId }, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, {
      log: operationLog(params, "webhooks.delete"),
      requestId,
      instance: instance ?? "",
      operation: "webhooks.delete",
    });
  }
}

/**
 * What a receiver's answer means for a test delivery. A redirect is a failure: deliveries never follow one
 * unless the operator allowed internal URLs, so "it answered 301" does not prove the real send works.
 */
const describeTestStatus = (statusCode: number): TV3WebhookTestResult => {
  if (statusCode >= 200 && statusCode < 300) return { delivered: true, statusCode, error: null };
  if (statusCode >= 300 && statusCode < 400) {
    return {
      delivered: false,
      statusCode,
      error: "The endpoint answered with a redirect, which is not followed",
    };
  }
  return { delivered: false, statusCode, error: `The endpoint answered HTTP ${statusCode}` };
};

/**
 * Sends one signed test event to the webhook's stored URL, through the same transport as real deliveries
 * (SSRF validation, DNS pinning, signing, redirect policy, timeout). It only ever targets the stored URL,
 * so it cannot be used to make the server call an address that was never accepted as a webhook target.
 * Not audited: it changes nothing. A refused or failed delivery answers 200 with `delivered: false`.
 */
export async function testV3Webhook(params: TBaseParams & { webhookId: string }): Promise<Response> {
  const { webhookId, requestId, instance } = params;
  const log = operationLog(params, "webhooks.test");

  try {
    const authorized = await authorizeWebhook(webhookId, "readWrite", params);
    if (authorized instanceof Response) return authorized;

    const target = await getWebhookDeliveryTarget(authorized.webhook.workspaceId, webhookId);
    if (!target) {
      return problemForbidden(requestId, "You are not authorized to access this resource", instance);
    }

    if (isDiscordWebhook(target.url)) {
      return successResponse<TV3WebhookTestResult>(
        { delivered: false, statusCode: null, error: "Discord webhooks are currently not supported." },
        { requestId }
      );
    }

    try {
      const { statusCode } = await sendSignedWebhookRequest({
        url: target.url,
        secret: target.secret,
        body: TEST_DELIVERY_BODY,
        messageId: uuidv7(),
      });
      return successResponse(describeTestStatus(statusCode), { requestId });
    } catch (error) {
      log.warn({ err: error, webhookId }, "V3 webhook test delivery failed");

      let message = "The endpoint could not be reached";
      if (error instanceof InvalidInputError) {
        message = error.message;
      } else if (error instanceof WebhookDeliveryTimeoutError) {
        message = `The endpoint did not answer within ${Math.round(WEBHOOK_DELIVERY_TIMEOUT_MS / 1000)} seconds`;
      }
      return successResponse<TV3WebhookTestResult>(
        { delivered: false, statusCode: null, error: message },
        { requestId }
      );
    }
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "webhooks.test",
    });
  }
}
