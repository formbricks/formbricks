import { createWebhook, getWebhooks } from "@/app/api/v1/webhooks/lib/webhook";
import { ZWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { TApiAuditLog, TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";

export const GET = withV1ApiWrapper({
  handler: async ({ authentication }: { authentication: NonNullable<TApiKeyAuthentication> }) => {
    try {
      const environmentIds = authentication.environmentPermissions.map(
        (permission) => permission.environmentId
      );
      const webhooks = await getWebhooks(environmentIds);
      return {
        response: responses.successResponse(webhooks),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        return {
          response: responses.internalServerErrorResponse(error.message),
        };
      }
      throw error;
    }
  },
});

export const POST = withV1ApiWrapper({
  handler: async ({
    req,
    auditLog,
    authentication,
  }: {
    req: NextRequest;
    auditLog: TApiAuditLog;
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    const webhookInput = await req.json();
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

    const environmentId = inputValidation.data.environmentId;
    if (!environmentId) {
      return {
        response: responses.badRequestResponse("Environment ID is required"),
      };
    }

    if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    try {
      const webhook = await createWebhook(inputValidation.data);
      auditLog.targetId = webhook.id;
      auditLog.newObject = webhook;

      return {
        response: responses.successResponse(webhook),
      };
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      }
      if (error instanceof DatabaseError) {
        return {
          response: responses.internalServerErrorResponse(error.message),
        };
      }
      throw error;
    }
  },
  action: "created",
  targetType: "webhook",
});
