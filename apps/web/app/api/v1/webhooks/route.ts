import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { createWebhook, getWebhooks } from "@/app/api/v1/webhooks/lib/webhook";
import { ZWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
import { handleApiError } from "@/app/lib/api/handle-api-error";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

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
        response: responses.successResponse(webhooks),
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
    const resolved = await resolveBodyIds(webhookInput, authentication.workspacePermissions, "POST");
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
      !hasPermission(authentication.workspacePermissions, workspaceId, "POST")
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

      return {
        response: responses.successResponse(webhook),
      };
    } catch (error) {
      return handleApiError(error);
    }
  },
  action: "created",
  targetType: "webhook",
});
