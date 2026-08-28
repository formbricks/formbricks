import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { createWebhook, getWebhooks } from "@/app/api/v1/webhooks/lib/webhook";
import { ZWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
import { handleApiError } from "@/app/lib/api/handle-api-error";
import {
  addLegacyEnvironmentIdBestEffort,
  addLegacyEnvironmentIdToList,
} from "@/app/lib/api/legacy-environment-id";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { hasApiKeyWorkspaceAccess } from "@/modules/organization/settings/api-keys/lib/utils";

export const GET = withV1ApiWrapper({
  handler: async ({ authentication }: THandlerParams) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    try {
      const workspaceIds = [
        ...new Set(authentication.workspacePermissions.map((permission) => permission.workspaceId)),
      ];
      const webhooks = await getWebhooks(workspaceIds);
      return {
        response: responses.successResponse(await addLegacyEnvironmentIdToList(webhooks)),
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
});

export const POST = withV1ApiWrapper({
  handler: async ({ req, auditLog, authentication }: THandlerParams) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    let webhookInput;
    try {
      webhookInput = await parseJsonBodyWithLimit<Record<string, unknown>>(req);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return {
          response: responses.payloadTooLargeResponse("Payload Too Large", { error: error.message }),
        };
      }

      return {
        response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
      };
    }

    // Accept workspaceId as alternative to environmentId
    const resolved = await resolveBodyIds(webhookInput, authentication, "POST");
    if (!resolved.ok) return { response: resolved.response };
    webhookInput = resolved.body;

    const inputValidation = ZWebhookInput.safeParse(webhookInput);

    if (!inputValidation.success) {
      return {
        response: responses.badRequestResponse(
          "Fields are missing or incorrectly formatted",
          transformErrorToDetails(inputValidation.error),
          true
        ),
      };
    }

    const { workspaceId } = inputValidation.data;

    if (
      !resolved.alreadyAuthorized &&
      !(await hasApiKeyWorkspaceAccess(authentication, workspaceId, "POST"))
    ) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    try {
      const webhook = await createWebhook(inputValidation.data);
      if (auditLog) {
        auditLog.targetId = webhook.id;
        auditLog.newObject = webhook;
      }

      // Best-effort, not strict: the insert has committed by now, and a failed workspace lookup here
      // (e.g. a P2024 pool timeout on the helper's own connection checkout) would surface as a 500 for
      // a webhook that exists. Zapier retries on that, and `Webhook` has no uniqueness on
      // `(url, workspaceId)`, so the retry would silently create a second subscription and duplicate
      // every delivery.
      return {
        response: responses.successResponse(await addLegacyEnvironmentIdBestEffort(webhook)),
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  action: "created",
  targetType: "webhook",
});
